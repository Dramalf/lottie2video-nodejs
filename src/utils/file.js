const exec = require('child_process').exec;
async function deleteDir(dirname) {
    return new Promise((resolve, reject) => {
      exec(`rm -rf ${dirname}`, (err, stdout, srderr) => {
        if (err) {
          reject(srderr);
        } else {
          resolve(stdout);
        }
      });
    });
  }
  
  async function createDir(dirpath, deleteFirst = true) {
    if (deleteFirst) await deleteDir(dirpath);
    return new Promise((resolve, reject) => {
      exec(`mkdir -p ${dirpath}`, (err, stdout, srderr) => {
        if (err) {
          reject(srderr);
        } else {
          resolve(stdout);
        }
      });
    });
  
  }

  module.exports = {
    createDir,
    deleteDir,
  };
  