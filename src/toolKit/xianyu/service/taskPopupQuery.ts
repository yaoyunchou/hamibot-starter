/**
 * 金币任务弹框内精准查找 — 基于 pages/金币页面-出现金币任务弹框 采集结构。
 * 在 taskWrap / taskListWrap 子树内查找，避免全屏 12 策略 + find() 扫万级节点。
 */
import { Record } from "../../../lib/logger";
import { findByA11yId } from "../utils/common";

const TASK_POPUP_SCOPE_TIMEOUT = 350;

export function isTaskPopupVisible(): boolean {
  return !!(findByA11yId("taskWrap", 200) || findByA11yId("taskListWrap", 200));
}

export function getTaskWrapRoot(): UiObject | null {
  return findByA11yId("taskWrap", TASK_POPUP_SCOPE_TIMEOUT);
}

export function getTaskListWrapRoot(): UiObject | null {
  return findByA11yId("taskListWrap", TASK_POPUP_SCOPE_TIMEOUT);
}

function isExcludedText(txt: string, excludeContains: (string | RegExp)[]): boolean {
  const t = (txt || "").trim();
  return excludeContains.some((k) =>
    typeof k === "string" ? t.includes(k) : (k as RegExp).test(t)
  );
}

function collectTextViews(root: UiObject, matcher: (tv: UiObject) => boolean): UiObject[] {
  const out: UiObject[] = [];
  try {
    const list = root.find(className("android.widget.TextView"));
    for (let i = 0; i < list.length; i++) {
      const tv = list[i];
      if (matcher(tv)) out.push(tv);
    }
  } catch {
    /* skip */
  }
  return out;
}

/** 任务列表区内按文案精确找单个 TextView */
export function findInTaskList(text: string, timeout = TASK_POPUP_SCOPE_TIMEOUT): UiObject | null {
  const root = getTaskListWrapRoot();
  if (!root) return null;
  try {
    const exact = root.findOne(className("android.widget.TextView").text(text));
    if (exact) return exact;
  } catch {
    /* skip */
  }
  return null;
}

/** 任务列表区内找所有精确匹配文案的节点（如多个「去完成」「领取奖励」） */
export function findAllInTaskList(text: string): UiObject[] {
  const root = getTaskListWrapRoot();
  if (!root) return [];
  const start = Date.now();
  try {
    const list = root.find(className("android.widget.TextView").text(text));
    if (!list || list.length === 0) return [];
    const out: UiObject[] = [];
    for (let i = 0; i < list.length; i++) out.push(list[i]);
    Record.info(`[taskPopup] findAll「${text}」${out.length}个 ${Date.now() - start}ms`);
    return out;
  } catch {
    return [];
  }
}

export type TaskPopupStrictOptions = {
  excludeContains?: (string | RegExp)[];
};

/**
 * 在 taskListWrap 内严格匹配任务标题（先 exact，再 contains 过滤误匹配）
 */
export function findTaskTitleStrict(
  title: string,
  options: TaskPopupStrictOptions = {}
): UiObject | null {
  const { excludeContains = ["下单"] } = options;
  const root = getTaskListWrapRoot();
  if (!root) return null;
  const start = Date.now();

  try {
    const exact = root.findOne(className("android.widget.TextView").text(title));
    if (exact) {
      Record.info(`[taskPopup] strict「${title}」exact ${Date.now() - start}ms`);
      return exact;
    }
  } catch {
    /* skip */
  }

  const hits = collectTextViews(root, (tv) => {
    const txt = (tv.text() || "").trim();
    return !!txt && txt.startsWith(title) && !isExcludedText(txt, excludeContains);
  });
  if (hits.length > 0) {
    Record.info(`[taskPopup] strict「${title}」contains ${Date.now() - start}ms`);
    return hits[0];
  }
  Record.info(`[taskPopup] strict「${title}」miss ${Date.now() - start}ms`);
  return null;
}

/** 签到钮：taskWrap 内 text=签到 且 clickable，排除「提醒签到收益」等 */
export function findTaskPopupSignIn(): UiObject | null {
  const root = getTaskWrapRoot();
  if (!root) return null;
  const start = Date.now();
  try {
    const btn = root.findOne(
      className("android.widget.TextView").text("签到").clickable(true)
    );
    if (btn) {
      Record.info(`[taskPopup] 签到 clickable ${Date.now() - start}ms`);
      return btn;
    }
  } catch {
    /* skip */
  }

  const hits = collectTextViews(root, (tv) => {
    const txt = (tv.text() || "").trim();
    if (txt !== "签到") return false;
    const clickable = typeof tv.clickable === "function" ? (tv.clickable as any)() : tv.clickable;
    return !!clickable;
  });
  if (hits.length > 0) {
    Record.info(`[taskPopup] 签到 scan ${Date.now() - start}ms`);
    return hits[0];
  }
  return null;
}
