import { select } from 'accessibility';
import { Record } from './logger';
import { SHOW_CONSOLE } from '../global';
import { PermissionException } from './exception';
import { sleep } from './sleep';

export async function init(): Promise<void> {
    // 检查无障碍权限（v7 通过 select().findOnce() 返回 null 来判断服务是否可用）
    try {
        const testNode = select().className('android.widget.FrameLayout').findOnce();
        if (testNode === null) {
            Record.warn('无障碍服务可能未启用，尝试继续...');
        } else {
            Record.verbose('无障碍权限已就绪');
        }
    } catch (e) {
        throw new PermissionException('Accessibility permission obtaining failure: ' + e);
    }

    // v7 通过 screen 模块获取屏幕尺寸（如不可用则使用默认值）
    let screenW = 1080;
    let screenH = 2400;
    try {
        const { width, height } = await import('accessibility').then(m => ({
            width: (globalThis as any).device?.width ?? 1080,
            height: (globalThis as any).device?.height ?? 2400,
        }));
        if (width > 0) screenW = width;
        if (height > 0) screenH = height;
    } catch { /* 使用默认值 */ }

    Record.debug(`Screen size: ${screenH} x ${screenW}`);

    if (SHOW_CONSOLE) {
        await sleep(300);
    }
}
