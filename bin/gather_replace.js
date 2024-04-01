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

const ToTranslateFilePath = './locale/toTranslated.ts'

// const chineseReg = /[\u4e00-\u9fa5]+/g // 不包括全角标点符号 ['注意啦', '安全', '是个']
const chineseReg = /[^\x00-\xff]/ // 包括全角标点符号 ['注意啦，安全！', '是个']
const FuncName = 't'
const ImportStr = `import { useTranslation } from 'react-i18next'`
const HooksStr = `const { t } = useTranslation()`

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

const gatherChinese = (value) => {
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
// 
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
    // plugins: [
    //   "@babel/plugin-transform-react-jsx",
    //   "@babel/plugin-transform-typescript",
    // ],
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
        // const importAst = template.ast`
        //   import { useTranslation } from 'react-i18next'
        // `;
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
        }
        // else if (path.findParent(p => p.isJSXExpressionContainer())) {
        //   //  <Input placeholder={ '请输入你的年龄3' + `${PageSize}` } />
        //   // const parentJSXExCon = node.findParent(p => p.isJSXExpressionContainer())
        //   let p = parentPath
        //   while (p) {
        //     if (t.isTemplateLiteral(p)) {
        //       return
        //     }
        //     p = p.parentPath
        //   }
        //   const quasisItem = t.templateElement(
        //     {
        //         raw: '',
        //         cooked: '',
        //     },
        //     false,
        //   )
        //   const quasis = [quasisItem, quasisItem]
        //   const expressions = [t.Identifier(node.value)]
        //   // path.replaceWith(t.templateLiteral(node))
        //   path.replaceWith(t.templateLiteral(quasis, expressions))
          // }
          // }
        // else if (path.parentPath.node.name === 'expression') {
          else if (t.isBinaryExpression(path.parentPath.node) || t.isConditionalExpression(path.parentPath.node)) {
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
        // 错误处理：path.replaceWithSourceString(`{${FuncName}('${node.value}')}`)
        // jsxText处理后，如果是replaceWithSourceString，会处理成字符串"translate('11今日面试')"
        // 这样有两个问题
        // 1.应该处理成JsxExpressionContainer，而不是StringLiteral
        // 2.错误处理成StringLiteral后，会被StringLiteral这个visitor重复处理，
        //   但是StringLiteral这个visitor中并没有对parentPath为JsxExpressionContainer的case进行排除
        // path.replaceWithSourceString(`{${FuncName}('${node.value}')}`)
        // path.replaceWith(t.jsxExpressionContainer(t.callExpression(t.identifier(FuncName), [t.stringLiteral(node.value)])))
        // replaceWithJsxExpression(path, FuncName, node.value)
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
    // TemplateElement(path) {
    //   const {node, parentPath} = path
    //   if (includesChinese(node.value.raw)) {
    //     console.log('----TemplateElement-----', node.value, `${FuncName}('${node.value}')`)
    //     if (parentPath.node.type === 'TemplateLiteral') {
    //       const { expressions, quasis } = parentPath.node
    //       let countExpressions = 0;
    //       quasis.forEach((node, index) => {
    //         const {} =
    //       })
    //     }
    //     // const aa = t.jsxExpressionContainer(t.callExpression(t.identifier(FuncName), [t.stringLiteral(node.value.raw)]))
    //     // console.log('-aa-', aa)
    //     // replaceWithJsxExpression(path, FuncName, node.value.raw)

    //     //path.replaceWithSourceString(`${FuncName}('${node.value}')`)
    //   }
    // }
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
    // ReturnStatement(path) {
    //   const parentFunctionPath = path.findParent(p => p.isArrowFunctionExpression() || p.isFunctionExpression())
    //   if (parentFunctionPath === path.getFunctionParent()) {
    //     console.log("找到最外层的 return:") // , path.node.argument
    //     const { parent } = path
    //     const hooksAst = template.ast`${HooksStr}`
    //     parent.body.unshift(hooksAst)
    //   }

    //   // const { parent } = path
    //   // const { body } = parent
    //   // const hooksAst = template.ast `${HooksStr}`
    //   // body.unshift(hooksAst)
    //   // todo ?????? 
    //   // body.unshift(
    //   //   babelParser.parse('const { t } = useTranslation()').program.body[0],
    //   // );
    // }
  })
//   todo: 在这里gatherChinese
  const res = generator(ast)
  return res
}
module.exports = {
    getNewContent
}




