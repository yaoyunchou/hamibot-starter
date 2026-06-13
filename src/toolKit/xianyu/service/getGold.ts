/**
 * 金币页任务流程（主弹框 / 领取 / 去完成）
 *
 * 注意：主弹框元素 taskName = mainPopup；金币主页元素 taskName = coinExchangeMain
 * 状态机见 doc/flow/03_gold_coin.txt
 *
 * 遇阻即停：无法识别的页面/弹框/任务行会 haltGoldFlow()，不再无限递归，便于抓取页面后继续处理。
 */
import { Record } from "../../../lib/logger";
import { createLogs } from "../../../lib/service";
import { findByA11yId, tryClickNode } from "../utils/common";
import { APPNAME, flushTraces, PageType, setRunInfo } from "./base";
import { dumpActiveWindowLayout } from "./layoutDump";
import { dismissGoldPageBlockers, resetGoldBlockerRunState } from "./goldBlockers";
import { backMainPage, resetBackMainPageLoop, returnToXianyuApp, taskList } from "./getMainPopup";
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

const TASK_LIST_VISIBLE_TOP = 1100;
const TASK_LIST_VISIBLE_BOTTOM = 2300;
const TASK_SCROLL_MAX = 8;
const MAIN_POPUP_TASK_ROUNDS_MAX = 3;

let maxLoopMap: any = {
  scrollUp: 1,
  scrollDown: 1,
  coinExchangeRunTime: 1,
  allTaskOver: false,
};

let _goldFlowHalted = false;

export function resetGoldFlowState() {
  _goldFlowHalted = false;
  maxLoopMap.scrollUp = 1;
  maxLoopMap.scrollDown = 1;
  maxLoopMap.coinExchangeRunTime = 1;
  maxLoopMap.allTaskOver = false;
  resetGoldBlockerRunState();
}

export const isGoldFlowHalted = (): boolean => _goldFlowHalted;

function assertGoldFlowContinue(): boolean {
  return !_goldFlowHalted && !shouldStopCurrentTask();
}

export function haltGoldFlow(reason: string, opts?: { dumpLayout?: boolean }) {
  if (_goldFlowHalted) return;
  _goldFlowHalted = true;
  const msg = `【金币任务停止】${reason}`;
  setRunInfo(msg);
  Record.error(msg);
  requestTaskStop(reason);

  if (opts?.dumpLayout === false) return;

  threads.start(function () {
    try {
      const layout = dumpActiveWindowLayout();
      createLogs("gold_halt", {
        reason,
        time: new Date().toLocaleTimeString("zh-CN"),
        package: layout.package,
        activity: layout.activity,
        node_count: layout.tree ? countTreeNodes(layout.tree) : 0,
        tree: layout.tree,
      });
    } catch (e) {
      Record.warn("haltGoldFlow dump: " + e);
    }
  });
}

function countTreeNodes(node: any): number {
  if (!node) return 0;
  let n = 1;
  const ch = node.children;
  if (Array.isArray(ch)) {
    for (let i = 0; i < ch.length; i++) n += countTreeNodes(ch[i]);
  }
  return n;
}

export {
  assertOnGoldCoinPage,
  isOnGoldCoinPage,
  probeGoldCoinPage,
} from "./goldPageDetect";
export type { GoldPageConfidence, GoldPageProbe } from "./goldPageDetect";

export function isTaskPopupOpen(): boolean {
  return !!(findByA11yId("taskWrap", 500) || findByA11yId("taskListWrap", 500));
}

/** mapDiceBtn 角标：×N = 有次数可摇；「赚」= 无次数，需做任务获取 */
export type DiceBtnState =
  | { kind: "rolls"; count: number }
  | { kind: "earn" }
  | { kind: "missing" };

function parseDiceBadgeText(text: string): DiceBtnState | null {
  const t = (text || "").trim();
  if (!t) return null;
  if (t === "赚") return { kind: "earn" };
  const match = /[×xX](\d+)/.exec(t);
  if (match) return { kind: "rolls", count: parseInt(match[1], 10) };
  return null;
}

function readDiceBadgeFromBtn(btn: any): DiceBtnState | null {
  try {
    const n = typeof btn.childCount === "function" ? btn.childCount() : 0;
    for (let i = 0; i < n; i++) {
      const child = btn.child(i);
      if (!child) continue;
      const text = typeof child.text === "function" ? child.text() || "" : "";
      const parsed = parseDiceBadgeText(text);
      if (parsed) return parsed;
    }
  } catch {
    /* skip */
  }
  return null;
}

export function getDiceBtnState(): DiceBtnState {
  const btn = findByA11yId("mapDiceBtn", 400);
  if (!btn) return { kind: "missing" };
  const fromBtn = readDiceBadgeFromBtn(btn);
  if (fromBtn) return fromBtn;

  try {
    const b = btn.bounds();
    const badges = className("android.widget.TextView").find();
    for (let i = 0; i < badges.length; i++) {
      const el = badges[i];
      const rb = el.bounds();
      if (rb.left < b.left || rb.top < b.top || rb.right > b.right || rb.bottom > b.bottom) continue;
      const parsed = parseDiceBadgeText(el.text() || "");
      if (parsed) return parsed;
    }
  } catch {
    /* skip */
  }
  return { kind: "missing" };
}

export function isDiceEarnMode(): boolean {
  return getDiceBtnState().kind === "earn";
}

/** 剩余可摇次数；「赚」或找不到按钮时返回 0 */
export function getDiceRemainingCount(): number {
  const state = getDiceBtnState();
  return state.kind === "rolls" ? state.count : 0;
}

const DICE_ROLL_ANIMATION_MS = 2800;
const DICE_ROLL_MAX_PER_RUN = 30;

/**
 * 色子有点数时循环点击 mapDiceBtn 摇骰子收金币。
 * 每次点击后 dismiss 拦截弹框，直到次数归零或达到上限。
 */
export function rollAvailableDice(): number {
  let rolled = 0;
  while (rolled < DICE_ROLL_MAX_PER_RUN) {
    if (!assertGoldFlowContinue()) break;
    if (isTaskPopupOpen()) break;

    dismissGoldPageBlockers();
    const diceState = getDiceBtnState();
    if (diceState.kind === "earn") {
      setRunInfo("rollAvailableDice: 色子角标为「赚」，无次数可摇");
      break;
    }
    const remaining = diceState.kind === "rolls" ? diceState.count : 0;
    if (remaining <= 0) {
      if (rolled === 0) {
        setRunInfo("rollAvailableDice: 未检测到 ×N 次数");
      } else {
        setRunInfo(`rollAvailableDice: 骰子已用完，共摇 ${rolled} 次`);
      }
      break;
    }

    const btn = findByA11yId("mapDiceBtn", 800);
    if (!btn) {
      setRunInfo("rollAvailableDice: 找不到 mapDiceBtn");
      break;
    }

    setRunInfo(`rollAvailableDice: 剩余 ×${remaining}，点击摇骰子 (${rolled + 1})`);
    tryClickNode(btn);
    rolled++;
    sleep(DICE_ROLL_ANIMATION_MS);
    dismissGoldPageBlockers();
  }

  if (rolled >= DICE_ROLL_MAX_PER_RUN) {
    setRunInfo(`rollAvailableDice: 已达单轮上限 ${DICE_ROLL_MAX_PER_RUN} 次`);
  }
  return rolled;
}

export function openTaskPopup(): boolean {
  if (isTaskPopupOpen()) return true;
  dismissGoldPageBlockers();
  if (isTaskPopupOpen()) return true;

  const entry = findByA11yId("feedsTaskMaskBox", 1200);
  if (entry) {
    setRunInfo("openTaskPopup: 点击 feedsTaskMaskBox");
    entry.click();
    sleep(1500);
    dismissGoldPageBlockers();
    if (isTaskPopupOpen()) return true;
  }

  // 色子角标为「赚」：点击 mapDiceBtn 进入做任务引导（非摇骰子）
  if (isDiceEarnMode()) {
    const btn = findByA11yId("mapDiceBtn", 800);
    if (btn) {
      setRunInfo("openTaskPopup: 色子显示「赚」，点击 mapDiceBtn 引导做任务");
      tryClickNode(btn);
      sleep(1500);
      dismissGoldPageBlockers();
    }
  }

  return isTaskPopupOpen();
}

function findTaskListScrollBox(): any {
  const wrap = findByA11yId("taskListWrap", 500);
  if (wrap) {
    const local = wrap.findOne(className("android.view.View").scrollable(true));
    if (local) return local;
  }
  return className("android.view.View").scrollable(true).findOne(800);
}

export function runActivePopups() {
  try {
    if (!assertGoldFlowContinue()) return;
    dismissGoldPageBlockers();
  } catch (error) {
    setRunInfo(`runActivePopups: 异常 ${error}`);
    Record.error(`runActivePopups, ${error}`);
  }
}

function isTitleAlignedWithActionBtn(taskTitleTop: number, actionBtnTop: number): boolean {
  return taskTitleTop - actionBtnTop < 20;
}

export function checkGetGold() {
  if (!assertGoldFlowContinue()) return;
  const pending = taskList.filter((t: any) => t.awaitingRewardClaim === true);
  if (pending.length === 0) {
    setRunInfo("checkGetGold: 无待领取任务，跳过");
    return;
  }
  setRunInfo("checkGetGold: 检查领取奖励");
  sleep(400);
  const rewards = findAllInTaskList("领取奖励");
  if (rewards.length === 0) {
    setRunInfo("checkGetGold: 无可领取奖励");
    return;
  }
  setRunInfo(`checkGetGold: 共 ${rewards.length} 个[领取奖励]`);
  for (let i = 0; i < rewards.length; i++) {
    if (!assertGoldFlowContinue()) return;
    const reward = rewards[i];
    const rTop = reward.bounds().top;
    let matched: any = null;
    for (let j = 0; j < pending.length; j++) {
      const task: any = pending[j];
      const titleEl = findTaskTitleStrict(task.title);
      if (!titleEl) continue;
      const tTop = titleEl.bounds().top;
      if (isTitleAlignedWithActionBtn(tTop, rTop)) {
        matched = task;
        setRunInfo(`checkGetGold: [领取奖励] 与任务[${task.title}]同行`);
        break;
      }
    }
    if (matched) {
      reward.click();
      matched.hasRun = true;
      matched.awaitingRewardClaim = false;
    } else {
      reward.click();
      pending.forEach((t: any) => {
        t.awaitingRewardClaim = false;
        t.hasRun = true;
      });
    }
    sleep(800);
  }
}

function findMainPopupActionAligned(taskTitleTop: number, keyword: string): any {
  const btns = findAllInTaskList(keyword);
  if (btns.length === 0) return null;
  for (let i = 0; i < btns.length; i++) {
    const react = btns[i].bounds();
    if (taskTitleTop - react.top < 20) return btns[i];
  }
  return null;
}

function scrollTaskList(direction: "up" | "down") {
  if (direction === "up") {
    swipe(10, 2200, 10, 1200, 500);
  } else {
    swipe(10, 1259, 10, 2300, 500);
  }
  sleep(400);
}

export function mainPopupFn(title: string, callback: () => void, task: any) {
  if (!assertGoldFlowContinue()) return;
  setRunInfo(`mainPopupFn: 开始[${title}]`);

  dismissGoldPageBlockers();

  if (!isTaskPopupOpen()) {
    if (isOnGoldCoinPage()) {
      setRunInfo(`mainPopupFn[${title}]: 已在金币页，尝试打开任务弹框`);
      dismissGoldPageBlockers();
      openTaskPopup();
    } else {
      setRunInfo(`mainPopupFn[${title}]: 不在金币页，执行 backMainPage`);
      backMainPage();
    }
    dismissGoldPageBlockers();
    if (!isTaskPopupOpen()) {
      haltGoldFlow(`执行任务[${title}]时任务弹框未打开，请抓取当前页面`);
    }
    return;
  }

  if (!findTaskListScrollBox()) {
    haltGoldFlow(`任务[${title}]：找不到可滚动列表(taskListWrap)，请抓取页面`);
    return;
  }

  if (title === "看视频奖励100币") {
    checkGetGold();
  }

  let scrollAttempts = 0;
  while (scrollAttempts <= TASK_SCROLL_MAX) {
    if (!assertGoldFlowContinue()) return;

    const titleEl = findTaskTitleStrict(title);
    if (!titleEl) {
      if (isTaskPopupOpen()) {
        task.awaitingRewardClaim = true;
        return;
      }
      haltGoldFlow(`找不到任务标题[${title}]且弹框已关闭，请抓取页面`);
      return;
    }

    const top = titleEl.bounds().top;
    if (top > TASK_LIST_VISIBLE_BOTTOM) {
      scrollAttempts++;
      scrollTaskList("up");
      continue;
    }
    if (top < TASK_LIST_VISIBLE_TOP) {
      scrollAttempts++;
      scrollTaskList("down");
      continue;
    }

    const goBtn = findMainPopupActionAligned(top, "去完成");
    if (!goBtn) {
      haltGoldFlow(`任务[${title}]已在可视区但找不到同行「去完成」，请抓取 taskListWrap 页面`);
      return;
    }

    goBtn.click();
    sleep(1000);
    try {
      callback();
    } catch (e) {
      haltGoldFlow(`任务[${title}] callback 异常: ${e}`);
      return;
    }
    sleep(1200);

    if (currentPackage() !== APPNAME) {
      setRunInfo(`mainPopupFn[${title}]: 任务在外部 App(${currentPackage()})，拉回闲鱼…`);
      if (!returnToXianyuApp(6)) {
        haltGoldFlow(`任务[${title}] 完成后仍在 ${currentPackage()}，请手动回到闲鱼`);
        return;
      }
      sleep(2000);
    }

    resetBackMainPageLoop();
    backMainPage();
    sleep(1500);
    if (!assertOnGoldCoinPage(`mainPopupFn[${title}] 完成后`, 1200)) {
      const probe = probeGoldCoinPage(200);
      haltGoldFlow(`任务[${title}] 完成后未回到金币地图 (${probe.reason})，请抓取页面`);
      return;
    }

    task.awaitingRewardClaim = true;
    return;
  }

  haltGoldFlow(`任务[${title}] 滚动 ${TASK_SCROLL_MAX} 次仍未进入可视区，请抓取 taskListWrap 页面`);
}

export function mainPopupTask(round: number = 0) {
  try {
    if (!assertGoldFlowContinue()) return;
    setRunInfo(`mainPopupTask: 第 ${round + 1}/${MAIN_POPUP_TASK_ROUNDS_MAX} 轮`);

    dismissGoldPageBlockers();
    if (!isTaskPopupOpen()) {
      haltGoldFlow("mainPopupTask: 任务弹框 taskWrap 不存在（已尝试关闭拦截弹框），请抓取金币页");
      return;
    }

    checkGetGold();
    if (!assertGoldFlowContinue()) return;

    const pendingTasks = taskList.filter((item: any) => !item.hasRun);
    if (pendingTasks.length === 0) {
      maxLoopMap.allTaskOver = true;
      flushTraces("goldCoin");
      return;
    }

    const qdBtn = findTaskPopupSignIn();
    if (qdBtn) {
      qdBtn.click();
      sleep(800);
    }

    for (let i = 0; i < taskList.length; i++) {
      if (!assertGoldFlowContinue()) return;
      const task: any = taskList[i];
      if (task.awaitingRewardClaim && !task.hasRun) continue;
      if (!task.hasRun) {
        mainPopupFn(task.title, task.callBack, task);
        if (_goldFlowHalted) return;
      }
    }

    if (!assertGoldFlowContinue()) return;

    const stillPending = taskList.filter((item: any) => !item.hasRun);
    if (stillPending.length === 0) {
      maxLoopMap.allTaskOver = true;
      flushTraces("goldCoin");
      return;
    }

    if (round + 1 < MAIN_POPUP_TASK_ROUNDS_MAX) {
      mainPopupTask(round + 1);
      return;
    }

    const titles = stillPending.map((t: any) => t.title).join("、");
    haltGoldFlow(
      `${MAIN_POPUP_TASK_ROUNDS_MAX} 轮后仍有 ${stillPending.length} 个未完成: ${titles}。请抓取页面后补充 taskList`
    );
  } catch (error) {
    haltGoldFlow(`mainPopupTask 异常: ${error}`);
    Record.error(`mainPopup, ${error}`);
  }
}

export function xianyuBack(retry = 0) {
  if (retry > 5) {
    haltGoldFlow("xianyuBack: 超过 5 次仍无法回到闲鱼");
    return;
  }
  launch(APPNAME);
  sleep(2000);
  if (currentPackage() !== APPNAME) {
    xianyuBack(retry + 1);
  }
}

export function coinExchange() {
  try {
    if (!assertGoldFlowContinue()) return;
    resetGoldFlowState();

    setRunInfo("coinExchange: 开始");
    runActivePopups();
    if (!assertGoldFlowContinue()) return;

    if (!assertOnGoldCoinPage("coinExchange", 1000)) {
      const probe = probeGoldCoinPage(200);
      haltGoldFlow(
        `不在金币地图页 (${probe.reason}) pkg=${currentPackage()} activity=${currentActivity()}`
      );
      return;
    }

    dismissGoldPageBlockers();

    const diceState = getDiceBtnState();
    if (diceState.kind === "rolls" && diceState.count > 0) {
      setRunInfo(`coinExchange: 色子 ×${diceState.count}，先摇骰子`);
      rollAvailableDice();
      if (!assertGoldFlowContinue()) return;
      dismissGoldPageBlockers();
    } else if (diceState.kind === "earn") {
      setRunInfo("coinExchange: 色子显示「赚」，跳过摇骰子，进入任务流程");
    }

    if (isTaskPopupOpen()) {
      mainPopupTask();
      return;
    }

    if (openTaskPopup()) {
      dismissGoldPageBlockers();
      if (isTaskPopupOpen()) {
        mainPopupTask();
        return;
      }
    }

    dismissGoldPageBlockers();
    if (isTaskPopupOpen()) {
      mainPopupTask();
      return;
    }

    haltGoldFlow(
      "在金币页但无法打开任务弹框(taskWrap)。若出现新拦截弹框请采集 pages 后补充 goldBlockers 规则"
    );
  } catch (error) {
    haltGoldFlow(`coinExchange 异常: ${error}`);
    Record.error(`coinExchange, ${error}`);
  }
}
