const fs = require('fs-extra');
const path = require('path');
const { camelCase, kebabCase, upperFirst } = require('lodash');

const componentsJSON = require('./components.json');
const packageJSON = require('../package.json');

const COMPONENTS_FOLDER = 'src/components';

function copy(sourceFolder, destinationFolder, replaceList) {
  if (!fs.existsSync(sourceFolder)) {
    return;
  }

  if (!fs.existsSync(destinationFolder)) {
    fs.mkdirSync(destinationFolder, { recursive: true });
  }

  fs.readdirSync(sourceFolder).forEach((file) => {
    const sourceFilePath = path.resolve(sourceFolder, file);
    const destinationFilePath = path.resolve(destinationFolder, file);
    if (fs.lstatSync(sourceFilePath).isDirectory()) {
      copy(sourceFilePath, destinationFilePath, replaceList);
    } else {
      let content = fs.readFileSync(sourceFilePath, 'utf-8').toString();

      replaceList.forEach(({ reg, text }) => {
        content = content.replace(reg, text);
      });

      fs.writeFileSync(destinationFilePath, content, 'utf-8');
    }
  });
}

function getTagName(framework, name) {
  return framework.startsWith('vue') ? kebabCase(name) : name;
}

// 精准匹配并清理 mixins 数组
function cleanMixinsArray(text) {
  // 精确匹配 mixins: [ ... ] 结构
  const mixinsRegex = /(mixins:\s*)\[([\s\S]*?)\]/g;
  return text.replace(mixinsRegex, (match, prefix, content) => {
    // 清理方括号内的空格和换行
    const cleaned = content
      .replace(/\s+/g, ' ') // 所有空白字符替换为单个空格
      .trim(); // 移除首尾空格
    return `${prefix}window.$mixins ? [${cleaned}] : []`;
  });
}

// 精确匹配所有 return this.__getOrCreateDataSource( ，并在前面加上判断 this.__getOrCreateDataSource 是否存在
function handleGetOrCreateDataSource(text) {
  const getOrCreateDataSourceRegex = /(return\s+this\.__getOrCreateDataSource\()/g;
  return text.replace(getOrCreateDataSourceRegex, (match, prefix) => {
    return `if (!this.__getOrCreateDataSource) return;\n${prefix}`;
  })
}

// 精确匹配所有 meta: { ... } 结构，整体替换成 name: ${tagName}
function handleMeta(text, tagName) {
  const metaRegex = /(meta:\s*\{([\s\S]*?)\})/g;
  return text.replace(metaRegex, () => {
    return `name: '${tagName}'`;
  })
}

function createComponent(rootPath, metaInfo, options) {
  const templateFolder = path.resolve(__dirname, `${metaInfo.framework}-component`);
  if (!fs.existsSync(templateFolder)) {
    throw new Error(`未找到 ${metaInfo.framework} 组件模板`);
  }

  const compName = upperFirst(camelCase(options.name));
  const tagName = getTagName(metaInfo.framework, compName);

  const componentFolder = path.resolve(rootPath, COMPONENTS_FOLDER, tagName);

  if (fs.existsSync(componentFolder)) {
    // 组件已存在，直接删除
    fs.removeSync(componentFolder);
    console.log(`组件目录 ${componentFolder} 已存在，删除后重新创建`);
  }

  let sourceCode = options.sourceCode;
  // 精准匹配并清理 mixins 数组
  sourceCode = cleanMixinsArray(sourceCode);
  // 预览兼容 __getOrCreateDataSource 方法
  sourceCode = handleGetOrCreateDataSource(sourceCode);
  // 精确匹配并替换 meta: { ... } 结构
  sourceCode = handleMeta(sourceCode, tagName);

  const replaceTextList = [
    {
      reg: /\{\{pkgName\}\}/g,
      text: metaInfo.name,
    },
    {
      reg: /\{\{tagName\}\}/g,
      text: tagName,
    },
    {
      reg: /\{\{compName\}\}/g,
      text: compName,
    },
    {
      reg: /\{\{title\}\}/g,
      text: options.title,
    },
    {
      reg: /\{\{description\}\}/g,
      text: options.title,
    },
    {
      reg: /\{\{type\}\}/g,
      text: options.type,
    },
    {
      reg: /\{\{compProps\}\}/g,
      text: options.props,
    },
    {
      reg: /\{\{compCode\}\}/g,
      text: sourceCode,
    },
  ];

  copy(templateFolder, componentFolder, replaceTextList);

  const componentIndexPath = path.resolve(rootPath, COMPONENTS_FOLDER, 'index.ts');

  if (!fs.existsSync(componentIndexPath)) {
    console.error(`未找到组件目录 ${componentIndexPath}`);
    return;
  }

  // 写入 import
  const content = fs.readFileSync(componentIndexPath, 'utf-8').toString();
  if (content.includes(`export { default as ${compName} } from './${tagName}';`)) {
    console.log(`组件 ${compName} 已存在，跳过注册导出`);
    return;
  }

  fs.writeFileSync(
    componentIndexPath,
    [
      ...content
        .toString()
        .split('\n')
        .filter((c) => !!c.trim()),
      `export { default as ${compName} } from './${tagName}';`,
      '',
    ].join('\n'),
    'utf-8'
  );
}

function main() {
  const cwd = process.cwd();
  const metaInfo = { framework: 'vue2', name: packageJSON.name };

  componentsJSON.forEach((component) => {
    const { name, nasl, sourceCode } = component;
    const compProps = nasl.params.map((param) => {
      const { name, title } = param;
      const textArr = [
        `@Prop({ title: '${name}', description: '${title || ''}', setter: { concept: 'InputSetter' }})`,
        `text: nasl.core.String = '';\n`
      ];
      return textArr.join('\n');
    });
    const options = {
      name,
      sourceCode,
      title: nasl.title,
      type: 'pc',
      props: compProps
    };
    try {
      createComponent(cwd, metaInfo, options);
      console.log(`创建组件 ${name} 成功`);
    } catch (error) {
      console.error(`创建组件 ${name} 失败`, error);
    }
  });
}
main();
