/**
 * 屏幕尺寸工具 — v7 版本
 * v7 中没有 device 全局和 context 全局，通过 Java 互操作获取实际尺寸。
 */

let cachedW = 0;
let cachedH = 0;

function readFromDisplayMetrics(): { w: number; h: number } {
    try {
        // v7 Java 互操作
        const { java } = require('java') as any;
        const context = java?.lang?.Class?.forName('android.app.ActivityThread')
            ?.getMethod('currentApplication')?.invoke(null);
        if (context) {
            const dm = context.getResources().getDisplayMetrics();
            const w = dm.widthPixels as number;
            const h = dm.heightPixels as number;
            if (w > 0 && h > 0) return { w, h };
        }
    } catch {}
    return { w: 0, h: 0 };
}

export function ensureScreenSize(): { w: number; h: number } {
    if (cachedW > 0 && cachedH > 0) return { w: cachedW, h: cachedH };

    const dm = readFromDisplayMetrics();
    let w = dm.w;
    let h = dm.h;

    if (w === 0 || h === 0) {
        w = 1080;
        h = 2400;
    }
    cachedW = w;
    cachedH = h;
    return { w, h };
}

export function getScreenWidth(): number {
    if (cachedW > 0) return cachedW;
    return ensureScreenSize().w;
}

export function getScreenHeight(): number {
    if (cachedH > 0) return cachedH;
    return ensureScreenSize().h;
}
