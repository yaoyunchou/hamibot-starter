/**
 * AutoX.js v7 脚本入口（Node.js 引擎）
 */
import { init } from './lib/init';
import { xyBaseRunWithLog } from './toolKit/xianyu';

(async () => {
    try {
        await init();
        await xyBaseRunWithLog();
    } catch (e) {
        console.error('[main] 启动失败:', e);
        process.exit(1);
    }
})();
