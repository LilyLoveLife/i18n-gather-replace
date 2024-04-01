
const fs =require('fs')
const path = require('path');

// 收集相关
let flag_garther = false
const toTranslateSet = new Set()

// 替换相关
const fileTypeList = ['.tsx', '.ts']


const dealFile = (filePath) => {
    const fileName = path.basename(filePath);
    const fileName_without_extension = path.parse(filePath).name
    const extension = path.parse(filePath).ext
    const newFileName = `${fileName_without_extension}_translated${extension}`
    
    const parentDir = path.dirname(filePath);
    const newFilePath = path.join(parentDir, newFileName);
  
    if (fileTypeList.includes(path.extname(filePath))) {
      const newContent = getNewContent(filePath)
      // 写入新内容到文件
      fs.writeFile(newFilePath, newContent.code, 'utf8', (writeErr) => {
        if (writeErr) {
          console.error(writeErr);
          return writeErr
        }
        console.log('文件内容已修改。');
        return true
      });
    }
}
async function readFilesInDirectory(directoryPath) {
    const stats = fs.statSync(directoryPath);
    if (stats.isFile()) {
      console.log('是一个文件');
      dealFile(directoryPath)
    } else {
      console.log('是一个目录');
      const files = fs.readdirSync(directoryPath);
   
      for (const childFile of files) {
        const childFilePath = path.join(directoryPath, childFile);
        readFilesInDirectory(childFilePath)
      }
    }
}
module.exports = readFilesInDirectory