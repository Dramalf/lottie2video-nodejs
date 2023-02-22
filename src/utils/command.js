const path = require('path');
class CommandDecorator {
    constructor() {
      this.hasBgv = false;
      this.hasBgm = false;
      this.hasLottie = false;
      this.hasSubtitles = false;
      this.hasTTS = false;
      this.muteBgv = false;
    }
    setBgVideoPath(path) {
      this.bgvPath = path;
      this.hasBgv = true;
      return this;
    }
    setBgMusicPath(path) {
      this.bgmPath = path;
      this.hasBgm = true;
      return this;
    }
    setLottieSplitsPath(path) {
      this.lottieSplitsPath = path;
      this.hasLottie = true;
      return this;
    }
    setSubTitles(subtitles, options) {
      this.subtitles = subtitles;
      this.subtitleOption = options;
      this.hasSubtitles = true;
      return this;
    }
    setTTSPath(path, subtitles) {
      this.ttsFilePath = path;
  
      this.tts = subtitles;
      this.hasTTS = true;
      return this;
    }
    setBgvMute() {
      this.muteBgv = true;
      return this;
    }
    setDuration(duration) {
      this.duration = duration;
      return this;
    }
    getInputs() {
      const _inputs = [];
      // 背景视频-背景音乐-lottie图片序列-tts语音
      this.hasBgv && _inputs.push(this.bgvPath);
      this.hasLottie && _inputs.push(this.lottieSplitsPath);
      this.hasBgm && _inputs.push(this.bgmPath);
      this.hasTTS && _inputs.push(...this.tts.map(s => path.join(this.ttsFilePath, s.ttsName + '.wav')));
      return _inputs;
    }
    getFilters() {
      let filters = '';
      let overlayFilters = '';
      let textFilters = '';
      let audioFilters = '';
      // 是否有两个图层需要重叠处理
      const needOverlay = this.hasBgv && this.hasLottie;
      // 讲解前的输入流数量
      const foreInputAccount = this.hasBgv + this.hasLottie + this.hasBgm;
      // 讲解前的音频输入数量
      let foreAudioAccount = 0;
      if (this.hasBgv && !this.muteBgv) foreAudioAccount++;
      if (this.hasBgm) foreAudioAccount++;
  
      if (this.hasSubtitles) {
        const streamBindTextIndex = needOverlay ? 1 : 0;
  
        const outStreamName = needOverlay ? 'pv' : 'outv';
        const drawTextCommand = this.subtitles.map(subtitle => {
          const { duration, text, startTime } = subtitle;
          const { ttfPath } = this.subtitleOption;
          return `drawtext=fontcolor=0xFFF6AA:fontsize=45:bordercolor=black:borderw=3:fontfile=${ttfPath}:line_spacing=7:text='${text}':x=(w-text_w)/2:y=(h-text_h)/6*5+10:enable='between(t\\,${startTime}\\,${startTime + duration})'`;
        }).join(',');
        textFilters = `[${streamBindTextIndex}:v]` + drawTextCommand + `[${outStreamName}];`;
        if (needOverlay) {
          overlayFilters = '[0:v][pv]overlay=0:0[outv];';
        } else {
          overlayFilters = '';
        }
      } else {
        if (needOverlay) {
          overlayFilters = '[0:v][1:v]overlay=0:0[outv];';
        } else {
          overlayFilters = '[0:v][outv];';
        }
      }
      if (this.hasTTS) {
        // 在需要讲解的情况下，输入为下  （背景视频声音和背景音乐声音不要共存）
        // 只有背景视频，不需要静音，无背景音乐
        // 只有背景视频，需要静音，有背景音乐
        // 有背景视频，有lottie，不需要静音，无背景音乐
        // 有背景视频，有lottie，需要静音，有背景音乐
        // 只有lottie，有背景音乐
        // 只有Lottie，无背景音乐
        let delayCommand = '';
        let amixCommand = '';
        // 定位到背景音乐/背景视频声音的index
        if (foreAudioAccount !== 0) amixCommand = `[${foreInputAccount - 1}]`;
  
        this.tts.forEach((audio, index) => {
          const { startTime } = audio;
          const audioIndex = index + foreInputAccount;
          delayCommand += `[${audioIndex}]adelay=${startTime * 1000}|${startTime * 1000},volume=6dB[del${audioIndex}];`;
          amixCommand += `[del${audioIndex}]`;
        });
        amixCommand += 'amix=' + (this.tts.length + foreAudioAccount) + '[outa];';
        audioFilters = delayCommand + amixCommand;
      } else {
        // 没有视频讲解时，输入为下
        // 只有背景视频，不需要静音，无背景音乐
        // 只有背景视频，需要静音，有背景音乐
        // 只有lottie，需要背景音乐
        // 只有lottie，无背景音乐
        // 有背景音乐，有lottie，不需要静音，
        if (this.hasBgv && !this.muteBgv) {
          audioFilters = '[0]volume=1[outa];';
        }
        if (this.hasBgm) {
          audioFilters = `[${foreInputAccount - 1}]volume=1[outa];`;
        }
  
      }
      filters = textFilters + overlayFilters + audioFilters;

      filters = filters.substring(0, filters.length - 1);
      return filters;
    }
    getOutputOptions() {
      return [
        '-map', '[outv]',
        '-map', '[outa]',
        '-ss', 0, '-t', this.duration,
        '-c:v', 'libx264',
        '-threads', '8',
        '-crf', '18',
        '-preset', 'veryfast',
        '-f', 'mp4',
      ];
    }
  }
  module.exports = {
    CommandDecorator,
  };
  