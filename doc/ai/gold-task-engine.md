# 金币任务引擎设计文档

> 适用版本：`src/toolKit/xianyu/service/getGold.ts`（路径引擎版）  
> 场景：闲鱼 App 金币地图 → 任务弹框 → 逐条执行任务领取金币

---

## 一、为什么这套逻辑能跑成功？

传统脚本的问题是"线性写死"——点 A、点 B、等弹框出现，任何一步时机不对就整体卡死。
金币任务引擎解决了三个核心痛点：

| 痛点 | 旧方式 | 引擎方式 |
|---|---|---|
| 任务卡死 | 某步失败→整个脚本停止 | 失败→退回 Checkpoint→继续下一条 |
| 迷路不知道 | 静默失败，日志空白 | 捕获现场快照 + 规则分析 + AI 异步诊断 |
| 无法重试 | 每次从头跑 | 最多 3 轮，成功跳过，失败重试 |

---

## 二、整体架构

```
金币首页（唯一 Checkpoint）
    │
    ├── 摇骰子路径（rollAvailableDice）
    │       └── 有次数 → 循环摇 → 遇弹框退出
    │
    └── 任务弹框路径（mainPopupTask）
            │
            ├── 第 1 轮签到 → checkGetGold（领上轮奖励）
            │
            ├── for each task in pendingList:
            │       └── runSingleTask(task)
            │               ├── [PathStep 1] 确认弹框打开
            │               ├── [PathStep 2] 找到任务标题
            │               ├── [PathStep 3] 滚动到可视区
            │               ├── [PathStep 4] 点击去完成
            │               ├── [PathStep 5] 执行任务回调（可选）
            │               ├── [PathStep 6] 归位-返回金币页
            │               ├── [PathStep 7] 归位-重新打开弹框（可选）
            │               └── [PathStep 8] 验证完成-领取奖励（可选）
            │                       ↓失败
            │               logPathFailure → AI 分析 → backToGoldCheckpoint
            │
            └── 最多 3 轮 → 仍有失败 → 写 YYYYMMDD-error.log
```

---

## 三、三个核心机制

### 3.1 路径引擎（PathStep + runPath）

每个任务被拆解为一个 `PathStep[]` 数组，逐步执行：

```typescript
type PathStep = {
  label: string;                           // 步骤名，写日志
  action: () => boolean | null | undefined; // true=成功 false=失败 null=跳过
  required?: boolean;                      // false=可选步骤失败不中止
  failHint?: string;                       // 失败原因，用于分析
};
```

**关键设计：`action` 返回 `null`**  
可选步骤（`required: false`）失败时不中止路径，直接跳过。  
例如"执行任务回调"失败了，路径继续走"归位"步骤，不影响整体。

**这套结构的可移植性**：任何"点击序列 + 检查"场景都可以套用，只需把步骤塞进数组即可。

---

### 3.2 Checkpoint 机制（backToGoldCheckpoint）

金币首页是**唯一的 Checkpoint**，所有任务路径在以下时机触发归位：

1. 任务路径正常结束后（PathStep 6：归位-返回金币页）
2. 任务路径失败后（失败处理中调用 backToGoldCheckpoint）
3. 下一个任务执行前（`mainPopupTask` 外层双保险检查）

```
backToGoldCheckpoint 内部逻辑：
  已在金币页？→ 直接返回 true
  返回失败？→ goBackMyPage（多次 back 键）→ 找到金币入口点击
  仍失败？→ haltGoldFlow（不可恢复时才停止）
```

**关键设计：Checkpoint 独立于业务**  
`backToGoldCheckpoint` 不触发 `mainPopupTask` 也不触发 `coinExchange`，
它只负责"导航回金币页"，避免嵌套调用造成任务状态污染。

---

### 3.3 三轮重试循环（mainPopupTask）

```
第 1 轮：执行全部任务（done 标记 hasRun=true，failed 继续）
第 2 轮：跳过 hasRun=true，重试上轮失败的
第 3 轮：同上
结束：仍有失败 → 写 error 日志
```

每条任务对象（task）独立持有状态：

| 字段 | 含义 |
|---|---|
| `hasRun` | 是否已成功完成（跳过后续轮） |
| `failCount` | 累计失败次数 |
| `lastResult` | 最后一次结果（"done" / "failed"） |
| `failRecords[]` | 每次失败的详情（轮次、步骤、原因、时间戳） |
| `rewardVerified` | 是否见到"领取奖励"按钮（验证任务是否真正计数） |

**关键设计：任务对象完全独立**  
同名任务（如 4 条"看视频奖励100币"）各自持有独立状态，互不影响。
slot1 的结果不会传递给 slot2，每条执行一次标记一次。

---

## 四、失败处理分层

失败发生后，按严重程度分三层处理：

```
Layer 1 — 轻量失败（标题不在列表）
  任务未在弹框列表中出现
  → 直接标记 failed，无 AI 分析，无 Checkpoint 恢复
  → 下一轮重试

Layer 2 — 路径失败（其他步骤失败）
  弹框关闭、按钮找不到、回调异常等
  → logPathFailure（规则分析 + 写 path_failure 日志）
  → AI 异步分析（runAiFailureAnalysis）
  → backToGoldCheckpoint + openTaskPopup
  → 标记 failed，下一轮重试

Layer 3 — 不可恢复（连金币页都回不去）
  → haltGoldFlow：写 gold_halt 日志 + AI 分析 + 停止整个金币流程
```

---

## 五、AI 保驾护航

AI 分析是异步的，**不阻塞主流程**，用于事后诊断"为什么迷路"：

```
触发时机：
  - 任意路径失败（logPathFailure 调用 runAiFailureAnalysis）
  - haltGoldFlow（最严重的不可恢复失败）

发送内容：
  - 当前 pkg / activity
  - 屏幕截图（captureCurrentState）
  - 可见文本、页面快照
  - 失败步骤名、failHint

返回内容：
  - aiPageType：当前在哪个页面
  - aiReasoning：AI 的判断依据
  - aiSuggestion：建议操作（retry / abort 等）

写入日志：
  - logs/device/ai_failure_analysis/YYYY-MM-DD.log
```

AI 分析不影响执行结果，只负责"记录为什么失败"，供后续人工优化路径。

---

## 六、状态实时同步到 Web 端

每个任务执行完毕后，异步将全量 taskList 状态 POST 到后端：

```typescript
syncGoldTasks(taskList.map(t => ({
  title, hasRun, rewardVerified, failCount, lastResult, failRecords
})));
```

后端（`server/routers/gold_tasks.py`）按 `uid` 匹配更新，每天第一次访问自动重置。
前端 dashboard 可实时查看任务进度、手动重置、补充任务。

---

## 七、可借鉴的设计模式

这套引擎本质是一个**"步骤序列 + Checkpoint 恢复 + 三轮重试"**的自动化框架，适用于任何需要在移动 App 内完成"多步骤点击 + 状态确认"的场景。

### 迁移到新业务的步骤

**Step 1：确定 Checkpoint**  
找到一个"稳定的出发页面"，脚本可以随时导航回来。  
示例：商品详情页 / 个人中心 / 首页

**Step 2：拆解路径为 PathStep[]**  
把"点击 A → 等待 B 出现 → 检查 C → 点击 D"写成步骤数组：

```typescript
const steps: PathStep[] = [
  { label: "确认在目标页", action: () => isOnTargetPage() },
  { label: "找到目标元素", action: () => !!findByA11yId("xxx") },
  { label: "点击按钮",     action: () => { btn.click(); sleep(1000); return true; } },
  { label: "归位",         action: () => backToCheckpoint() },
];
runPath("任务名", steps);
```

**Step 3：实现 backToCheckpoint**  
只负责导航，不触发业务逻辑，与 `mainLoop` 解耦。

**Step 4：套入三轮重试循环**  
复用 `mainPopupTask` 的结构，替换 taskList 和 runSingleTask 内部逻辑。

**Step 5：接入 AI 分析（可选）**  
在 `logPathFailure` 里调用 `runAiFailureAnalysis`，失败时自动截图上报。

### 适用场景举例

| 场景 | Checkpoint | PathStep 核心操作 |
|---|---|---|
| 签到任务 | 个人中心 | 找签到按钮 → 点击 → 确认弹框 → 归位 |
| 商品批量上架 | 卖家工作台 | 填写表单 → 提交 → 验证成功 → 归位 |
| 每日限时抢购 | 商品列表 | 滚动到目标商品 → 点击 → 确认支付 → 归位 |
| 消息批量回复 | 消息列表 | 进入会话 → 发送内容 → 返回列表 → 下一条 |

---

## 八、设计原则总结

1. **单一 Checkpoint**：脚本在任何时候都知道怎么回到"起点"
2. **步骤显式声明**：每个操作有名字、有失败描述，日志可读性极高
3. **可选步骤不中止**：`required: false` 保证次要操作失败不影响主流程
4. **任务对象独立**：状态挂在 task 对象上，同名任务各自独立不串联
5. **失败分层处理**：轻量 → 规则分析 → AI 分析 → 不可恢复停止
6. **异步不阻塞**：AI 分析、Web 同步都在子线程，不影响主流程节奏
7. **三轮重试兜底**：单轮失败不放弃，全部失败才写 error 日志
