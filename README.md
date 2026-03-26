<h1 align="center">Welcome to hamibot-starter 👋</h1>
<p align="center">
  <a href="https://www.npmjs.com/package/script-template" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/script-template.svg">
  </a>
  <a href="#" target="_blank">
    <img alt="GitHub package.json version" src="https://img.shields.io/github/package-json/v/batu1579/hamibot-starter">
  </a>
  <a href="[#](https://github.com/batu1579/hamibot-starter/blob/main/LICENSE)" target="_blank">
    <img alt="License: MPL--2.0" src="https://img.shields.io/badge/License-MPL--2.0-yellow.svg" />
  </a>
</p>

> 一个用来快速开始编写 `Hamibot` 脚本的模板，使用 `TypeScript` 编写。
>
> 通过声明文件提供 `Hamibot` 绝大部分函数的代码提示、类型检查和文档，帮你减少键入次数和查询官方文档的时间。提供常用的代码片段，直接调用可以辅助更快完成开发，并让你能专注于核心功能。
>
> 欢迎各位大佬帮我一起完善这个项目！

## 快速开始

1. 下载本仓库，有两种方式可选：

   1. 点击右上角的 [Fork](https://github.com/batu1579/hamibot-starter/fork) 按钮将此仓库克隆到自己账户下，然后将仓库克隆到本地。

        > 推荐，使用这种方式可以方便的得到更新，但是一个账户只能克隆一个。

   2. 点击右上角的 [Use this template](https://github.com/batu1579/hamibot-starter/generate) 按钮以此仓库为模板在账户下创建仓库。

        > 如果你的账号里已经有一个克隆的仓库，那就只能选择这种方法。但是使用这种方式没法方便的通过合并上游仓库的方式来更新。

   3. 如果你不准备使用 Git 作为版本管理工具，也可以从 [这里](https://github.com/batu1579/hamibot-starter/archive/refs/heads/main.zip) 下载压缩包。

2. 使用指令安装依赖：

    ```sh
    npm install
    ```

    > 因为使用了 npm 来管理依赖，在安装之前请确保安装过 `node.js` 。

3. 在 `src` 文件夹下编写代码，程序入口为 `src/index.ts` 。

4. 完成编写后打包项目，有三种方式可选：

   1. 使用 VSCode 快捷键 `ctrl + shift + b` 打开任务菜单，然后选择 `npm build` 打包。
   2. 使用命令打包项目：

      ```sh
      npm run build
      ```

   3. 在 VS Code 资源管理器的 NPM 脚本窗口中选则对应的配置运行。

      > 如果没有找到 NPM 窗口可以在命令窗口中查找并选择 `焦点在 NPM 脚本 视图上`

5. 在控制台上传打包后的文件: `dist/index.js` 。

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

- [ ] 将 hamibot 的类型声明单独发布到 `DefinitelyTyped`
- [ ] 添加声明文件 [24/26]
  - [ ] Util
  - [ ] Canvans
- [ ] 使用 `Eslint` 在提交前统一代码风格
- [ ] 检查泛型注释
- [ ] 检查回调函数注释
- [ ] 检查注释中的类和方法是否使用行内代码格式
- [ ] 检查注释中的示例代码是否都能够运行
- [ ] 统一函数类型（Function、function）

## 本地服务端（server/）

本地服务端使用 Python + FastAPI，建议用 venv 虚拟环境隔离依赖。

### 1. 创建虚拟环境

在 `server/` 目录下执行：

```sh
cd server
python -m venv .venv
```

### 2. 激活虚拟环境

**Windows（PowerShell）**

```powershell
.venv\Scripts\Activate.ps1
```

**Windows（CMD）**

```cmd
.venv\Scripts\activate.bat
```

**macOS / Linux**

```sh
source .venv/bin/activate
```

激活后终端前缀会变为 `(.venv)`，表示已进入虚拟环境。

### 3. 安装依赖

```sh
pip install -r requirements.txt
```

### 4. 配置环境变量

复制示例文件并按需修改：

```sh
cp .env.example .env
```

`.env` 内容（当前只需配置端口）：

```
PORT=3000
```

### 5. 启动服务

```sh
python main.py
```

服务启动后访问 `http://localhost:3000/health` 确认运行正常。

### 6. 退出虚拟环境

```sh
deactivate
```

### 注意事项

- `.venv/` 已加入 `.gitignore`，不会被提交到仓库
- 每次开新终端都需要重新激活虚拟环境（步骤 2）
- 新增依赖后执行 `pip freeze > requirements.txt` 更新依赖文件

---

## 作者

👤 **BATU1579**

- Github: [@batu1579](https://github.com/batu1579)

## 支持

如果有帮到你的话，帮我点颗小星星叭~ ⭐️

***
_This README was generated with ❤️ by [readme-md-generator](https://github.com/kefranabg/readme-md-generator)_
