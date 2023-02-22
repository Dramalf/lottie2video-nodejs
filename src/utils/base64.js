const fs = require('fs');
const https = require('https');
const path = require('path');
async function webImage2Base64(url) {
    let base64Img;
    return new Promise(function (resolve, reject) {
      const req = https.get(url, function (res) {
        const chunks = [];
        let size = 0;
        res.on('data', function (chunk) {
          chunks.push(chunk);
          size += chunk.length; // 累加缓冲数据的长度
        });
        res.on('end', function (err) {
          const data = Buffer.concat(chunks, size);
          base64Img = 'data:image/png;base64,' + data.toString('base64');
          resolve(base64Img);
        });
      });
      req.on('error', e => {
        resolve({ success: false, errmsg: e.message });
      });
      req.end();
    });
  }
  function localImage2Base64(url) {
    const bitmap = fs.readFileSync(url);
    const type = url.match(/(png|jpg|jpeg)$/g)[0];
    const base64str = `data:image/${type};base64,` + Buffer.from(bitmap, 'binary').toString('base64');
  
    return base64str;
  }

  module.exports = {
    webImage2Base64,
    localImage2Base64,
  };