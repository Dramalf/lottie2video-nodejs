const lottie = require('lottie-nodejs');
const path = require('path');
const fs=require('fs/promises');
const stringRandom = require('./utils/stringRandom');
const FfmpegCommand = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg');
const ffprobe = require('@ffprobe-installer/ffprobe');
const { writeFile } = require('fs').promises;
const { Canvas, Image } = require('canvas');
const { request } = require('urllib');

// const mock = require('./mock/task.json');

const {
    loadAssetsPic,
    getLottieBasicInfo,
    formatFrame,
    parseModifyRules,
    log,
    getItembyPath,
} = require('./utils/lottie');
const { CommandDecorator } = require('./utils/command');
// const {
//     requestTTSServe,
// } = require('../utils/tts');
const {
    createDir,
    deleteDir,
} = require('./utils/file');
const {
    formatChars,
} = require('./utils/char');
const { url } = require('inspector');

FfmpegCommand.setFfmpegPath(ffmpegPath.path);
FfmpegCommand.setFfprobePath(ffprobe.path);

lottie.setCanvas({
    Canvas,
    Image,
});

class LottieRecorder {
    bindTaskDir(path) {
        this.taskDir = path;
        return this;
    }
    bindOutputDir(path){
        this.outputDir=path;
        return this;
    }
    async lottieToVideo(taskFile) {
        const curTime = new Date().getTime();
        const projectName = 'l2v-' + stringRandom(4);
        await createDir(path.join(this.outputDir, projectName));
        try {
            const { scripts, bg, subtitles } = taskFile;
            const lottieList = await this.getAllLottieObj(scripts);
            // 基础片段信息
            const { w: videoW, h: videoH, fr: fps } = lottieList[0];
            let templateTotalFrames = 0;

            for (let i = 0; i < scripts.length; i++) {
                const script = scripts[i];
                const lottie = lottieList[i];
                script.lottie = lottie;
                script.basicLottieInfo = getLottieBasicInfo(lottie);
                templateTotalFrames += script.basicLottieInfo.totalFrames;
                let startFrame = 0;
                if (i !== 0) {
                    const lastScript = scripts[i - 1];
                    const lastScriptStartFrame = lastScript.startFrame;
                    const lastScriptTotlaFrame = lastScript.basicLottieInfo.totalFrames;
                    startFrame = lastScriptTotlaFrame + lastScriptStartFrame;
                }
                script.startFrame = startFrame;
            }
            const scriptTasks = scripts.map(async script => {
                const { lottie, change, basicLottieInfo: { totalFrames }, startFrame } = script;
                parseModifyRules(change, lottie);
                const initTasks = [
                    loadAssetsPic(lottie),
                    this.video2frames(change, projectName),
                    formatChars(change, lottie,this.taskDir),
                ];
                await Promise.all(initTasks);
                await this.drawAndSplit(lottie, change, { width: videoW, height: videoH, totalFrames, startFrame, projectName });
            });
            const loadBgmTask = this.loadBgm(bg.bgm, projectName);
            const bgCropTask = this.cropBgVideo(bg.url, { sw: videoW, sh: videoH, st: 0, d: templateTotalFrames / fps }, projectName);
            // const ttsTask = this.requestTTS(props.subtitles || subtitles, projectName);
            await Promise.all([...scriptTasks, bgCropTask, loadBgmTask]);
            await this.overlayBgVideoAndLottie({
                projectName,
                d: templateTotalFrames / fps,
                hasBgVideo: !!(bg && bg.type === 'video'),
                subtitles: subtitles,
            });
            const cost = new Date().getTime() - curTime;
            log('===finish all tasks===', cost);


        } catch (error) {
            log('catch error', error);
            deleteDir(path.join(this.outputDir, projectName));
            return {
                success: false,
                error,
            };
        }

    }
    async loadBgm(bgm, projectName) {
        const command = new FfmpegCommand();
        console.log(path.join(this.taskDir, bgm),'bbbb')
        const url = bgm.startsWith('http') ? bgm : path.join(this.taskDir, bgm);
        command.addInput(url).output(path.join(this.outputDir, projectName, 'bgm.mp3'));
        return new Promise((resolve, reject) => {
            command.on('end', resolve);
            command.on('error', reject);
            command.run();
        });
    }
    async requestTTS(subtitles, projectName) {
        const ttsDir = path.join(this.outputDir, projectName, 'tts');
        await createDir(ttsDir);
        if (!(subtitles && subtitles.length)) return;
        return Promise.all(subtitles.map(subtitle => {
            const ttsName = stringRandom(4);
            subtitle.ttsName = ttsName;
            return requestTTSServe({ text: subtitle.text, audioSaveFile: path.join(ttsDir, `${ttsName}.wav`) })
                .then(duration => {
                    subtitle.duration = duration;
                });
        }));
    }
    async getAllLottieObj(lotties) {

        const jsons = await Promise.all(lotties.map(lo => {
            if (lo.url.startsWith('http'))
                return request(lo.url).then(res => res.data);
            else
                return fs.readFile(path.join(this.taskDir, lo.url))
        }));
        return jsons.map(JSON.parse);
    }
    async overlayBgVideoAndLottie({ projectName, d, hasBgVideo, subtitles = [] }) {
        const ct = new Date().getTime();
        const bgVideoPath = path.join(this.outputDir, `${projectName}/bg.mp4`);
        const bgmPath = path.join(this.outputDir, `${projectName}/bgm.mp3`);
        const hasSubtitles = subtitles && subtitles.length;
        const tempLottieSplitsDir = path.join(this.outputDir, `${projectName}/temp/lottieSplits/%05d.png`);
        const deafultTTFDir = path.join(this.taskDir, 'SmileySans-Oblique.ttf');
        const wavDir = path.join(this.outputDir, projectName, 'tts');
        const command = new FfmpegCommand();

        subtitles.forEach((subtitle, index) => {
            if (!subtitle.duration) subtitle.duration = subtitle.text.length * 0.261;
            const startTime = subtitles.slice(0, index).reduce((pre, cur) => {

                return pre + cur.duration + 0.5
            }, 0.5);
            subtitle.startTime = startTime;
        });
        const commandFormater = new CommandDecorator();

        commandFormater
            .setBgVideoPath(bgVideoPath)
            .setDuration(d)
            .setBgMusicPath(bgmPath)
            .setBgvMute()
            .setLottieSplitsPath(tempLottieSplitsDir)
            .setSubTitles(subtitles, {
                ttfPath: deafultTTFDir,
            })
        // .setTTSPath(wavDir, subtitles);
        const inputs = commandFormater.getInputs();
        const filterText = commandFormater.getFilters();
        const outputOptions = commandFormater.getOutputOptions();
        log(filterText)
        inputs.forEach(i => {
            log(i);
            command.addInput(i);
        });
        command.inputFPS(25);
        command.complexFilter(filterText);
        command.withOutputOptions(outputOptions);
        command.output(path.join(this.outputDir, `${projectName}/res.mp4`));
        await new Promise((resolve, reject) => {
            command.on('error', reject)
                .on('end', resolve)
                .run();
        });

        log('overlayBgVideoAndLottie cost', new Date().getTime() - ct);
    }
    async cropBgVideo(vurl, payload, projectName) {
        if (!vurl) return;
        const ct = new Date().getTime();
        const { sw, sh, st, d } = payload;
        const command = new FfmpegCommand();
        const HWR = sh / sw;
        const url = vurl.startsWith('http') ? vurl : path.join(this.taskDir, vurl);
        await new Promise((resolve, reject) => {
            command
                .addInput(url)
                .videoFilters(
                    `crop='w=if(gt(${HWR},ih/iw),ih/${HWR},iw):h=if(gt(${HWR},ih/iw),ih,iw*${HWR})'`,
                    `scale=${sw}:${sh}`
                )
                .withOutputOptions('-ss', st, '-t', d)
                .output(path.join(this.outputDir, `${projectName}/bg.mp4`))
                .on('end', resolve)
                .run();
        });
        log('cropBgVideo cost', new Date().getTime() - ct);
    }

    async drawAndSplit(lottieObj, edits = [], { totalFrames, width, height, startFrame, projectName }) {
        const ct = new Date().getTime();
        log('draw from ', startFrame, '   ---to--', totalFrames + startFrame);
        const canvas = new Canvas(width, height);
        let frame;

        const tempLottieSplitsDir = path.join(this.outputDir, `${projectName}/temp/lottieSplits`);

        await createDir(tempLottieSplitsDir, false);
        const anim = lottie.loadAnimation({
            container: canvas,
            renderer: 'canvas',
            loop: true,
            animationData: lottieObj,
        });
        for (frame = 0; frame < totalFrames; frame++) {
            // eslint-disable-next-line no-loop-func
            edits.forEach(edit => {
                const { name, path: itemPath, type } = edit;
                if (type !== 'video') return;
                const vframesDir = path.join(this.outputDir, `${projectName}/temp/vframes/${name}`);
                const item = getItembyPath(anim.renderer, itemPath, 'elements');
                item.img.src = localImage2Base64(`${vframesDir}/${formatFrame(frame + 1, 5)}.jpeg`);
            });
            anim.goToAndStop(frame, true);
            const buffer = canvas.toBuffer('image/png', { compressionLevel: 3, filters: canvas.PNG_FILTER_NONE });
            const picPath = path.join(tempLottieSplitsDir, `${formatFrame(frame + startFrame, 5)}.png`);
            await writeFile(picPath, buffer);
        }
        anim.destroy();
        log('drawAndSplit cost', new Date().getTime() - ct);
    }

    async video2frames(edits, projectName) {
        const ct = new Date().getTime();
        if (!(edits && edits.length)) return;
        await Promise.all(edits.map(async edit => {
            const { type, url, st, sw, sh, cw, ch, op, name } = edit;
            if (type === 'video') {
                const command = new FfmpegCommand();
                const vframesDir = path.join(this.outputDir, `${projectName}/temp/vframes/${name}`);
                await createDir(vframesDir);
                await new Promise((resolve, reject) => {
                    command
                        .addInput(url)
                        .videoFilters(
                            `scale=${sw}:${sh}`
                        )
                        .withOutputOptions('-ss', st, '-vframes', op)
                        .output(`${vframesDir}/%05d.jpeg`)
                        .withOutputOptions('-qscale:v 2')
                        .on('end', resolve)
                        .run();
                });

            }
            return true;
        }));
        log('video2frames cost', new Date().getTime() - ct);
    }
}
module.exports = LottieRecorder;