import {
    back, click, home, longClick, select, swipe,
} from 'accessibility';
import { launch as appLaunch, getPackageName, openAppSettings } from 'app';
import { Record } from '../../../lib/logger';
import { sleep } from '../../../lib/sleep';
import { flushElementCache } from './selector';
import { getScreenWidth, getScreenHeight } from '../../../lib/screenSize';

// ─────────────────────── UiSelector helpers ─────────────────────────

/**
 * 按无障碍节点 id 深度优先查找（WebView/H5 场景）。
 */
/**
 * 按 a11y id 深度优先查找（同步，v7 中 select().findOne() 是阻塞调用）
 */
export const findByA11yId = (
    targetId: string,
    timeoutMs = 3000,
    occurrenceIndex = 0
): Autox.UiObject | null => {
    const endAt = Date.now() + timeoutMs;
    const collect = (node: Autox.UiObject | null, out: Autox.UiObject[]) => {
        if (!node) return;
        try { if (node.id() === targetId) out.push(node); } catch {}
        const n = typeof node.childCount === 'function' ? node.childCount() : 0;
        for (let i = 0; i < n; i++) {
            try { collect(node.child(i), out); } catch {}
        }
    };
    while (Date.now() < endAt) {
        try {
            let root: Autox.UiObject | null = select().className('android.widget.FrameLayout').depth(0).findOnce();
            if (!root) root = select().findOnce();
            if (root) {
                const hits: Autox.UiObject[] = [];
                collect(root, hits);
                if (hits.length > occurrenceIndex) return hits[occurrenceIndex];
            }
        } catch {}
        // 短暂 busy-wait（不用 await，保持同步）
        const pollEnd = Date.now() + 80;
        while (Date.now() < pollEnd) {}
    }
    return null;
};

// ─────────────────────── 点击工具 ─────────────────────────

/** 尝试点击节点（含父节点），失败则坐标点击 */
export const tryClickNode = async (node: Autox.UiObject | null | undefined): Promise<boolean> => {
    if (!node) {
        Record.error('tryClickNode: 传入的节点为空');
        return false;
    }
    try {
        const isClickable = typeof node.clickable === 'function'
            ? (node.clickable as any)()
            : node.clickable;

        if (isClickable) {
            const result = node.click();
            return !!result;
        }

        // 查找父级可点击节点
        let parent: Autox.UiObject | null = node.parent();
        for (let i = 0; i < 4 && parent; i++) {
            const parentClickable = typeof parent.clickable === 'function'
                ? (parent.clickable as any)()
                : parent.clickable;
            if (parentClickable) {
                return !!parent.click();
            }
            parent = parent.parent();
        }

        // 坐标点击兜底
        const b = node.bounds();
        return await click(b.centerX(), b.centerY());
    } catch (e) {
        Record.error(`tryClickNode 异常: ${(e as any)?.message || e}`);
        return false;
    }
};

// ─────────────────────── 弹窗工具 ─────────────────────────

const pickRightMostButton = (buttons: Autox.UiCollection | null | undefined): Autox.UiObject | null => {
    if (!buttons || buttons.length === 0) return null;
    let candidate: Autox.UiObject | null = null;
    let maxRight = -1;
    for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        try {
            const b = btn.bounds();
            if (b.right > maxRight) { maxRight = b.right; candidate = btn; }
        } catch {}
    }
    return candidate;
};

const confirmRegex = /(确定|强制停止|强行停止|停止|结束|允许|是|Yes|OK|好|确定停止|结束运行|关闭应用)/i;
const confirmIds = [
    'android:id/button1', 'miui:id/button1',
    'com.android.settings:id/left_button', 'com.android.settings:id/confirm_button',
    'com.miui.securitycenter:id/accept', 'com.huawei.systemmanager:id/btn_right',
    'com.coloros.oppoguardelf:id/btn_ok', 'com.oplus.securitycenter:id/btn_ok',
    'com.vivo.permissionmanager:id/btn_right',
];

const findConfirmButton = async (timeout = 3500): Promise<Autox.UiObject | null> => {
    const endAt = Date.now() + timeout;
    const tryFind = (): Autox.UiObject | null => {
        for (const rid of confirmIds) {
            try { const w = select().id(rid).findOne(200); if (w) return w; } catch {}
        }
        const byText = select().textMatches(confirmRegex).findOne(200)
            || select().descMatches(confirmRegex).findOne(200)
            || select().className('android.widget.Button').textMatches(confirmRegex).findOne(200);
        if (byText) return byText;
        const buttons = select().className('android.widget.Button').find();
        return pickRightMostButton(buttons);
    };
    let btn = tryFind();
    while (!btn && Date.now() < endAt) { await sleep(150); btn = tryFind(); }
    return btn;
};

// ─────────────────────── 关闭应用 ─────────────────────────

const findCloseAllButton = async (timeout = 200): Promise<Autox.UiObject | null> => {
    const endAt = Date.now() + timeout;
    const textRegex = /^(清除全部|全部清除|一键清理|全部关闭|关闭全部|清理全部|全部移除|关闭所有|全部结束|全部清理|全部清除|Clear\s*all|Close\s*all|Dismiss\s*all|Remove\s*all)$/i;
    const ids = [
        'com.huawei.android.launcher:id/clear_all_recents_image_button',
        'com.android.systemui:id/clear_all', 'com.android.systemui:id/dismiss_text',
        'com.android.launcher3:id/clear_all', 'com.miui.home:id/clearAnimView',
        'com.miui.systemui:id/clear_all', 'com.huawei.android.launcher:id/clear_all',
        'com.huawei.android.launcher:id/clearbox', 'com.samsung.android.recents:id/recents_clear_all_button',
        'com.coloros.recents:id/clear_all', 'com.oplus.systemui:id/clear_all',
        'com.vivo.recents:id/clear', 'com.transsion.phonemanager:id/clear_all', 'clearbox',
    ];
    const tryFind = (): Autox.UiObject | null => {
        for (const rid of ids) {
            try { const w = select().id(rid).findOne(150); if (w) return w; } catch {}
        }
        return select().textMatches(textRegex).findOne(200)
            || select().descMatches(textRegex).findOne(200)
            || select().className('android.widget.Button').textMatches(textRegex).findOne(200)
            || null;
    };
    let btn = tryFind();
    while (!btn && Date.now() < endAt) { await sleep(150); btn = tryFind(); }
    return btn;
};

export const closeApp = async (appNameOrPackage: string): Promise<boolean> => {
    try {
        try { flushElementCache(); } catch {}

        // 激活 AutoX.js 自身（使当前前台切换）
        appLaunch('org.autojs.autoxjs') || appLaunch('org.autojs.autojs');
        await sleep(1000);

        const packageName = appNameOrPackage.includes('.')
            ? appNameOrPackage
            : getPackageName(appNameOrPackage);

        if (!packageName) {
            Record.error(`未找到应用包名: ${appNameOrPackage}`);
            return false;
        }

        // 方式一：最近任务页关闭
        try {
            // @ts-ignore — recents() 是 AutoX.js 全局
            (globalThis as any).recents?.();
            await sleep(500);
            const closeAllBtn = await findCloseAllButton(2000);
            if (closeAllBtn && await tryClickNode(closeAllBtn)) {
                await sleep(600);
                Record.info("已通过最近任务页'关闭全部'关闭应用");
                return true;
            }
            const card = select().textMatches(new RegExp(appNameOrPackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).findOne(800)
                || select().textMatches(new RegExp(packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).findOne(800);
            if (card) {
                const b = card.bounds();
                await swipe(b.centerX(), b.centerY(), b.centerX(), Math.max(0, b.centerY() - getScreenHeight() * 0.6), 250);
                await sleep(300);
                Record.info('已通过最近任务页卡片滑动关闭应用');
                try { flushElementCache(); } catch {}
                return true;
            }
            await home();
        } catch {}

        // 方式二：设置页强制停止
        openAppSettings(packageName);
        await sleep(1500);
        const stopBtn = await findCloseAllButton(4000);
        if (stopBtn) {
            await tryClickNode(stopBtn);
            await sleep(600);
            const confirmBtn = await findConfirmButton(3500);
            if (confirmBtn) {
                await tryClickNode(confirmBtn);
                await sleep(600);
                Record.info(`已通过设置页强制停止: ${packageName}`);
                await back();
                await sleep(300);
                return true;
            }
        }
        Record.warn(`关闭应用未确认成功: ${packageName}`);
        return false;
    } catch (err) {
        Record.error(`closeApp 异常: ${(err as any)?.message || err}`);
        return false;
    }
};

export const closeAllRecentApps = async (options?: { preferButton?: boolean; maxSwipes?: number }): Promise<boolean> => {
    const preferButton = options?.preferButton !== false;
    const maxSwipes = Math.max(3, Math.min(options?.maxSwipes ?? 12, 30));
    try {
        (globalThis as any).recents?.();
        await sleep(500);
        if (preferButton) {
            const closeAllBtn = await findCloseAllButton(2500);
            if (closeAllBtn && await tryClickNode(closeAllBtn)) {
                await sleep(600);
                Record.info("已点击'关闭全部'按钮");
                await home();
                return true;
            }
        }
        const columns = [
            Math.floor(getScreenWidth() * 0.33),
            Math.floor(getScreenWidth() * 0.5),
            Math.floor(getScreenWidth() * 0.67),
        ];
        const startY = Math.floor(getScreenHeight() * 0.6);
        const endY = Math.floor(getScreenHeight() * 0.15);
        let swiped = 0;
        for (let i = 0; i < maxSwipes; i++) {
            if (await swipe(columns[i % columns.length], startY, columns[i % columns.length], endY, 250)) {
                swiped++;
                await sleep(150);
            }
        }
        Record.info(`已通过滑动关闭最近任务卡片，次数: ${swiped}`);
        await home();
        return swiped > 0;
    } catch (err) {
        Record.error(`closeAllRecentApps 异常: ${(err as any)?.message || err}`);
        return false;
    }
};

// ─────────────────────── 截图权限弹框 ─────────────────────────

const MEDIA_PROJECTION_TITLE_RE = /要开始使用.*录制或投放内容/;

const isMediaProjectionDialogVisible = (): boolean => {
    try {
        const hasTitle = !!(
            select().textMatches(MEDIA_PROJECTION_TITLE_RE).findOnce()
            || select().textContains('要开始使用').findOnce()
        );
        if (!hasTitle) return false;
        return !!(
            select().id('android:id/button3').findOnce()
            || select().className('android.widget.Button').text('取消').findOnce()
        );
    } catch { return false; }
};

const isMediaProjectionDialogStable = async (stableChecks = 3, intervalMs = 350): Promise<boolean> => {
    for (let i = 0; i < stableChecks; i++) {
        if (!isMediaProjectionDialogVisible()) return false;
        if (i < stableChecks - 1) await sleep(intervalMs);
    }
    return true;
};

export const tryConfirmMediaProjectionDialog = async (): Promise<boolean> => {
    if (!await isMediaProjectionDialogStable(2, 300)) return false;
    try {
        const btn1 = select().id('android:id/button1').findOne(400);
        if (btn1) {
            const label = (btn1.text() || '').trim();
            if (label && label !== '取消') {
                Record.log(`mediaProjection: 点击 button1「${label}」`);
                return await tryClickNode(btn1);
            }
        }
    } catch {}
    try {
        const byText = select().textMatches(/^(立即开始|开始|允许|确定)$/).findOne(400);
        if (byText) {
            Record.log(`mediaProjection: 点击文案「${byText.text()}」`);
            return await tryClickNode(byText);
        }
    } catch {}
    try {
        const cancel = select().id('android:id/button3').findOne(500)
            || select().className('android.widget.Button').text('取消').findOne(500);
        if (!cancel) return false;
        const cancelBounds = cancel.bounds();
        const panel = select().id('com.android.systemui:id/buttonPanel').findOne(300) || cancel.parent();
        if (!panel) return false;
        const panelBounds = panel.bounds();
        const confirmX = panelBounds.right - (cancelBounds.centerX() - panelBounds.left);
        const confirmY = cancelBounds.centerY();
        Record.log(`mediaProjection: 坐标确认 (${confirmX}, ${confirmY})`);
        return await click(confirmX, confirmY);
    } catch (e) {
        Record.error(`mediaProjection: 确认失败 ${(e as any)?.message || e}`);
        return false;
    }
};

export const isMediaProjectionDialogVisibleExport = isMediaProjectionDialogVisible;

/**
 * 在 takeScreenshot 阻塞前先启动弹框自动确认循环（后台异步）。
 * 返回 stop 函数，截图完成后调用。
 */
export const startMediaProjectionAutoConfirm = (durationMs = 35000): () => void => {
    let stopped = false;
    (async () => {
        Record.log(`mediaProjection: 自动确认启动 ${durationMs}ms`);
        await sleep(1500);
        const endAt = Date.now() + durationMs;
        let confirmCount = 0;
        while (!stopped && Date.now() < endAt && confirmCount < 3) {
            if (!isMediaProjectionDialogVisible()) { await sleep(500); continue; }
            if (!await isMediaProjectionDialogStable(3, 350)) { await sleep(400); continue; }
            if (await tryConfirmMediaProjectionDialog()) {
                confirmCount++;
                Record.log(`mediaProjection: 已点击确认 (${confirmCount}/3)`);
                await sleep(2000);
            } else {
                await sleep(500);
            }
        }
        Record.log('mediaProjection: 自动确认结束');
    })();
    return () => { stopped = true; };
};
