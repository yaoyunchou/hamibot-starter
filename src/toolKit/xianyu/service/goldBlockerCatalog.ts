/**
 * 金币页拦截弹框规则表 — 采集 pages 后在此追加条目即可。
 *
 * 新增弹框步骤：
 * 1. 对比「有弹框页」与「金币页面」，找 popup-only 文案 / bounds
 * 2. 在 GOLD_BLOCKER_CATALOG 的 GENERIC 之前 insert 一条
 * 3. detect 用 probeTexts（全部命中）或 probeAnyText（任一命中）
 * 4. handle 用 actions 组合：clickTexts → bounds → anchorClose
 */
import { click, select } from 'accessibility';
import { sleep } from '../../../lib/sleep';
import { findByA11yId, tryClickNode } from "../utils/common";
import { setRunInfo } from "./base";
import type { GoldBlockerRule } from "./goldBlockers";

function isTaskPopupOpen(): boolean {
  return !!(findByA11yId("taskWrap", 200) || findByA11yId("taskListWrap", 200));
}

function probeTextContains(text: string): boolean {
  try {
    return !!select().className("android.widget.TextView").textContains(text).findOnce();
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

async function clickTextButton(text: string, timeout = 400): Promise<boolean> {
  const btn = select().className("android.widget.TextView").textContains(text).clickable(true).findOne(timeout);
  if (!btn) return false;
  await tryClickNode(btn);
  return true;
}

/** 点击坐标范围内的可点击元素，若未找到则点击中心坐标 */
async function clickInBounds(left: number, top: number, right: number, bottom: number): Promise<boolean> {
  const cx = Math.floor((left + right) / 2);
  const cy = Math.floor((top + bottom) / 2);
  // 尝试在范围内找可点击的 TextView
  const candidates = [
    select().className("android.widget.TextView").clickable(true).findOnce(),
    select().className("android.view.View").clickable(true).findOnce(),
  ];
  for (const el of candidates) {
    if (!el) continue;
    try {
      const b = el.bounds();
      if (b.left >= left && b.right <= right && b.top >= top && b.bottom <= bottom) {
        await tryClickNode(el);
        return true;
      }
    } catch { /* skip */ }
  }
  await click(cx, cy);
  return true;
}

async function clickTextList(texts: string[], timeout = 350): Promise<boolean> {
  for (let i = 0; i < texts.length; i++) {
    if (await clickTextButton(texts[i], timeout)) return true;
  }
  return false;
}

async function anchorClose(anchorText: string, childIndex: number): Promise<boolean> {
  const el = select().className("android.widget.TextView").textContains(anchorText).findOne(500);
  if (!el) return false;
  try {
    const closeBtn = el.parent()?.child(childIndex);
    if (closeBtn) {
      await tryClickNode(closeBtn);
      await sleep(800);
      return true;
    }
  } catch {
    /* skip */
  }
  return false;
}

/** 点击 anchor 正下方、无文案的可点击关闭钮 */
async function clickEmptyCloseBelowAnchor(anchorText: string): Promise<boolean> {
  const anchor = select().className("android.widget.TextView").text(anchorText).findOne(500);
  if (!anchor) return false;
  try {
    const anchorBottom = anchor.bounds().bottom;
    const parent = anchor.parent();
    if (!parent) return false;
    const n = typeof parent.childCount === "function" ? parent.childCount() : 0;
    for (let i = 0; i < n; i++) {
      const child = parent.child(i);
      if (!child) continue;
      if (!child.clickable) continue;
      if (!(child.text() || "").trim()) {
        const top = child.bounds().top;
        if (top >= anchorBottom && top <= anchorBottom + 250) {
          await tryClickNode(child);
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
  priority?: number;
  enabled?: boolean;
  optional?: boolean;
  probeTexts?: string[];
  probeAnyText?: string[];
  when?: () => boolean;
  onHandle: () => boolean | Promise<boolean>;
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
    handle: async () => {
      setRunInfo(`goldBlocker[${e.id}]: 处理拦截弹框`);
      const ok = await e.onHandle();
      if (ok && e.settleMs) await sleep(e.settleMs);
      return !!ok;
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
    probeAnyText: ["继续寻宝"],
    settleMs: 1000,
    onHandle: async () => {
      const btn = findByA11yId("wealthBtn", 500);
      if (btn) {
        await tryClickNode(btn);
        return true;
      }
      return await clickTextButton("继续寻宝") || await clickInBounds(246, 1624, 834, 1766);
    },
  },
  {
    id: "dice_scratch_activity",
    priority: 65,
    optional: true,
    probeTexts: ["中奖图案", "开始刮奖"],
    settleMs: 800,
    onHandle: () =>
      clickEmptyCloseBelowAnchor("开始刮奖") ||
      clickInBounds(485, 1905, 598, 2021),
  },
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
