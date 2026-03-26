# 项目优化记录

> 最后更新：2026-03-25

---

## 一、发现的问题

在对 `src/` 客户端代码进行审查时，发现了以下问题（按严重程度排序）：

### 严重（Bug / 安全）

| # | 文件 | 问题描述 |
|---|------|----------|
| 1 | `src/lib/service.ts` | JWT token 与明文用户名/密码硬编码在源码中，存在凭据泄露风险 |
| 2 | `service/base.ts` L161 | `goBackMyPage` 缺少括号，是一个 no-op 表达式，调用完全无效 |
| 3 | `service/exposure copy.ts` | `findDom` 函数开头有 `return`，后续所有逻辑均不可达 |

### 中等（维护性 / 逻辑）

| # | 文件 | 问题描述 |
|---|------|----------|
| 4 | `service/base.ts` | 两个启动函数（`xyBaseRun` / `xyBaseRunWithLog`）各有两处空 `setInterval`，无逻辑、无清理，浪费资源 |
| 5 | `src/global.ts` | `SHOW_CONSOLE` 硬编码为 `false`，与 `config.json` 中的 `_SHOW_CONSOLE` 配置项完全脱节 |
| 6 | `src/index.ts` | `console.show()` 无条件调用，忽略了用户配置 |
| 7 | `service/base.ts` | `findPage` 中使用 `const newPageName = currentPackage()` 赋值后从未使用 |
| 8 | `service/base.ts` | `import { Record }` 导入后未使用（已被后来的重构清理） |
| 9 | `lib/service.ts` | `request` 函数参数类型 `Record<string, any>` 与 `import { Record }` 同名冲突 |
| 10 | `lib/service.ts` | `createLogs(name, data)` 参数无类型注解 |
| 11 | `lib/service.ts` | API URL 参数 `nikeName` 拼写错误（应为 `nickName`） |

### 低（死代码 / 冗余）

| # | 文件 | 问题描述 |
|---|------|----------|
| 12 | `service/exposure copy.ts` | 与 `exposure.ts` 重复的备份文件，共 274 行 |
| 13 | `service/autoEvaluation.ts` | 167 行全为注释，无任何有效导出 |
| 14 | `service/addboox.ts` | 4 行空文件，仅有注释 |
| 15 | `service/base.ts` | 大量注释掉的调试代码和 `console.log` |
| 16 | `lib/service.ts` | 两个 `getToken` / `getHeader` 返回相同对象，功能重复 |

---

## 二、已完成的优化（2026-03-25）

### ✅ 删除死代码文件

删除了以下 3 个无实际逻辑的文件：

- `src/toolKit/xianyu/service/exposure copy.ts`（274 行，9KB）
- `src/toolKit/xianyu/service/autoEvaluation.ts`（167 行）
- `src/toolKit/xianyu/service/addboox.ts`（4 行）

### ✅ 修复 base.ts Bug

**Bug 修复（no-op 调用）**

```typescript
// 修复前 —— 这行什么都不做
} else {
    goBackMyPage    // 表达式，没有括号
    sleep(1000)

// 修复后
} else {
    goBackMyPage()
    sleep(1000)
```

**清理空 setInterval**

`xyBaseRun` 和 `xyBaseRunWithLog` 中各有两处空的 `setInterval`，已全部删除：

```typescript
// 删除前（每个函数两处）
var time = setInterval(() => {}, 2000);  // 无任何逻辑

// 删除后：完全移除
```

`base.ts` 从 **368 行精简到 269 行**，并同步清理了注释掉的调试代码和未使用的变量。

### ✅ 打通 SHOW_CONSOLE 配置

**`src/global.ts`**

```typescript
// 修改前：硬编码，配置面板的 _SHOW_CONSOLE 选项完全无效
export const SHOW_CONSOLE = false;

// 修改后：读取用户在 Hamibot 配置面板的设置
export const SHOW_CONSOLE = _SHOW_CONSOLE === true || _SHOW_CONSOLE === 'true';
```

**`src/index.ts`**

```typescript
// 修改前：无论配置如何，始终弹出控制台
console.show();

// 修改后：根据配置决定
if (SHOW_CONSOLE) {
    console.show();
}
```

### ✅ service.ts 类型与命名修正

```typescript
// 1. 新增 RequestOptions 类型，消除与 import { Record } 的命名冲突
type RequestOptions = { method?: string; headers?: object; body?: string }

// 2. 补全类型注解
export const createLogs = (name: string, data: unknown): void => { ... }

// 3. 修正拼写错误
// 修改前
`/api/order/good?nikeName=${nickName}`
// 修改后
`/api/order/good?nickName=${nickName}`
```

---

## 三、待优化项（Backlog）

### 高优先级

#### 服务端路由补全
`server/main.py` 中引用了 5 个路由模块，但均未实现：

| 路由文件 | 对应功能 | 对应客户端调用 |
|----------|----------|----------------|
| `routers/logs.py` | 日志上报 | `createLogs()` |
| `routers/order.py` | 订单查询 | `getGoodInfo()`, `getGoodInfoByOrderNumber()` |
| `routers/cache.py` | 元素缓存读写 | `getElementCache()`, `saveElementCache()` |
| `routers/book.py` | 书单相关 | 待确认 |
| `routers/goods.py` | 商品信息 | 待确认 |

#### TypeScript 编译目标升级
`tsconfig.json` 的 `target: es5` 导致无法使用 `Map`、`Array.from` 等现代 API（虽然 Hamibot 运行时支持），产生编译告警：

```json
// tsconfig.json 建议改为
{
  "compilerOptions": {
    "target": "es6",
    "lib": ["es6"],
    ...
  }
}
```

### 中优先级

#### `lib/service.ts` 中还保留了旧接口兼容层
`xyLogin`、`getHeader`、`getNestHeader` 保留为空实现以兼容现有调用，但调用方仍存在。待服务端稳定后，应在调用方统一移除这些调用：

```typescript
// 这些调用可在调用方清理
xyLogin()
getHeader()
getNestHeader()
```

#### `base.ts` 中 `findPage` 的 `default` 分支
```typescript
default:
    console.log('dddd');  // 无意义的占位输出，应改为实际错误处理
```

#### `getMainPopup.ts` 中的页面名不一致
`backMainPage` 函数调用 `findPage("getGold")`，但 `base.ts` 的 `switch` 中使用的是 `"goldCoin"`，导致 `default` 分支静默失败。

#### `autoComment.ts` 风格不一致
`await` 在同步 HTTP 调用上使用，虽然 JavaScript 允许，但与整体同步风格不一致，容易引起混淆。

### 低优先级

#### `lib/logger.ts` 过大
目前有 827 行，建议按职责拆分（如将 pushplus 发送逻辑、日志格式化分离为独立模块）。

#### `utils/index.ts` 中的店铺数据硬编码
书单、店铺名等数据写死在代码中，应迁移到服务端配置或 Hamibot 环境变量。

#### `config.json` 缺少 `_LOCAL_SERVER` 配置项
`service.ts` 已经从 `hamibot.env._LOCAL_SERVER` 读取服务器地址，但 `config.json` 中尚未添加对应配置，用户在控制台看不到该输入项：

```json
{
    "name": "_LOCAL_SERVER",
    "type": "text",
    "label": "本地服务器地址",
    "help": "格式：http://192.168.x.x:3000，填写运行服务端的电脑局域网 IP"
}
```

---

## 四、架构现状与目标

### 当前架构

```
Hamibot 脚本
    └── src/lib/service.ts
            ├── → xfyapi.xfysj.top    (直连)
            └── → nestapi.xfysj.top   (直连)

server/  (FastAPI，已搭建框架但路由未实现)
```

### 目标架构（服务端路由补全后）

```
Hamibot 脚本
    └── src/lib/service.ts
            └── → localhost:3000  (本地服务器，已修改)

server/  (FastAPI)
    ├── core/token_store.py  (统一管理两套系统的 JWT，自动刷新)
    ├── routers/logs.py      (待实现)
    ├── routers/order.py     (待实现)
    ├── routers/cache.py     (待实现)
    └── routers/...          (待实现)
        ├── → xfyapi.xfysj.top
        └── → nestapi.xfysj.top
```

**引入本地服务器的核心收益：**
- 凭据集中在服务端 `.env` 管理，不再出现在脚本代码中
- Token 自动刷新，脚本无需关心登录逻辑
- 可在服务端做数据缓存、聚合，减少重复网络请求

---

## 五、核心流程图

每个流程独立存放在 `doc/flow/` 目录下，便于单独编辑：

| 文件 | 内容 |
|------|------|
| `flow/01_startup.txt` | 整体启动流程（index.ts → xyBaseRunWithLog） |
| `flow/02_page_navigation.txt` | 页面导航流程（findPage + goBackMyPage） |
| `flow/03_gold_coin.txt` | 金币任务流程（coinExchange + mainPopupTask） |
| `flow/04_find_dom.txt` | 商品数据采集流程（findDom 递归翻页） |
| `flow/05_architecture.txt` | 架构调用流程（当前直连 vs 目标代理） |
