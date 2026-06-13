/**
 * 金币 H5 页探测 — 全项目唯一事实来源。
 *
 * 对比 logs/device/闲鱼/pages 下全部采集页（首页/我的/录屏权限/金币各变体）：
 * 下列 a11y id **仅出现在金币寻宝地图页**，其他页面为 0 命中：
 *   newGameContainer, contentWrap, gameWrap, mapDiceBtn, mapCacheWrap, feedsTaskMaskBox, navBarCoinIcon
 *
 * 判定策略（宁可漏判、不可误判）：
 * 1. 外壳：闲鱼 pkg + WebHybridActivity
 * 2. 独占 id 必须同时存在：newGameContainer + contentWrap + game_canvas
 * 3. 结构：game_canvas 在 newGameContainer 内，mapDiceBtn 在 contentWrap 内
 * 4. 圆点：mapDiceBtn 中心落在屏幕归一化区域 (35%~65%, 50%~72%)
 * 5. 加载兜底（窄）：上述 1~3 成立 + mapLoading 在 contentWrap 内（地图尚未绘出骰子）
 */
import { getScreenHeight, getScreenWidth } from "../../../lib/screenSize";

const APPNAME = "com.taobao.idlefish";
const GOLD_COIN_ACTIVITY = "com.taobao.idlefish.webview.WebHybridActivity";

/** 金币页独占 id（采集语料中其他页面从未出现） */
const GOLD_EXCLUSIVE_IDS = [
  "newGameContainer",
  "contentWrap",
  "gameWrap",
  "game_canvas",
  "mapDiceBtn",
  "mapLoading",
  "mapCacheWrap",
  "feedsTaskMaskBox",
  "navBarCoinIcon",
] as const;

export type GoldPageConfidence = "full" | "loading";

export type GoldPageProbe = {
  ok: boolean;
  reason: string;
  confidence?: GoldPageConfidence;
  matched: string[];
  diceAnchor?: { x: number; y: number };
};

/** mapDiceBtn 中心归一化区域（1080×2400 语料标定，各弹框变体 bounds 一致） */
const MAP_DICE_NORM = {
  cxMin: 0.35,
  cxMax: 0.65,
  cyMin: 0.5,
  cyMax: 0.72,
};

function isBoundsInside(inner: UiObject, outer: UiObject): boolean {
  const a = inner.bounds();
  const b = outer.bounds();
  return a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom;
}

function normCenter(el: UiObject): { cx: number; cy: number; px: number; py: number } {
  const box = el.bounds();
  const w = getScreenWidth();
  const h = getScreenHeight();
  const px = Math.floor((box.left + box.right) / 2);
  const py = Math.floor((box.top + box.bottom) / 2);
  return { cx: px / w, cy: py / h, px, py };
}

function isDiceAnchorInRegion(el: UiObject): boolean {
  const { cx, cy } = normCenter(el);
  return (
    cx >= MAP_DICE_NORM.cxMin &&
    cx <= MAP_DICE_NORM.cxMax &&
    cy >= MAP_DICE_NORM.cyMin &&
    cy <= MAP_DICE_NORM.cyMax
  );
}

/** 单次 DFS 收集金币页锚点，避免多次遍历窗口 */
function scanGoldAnchors(timeoutMs: number): Map<string, UiObject> {
  const found = new Map<string, UiObject>();
  const endAt = Date.now() + timeoutMs;

  const collect = (node: UiObject | null) => {
    if (!node) return;
    try {
      const id = node.id();
      if (id && (GOLD_EXCLUSIVE_IDS as readonly string[]).includes(id) && !found.has(id)) {
        found.set(id, node);
      }
    } catch {
      /* skip */
    }
    const n = typeof node.childCount === "function" ? node.childCount() : 0;
    for (let i = 0; i < n; i++) {
      try {
        collect(node.child(i));
      } catch {
        /* skip */
      }
    }
  };

  const rootGetter = (auto as any).rootInActiveWindow || (auto as any).root;
  while (Date.now() < endAt) {
    try {
      const root = typeof rootGetter === "function" ? rootGetter() : rootGetter;
      if (root) collect(root);
    } catch {
      /* skip */
    }
    if (
      found.has("newGameContainer") &&
      found.has("contentWrap") &&
      found.has("game_canvas") &&
      (found.has("mapDiceBtn") || found.has("mapLoading"))
    ) {
      break;
    }
    sleep(80);
  }
  return found;
}

function fail(matched: string[], reason: string): GoldPageProbe {
  return { ok: false, reason, matched };
}

function pass(
  matched: string[],
  reason: string,
  confidence: GoldPageConfidence,
  diceAnchor?: { x: number; y: number }
): GoldPageProbe {
  return { ok: true, reason, confidence, matched, diceAnchor };
}

/**
 * 探测是否为闲鱼寻宝金币地图页。
 * 仅当独占 id 组合 + 结构关系成立时返回 ok:true。
 */
export function probeGoldCoinPage(timeoutMs = 600): GoldPageProbe {
  const matched: string[] = [];

  const pkg = currentPackage();
  if (pkg !== APPNAME) {
    return fail(matched, `非闲鱼 pkg=${pkg}`);
  }
  matched.push("pkg");

  const activity = currentActivity();
  if (activity !== GOLD_COIN_ACTIVITY) {
    return fail(matched, `非金币 WebView activity=${activity}`);
  }
  matched.push("activity");

  const anchors = scanGoldAnchors(timeoutMs);

  const newGameContainer = anchors.get("newGameContainer");
  if (!newGameContainer) {
    return fail(matched, "缺少 newGameContainer（金币页独占 id，其他 H5/首页均无）");
  }
  matched.push("newGameContainer");

  const contentWrap = anchors.get("contentWrap");
  if (!contentWrap) {
    return fail(matched, "缺少 contentWrap（金币页独占 id）");
  }
  matched.push("contentWrap");

  const gameCanvas = anchors.get("game_canvas");
  if (!gameCanvas) {
    return fail(matched, "缺少 game_canvas（寻宝地图画布）");
  }
  matched.push("game_canvas");

  if (!isBoundsInside(gameCanvas, newGameContainer)) {
    return fail(matched, "结构校验失败：game_canvas 不在 newGameContainer 内");
  }
  matched.push("struct:canvas⊂ngc");

  if (anchors.has("gameWrap")) matched.push("gameWrap");

  const diceBtn = anchors.get("mapDiceBtn");
  if (diceBtn) {
    if (!isBoundsInside(diceBtn, contentWrap)) {
      return fail(matched, "结构校验失败：mapDiceBtn 不在 contentWrap 内");
    }
    if (!isDiceAnchorInRegion(diceBtn)) {
      const c = normCenter(diceBtn);
      return fail(matched, `mapDiceBtn 坐标 (${c.px},${c.py}) 偏离金币地图圆点区域`);
    }
    matched.push("mapDiceBtn");
    const center = normCenter(diceBtn);
    return pass(
      matched,
      "金币页铁证：独占 id 三连 + 结构 + 圆点",
      "full",
      { x: center.px, y: center.py }
    );
  }

  const mapLoading = anchors.get("mapLoading");
  if (mapLoading && isBoundsInside(mapLoading, contentWrap)) {
    matched.push("mapLoading");
    return pass(matched, "金币页铁证：独占 id + 结构 + 地图加载中", "loading");
  }

  return fail(
    matched,
    "地图未就绪：有骨架但无 mapDiceBtn / mapLoading，不贸然认定金币页"
  );
}

export function isOnGoldCoinPage(timeoutMs = 600): boolean {
  return probeGoldCoinPage(timeoutMs).ok;
}

function formatProbeLog(context: string, probe: GoldPageProbe): string {
  if (probe.ok) {
    const conf = probe.confidence === "loading" ? " [加载态]" : "";
    const dot = probe.diceAnchor ? ` 圆点(${probe.diceAnchor.x},${probe.diceAnchor.y})` : "";
    return `${context}: 金币页✓${conf} ${probe.reason}${dot} [${probe.matched.join("+")}]`;
  }
  return `${context}: 非金币页✗ ${probe.reason} [${probe.matched.join("+")}]`;
}

/** 探测并写悬浮窗日志；返回是否确认为金币页 */
export function assertOnGoldCoinPage(context: string, timeoutMs = 800): boolean {
  const probe = probeGoldCoinPage(timeoutMs);
  const msg = formatProbeLog(context, probe);
  try {
    const base = require("./base") as { setRunInfo?: (s: string) => void };
    if (typeof base.setRunInfo === "function") base.setRunInfo(msg);
  } catch {
    /* 模块初始化阶段 base 未就绪 */
  }
  return probe.ok;
}
