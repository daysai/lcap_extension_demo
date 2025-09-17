(function () {
  // 修改为自己的项目名称
  const appName = 'testaizcy';
  // 业务组件黑名单，可以补充希望过滤的业务组件名称，否则默认全部生成
  const blackList = [];

  const pcFrontend = $data.app.frontendTypes.find((item) => item.name === 'pc');
  const componentsJSON = [];
  pcFrontend.businessComponents.forEach((component) => {
    if (!component?.name) return;
    if (blackList.includes(component.name)) return;

    // 判断 name 属性，如果是 lcap_ 开头的，直接使用原 name，如果不是，加上 lcap_ 前缀
    const componentName = component.name.startsWith('lcap_') ? component.name : `lcap_${component.name}`;

    // $logics['app.logics.x'] 替换为 $logics['sharedApp.${appName}.logics.x']
    // app.dataSources 替换为 sharedApp.${appName}.dataSources
    const sourceCode = component.toVue()
      .replace(/\$logics\['app\.logics\.([^']+)'\]/g, `$logics['sharedApp.${appName}.logics.$1']`)
      .replace(/app\.dataSources/g, `sharedApp.${appName}.dataSources`);
    componentsJSON.push({
      name: componentName,
      sourceCode,
      nasl: component.toJSON(),
    });
    console.log(componentsJSON);
  });

  if (!componentsJSON.length) {
    console.log('没有需要生成的组件，程序退出！');
    return;
  }

  // 下载 JSON 文件
  (function downloadJSON(data, filename = 'components.json') {
    try {
      // 将数据转换为 JSON 字符串
      const jsonString = JSON.stringify(data, null, 2);
      // 创建 Blob 对象
      const blob = new Blob([jsonString], {
        type: 'application/json;charset=utf-8',
      });
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      // 设置下载属性
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      // 添加到 DOM 并触发点击
      document.body.appendChild(link);
      link.click();
      // 清理资源
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(`✅ JSON 文件已下载: ${filename}`);
      return true;
    } catch (error) {
      console.error('❌ 下载失败:', error);
      return false;
    }
  })(componentsJSON);
})();