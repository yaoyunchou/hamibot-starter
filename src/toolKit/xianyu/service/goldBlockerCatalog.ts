/**
 * 金币页拦截弹框规则表 — 采集 pages 后在此追加条目即可。
 *
 * 新增弹框步骤：
 * 1. 对比「有弹框页」与「金币页面」，找 popup-only 文案 / bounds
 * 2. 在 GOLD_BLOCKER_CATALOG 的 GENERIC 之前 insert 一条
 * 3. detect 用 probeTexts（全部命中）或 probeAnyText（任一命中）
 * 4. handle 用 actions 组合：clickTexts → bounds → anchorClose
 *
 * 示例采集：logs/device/闲鱼/pages/金币页面-出现金币任务弹框-做任务弹窗
 */
import { findByA11yId, tryClickNode } from "../utils/common";
import { setRunInfo } from "./base";
import type { GoldBlockerRule } from "./goldBlockers";

function isTaskPopupOpen(): boolean {
  return !!(findByA11yId("taskWrap", 200) || findByA11yId("taskListWrap", 200));
}

function probeTextContains(text: string): boolean {
  try {
    return !!className("android.widget.TextView").textContains(text).findOnce();
  } catch {
    return false;
  }
}

function probeAllTexts(texts: string[]): boolean {
  for (let i = 0; i < texts.length; i++) {
    if (!probeTextContains(texts[i])) return false;
  }
  return true;
}

function probeAnyText(texts: string[]): boolean {
  for (let i = 0; i < texts.length; i++) {
    if (probeTextContains(texts[i])) return true;
  }
  return false;
}

function clickTextButton(text: string, timeout = 400): boolean {
  const btn = className("android.widget.TextView").textContains(text).clickable(true).findOne(timeout);
  if (!btn) return false;
  tryClickNode(btn);
  return true;
}

function clickInBounds(left: number, top: number, right: number, bottom: number): boolean {
  const tv = className("android.widget.TextView").clickable(true).boundsInside(left, top, right, bottom).findOne(400);
  if (tv) {
    tryClickNode(tv);
    return true;
  }
  const view = className("android.view.View").clickable(true).boundsInside(left, top, right, bottom).findOne(300);
  if (view) {
    tryClickNode(view);
    return true;
  }
  click(Math.floor((left + right) / 2), Math.floor((top + bottom) / 2));
  return true;
}

function clickTextList(texts: string[], timeout = 350): boolean {
  for (let i = 0; i < texts.length; i++) {
    if (clickTextButton(texts[i], timeout)) return true;
  }
  return false;
}

function anchorClose(anchorText: string, childIndex: number): boolean {
  const el = className("android.widget.TextView").textContains(anchorText).findOne(500);
  if (!el) return false;
  try {
    const closeBtn = el.parent().child(childIndex);
    if (closeBtn) {
      closeBtn.click();
      sleep(800);
      return true;
    }
  } catch {
    /* skip */
  }
  return false;
}

/** 点击 anchor 正下方、无文案的可点击关闭钮（只点关闭，不点 anchor 本身） */
function clickEmptyCloseBelowAnchor(anchorText: string): boolean {
  const anchor = className("android.widget.TextView").text(anchorText).findOne(500);
  if (!anchor) return false;
  try {
    const anchorBottom = anchor.bounds().bottom;
    const parent = anchor.parent();
    if (!parent) return false;
    for (let i = 0; i < parent.childCount(); i++) {
      const child = parent.child(i);
      if (!child) continue;
      const childClickable = typeof child.clickable === "function" ? (child.clickable as any)() : child.clickable;
      if (!childClickable) continue;
      if (!(child.text() || "").trim()) {
        const top = child.bounds().top;
        if (top >= anchorBottom && top <= anchorBottom + 250) {
          tryClickNode(child);
          return true;
        }
      }
    }
  } catch {
    /* skip */
  }
  return false;
}

/** 声明式弹框配置 */
export type BlockerCatalogEntry = {
  id: string;
  /** 越小越先匹配；默认 100 */
  priority?: number;
  enabled?: boolean;
  /** 季节性/低频：本轮首次未命中则不再扫描 */
  optional?: boolean;
  /** 全部文案都出现才算命中 */
  probeTexts?: string[];
  /** 任一文案出现即命中（与 probeTexts 二选一） */
  probeAnyText?: string[];
  /** 额外 detect 条件，返回 false 则跳过 */
  when?: () => boolean;
  /** 处理动作，按顺序尝试，任一成功即返回 */
  onHandle: () => boolean;
  /** handle 成功后等待 ms */
  settleMs?: number;
};

function entryToRule(e: BlockerCatalogEntry): GoldBlockerRule {
  return {
    id: e.id,
    enabled: e.enabled,
    optional: e.optional,
    detect: () => {
      if (e.when && !e.when()) return false;
      if (e.probeTexts && e.probeTexts.length > 0) return probeAllTexts(e.probeTexts);
      if (e.probeAnyText && e.probeAnyText.length > 0) return probeAnyText(e.probeAnyText);
      return false;
    },
    handle: () => {
      setRunInfo(`goldBlocker[${e.id}]: 处理拦截弹框`);
      const ok = e.onHandle();
      if (ok && e.settleMs) sleep(e.settleMs);
      return ok;
    },
  };
}

/**
 * 弹框规则目录 — 后续新增只改此数组。
 * priority：业务弹框 10~50，活动/季节 60~80，通用兜底 900+
 */
export const GOLD_BLOCKER_CATALOG: BlockerCatalogEntry[] = [
  {
    id: "task_nudge_modal",
    priority: 10,
    probeTexts: ["再完成", "个任务可领"],
    when: () => !isTaskPopupOpen(),
    settleMs: 1500,
    onHandle: () =>
      clickTextList(["去做任务", "立即去做", "做任务", "马上去做", "去完成"]) ||
      clickInBounds(300, 1320, 800, 1500) ||
      clickInBounds(460, 1680, 620, 1820),
  },
  {
    id: "summer_medal",
    priority: 60,
    optional: true,
    probeAnyText: ["夏日活动勋章"],
    onHandle: () =>
      anchorClose("夏日活动勋章", 3) ||
      clickTextList(["关闭", "我知道了", "跳过"]),
  },
  {
    id: "dice_continue_treasure",
    priority: 64,
    optional: true,
    // popup-only：对比 金币页面，仅弹框页有「继续寻宝」
    probeAnyText: ["继续寻宝"],
    settleMs: 1000,
    onHandle: () => {
      const btn = findByA11yId("wealthBtn", 500);
      if (btn) {
        tryClickNode(btn);
        return true;
      }
      return clickTextButton("继续寻宝") || clickInBounds(246, 1624, 834, 1766);
    },
  },
  {
    id: "dice_scratch_activity",
    priority: 65,
    optional: true,
    // popup-only：对比 金币页面 vs 金币页面-摇色子-活动弹框，仅弹框页有这两句文案
    probeTexts: ["中奖图案", "开始刮奖"],
    settleMs: 800,
    // 关闭钮在「开始刮奖」正下方，无文案；bounds [485,1905,598,2021]，与开始刮奖 y 相隔 99px
    onHandle: () =>
      clickEmptyCloseBelowAnchor("开始刮奖") ||
      clickInBounds(485, 1905, 598, 2021),
  },
  // ── 在此追加新弹框（采集 pages 后填写）──
  // {
  //   id: "xxx_activity",
  //   priority: 65,
  //   optional: true,
  //   probeAnyText: ["活动标题文案"],
  //   onHandle: () => clickTextList(["关闭"]) || clickInBounds(l, t, r, b),
  // },
  {
    id: "generic_dismiss",
    priority: 900,
    probeAnyText: ["我知道了", "以后再说", "不再提示", "跳过"],
    settleMs: 800,
    onHandle: () => clickTextList(["我知道了", "以后再说", "不再提示", "跳过", "关闭", "取消"]),
  },
];

export function buildGoldBlockerRules(): GoldBlockerRule[] {
  return GOLD_BLOCKER_CATALOG.filter((e) => e.enabled !== false)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
    .map(entryToRule);
}
