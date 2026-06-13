# Hamibot / Auto.js 线程与截图权限核心指导手册

> **本文档极其重要。** 每次修改 `xyBaseRunWithLog`、悬浮窗、截图权限、调试轮询等任何启动相关逻辑前，必须先阅读本文档。违反其中任何一条规则都会导致日志消失、悬浮窗不显示、截图失败等连锁问题。

---

## 一、引擎模型（Hamibot / Auto.js Pro 8 经典引擎）

Hamibot 使用的是 **Rhino（经典）引擎**，不是 Node.js 引擎。两者线程模型完全不同：

| 特性 | 经典引擎（本项目） | Node.js 引擎（Pro 9） |
|------|-------------------|----------------------|
| `requestScreenCapture` | **同步阻塞**，等用户点允许 | 异步 `Promise`，用 `await` |
| 线程创建 | `threads.start(fn)` | `worker_threads` |
| UI 更新 | `ui.post(fn)` / `ui.run(fn)` | 原生异步 |
| 悬浮窗 | `floaty.window(xml)` | 同，但需 `ui-thread` |

**不要把 Pro 9 的写法（async/await、Promise、require(...)）混入本项目。**

---

## 二、三类线程及其规则

### 1. 主线程（Main Script Thread）

- 脚本入口函数（`xyBaseRunWithLog`）运行的地方
- **可以调用** `requestScreenCapture()`（会阻塞，直到用户响应）
- **可以调用** `sleep()`、`launchApp()`、`closeApp()` 等同步操作
- **不可以** 长时间阻塞（否则整个主流程卡死），但等待截图权限是例外

### 2. 子线程（threads.start）

- `threads.start(function() { ... })` 创建
- **可以调用** 绝大多数 Auto.js API
- **不可以** 直接操作 floaty 窗口 View（如 `window.runLog.setText(...)`）——必须通过 `ui.post()` 派发到 UI 线程
- **不可以** 在子线程调用 `ui.run(fn)`（会死锁！`ui.run` 等待 UI 线程，而 UI 线程可能反过来等待子线程）

### 3. Android UI 线程

- Android 系统的界面渲染线程
- `ui.post(fn)` / `ui.run(fn)` 把代码派发到此线程
- **`requestScreenCapture()` 禁止在此线程调用**（文档明确禁止）
- 操作悬浮窗 View 必须在此线程（用 `ui.post`）

---

## 三、关键 API 规则

### `requestScreenCapture(landscape: boolean): boolean`

```
❌ 禁止在 Android UI 线程调用（ui.post / ui.run 内部）
❌ 禁止在子线程内调用（会产生 InterruptedException 等异常）
✅ 必须在主脚本线程调用
✅ 会同步阻塞，直到用户点击「允许」或「拒绝」
✅ 调用一次即可，后续 captureScreen() 直接用
```

**正确时机：在 `threads.start` 之后，主线程中调用。**

```typescript
// 先启动子线程（悬浮窗先建好）
threads.start(function () {
    const window = floaty.window(`...`);
    initRunInfo(window);
    startTaskPoller();
    startDebugPoller();
});

// 主线程稍等，让子线程把悬浮窗建好
sleep(800);

// 主线程申请截图权限（阻塞直到用户点允许）
if (requestScreenCapture(false)) {
    // 权限已获取
} else {
    // 用户拒绝
}
```

### `captureScreen(): Image`

```
✅ 可在子线程调用
✅ 必须在 requestScreenCapture() 已调用且用户已允许之后才能使用
❌ 权限未获取时调用会抛异常或返回 null
```

### `floaty.window(xml): FloatyWindow`

```
✅ 可在子线程创建
❌ 创建后，操作其 View（setText 等）必须用 ui.post()
```

### `ui.post(fn)` vs `ui.run(fn)`

```
ui.post(fn)  → 异步派发，不等待结果，不阻塞当前线程   ✅ 推荐
ui.run(fn)   → 同步等待 UI 线程执行完再返回           ⚠️ 谨慎：在子线程调用易死锁
```

---

## 四、正确的启动顺序（必须遵守）

```
xyBaseRunWithLog()
    │
    ├─ closeApp / sleep / launchApp          （主线程，同步）
    │
    ├─ threads.start(function() {            【① 先启动子线程】
    │      setRunInfo('子线程启动...')
    │      findDom()                         （初始化 DOM 查找）
    │      floaty.window(...)                （创建悬浮窗）
    │      initRunInfo(window)               （绑定 UI，刷新积压日志）
    │      startTaskPoller()                 （任务轮询）
    │      startDebugPoller()                （调试指令轮询）
    │  })
    │
    ├─ sleep(800)                            【② 给子线程时间初始化】
    │
    └─ requestScreenCapture(false)           【③ 主线程申请截图权限】
         ↓ 阻塞等待用户点击
         ↓ 用户点「允许」→ 返回 true
         ↓ 用户点「拒绝」→ 返回 false
```

**顺序不能颠倒。** 如果把 `requestScreenCapture` 放到 `threads.start` 之前：
- 主线程卡在权限弹窗
- 子线程根本没有启动
- 悬浮窗不出现、日志全消失
- debug 轮询无法工作

---

## 五、日志体系

项目有三条日志链路，缺一不可：

| 链路 | 写入时机 | 可见位置 |
|------|---------|---------|
| `console.log` | 任意时机 | Hamibot 控制台 |
| `reportTrace` / `createLogs('trace', ...)` | `setRunInfo` 内自动触发 | 服务端 `logs/device/trace/` |
| `ui.post` 更新悬浮窗 | `setRunInfo` 内，仅在 `runInfo.page != null` 后 | 手机悬浮红色 Log 条 |

### `setRunInfo(msg)` 的行为

```typescript
export const setRunInfo = (log: string) => {
    runInfo.log = log;          // 永远存储（悬浮窗未就绪时作为缓冲）
    reportTrace(log);           // 异步上报到服务端 trace
    if (runInfo.page) {
        ui.post(() => {         // 有悬浮窗才刷 UI（ui.post 不阻塞）
            runInfo.page.runLog.setText(runInfo.log);
        });
    }
};
```

### `initRunInfo(window)` 的行为

```typescript
export const initRunInfo = (logUI: any) => {
    runInfo.page = logUI;       // 绑定悬浮窗
    if (runInfo.log) {          // 把启动阶段积压的最后一条日志刷到 UI
        ui.post(() => {
            runInfo.page.runLog.setText(runInfo.log);
        });
    }
};
```

> **注意**：`runInfo.log` 只存最后一条。悬浮窗就绪前的中间日志只能在 trace 文件里看，悬浮窗只能看到 `initRunInfo` 时刻的那条。这是正常现象。

---

## 六、调试指令轮询（debugPoller）规则

```typescript
export const startDebugPoller = () => {
    threads.start(function () {
        while (true) {
            const result = pollDebugCommands();
            for (const cmd of result.data) {
                // ✅ 每条指令独立线程执行，避免大操作阻塞轮询
                threads.start(function () {
                    executeDebugCommand(cmd);
                });
            }
            sleep(3000);
        }
    });
};
```

**为什么每条指令要独立线程：**
- `page_capture`（采集页面树）可能耗时 60–120s
- 如果在轮询线程内同步执行，轮询会卡住 → 服务端超时 → 指令堆积
- 独立线程执行后，轮询主循环每 3s 继续检查新指令

---

## 七、截图权限状态管理

```typescript
let _screenCaptureState = 'unknown';  // 初始值

// 启动时：主线程申请权限后更新
if (requestScreenCapture(false)) {
    _screenCaptureState = 'granted';
} else {
    _screenCaptureState = 'denied';
}

// 截图成功后：也更新为 granted（确认状态）
_screenCaptureState = 'granted';
```

- `unknown`：未申请（脚本刚启动，还没到权限申请步骤）
- `granted`：用户已允许，`captureScreen()` 可用
- `denied`：用户拒绝或异常，`captureScreen()` 会失败

`page_capture` 采集时，若 `_screenCaptureState !== 'granted'`，应记录 `screenshot_error`，但**仍然保存布局树**，不要因截图失败而整个指令失败。

---

## 八、常见错误场景及原因

| 现象 | 根因 | 修复方向 |
|------|------|---------|
| 悬浮窗不显示，日志全消失 | `requestScreenCapture` 在 `threads.start` 之前，主线程卡死 | 调整为先 `threads.start` 再申请权限 |
| `requestScreenCapture error: InterruptedException` | 脚本被强制停止时主线程正在阻塞等待权限 | 正常现象，重启脚本即可 |
| 悬浮窗显示但不更新 | 在子线程直接 `window.runLog.setText(...)` 而没用 `ui.post` | 改用 `ui.post(fn)` |
| 悬浮窗卡死/ANR | 在子线程用了 `ui.run(fn)`，产生死锁 | 改为 `ui.post(fn)` |
| `captureScreen` 返回 null 或抛异常 | 用户未点允许，或 `requestScreenCapture` 未被调用 | 确保启动流程完整走完 |
| debug 指令一直 pending | 旧的 running 指令堆积，或 debugPoller 没有启动 | 检查 trace 是否有 `debugPoller: 调试轮询已启动` |
| debug 指令执行超时 | 在轮询线程同步执行耗时操作 | 改为 `threads.start(executeDebugCommand)` |

---

## 九、修改启动逻辑的 Checklist

每次修改 `xyBaseRunWithLog` 或相关启动逻辑时，逐条确认：

- [ ] `threads.start(...)` 在 `requestScreenCapture()` **之前**调用
- [ ] `requestScreenCapture()` 在**主线程**调用（不在 `threads.start` 内部）
- [ ] 所有悬浮窗 View 操作都通过 `ui.post(fn)` 而非 `ui.run(fn)`
- [ ] `setRunInfo` 用于所有日志输出（不要只用 `console.log`）
- [ ] `initRunInfo(window)` 在悬浮窗创建后立即调用
- [ ] `startDebugPoller` 中每条指令用独立 `threads.start` 执行
- [ ] `page_capture` 截图失败时仍保存布局树，不整体失败

---

## 十、本项目当前正确实现（参考锚点）

```
src/toolKit/xianyu/service/base.ts
  ├── runInfo / initRunInfo / setRunInfo    → 日志与悬浮窗体系
  ├── reportTrace                           → 异步 trace 上报
  ├── _screenCaptureState                  → 截图权限状态
  ├── _runDebugScreenshot                  → 截图执行（子线程）
  ├── _runDebugPageCapture                 → 页面采集（子线程）
  ├── executeDebugCommand                  → 调试指令分发
  ├── startDebugPoller                     → 每条指令独立线程
  └── xyBaseRunWithLog                     → 主入口，顺序：threads.start → sleep → requestScreenCapture
```

---

*最后更新：2026-06-12*
*根据实际踩坑经历整理，所有规则均经过验证。*
