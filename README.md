# lottie2video-nodejs
lottie2video-nodejs


maybe you should first create a folder named "result";
then `node demo.js`
## TODO
replace .png temporary files by rgba raw data
``` node.js
//save as rgba raw file
const imageData = canvas.getContext('2d').getImageData(0, 0, w, h);
const { width, height, data } = imageData;
const rgbaArray = new Uint8Array(width * height * 4);
for (let i = 0; i < data.length; i++) {
  rgbaArray[i] = data[i];
}

fs.writeFileSync('./rgba/' + formatFrame(frame) + '.bin', Buffer.from(rgbaArray));

//ffmpeg composite
const ffmpeg = spawn("ffmpeg", [
  "-f", "rawvideo",
  "-video_size", `${w}x${h}`,
  "-pixel_format", "rgba",
  "-i", `concat:${Array(totalFrame).fill(0).map((_, index) => {
    return `./rgba/${formatFrame(index)}.bin`
  }).join('|')}`,
  "-c:v", "libx264",
  "-y",
  "-crf", "18",
  "-preset", "slow",
  "-f","mp4",
  "-movflags", "+faststart",
  "check.mp4"
]);
`
