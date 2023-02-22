const path = require('path');
const LottieRecorder = require('./src');
const task = require('./mock/task.json')
const resourceDir = path.join(__dirname, 'mock');
const resultDir=path.join(__dirname,'result');
new LottieRecorder().bindTaskDir(resourceDir).bindOutputDir(resultDir).lottieToVideo(task);