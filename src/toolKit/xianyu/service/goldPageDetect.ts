/**
 * 金币 H5 页探测 — v7 版本
 * 使用 accessibility 模块的 select() + currentPackage/Activity
 */
import { currentActivity, currentPackage, select } from 'accessibility';
import { getScreenHeight, getScreenWidth } from '../../../lib/screenSize';
import { sleep } from '../../../lib/sleep';

const APPNAME = 'com.taobao.idlefish';
const GOLD_COIN_ACTIVITY = 'com.taobao.idlefish.webview.WebHybridActivity';

const GOLD_EXCLUSIVE_IDS = [
    'newGameContainer', 'contentWrap', 'gameWrap', 'game_canvas',
    'mapDiceBtn', 'mapLoading', 'mapCacheWrap', 'feedsTaskMaskBox', 'navBarCoinIcon',
] as const;

export type GoldPageConfidence = 'full' | 'loading';
export type GoldPageProbe = {
    ok: boolean;
    reason: string;
    confidence?: GoldPageConfidence;
    matched: string[];
    diceAnchor?: { x: number; y: number };
};

const MAP_DICE_NORM = { cxMin: 0.35, cxMax: 0.65, cyMin: 0.5, cyMax: 0.72 };

function isBoundsInside(inner: Autox.UiObject, outer: Autox.UiObject): boolean {
    const a = inner.bounds();
    const b = outer.bounds();
    return a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom;
}

function normCenter(el: Autox.UiObject): { cx: number; cy: number; px: number; py: number } {
    const box = el.bounds();
    const w = getScreenWidth();
    const h = getScreenHeight();
    const px = Math.floor((box.left + box.right) / 2);
    const py = Math.floor((box.top + box.bottom) / 2);
    return { cx: px / w, cy: py / h, px, py };
}

function isDiceAnchorInRegion(el: Autox.UiObject): boolean {
    const { cx, cy } = normCenter(el);
    return cx >= MAP_DICE_NORM.cxMin && cx <= MAP_DICE_NORM.cxMax
        && cy >= MAP_DICE_NORM.cyMin && cy <= MAP_DICE_NORM.cyMax;
}

/** 使用 select() 批量查找金币页锚点 */
function scanGoldAnchors(timeoutMs: number): Map<string, Autox.UiObject> {
    const found = new Map<string, Autox.UiObject>();
    const endAt = Date.now() + timeoutMs;

    const collect = (node: Autox.UiObject | null) => {
        if (!node) return;
        try {
            const id = node.id();
            if (id && (GOLD_EXCLUSIVE_IDS as readonly string[]).includes(id) && !found.has(id)) {
                found.set(id, node);
            }
        } catch {}
        const n = typeof node.childCount === 'function' ? node.childCount() : 0;
        for (let i = 0; i < n; i++) {
            try { collect(node.child(i)); } catch {}
        }
    };

    while (Date.now() < endAt) {
        try {
            // 从 select() 找到根节点再 DFS
            let root: any = select().className('android.widget.FrameLayout').depth(0).findOnce();
            if (!root) root = select().findOnce();
            if (root) collect(root);
        } catch {}
        if (
            found.has('newGameContainer') && found.has('contentWrap') &&
            found.has('game_canvas') && (found.has('mapDiceBtn') || found.has('mapLoading'))
        ) break;
        // 同步轮询（select 方法是同步的）
        const pollEnd = Date.now() + 80;
        while (Date.now() < pollEnd) {} // 短暂忙等（v7 中 select 同步，无需 await sleep 在此）
    }
    return found;
}

function fail(matched: string[], reason: string): GoldPageProbe {
    return { ok: false, reason, matched };
}
function pass(matched: string[], reason: string, confidence: GoldPageConfidence, diceAnchor?: { x: number; y: number }): GoldPageProbe {
    return { ok: true, reason, confidence, matched, diceAnchor };
}

export function probeGoldCoinPage(timeoutMs = 600): GoldPageProbe {
    const matched: string[] = [];
    const pkg = currentPackage();
    if (pkg !== APPNAME) return fail(matched, `非闲鱼 pkg=${pkg}`);
    matched.push('pkg');

    const activity = currentActivity();
    if (activity !== GOLD_COIN_ACTIVITY) return fail(matched, `非金币 WebView activity=${activity}`);
    matched.push('activity');

    const anchors = scanGoldAnchors(timeoutMs);
    const newGameContainer = anchors.get('newGameContainer');
    if (!newGameContainer) return fail(matched, '缺少 newGameContainer');
    matched.push('newGameContainer');

    const contentWrap = anchors.get('contentWrap');
    if (!contentWrap) return fail(matched, '缺少 contentWrap');
    matched.push('contentWrap');

    const gameCanvas = anchors.get('game_canvas');
    if (!gameCanvas) return fail(matched, '缺少 game_canvas');
    matched.push('game_canvas');

    if (!isBoundsInside(gameCanvas, newGameContainer)) return fail(matched, 'game_canvas 不在 newGameContainer 内');
    matched.push('struct:canvas⊂ngc');
    if (anchors.has('gameWrap')) matched.push('gameWrap');

    const diceBtn = anchors.get('mapDiceBtn');
    if (diceBtn) {
        if (!isBoundsInside(diceBtn, contentWrap)) return fail(matched, 'mapDiceBtn 不在 contentWrap 内');
        if (!isDiceAnchorInRegion(diceBtn)) {
            const c = normCenter(diceBtn);
            return fail(matched, `mapDiceBtn 坐标 (${c.px},${c.py}) 偏离区域`);
        }
        matched.push('mapDiceBtn');
        const center = normCenter(diceBtn);
        return pass(matched, '金币页铁证', 'full', { x: center.px, y: center.py });
    }

    const mapLoading = anchors.get('mapLoading');
    if (mapLoading && isBoundsInside(mapLoading, contentWrap)) {
        matched.push('mapLoading');
        return pass(matched, '金币页铁证：加载中', 'loading');
    }

    return fail(matched, '地图未就绪：无 mapDiceBtn / mapLoading');
}

export function isOnGoldCoinPage(timeoutMs = 600): boolean {
    return probeGoldCoinPage(timeoutMs).ok;
}

export function assertOnGoldCoinPage(context: string, timeoutMs = 800): boolean {
    const probe = probeGoldCoinPage(timeoutMs);
    const msg = probe.ok
        ? `${context}: 金币页✓ ${probe.reason} [${probe.matched.join('+')}]`
        : `${context}: 非金币页✗ ${probe.reason} [${probe.matched.join('+')}]`;
    try {
        const base = require('./base') as { setRunInfo?: (s: string) => void };
        if (typeof base.setRunInfo === 'function') base.setRunInfo(msg);
    } catch {}
    return probe.ok;
}
