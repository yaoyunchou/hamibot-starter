/**
 * 任务停止控制：Dashboard 取消 → 客户端轮询检测 → 中断执行
 */
import { fetchTaskStatus } from '../../../lib/service';
import { Record } from '../../../lib/logger';
import { stopAiLoop } from './aiExecutor';
import { sleep } from '../../../lib/sleep';

let _stopRequested = false;
let _watchTaskId: string | null = null;
let _watchActive = false;

export const shouldStopCurrentTask = (): boolean => _stopRequested;

export const requestTaskStop = (reason?: string) => {
    _stopRequested = true;
    stopAiLoop();
    Record.info('taskControl: 收到停止请求' + (reason ? ` (${reason})` : ''));
};

export const clearTaskStop = () => {
    _stopRequested = false;
    _watchTaskId = null;
};

/** 执行任务前启动，每 2 秒检查服务端是否已取消（async 替代 threads.start） */
export const startCancelWatcher = (taskId: string) => {
    clearTaskStop();
    _watchTaskId = taskId;
    _watchActive = true;
    (async () => {
        while (_watchActive && _watchTaskId === taskId) {
            try {
                const res = await fetchTaskStatus(taskId);
                const task = res && res.data;
                if (task && (task.status === 'cancelled' || task.cancel_requested)) {
                    requestTaskStop('server_cancel');
                    break;
                }
            } catch (e) {
                Record.warn('cancelWatcher: ' + e);
            }
            await sleep(2000);
        }
    })();
};

export const stopCancelWatcher = () => {
    _watchActive = false;
    _watchTaskId = null;
};
