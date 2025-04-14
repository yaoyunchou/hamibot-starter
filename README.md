# 闲鱼自动化工具

## 功能模块

- 基础服务 (base.ts)
  - 页面导航
  - 运行状态管理
  - UI 悬浮窗控制

- 曝光服务 (exposure.ts)
  - 商品曝光统计
  - 数据采集分析

- 金币服务 (getGold.ts) 
  - 金币任务自动化
  - 推广任务处理

## 更新记录

### 2024-03-xx
- 优化代码结构
- 分离业务逻辑
- 完善错误处理
- 规范化日志记录

## 使用预制函数

所有预制库都存放在 `src/lib` 文件夹中。

详细使用方式和文档见 [预制库说明](./src/lib/README.md) 。

## 导出设置

1. 在 `buildConfig` 文件夹下添加新的配置文件，例如： `webpack.MyBuildConfig.js`。
2. 编写独立的构建设置，可以复制 `buildConfig/webpack.dev.js` 中的内容然后修改。
3. 在 `package.json` 文件中的 `scripts` 字段中添加新的记录，例如：

    ```json
    "scripts": {
        "build": "webpack --config ./buildConfig/webpack.dev.js",
        "MyBuildConfig": "webpack --config ./buildConfig/webpack.MyBuildConfig.js"
    },
    ```

4. 在打包项目时选择对应的配置。

## 编写 UI

在编写 UI 的时候需要使用 XML 字符串，不要使用 `tsx` 文件。

```typescript
let widget = floaty.window(
    "<frame gravity='center' bg='#FF0000'>\
        <text id='text'>悬浮文字</text>\
    </frame>"
);
setTimeout(() => {
    widget.close();
}, 5000);
```

> 我目前找到的编译 tsx 的方法都会打包成 React 对象，如果有了解的大大拜托帮帮我蟹蟹。

## 注意事项

1. 如果有用到暂时没有声明过的模块，可以使用 TS 的忽略语法:

   > 注意：忽略会跳过所有检查，除了语法错误。使用时会有风险，请在确保肯定不会出现问题后再使用。

    ```typescript
    // 多行忽略（取消两个标记间的代码检查。）
    // 可以不使用结束标记，即忽略到文件结尾。
    // 注意：必须在文件顶部使用。
    // @ts-nocheck
    canvas.drawLine(0, 0, 1080, 1920, paint);
   
    // @ts-check
   
    // 单行忽略（取消下一行的代码检查。）
    // @ts-ignore
    canvas.drawLine(0, 0, 1080, 1920, paint);
    ```

## TODO List

