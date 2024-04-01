/* eslint-disable no-control-regex */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable import/no-extraneous-dependencies */
const babel = require('@babel/core')
const babelParser = require('@babel/parser')
const template = require('@babel/template').default
const t = require('@babel/types')


const traverse = require('@babel/traverse').default
const fs =require('fs')
const path = require('path');
const generator = require('@babel/generator').default
const ts = require('typescript');

// const chineseReg = /[\u4e00-\u9fa5]+/g // 不包括全角标点符号 ['注意啦', '安全', '是个']
const chineseReg = /[^\x00-\xff]/ // 包括全角标点符号 ['注意啦，安全！', '是个']
const fileTypeList = ['.tsx', '.ts']
const FuncName = 't'
const ImportStr = `import { useTranslation } from 'react-i18next'`
const HooksStr = `const { t } = useTranslation()`

const ToTranslateFilePath = './locale/toTranslated.ts'
const includesChinese = (str) => {
  return chineseReg.test(str)
}
const buildCallExpression = (funcName, nodeValue) => {
  return t.callExpression(t.identifier(funcName), [t.stringLiteral(nodeValue)])
}
const replaceWithJsxExpression = (path, funcName, nodeValue) => {
  path.replaceWith(t.jsxExpressionContainer(t.callExpression(t.identifier(funcName), [t.stringLiteral(nodeValue)])))
}
const isInConsole = (path) => {
  return path.findParent(p => p.isCallExpression()) && path.parent.callee.object.name === 'console'
}
let flag_garther = false
const toTranslateSet = new Set()
const patchChinese = (value) => {
  console.log('中文 ~ ', value);
  const filePath = path.join(__dirname, ToTranslateFilePath)
  // 检查文件是否存在于给定路径
  if (fs.existsSync()) {
    console.log('文件存在');
    if (!flag_garther) {
      flag_garther = true
      const fileContent = fs.readFileSync(filePath, 'utf8');
      // 编译文件
      const result = ts.transpileModule(fileContent, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS
        }
      });
      console.log('---11---', result)
    } else if (!toTranslateSet.has(value)) {
        toTranslateSet.add(value)
      }
  } else {
    console.error('文件不存在');
    const newObj = {
      [value]: ''
    }
    fs.writeFile(filePath, `export ${  JSON.stringify(newObj)}`, (err) => {
      if (err) {
        console.error('An error occurred:', err);
        return;
      }
      console.log('File created and content written!');

    });
  }


}
const getNewContent = (filePath) => {
  // 另一种实现： babelParser.parse
  // const code = fs.readFileSync(file1, 'utf8');
  // const ast = babelParser.parse(code, {
  //   sourceType: 'module', // default: "script"
  //   plugins: ['typescript', 'jsx'],
  // });
  // 一种实现： babel.transformFileSync
  const {ast} = babel.transformFileSync(filePath, {
    sourceType: 'module',
    parserOpts: {
      plugins: ['jsx', 'typescript'],
    },
    ast: true,
  })
  // 引入 import { useTranslation } from 'react-i18next';
  // const { t } = useTranslation();
  traverse(ast, {
    Program({node, parantPath}) {
      const importList = node.body.filter(item => item.type === 'ImportDeclaration')
      const imported = importList.find(item => {
        const source = item.source.value === 'react-i18next' // react-i18next
        const importedHooks = item.specifiers.find((item) => {
          if (item.type === 'ImportSpecifier') {
            return item.imported.name === 'useTranslation'
          }
          return false
        })
        return source && importedHooks
      })
      if (!imported) {
        const importAst = template.ast `${ImportStr}`
        node.body.unshift(importAst);
        // path.get('body').unshiftContainer(importAst)
      }
    },
    StringLiteral(path) {
      const { node, parentPath } = path
      if (includesChinese(node.value)) {
        const translated = parentPath?.node?.type === 'CallExpression' && parentPath.node.callee.name === FuncName
        if (translated) {
          return
        }

        if (parentPath.isJSXAttribute()) {
          path.replaceWith(t.jSXExpressionContainer(t.stringLiteral(node.value)))
          // path.replaceWithSourceString(`{${FuncName}('${node.value}')}`)
        } else if (t.isBinaryExpression(path.parentPath.node) || t.isConditionalExpression(path.parentPath.node)) {
            const quasisItem = t.templateElement(
              {
                  raw: node.value,
                  cooked: node.value,
              },
              false,
            )
          const quasis = [quasisItem]
          const expressions = []
          // const expressions = [t.Identifier(node.value)]
        // const expressions = [t.stringLiteral(node.value)]
        // path.replaceWith(t.templateLiteral(node))
        path.replaceWith(t.templateLiteral(quasis, expressions))
        }
        else {
          path.replaceWithSourceString(`${FuncName}('${node.value}')`)
        }
        // let curr = path
        // let isJSXExpressionContainer = false
      }
    },
    JSXText(path) {
      const {node} = path
      if (includesChinese(node.value)) {
        path.replaceWith(t.jSXExpressionContainer(t.stringLiteral(node.value)))
      }
    },
    TemplateLiteral(path) {
      const { expressions, quasis } = path.node
          let countExpressions = 0;
          quasis.forEach((node, index) => {
            const { value: { raw }, tail, } = node
            if (includesChinese(raw)) {
              console.log(raw)
              // const newCall = buildCallExpression(FuncName, raw)
              const newCall = t.stringLiteral(raw) // 先转成字符串，然后走StringLiteral的visitor
              expressions.splice(index + countExpressions, 0, newCall)
              countExpressions++
              node.value = {
                raw: '',
                cooked: '',
              }
              quasis.push(
                  t.templateElement(
                    {
                        raw: '',
                        cooked: '',
                    },
                    false,
                  ),
              );
            }
          })
          quasis[quasis.length - 1].tail = true;
    },
    ArrowFunctionExpression(path) {
      const parentFunctionPath = path.findParent(p => p.isArrowFunctionExpression() || p.isFunctionExpression())
      if (!parentFunctionPath) {
        const { parent } = path
        console.log("找到最外层的函数:", path.node) // , path.node.argument
        const hooksAst = template.ast`${HooksStr}`
        path.node.body.body.unshift(hooksAst)
      }
    },
    FunctionExpression(path) {
      const parentFunctionPath = path.findParent(p => p.isArrowFunctionExpression() || p.isFunctionExpression())
      if (!parentFunctionPath) {
        const { parent } = path
        // console.log("找到最外层的函数:", path.node) // , path.node.argument
        const hooksAst = template.ast`${HooksStr}`
        path.node.body.body.unshift(hooksAst)
      }
    },
  })
  const res = generator(ast)
  return res
}
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
const projectRoot = process.cwd()

const aa = path.join(__dirname, 'src/test/index.tsx');
const bb = path.join(projectRoot, './test/index.tsx');

const dirPath = path.join(projectRoot, './src/test/index.tsx');
// const dirPath = path.join(__dirname, 'src/test');

readFilesInDirectory(dirPath)
// const file = path.join(__dirname, 'src/test/index.tsx');
// const result = getNewContent(file)


