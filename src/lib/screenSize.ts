/**
 * Hamibot 下 device.width/height 可能长期为 0，业务统一从这里取尺寸。
 */

let cachedW = 0;
let cachedH = 0;

function readFromDisplayMetrics(): { w: number; h: number } {
    try {
        const dm = (context as any).getResources().getDisplayMetrics();
        const w = dm.widthPixels as number;
        const h = dm.heightPixels as number;
        if (w > 0 && h > 0) return { w, h };
    } catch (_) {}
    return { w: 0, h: 0 };
}

/**
 * 先轮询 device，再尝试系统 DisplayMetrics，最后用 1080×2400（与 setScreenMetrics 一致）保证可运行。
 */
export function ensureScreenSize(): { w: number; h: number } {
    if (cachedW > 0 && cachedH > 0) {
        return { w: cachedW, h: cachedH };
    }

    const SCREEN_WAIT_MS = 200;
    const SCREEN_RETRY_MAX = 15;
    let w = device.width;
    let h = device.height;
    for (let i = 0; i < SCREEN_RETRY_MAX && (w === 0 || h === 0); i++) {
        sleep(SCREEN_WAIT_MS);
        w = device.width;
        h = device.height;
    }
    if (w === 0 || h === 0) {
        const dm = readFromDisplayMetrics();
        w = dm.w;
        h = dm.h;
    }
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
    if (device.width > 0) return device.width;
    return ensureScreenSize().w;
}

export function getScreenHeight(): number {
    if (cachedH > 0) return cachedH;
    if (device.height > 0) return device.height;
    return ensureScreenSize().h;
}
