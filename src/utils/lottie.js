'use strict';
const stringRandom = require('./stringRandom');
const {
    webImage2Base64,
} = require('./base64')

function log(...args) {

      console.log('\x1B[32m%s\x1B[0m', '===log===', ...args);
}


function getLottieBasicInfo(lottie) {
    const { w, h, ip, op, fr } = lottie;
    return {
        width: w,
        height: h,
        totalFrames: op - ip,
        fps: fr,
    };
}

async function loadAssetsPic(lottie) {
    await Promise.all(lottie.assets.map(async asset => {
        if (asset.p&&asset.p.startsWith('http')) {
            asset.p = await webImage2Base64(asset.p);
        }
        return true;
    }));
}
function formatFrame(frame, n = 5) {
    return (new Array(n).fill(0).join('') + frame).slice(-1 * n);
}

function parseModifyRules(rules, lottie) {
    if (!(rules && rules.length)) return;
    const { fr: fps, op: lop, ip: lip } = lottie;
    rules.forEach(rule => {
        const { type, assetId, path } = rule;
        const name = stringRandom(5) + '-' + type;
        rule.name = name;
        lottie.assets.some(asset => {
            if (asset.id === assetId) {
                rule.sw = asset.w;
                rule.sh = asset.h;
                return true;
            }
            return false;
        });
        const item = getItembyPath(lottie, path, 'layers');

        if (type === 'video' || type === 'image') {

            const { ip, op } = item;
            rule.op = Math.min(op, lop);
            rule.id = Math.max(ip, lip);
        } else if (type === 'text') {
            // TODO
            const k = getItembyPath(item, 't.d.k');

            const textData = k[0];
            rule.textData = textData;

            formatTextData(rule);

        }
        return rule;
    });

}
function formatTextData(rule) {
    const { textData } = rule;
    const s = textData.s;
    s.fFamily = rule.fFamily;

    s.fStyle = 'regular';
    s.fWeight = s.fWeight || 500;
    s.f = `${rule.fFamily}_${s.fWeight}_${s.fStyle}`;
    if (rule.text) s.t = rule.text;
}
function getItembyPath(ob, path, key) {
    return path.split('.').reduce((pre, cur) => (key ? pre[key] : pre)[cur], ob);
}

module.exports = {
    loadAssetsPic,
    getLottieBasicInfo,
    getItembyPath,
    formatFrame,
    parseModifyRules,
    log,
    formatTextData,
};
