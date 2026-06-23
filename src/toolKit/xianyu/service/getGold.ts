/**
 * getGold.ts — 金币任务流程（路径引擎版）
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  架构概览                                                │
 * │                                                         │
 * │  金币首页 (Checkpoint)                                  │
 * │    │                                                    │
 * │    ├── 摇骰子路径                                       │
 * │    └── 任务弹框                                         │
 * │           ├── [任务A] → Step[] → 归位 → 领奖           │
 * │           └── [任务B] → Step[] → 归位 → 领奖           │
 * │                   │                                    │
 * │              步骤失败 → 记录快照 → 退回Checkpoint       │
 * │                       → 重试 or 跳过当前任务           │
 * └─────────────────────────────────────────────────────────┘
 *
 * 设计原则：
 *   1. 金币首页为唯一 Checkpoint，所有任务路径从这里出发、也回到这里
 *   2. 检测用"文本 OR a11y-id"双轨，任意命中即可，不依赖 bounds 校验
 *      （WebView 滚动时 mapDiceBtn 的 bounds.bottom 可能为负，坐标失效）
 *   3. 每个任务封装为 PathStep[]，失败时记录上下文快照，不 halt 整体流程
 *   4. 单任务失败 → 退回 Checkpoint → 重试/跳过，不影响后续任务
 *   5. haltGoldFlow 只在真正无法恢复（连金币页都回不去）时使用
 */

import { Record } from "../../../lib/logger";
import { aiDecide, aiOperationComplete, aiOperationStart, createLogs, syncGoldTasks } from "../../../lib/service";
import { getScreenWidth, getScreenHeight } from "../../../lib/screenSize";
import { findByA11yId, tryClickNode } from "../utils/common";
import { APPNAME, clearTaskContext, flushTraces, PageType, setRunInfo, setTaskContext } from "./base";
import { dumpActiveWindowLayout } from "./layoutDump";
import { captureCurrentState } from "./aiExecutor";
import { dismissGoldPageBlockers, resetGoldBlockerRunState } from "./goldBlockers";
import {
  backMainPage,
  resetBackMainPageLoop,
  returnToXianyuApp,
  taskList,
} from "./getMainPopup";
import {
  assertOnGoldCoinPage,
  isOnGoldCoinPage,
  probeGoldCoinPage,
} from "./goldPageDetect";
import {
  findAllInTaskList,
  findTaskPopupSignIn,
  findTaskTitleStrict,
} from "./taskPopupQuery";
import { requestTaskStop, shouldStopCurrentTask } from "./taskControl";

// ═══════════════════════════════════════════════════════════
// § 0  流程状态
// ═══════════════════════════════════════════════════════════

let _goldFlowHalted = false;

export function resetGoldFlowState() {
  _goldFlowHalted = false;
  resetGoldBlockerRunState();
}

export const isGoldFlowHalted = (): boolean => _goldFlowHalted;

function assertGoldFlowContinue(): boolean {
  return !_goldFlowHalted && !shouldStopCurrentTask();
}

/** 不可恢复时停止整个金币流程，写 dump 日志，并触发 AI 兜底分析 */
export function haltGoldFlow(reason: string, opts?: { dumpLayout?: boolean }) {
  if (_goldFlowHalted) return;
  _goldFlowHalted = true;
  const msg = `【金币任务停止】${reason}`;
  setRunInfo(msg);
  Record.error(msg);
  requestTaskStop(reason);

  if (opts?.dumpLayout === false) return;

  // layout dump（原有逻辑）
  threads.start(function () {
    try {
      const layout = dumpActiveWindowLayout();
      createLogs("gold_halt", {
        reason,
        time: new Date().toLocaleTimeString("zh-CN"),
        package: layout.package,
        activity: layout.activity,
        tree: layout.tree,
      });
    } catch (e) {
      Record.warn("haltGoldFlow dump: " + e);
    }
  });

  // AI 兜底分析（异步，保驾护航最后一道防线）
  runAiFailureAnalysis(`haltGoldFlow: ${reason}`);
}

// ═══════════════════════════════════════════════════════════
// § 1  轻量状态检测（双轨 OR 逻辑，不依赖 bounds 校验）
// ═══════════════════════════════════════════════════════════

/**
 * 快速探测是否在金币地图页。
 * 策略：文本"闲鱼币"（最快）→ a11y navBarCoinIcon → a11y contentWrap
 * 不调用 probeGoldCoinPage，避免 mapDiceBtn bounds 反转导致误判。
 */
function quickIsOnGoldPage(timeoutMs = 400): boolean {
  try {
    if (className("android.widget.TextView").textContains("闲鱼币").findOne(timeoutMs)) return true;
  } catch { /* skip */ }
  if (findByA11yId("navBarCoinIcon", timeoutMs)) return true;
  if (findByA11yId("contentWrap", Math.min(timeoutMs, 300))) return true;
  return false;
}

/**
 * 探测任务弹框是否可见。
 * 策略：a11y taskWrap（最准）→ a11y taskListWrap → 文本"今天"（兜底）
 *
 * 注：弹框打开时 mapDiceBtn 的 bounds 可能反转（被滚出视口），
 *     不能用 bounds 判断，只能用 taskWrap/taskListWrap 的存在性。
 */
export function isTaskPopupOpen(): boolean {
  if (findByA11yId("taskWrap", 300)) return true;
  if (findByA11yId("taskListWrap", 300)) return true;
  try {
    if (className("android.widget.TextView").text("今天").findOnce()) return true;
  } catch { /* skip */ }
  return false;
}

/**
 * 获取 mapDiceBtn，但仅当 bounds 合法（bottom > top）时返回。
 * 弹框打开时按钮被 WebView 滚出屏幕，bounds.bottom 可能为负，此时不可用。
 */
function getDiceBtnValid(): UiObject | null {
  const btn = findByA11yId("mapDiceBtn", 400);
  if (!btn) return null;
  try {
    const b = btn.bounds();
    if (b.bottom <= b.top) return null; // bounds 反转，不可用
    return btn;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// § 2  路径执行引擎
// ═══════════════════════════════════════════════════════════

export type PathStep = {
  /** 步骤名称，用于日志追踪 */
  label: string;
  /**
   * 执行动作：
   *   true  = 成功
   *   false = 失败（required=true 时中止路径）
   *   null  = 跳过（不计入失败，用于可选操作）
   */
  action: () => boolean | null | undefined;
  /** false = 可选步骤，失败时继续；默认 true = 失败时中止 */
  required?: boolean;
  /** 失败时写入日志的原因描述，帮助后续分析 */
  failHint?: string;
};

export type PathResult = {
  ok: boolean;
  pathName: string;
  totalSteps: number;
  completedSteps: number;
  failedStep?: string;
  failHint?: string;
};

/**
 * 顺序执行路径（PathStep 数组）。
 * 每步写日志，required 步骤失败时中止并返回 ok=false。
 */
export function runPath(name: string, steps: PathStep[]): PathResult {
  setRunInfo(`[路径] 开始 ${name}（${steps.length}步）`);
  let completed = 0;

  for (let i = 0; i < steps.length; i++) {
    if (!assertGoldFlowContinue()) {
      return { ok: false, pathName: name, totalSteps: steps.length, completedSteps: completed, failedStep: "__halted__" };
    }

    const step = steps[i];
    const required = step.required !== false;
    setRunInfo(`[${name}] #${i + 1}/${steps.length} ${step.label}`);

    let result: boolean | null | undefined = false;
    try {
      result = step.action();
    } catch (e) {
      Record.warn(`[${name}] #${i + 1} ${step.label} 抛出异常: ${e}`);
      result = false;
    }

    if (result === null || result === undefined) {
      // 可选步骤跳过，不计失败
      completed++;
      continue;
    }

    if (!result) {
      if (required) {
        const hint = step.failHint || `步骤[${step.label}]返回 false`;
        setRunInfo(`[${name}] ✗ 中止于 #${i + 1}[${step.label}]：${hint}`);
        return {
          ok: false,
          pathName: name,
          totalSteps: steps.length,
          completedSteps: completed,
          failedStep: step.label,
          failHint: hint,
        };
      }
      // 可选步骤失败，继续
      setRunInfo(`[${name}] ~ #${i + 1}[${step.label}] 可选步骤失败，继续`);
    }

    completed++;
  }

  setRunInfo(`[${name}] ✓ 路径完成（${completed}/${steps.length} 步）`);
  return { ok: true, pathName: name, totalSteps: steps.length, completedSteps: completed };
}

// ═══════════════════════════════════════════════════════════
// § 3  失败分析器（迷路时记录现场快照）
// ═══════════════════════════════════════════════════════════

type FailureSnapshot = {
  pathName: string;
  failedStep?: string;
  failHint?: string;
  pkg: string;
  activity: string;
  onGoldPage: boolean;
  popupOpen: boolean;
  visibleTexts: string[];
};

function captureFailureSnapshot(pathName: string, result: PathResult): FailureSnapshot {
  const pkg = currentPackage();
  const activity = currentActivity();
  const onGoldPage = quickIsOnGoldPage(200);
  const popupOpen = isTaskPopupOpen();

  // 采集屏幕可见文本（最多 15 条，用于辅助分析）
  const visibleTexts: string[] = [];
  try {
    const tvs = className("android.widget.TextView").find();
    for (let i = 0; i < Math.min((tvs as any).length, 15); i++) {
      const t = (tvs as any)[i].text();
      if (t && t.trim()) visibleTexts.push(t.trim());
    }
  } catch { /* skip */ }

  return {
    pathName,
    failedStep: result.failedStep,
    failHint: result.failHint,
    pkg,
    activity,
    onGoldPage,
    popupOpen,
    visibleTexts,
  };
}

function analyzeFailure(snap: FailureSnapshot): string {
  const step = snap.failedStep || "?";
  const hint = snap.failHint || "";

  if (snap.pkg !== APPNAME) {
    return `不在闲鱼（pkg=${snap.pkg}），可能任务跳转到了外部 App 未能回来`;
  }
  if (!snap.onGoldPage) {
    return `在闲鱼但不在金币页（activity=${snap.activity}）；步骤[${step}]失败`;
  }
  if (!snap.popupOpen) {
    return `在金币页但任务弹框已关闭；步骤[${step}]：${hint || "弹框可能被手势关闭或重新加载"}`;
  }
  return `弹框已开，步骤[${step}]失败：${hint || "未知原因，参考可见文本"}`;
}

/**
 * 记录路径失败：规则分析（同步日志）+ AI 深度分析（异步）
 */
function logPathFailure(result: PathResult): void {
  const snap = captureFailureSnapshot(result.pathName, result);
  const analysis = analyzeFailure(snap);

  setRunInfo(`[分析] ${result.pathName}/${result.failedStep || "?"} → ${analysis}`);
  Record.warn(`[路径失败] ${result.pathName}: ${analysis}`);

  // 规则分析快照日志（异步写文件）
  threads.start(function () {
    try {
      createLogs("path_failure", {
        pathName: snap.pathName,
        failedStep: snap.failedStep,
        failHint: snap.failHint,
        ruleAnalysis: analysis,
        pkg: snap.pkg,
        activity: snap.activity,
        onGoldPage: snap.onGoldPage,
        popupOpen: snap.popupOpen,
        visibleTexts: snap.visibleTexts,
        time: new Date().toLocaleTimeString("zh-CN"),
      });
    } catch { /* skip */ }
  });

  // AI 深度分析（异步，补充规则分析覆盖不到的场景）
  runAiFailureAnalysis(`路径失败: ${result.pathName} / ${result.failedStep || "?"}`, snap);
}

// ═══════════════════════════════════════════════════════════
// § 3.5  AI 失败分析（保驾护航最后防线）
// ═══════════════════════════════════════════════════════════

/**
 * 采集当前屏幕状态（无障碍树 + 截图）→ 调用 /api/ai/decide 做单步分析
 * → 把 AI 的 page_recognition + reasoning 写入 ai_failure_analysis 日志。
 *
 * 设计要点：
 *   - 完全异步（threads.start），不阻塞主流程
 *   - 只做分析，不执行任何 action（analysis_only: true）
 *   - 失败时静默，不再触发新的错误链
 *   - 每次 halt 或路径失败最多触发一次（由调用方控制频率）
 */
function runAiFailureAnalysis(context: string, snapshot?: FailureSnapshot): void {
  threads.start(function () {
    let opTaskId: string | null = null;
    try {
      // 构造给 AI 的任务描述，包含规则分析结论供 AI 参考
      const ruleConclusion = snapshot ? analyzeFailure(snapshot) : "";
      const taskDesc = [
        "【金币任务失败现场分析】",
        `失败场景：${context}`,
        snapshot?.failedStep ? `失败步骤：${snapshot.failedStep}` : "",
        snapshot?.failHint ? `步骤提示：${snapshot.failHint}` : "",
        ruleConclusion ? `规则初判：${ruleConclusion}` : "",
        "请分析：①当前页面是什么？②任务为何失败？③推荐如何恢复？",
      ].filter(Boolean).join("\n");

      setRunInfo("[AI分析] 开始采集现场快照...");

      // 采集无障碍树 + 截图（有截图权限时带截图，没有则只用树）
      const state = captureCurrentState({ withScreenshot: true });

      // 开启单步 AI 操作（用于关联 task_id，便于服务端追踪）
      const startRes = aiOperationStart(taskDesc, {
        screen: [getScreenWidth(), getScreenHeight()],
        trigger: "gold_flow_failure",
        pkg: state.package,
        activity: state.activity,
      });
      if (startRes && startRes.code === 0 && startRes.data?.task_id) {
        opTaskId = startRes.data.task_id;
      }

      setRunInfo(`[AI分析] 发送决策请求（opId=${opTaskId || "无"}）`);

      const decideRes = aiDecide({
        task: taskDesc,
        tree: state.tree,
        package: state.package,
        activity: state.activity,
        screenshot_base64: state.screenshot_base64 || undefined,
        task_id: opTaskId || undefined,
        step_count: 1,
        analysis_only: true, // 服务端标记：只需分析页面状态，不要求生成操作序列
      });

      if (!decideRes || decideRes.code !== 0 || !decideRes.data) {
        setRunInfo(`[AI分析] 接口返回异常: ${decideRes?.message || "null"}`);
        if (opTaskId) aiOperationComplete(opTaskId, "error");
        return;
      }

      const pageRec = decideRes.data.page_recognition || {};
      const ins = decideRes.data.instruction || {};

      const pageType = pageRec.page_type || "未知页面";
      const pageDesc = pageRec.description || "";
      const reasoning = ins.reasoning || "";
      const suggestion = ins.expected_result || ins.action || "";

      // 拼接 AI 给出的分析结论
      const aiConclusion = [
        `页面识别: ${pageType}`,
        pageDesc ? `页面描述: ${pageDesc}` : "",
        reasoning ? `原因分析: ${reasoning}` : "",
        suggestion ? `建议操作: ${suggestion}` : "",
      ].filter(Boolean).join(" | ");

      setRunInfo(`[AI分析] ${aiConclusion}`);
      Record.info(`[AI分析] context=${context} | ${aiConclusion}`);

      // 写入结构化分析日志（可在 server 侧查看完整记录）
      createLogs("ai_failure_analysis", {
        context,
        failedStep: snapshot?.failedStep,
        failHint: snapshot?.failHint,
        ruleAnalysis: ruleConclusion,
        aiPageType: pageType,
        aiPageDesc: pageDesc,
        aiReasoning: reasoning,
        aiSuggestion: suggestion,
        pkg: state.package,
        activity: state.activity,
        time: new Date().toLocaleTimeString("zh-CN"),
      });

      if (opTaskId) aiOperationComplete(opTaskId, "analysis_done");
    } catch (e) {
      Record.warn(`[AI分析] 异常: ${e}`);
      try { if (opTaskId) aiOperationComplete(opTaskId, "error"); } catch { /* skip */ }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// § 4  Checkpoint 恢复（退回金币首页）
// ═══════════════════════════════════════════════════════════

/**
 * 退回金币页 Checkpoint。
 * 使用 quickIsOnGoldPage（双轨）而非 probeGoldCoinPage（bounds敏感），
 * 避免因 mapDiceBtn bounds 反转导致误判"不在金币页"。
 */
function backToGoldCheckpoint(maxRetry = 3): boolean {
  for (let attempt = 0; attempt < maxRetry; attempt++) {
    setRunInfo(`backToGoldCheckpoint: 第${attempt + 1}/${maxRetry}次`);

    if (quickIsOnGoldPage(600)) {
      setRunInfo("backToGoldCheckpoint: ✓ 已在金币页");
      return true;
    }

    // 不在闲鱼 → 先拉回
    if (currentPackage() !== APPNAME) {
      setRunInfo(`backToGoldCheckpoint: 不在闲鱼(${currentPackage()})，拉回`);
      if (!returnToXianyuApp(3)) {
        sleep(2000);
        continue;
      }
      sleep(2000);
    }

    resetBackMainPageLoop();
    backMainPage();
    sleep(1500);

    if (quickIsOnGoldPage(800)) {
      setRunInfo("backToGoldCheckpoint: ✓ 已回金币页");
      return true;
    }

    sleep(800);
  }

  setRunInfo(`backToGoldCheckpoint: ✗ ${maxRetry}次后仍未到金币页`);
  return false;
}

// ═══════════════════════════════════════════════════════════
// § 5  色子相关
// ═══════════════════════════════════════════════════════════

/**
 * 色子按钮状态。
 * offscreen：bounds 反转（弹框打开时按钮被滚出视口），不可用但不代表"无次数"。
 */
export type DiceBtnState =
  | { kind: "rolls"; count: number }
  | { kind: "earn" }
  | { kind: "missing" }
  | { kind: "offscreen" };

function parseDiceBadgeText(text: string): DiceBtnState | null {
  const t = (text || "").trim();
  if (!t) return null;
  if (t === "赚") return { kind: "earn" };
  const match = /[×xX](\d+)/.exec(t);
  if (match) return { kind: "rolls", count: parseInt(match[1], 10) };
  return null;
}

function readDiceBadgeFromNode(btn: UiObject): DiceBtnState | null {
  try {
    const n = typeof btn.childCount === "function" ? btn.childCount() : 0;
    for (let i = 0; i < n; i++) {
      const child = btn.child(i);
      if (!child) continue;
      const text = typeof child.text === "function" ? child.text() || "" : "";
      const parsed = parseDiceBadgeText(text);
      if (parsed) return parsed;
    }
  } catch { /* skip */ }
  return null;
}

export function getDiceBtnState(): DiceBtnState {
  const rawBtn = findByA11yId("mapDiceBtn", 400);
  if (!rawBtn) return { kind: "missing" };

  // 关键修复：弹框打开时 mapDiceBtn 被 WebView 滚出屏幕，bounds.bottom 为负数
  // 此时坐标无效，但按钮本身存在——返回 offscreen 而非 missing
  try {
    const b = rawBtn.bounds();
    if (b.bottom <= b.top) return { kind: "offscreen" };
  } catch { /* skip */ }

  const fromNode = readDiceBadgeFromNode(rawBtn);
  if (fromNode) return fromNode;

  // 兜底：在 btn bounds 范围内找角标 TextView
  try {
    const b = rawBtn.bounds();
    const badges = className("android.widget.TextView").find();
    for (let i = 0; i < (badges as any).length; i++) {
      const el = (badges as any)[i];
      const rb = el.bounds();
      if (rb.left < b.left || rb.top < b.top || rb.right > b.right || rb.bottom > b.bottom) continue;
      const parsed = parseDiceBadgeText(el.text() || "");
      if (parsed) return parsed;
    }
  } catch { /* skip */ }

  return { kind: "missing" };
}

export function isDiceEarnMode(): boolean {
  return getDiceBtnState().kind === "earn";
}

export function getDiceRemainingCount(): number {
  const s = getDiceBtnState();
  return s.kind === "rolls" ? s.count : 0;
}

const DICE_ROLL_ANIMATION_MS = 2800;
const DICE_ROLL_MAX_PER_RUN = 30;

/** 有次数时循环摇骰子，直到次数归零或达上限 */
export function rollAvailableDice(): number {
  let rolled = 0;

  while (rolled < DICE_ROLL_MAX_PER_RUN) {
    if (!assertGoldFlowContinue()) break;
    if (isTaskPopupOpen()) break;

    dismissGoldPageBlockers();
    const diceState = getDiceBtnState();

    if (diceState.kind === "earn" || diceState.kind === "offscreen" || diceState.kind === "missing") {
      if (rolled === 0) setRunInfo(`rollAvailableDice: 无次数可摇（${diceState.kind}）`);
      else setRunInfo(`rollAvailableDice: 已摇完，共 ${rolled} 次`);
      break;
    }

    if (diceState.kind !== "rolls" || diceState.count <= 0) {
      setRunInfo(`rollAvailableDice: 次数归零，共摇 ${rolled} 次`);
      break;
    }

    // 只有 bounds 合法时才点击
    const btn = getDiceBtnValid();
    if (!btn) {
      setRunInfo("rollAvailableDice: mapDiceBtn bounds 异常，停止摇骰");
      break;
    }

    setRunInfo(`rollAvailableDice: ×${diceState.count}，第 ${rolled + 1} 次`);
    tryClickNode(btn);
    rolled++;
    sleep(DICE_ROLL_ANIMATION_MS);
    dismissGoldPageBlockers();
  }

  if (rolled >= DICE_ROLL_MAX_PER_RUN) {
    setRunInfo(`rollAvailableDice: 达单轮上限 ${DICE_ROLL_MAX_PER_RUN}`);
  }
  return rolled;
}

// ═══════════════════════════════════════════════════════════
// § 6  任务弹框操作
// ═══════════════════════════════════════════════════════════

/** 确保任务弹框打开，如未打开则尝试触发 */
export function openTaskPopup(): boolean {
  if (isTaskPopupOpen()) return true;
  dismissGoldPageBlockers();
  if (isTaskPopupOpen()) return true;

  // 方式一：feedsTaskMaskBox 遮罩入口
  const entry = findByA11yId("feedsTaskMaskBox", 1200);
  if (entry) {
    setRunInfo("openTaskPopup: 点击 feedsTaskMaskBox");
    entry.click();
    sleep(1500);
    dismissGoldPageBlockers();
    if (isTaskPopupOpen()) return true;
  }

  // 方式二：色子为「赚」模式，点击 mapDiceBtn 进入任务引导
  const diceState = getDiceBtnState();
  if (diceState.kind === "earn") {
    const btn = getDiceBtnValid();
    if (btn) {
      setRunInfo("openTaskPopup: 点击 mapDiceBtn（赚模式）");
      tryClickNode(btn);
      sleep(1500);
      dismissGoldPageBlockers();
    }
  }

  return isTaskPopupOpen();
}

function findTaskListScrollBox(): UiObject | null {
  const wrap = findByA11yId("taskListWrap", 500);
  if (wrap) {
    const local = (wrap as any).findOne(className("android.view.View").scrollable(true));
    if (local) return local;
  }
  return className("android.view.View").scrollable(true).findOne(800) as any;
}

const TASK_LIST_VISIBLE_TOP = 1100;
const TASK_LIST_VISIBLE_BOTTOM = 2300;
const TASK_SCROLL_MAX = 8;

/** 滚动直到任务标题进入可视区，返回是否成功 */
function scrollToTaskVisible(title: string): boolean {
  for (let i = 0; i < TASK_SCROLL_MAX; i++) {
    const el = findTaskTitleStrict(title);
    if (!el) return false;

    const top = el.bounds().top;
    if (top >= TASK_LIST_VISIBLE_TOP && top <= TASK_LIST_VISIBLE_BOTTOM) return true;

    if (top > TASK_LIST_VISIBLE_BOTTOM) {
      swipe(10, 2200, 10, 1200, 500); // 向上滑（列表往上走）
    } else {
      swipe(10, 1259, 10, 2300, 500); // 向下滑
    }
    sleep(400);
  }
  return false;
}

function findGoBtnAligned(taskTitleTop: number): UiObject | null {
  const btns = findAllInTaskList("去完成");
  if (!btns || !(btns as any).length) return null;
  for (let i = 0; i < (btns as any).length; i++) {
    if (taskTitleTop - (btns as any)[i].bounds().top < 20) return (btns as any)[i];
  }
  return null;
}

/**
 * 在任务弹框中查找与任务标题同行的「领取奖励」按钮。
 * 出现此按钮 = 任务已被服务端计数，是任务真正完成的铁证。
 */
function findRewardBtnAligned(taskTitleTop: number): UiObject | null {
  const btns = findAllInTaskList("领取奖励");
  if (!btns || !(btns as any).length) return null;
  for (let i = 0; i < (btns as any).length; i++) {
    if (Math.abs((btns as any)[i].bounds().top - taskTitleTop) < 30) {
      return (btns as any)[i];
    }
  }
  return null;
}

/** 领取所有 awaitingRewardClaim 任务的奖励 */
export function checkGetGold() {
  if (!assertGoldFlowContinue()) return;
  const pending = taskList.filter((t: any) => t.awaitingRewardClaim === true);
  if (pending.length === 0) {
    setRunInfo("checkGetGold: 无待领取任务，跳过");
    return;
  }
  sleep(400);
  const rewards = findAllInTaskList("领取奖励");
  if (!rewards || !(rewards as any).length) {
    setRunInfo("checkGetGold: 无可领取奖励");
    return;
  }
  setRunInfo(`checkGetGold: ${(rewards as any).length} 个[领取奖励]`);

  for (let i = 0; i < (rewards as any).length; i++) {
    if (!assertGoldFlowContinue()) return;
    const reward = (rewards as any)[i];
    const rTop = reward.bounds().top;

    let matched: any = null;
    for (let j = 0; j < pending.length; j++) {
      const task: any = pending[j];
      const titleEl = findTaskTitleStrict(task.title);
      if (!titleEl) continue;
      if (titleEl.bounds().top - rTop < 20) { matched = task; break; }
    }

    if (matched) {
      reward.click();
      matched.hasRun = true;
      matched.awaitingRewardClaim = false;
      setRunInfo(`checkGetGold: 已领[${matched.title}]奖励`);
    } else {
      reward.click();
      pending.forEach((t: any) => { t.awaitingRewardClaim = false; t.hasRun = true; });
      setRunInfo("checkGetGold: 无同行匹配，点击领取");
    }
    sleep(800);
  }
}

// ═══════════════════════════════════════════════════════════
// § 7  单任务路径
// ═══════════════════════════════════════════════════════════

/** 单任务执行结果：成功 or 失败（不再有 retry/skip，循环由调用方统一控制） */
type TaskRunResult = "done" | "failed";

/** 单轮任务失败记录，追加到 task.failRecords[] */
type TaskFailRecord = {
  round: number;
  failedStep: string;
  failHint: string;
  ruleAnalysis: string;
  timestamp: string;
};

/**
 * 用路径引擎执行单个任务。
 *
 * 行为：无论成功还是失败，执行完毕后都会尝试退回 Checkpoint + 开弹框，
 * 保证调用方的任务循环可以继续执行下一个任务，不会因单个任务卡死整轮。
 *
 * 路径步骤：
 *   1. 确认弹框打开
 *   2. 找到任务标题
 *   3. 滚动到可视区
 *   4. 点击「去完成」
 *   5. 执行任务回调（可选，异常不中止路径）
 *   6. 归位-返回金币页
 *   7. 归位-重新打开弹框（可选）
 *   8. 领取奖励（可选）
 */
function runSingleTask(task: any, round: number = 1): TaskRunResult {
  const title: string = task.title;

  // 设置任务上下文：此后所有 setRunInfo 调用（含回调内部）的 trace 日志都会带上 task 字段
  setTaskContext(title);

  const steps: PathStep[] = [
    {
      label: "确认任务弹框打开",
      action: () => isTaskPopupOpen(),
      failHint: "taskWrap/taskListWrap 不在无障碍树，弹框可能被关闭",
    },
    {
      label: "找到任务标题",
      action: () => !!findTaskTitleStrict(title),
      failHint: `taskListWrap 内未找到文本[${title}]，任务可能已完成或不在本轮列表`,
    },
    {
      label: "滚动到可视区",
      action: () => scrollToTaskVisible(title),
      failHint: `${TASK_SCROLL_MAX}次滚动后[${title}]仍在可视区外`,
    },
    {
      label: "点击去完成",
      action: () => {
        const el = findTaskTitleStrict(title);
        if (!el) return false;
        const goBtn = findGoBtnAligned(el.bounds().top);
        if (!goBtn) return false;
        goBtn.click();
        sleep(1000);
        return true;
      },
      failHint: `找不到与[${title}]同行的[去完成]按钮（taskTitleTop - btnTop < 20）`,
    },
    {
      label: "执行任务回调",
      required: false,
      action: () => {
        try {
          task.callBack();
          return true;
        } catch (e) {
          Record.warn(`[${title}] callBack 异常: ${e}`);
          return false;
        }
      },
    },
    {
      label: "归位-返回金币页",
      action: () => {
        if (currentPackage() !== APPNAME) {
          setRunInfo(`[${title}] 归位: 在外部 App(${currentPackage()})，拉回闲鱼`);
          if (!returnToXianyuApp(4)) return false;
          sleep(2000);
        }
        resetBackMainPageLoop();
        backMainPage();
        sleep(1500);
        return quickIsOnGoldPage(1000);
      },
      failHint: "无法回到金币页，可能卡在外部 App 或 backMainPage 超时",
    },
    {
      label: "归位-重新打开弹框",
      required: false,
      action: () => {
        dismissGoldPageBlockers();
        if (isTaskPopupOpen()) return true;
        return openTaskPopup();
      },
    },
    {
      // 验证任务是否真正被服务端计数：任务行右侧出现「领取奖励」按钮是铁证
      label: "验证完成-领取奖励",
      required: false,
      action: () => {
        sleep(400);
        if (!isTaskPopupOpen()) {
          setRunInfo(`[${title}] 验证: 弹框未开，跳过奖励检查`);
          return false;
        }
        const el = findTaskTitleStrict(title);
        if (!el) {
          setRunInfo(`[${title}] 验证: 任务标题消失（可能已自动完成）`);
          task.rewardVerified = true; // 任务行消失通常意味着已完成
          return true;
        }
        const titleTop = el.bounds().top;
        const rewardBtn = findRewardBtnAligned(titleTop);
        if (rewardBtn) {
          setRunInfo(`[${title}] 验证: ✓ 右侧出现「领取奖励」按钮 → 任务已计数，立即领取`);
          rewardBtn.click();
          sleep(800);
          task.rewardVerified = true;
          task.hasRun = true;
          return true;
        }
        // 未见领取按钮：可能任务未计数，也可能自动领取了，保守记录
        setRunInfo(`[${title}] 验证: ⚠ 未见「领取奖励」按钮（任务可能未计数，或已自动领取）`);
        task.rewardVerified = false;
        return false;
      },
    },
  ];

  // 路径名即任务名，日志里 [任务名] 会自动放最前
  const result = runPath(title, steps);

  if (result.ok) {
    task.hasRun = true;
    task.awaitingRewardClaim = false;
    task.lastResult = "done";
    const verifyNote = task.rewardVerified === true ? "（已验证领取按钮）" :
                       task.rewardVerified === false ? "（⚠未见领取按钮）" : "";
    setRunInfo(`[${title}] ✓ done${verifyNote}`);
    clearTaskContext();
    return "done";
  }

  // ── 失败处理 ──────────────────────────────────────────────
  // 1. 记录失败快照（规则分析 + AI 异步分析）
  logPathFailure(result);

  // 2. 将本轮失败记录追加到任务对象，供结束时生成 error 日志
  const snap = captureFailureSnapshot(result.pathName, result);
  const ruleAnalysis = analyzeFailure(snap);
  task.failCount = (task.failCount || 0) + 1;
  if (!task.failRecords) task.failRecords = [];
  (task.failRecords as TaskFailRecord[]).push({
    round,
    failedStep: result.failedStep || "?",
    failHint: result.failHint || "",
    ruleAnalysis,
    timestamp: new Date().toLocaleTimeString("zh-CN"),
  });

  // 3. 无论何种失败，都尝试退回 Checkpoint + 恢复弹框
  //    保证调用方循环可以继续执行下一个任务（不级联卡死）
  task.lastResult = "failed";
  setRunInfo(`[${title}] ✗ failed，退回 Checkpoint 准备执行下一任务`);
  backToGoldCheckpoint();
  openTaskPopup();
  clearTaskContext();

  return "failed";
}

// ═══════════════════════════════════════════════════════════
// § 8  主任务循环
// ═══════════════════════════════════════════════════════════

const MAIN_POPUP_TASK_ROUNDS_MAX = 3;

/**
 * 将最终失败任务写入日期前缀的 error 日志。
 * 文件名格式：YYYYMMDD-error（createLogs 内部会加路径后缀）
 */
function writeErrorSummaryLog(startTime: string): void {
  const failedTasks = (taskList as any[]).filter((t: any) => !t.hasRun && (t.failCount || 0) > 0);
  if (failedTasks.length === 0) return;

  const now = new Date();
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  createLogs(`${dateStr}-error`, {
    summary: `金币任务失败汇总：${failedTasks.length}/${(taskList as any[]).length} 个任务未完成`,
    startTime,
    endTime: now.toLocaleTimeString("zh-CN"),
    totalRounds: MAIN_POPUP_TASK_ROUNDS_MAX,
    allTasks: (taskList as any[]).map((t: any) => ({
      title: t.title,
      hasRun: !!t.hasRun,
      failCount: t.failCount || 0,
    })),
    failedTasks: failedTasks.map((t: any) => ({
      title: t.title,
      failCount: t.failCount || 0,
      failRecords: (t.failRecords || []) as TaskFailRecord[],
    })),
  });
  setRunInfo(`writeErrorSummaryLog: 已写入 ${dateStr}-error 日志`);
}

/**
 * 主任务循环。最多执行 MAIN_POPUP_TASK_ROUNDS_MAX 轮。
 *
 * 规则：
 *   - 每轮依次遍历 taskList
 *   - 每个任务无论成功/失败，执行完后立即跳到下一个（不卡死在单任务）
 *   - 成功（done）→ task.hasRun = true，后续所有轮均跳过
 *   - 失败（failed）→ 本轮跳过继续，下一轮重试
 *   - 全部 done 后提前退出
 *   - 3 轮结束仍有失败 → 写入 YYYYMMDD-error 日志
 */
export function mainPopupTask() {
  const startTime = new Date().toLocaleTimeString("zh-CN");

  // 初始化失败记录字段（防止 undefined）
  (taskList as any[]).forEach((t: any) => {
    if (!t.failCount) t.failCount = 0;
    if (!t.failRecords) t.failRecords = [];
  });

  try {
    for (let round = 1; round <= MAIN_POPUP_TASK_ROUNDS_MAX; round++) {
      if (!assertGoldFlowContinue()) return;
      setRunInfo(`mainPopupTask: ── 第 ${round}/${MAIN_POPUP_TASK_ROUNDS_MAX} 轮 ──`);

      // 每轮开始：清遮罩，确认弹框
      dismissGoldPageBlockers();
      if (!isTaskPopupOpen()) {
        haltGoldFlow("mainPopupTask: 任务弹框不可见（taskWrap/taskListWrap 均缺失）");
        return;
      }

      // 第一轮做签到
      if (round === 1) {
        const qdBtn = findTaskPopupSignIn();
        if (qdBtn) { qdBtn.click(); sleep(800); }
      }

      // 每轮先领取上轮已完成的奖励
      checkGetGold();
      if (!assertGoldFlowContinue()) return;

      // 本轮待执行：成功（hasRun）跳过，失败/未执行的重试
      const pendingThisRound = (taskList as any[]).filter(
        (t: any) => !t.hasRun && !t.awaitingRewardClaim
      );

      if (pendingThisRound.length === 0) {
        setRunInfo("mainPopupTask: 全部任务完成 ✓");
        flushTraces("goldCoin");
        return;
      }

      setRunInfo(
        `mainPopupTask: 第${round}轮 待执行 ${pendingThisRound.length}/${(taskList as any[]).length} 个`
      );

      for (let i = 0; i < pendingThisRound.length; i++) {
        if (!assertGoldFlowContinue()) return;

        const task = pendingThisRound[i];

        // 每个任务前确认弹框（runSingleTask 内部已有恢复逻辑，此处是双保险）
        if (!isTaskPopupOpen()) {
          setRunInfo(`mainPopupTask: [${task.title}] 前弹框未开，尝试恢复`);
          if (!backToGoldCheckpoint() || !openTaskPopup()) {
            setRunInfo("mainPopupTask: 弹框无法恢复，跳过本轮剩余任务");
            break; // 跳出本轮 for，进入下一轮
          }
        }

        setRunInfo(
          `[${task.title}] 开始执行 [第${round}轮 ${i + 1}/${pendingThisRound.length}]`
        );
        const runResult = runSingleTask(task, round);
        setRunInfo(`[${task.title}] 结果 → ${runResult} [第${round}轮]`);

        // 每个任务结束后异步同步全量状态到 Web 端（不阻塞主流程）
        threads.start(function () {
          try {
            syncGoldTasks((taskList as any[]).map((t: any) => ({
              title: t.title,
              hasRun: !!t.hasRun,
              rewardVerified: t.rewardVerified !== undefined ? t.rewardVerified : null,
              failCount: t.failCount || 0,
              lastResult: t.lastResult || null,
              failRecords: t.failRecords || [],
            })));
          } catch { /* 同步失败不影响主流程 */ }
        });
        // 无论 done / failed，继续执行下一个任务
      }

      // 本轮结束
      const stillPending = (taskList as any[]).filter(
        (t: any) => !t.hasRun && !t.awaitingRewardClaim
      );
      if (stillPending.length === 0) {
        setRunInfo("mainPopupTask: 全部任务完成 ✓");
        flushTraces("goldCoin");
        return;
      }
      setRunInfo(`mainPopupTask: 第${round}轮结束，剩 ${stillPending.length} 个未完成，继续下一轮`);
    }

    // 全部轮次结束，仍有失败 → 写 error 日志
    const finalFailed = (taskList as any[]).filter((t: any) => !t.hasRun);
    if (finalFailed.length > 0) {
      const titles = finalFailed.map((t: any) => t.title).join("、");
      setRunInfo(
        `mainPopupTask: ${MAIN_POPUP_TASK_ROUNDS_MAX} 轮结束，${finalFailed.length} 个未完成（${titles}），写入错误日志`
      );
      writeErrorSummaryLog(startTime);
    } else {
      setRunInfo("mainPopupTask: 全部任务完成 ✓");
      flushTraces("goldCoin");
    }
  } catch (error) {
    haltGoldFlow(`mainPopupTask 异常: ${error}`);
    Record.error(`mainPopupTask: ${error}`);
  }
}

// ═══════════════════════════════════════════════════════════
// § 9  兼容旧接口（保持外部调用不变）
// ═══════════════════════════════════════════════════════════

/** @deprecated 已由 dismissGoldPageBlockers 替代，保留兼容性 */
export function runActivePopups() {
  try {
    if (!assertGoldFlowContinue()) return;
    dismissGoldPageBlockers();
  } catch (error) {
    setRunInfo(`runActivePopups: 异常 ${error}`);
    Record.error(`runActivePopups: ${error}`);
  }
}

/** @deprecated 已由 mainPopupTask 替代，保留兼容性 */
export function mainPopupFn(title: string, callback: () => void, task: any) {
  task.callBack = callback;
  const result = runSingleTask(task, 1);
  setRunInfo(`mainPopupFn[${title}]: ${result}`);
}

export function xianyuBack(retry = 0) {
  if (retry > 5) {
    haltGoldFlow("xianyuBack: 超过 5 次仍无法回到闲鱼");
    return;
  }
  launch(APPNAME);
  sleep(2000);
  if (currentPackage() !== APPNAME) xianyuBack(retry + 1);
}

// ═══════════════════════════════════════════════════════════
// § 10  主入口
// ═══════════════════════════════════════════════════════════

export function coinExchange() {
  try {
    if (!assertGoldFlowContinue()) return;
    resetGoldFlowState();
    setRunInfo("coinExchange: 开始");

    dismissGoldPageBlockers();
    if (!assertGoldFlowContinue()) return;

    // ── 页面验证（用快速双轨检测，不依赖 bounds）──────────────
    if (!quickIsOnGoldPage(1000)) {
      // 兜底：用原有的 probeGoldCoinPage 打一次日志帮助诊断
      const probe = probeGoldCoinPage(200);
      haltGoldFlow(
        `不在金币地图页 pkg=${currentPackage()} act=${currentActivity()} | probe: ${probe.reason}`
      );
      return;
    }

    dismissGoldPageBlockers();

    // ── 摇骰子 ──────────────────────────────────────────────
    const diceState = getDiceBtnState();
    if (diceState.kind === "rolls" && diceState.count > 0) {
      setRunInfo(`coinExchange: 色子 ×${diceState.count}，先摇骰子`);
      rollAvailableDice();
      if (!assertGoldFlowContinue()) return;
      dismissGoldPageBlockers();
    } else if (diceState.kind === "earn") {
      setRunInfo("coinExchange: 色子显示「赚」，跳过摇骰，进入任务流程");
    } else if (diceState.kind === "offscreen") {
      setRunInfo("coinExchange: mapDiceBtn 在屏外（弹框已开或页面加载中），直接检查弹框");
    } else {
      setRunInfo(`coinExchange: 色子状态 ${diceState.kind}，进入任务流程`);
    }

    // ── 确保任务弹框打开 ─────────────────────────────────────
    if (!isTaskPopupOpen()) {
      if (!openTaskPopup()) {
        dismissGoldPageBlockers();
        if (!isTaskPopupOpen()) {
          haltGoldFlow(
            "在金币页但无法打开任务弹框(taskWrap)。若出现新拦截弹框请采集 pages 后补充 goldBlockers 规则"
          );
          return;
        }
      }
    }

    mainPopupTask();
  } catch (error) {
    haltGoldFlow(`coinExchange 异常: ${error}`);
    Record.error(`coinExchange: ${error}`);
  }
}

// ═══════════════════════════════════════════════════════════
// § 11  重导出（保持下游 import 不变）
// ═══════════════════════════════════════════════════════════

export {
  assertOnGoldCoinPage,
  isOnGoldCoinPage,
  probeGoldCoinPage,
} from "./goldPageDetect";
export type { GoldPageConfidence, GoldPageProbe } from "./goldPageDetect";
