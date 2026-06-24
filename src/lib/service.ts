import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Record } from './logger';
import { getConfig } from './config';
import { sleep } from './sleep';

const localHost: string = getConfig()._LOCAL_SERVER || 'http://10.10.30.129:3000';

const baseHeaders = { 'Content-Type': 'application/json' };

const AI_HTTP_TIMEOUT_MS = 180000;

const request = async (
    path: string,
    options: AxiosRequestConfig = {},
    timeoutMs = 10000
): Promise<AxiosResponse> => {
    return axios({
        url: `${localHost}${path}`,
        headers: { ...baseHeaders, ...(options.headers || {}) },
        timeout: timeoutMs,
        ...options,
    });
};

// ------------------------------------------------------------------ //
// 兼容层 —— 保留 body.json() / body.string() 形状供旧调用点使用
// ------------------------------------------------------------------ //

const wrapResponse = async (p: Promise<AxiosResponse>) => {
    const res = await p;
    return {
        statusCode: res.status,
        body: {
            json: () => res.data,
            string: () => (typeof res.data === 'string' ? res.data : JSON.stringify(res.data)),
        },
    };
};

export const xyLogin = () => { /* 登录由服务端统一管理 */ };
export const getHeader = () => baseHeaders;
export const getNestHeader = () => baseHeaders;

// ------------------------------------------------------------------ //
// 日志
// ------------------------------------------------------------------ //

export const createLogs = async (name: string, data: unknown): Promise<void> => {
    try {
        await request('/api/logs', { method: 'post', data: { name, data } });
    } catch (e) {
        Record.error('createLogs error', e);
    }
};

// ------------------------------------------------------------------ //
// 金币任务
// ------------------------------------------------------------------ //

export type GoldTaskSyncItem = {
    title: string;
    hasRun: boolean;
    rewardVerified?: boolean | null;
    failCount?: number;
    lastResult?: string | null;
    failRecords?: any[];
};

export const syncGoldTasks = async (tasks: GoldTaskSyncItem[]): Promise<void> => {
    try {
        await request('/api/gold/tasks/sync', { method: 'post', data: { tasks } }, 6000);
    } catch { /* 静默忽略 */ }
};

// ------------------------------------------------------------------ //
// 订单查询
// ------------------------------------------------------------------ //

export const getGoodInfo = async (nickName: string, title: string): Promise<any> => {
    const res = await wrapResponse(request(`/api/order/good?nickName=${encodeURIComponent(nickName)}&title=${encodeURIComponent(title)}`));
    return res.body.json();
};

export const getGoodInfoByOrderNumber = async (orderNumber: string): Promise<any> => {
    const res = await wrapResponse(request(`/api/order/number?orderNumber=${encodeURIComponent(orderNumber)}`));
    return res.body.json();
};

// ------------------------------------------------------------------ //
// Element 缓存
// ------------------------------------------------------------------ //

const _loadElementCache = async (): Promise<Map<string, any>> => {
    const res = await axios.get(`${localHost}/api/cache/element`, { timeout: 10000 });
    const data: any = res.data;
    if (data && data.code === 0 && Array.isArray(data.data)) {
        const cacheMap = new Map<string, any>();
        data.data.forEach((item: any) => {
            if (item && item.key !== undefined) cacheMap.set(item.key, item.value);
        });
        return cacheMap;
    }
    return new Map<string, any>();
};

export const getElementCache = async (): Promise<Map<string, any>> => {
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const cacheMap = await _loadElementCache();
            Record.info(`getElementCache 加载成功，共 ${cacheMap.size} 条 (第${attempt}次)`);
            return cacheMap;
        } catch (error) {
            lastError = error;
            Record.warn(`getElementCache 第${attempt}次失败: ${error}`);
            if (attempt < 3) await sleep(500);
        }
    }
    Record.error('getElementCache 3次均失败，使用空缓存', lastError);
    return new Map<string, any>();
};

export const saveElementCache = async (cache: Map<string, any>): Promise<void> => {
    try {
        const cacheData = Array.from(cache.entries()).map(([key, value]) => ({ key, value }));
        const res = await request('/api/cache/element', { method: 'put', data: cacheData });
        const result: any = res.data;
        const serverCount = result?.count ?? cache.size;
        Record.info(`saveElementCache 服务端共 ${serverCount} 条 (本次 ${cache.size} 条)`);
    } catch (error) {
        Record.error('saveElementCache 保存失败', error);
    }
};

// ------------------------------------------------------------------ //
// 控制面板 — 任务队列
// ------------------------------------------------------------------ //

export const fetchPendingTasks = async (): Promise<any> => {
    try {
        const res = await request('/api/control/tasks/poll', {
            method: 'post',
            data: { status: 'pending', limit: 1 },
        });
        return res.data;
    } catch (error) {
        Record.error('fetchPendingTasks error', error);
        return null;
    }
};

export const claimTask = async (taskId: string): Promise<void> => {
    try {
        await request(`/api/control/task/${taskId}`, {
            method: 'put',
            data: {
                status: 'running',
                started_at: new Date().toLocaleString('zh-CN', { hour12: false }),
            },
        });
    } catch (error) {
        Record.error('claimTask error', error);
    }
};

export const completeTask = async (taskId: string, success: boolean, message?: string): Promise<void> => {
    try {
        await request(`/api/control/task/${taskId}`, {
            method: 'put',
            data: {
                status: success ? 'completed' : 'error',
                completed_at: new Date().toLocaleString('zh-CN', { hour12: false }),
                message: message || null,
            },
        });
    } catch (error) {
        Record.error('completeTask error', error);
    }
};

export const fetchTaskStatus = async (taskId: string): Promise<any> => {
    try {
        const res = await request('/api/control/task/status', {
            method: 'post',
            data: { task_id: taskId },
        });
        return res.data;
    } catch (error) {
        Record.error('fetchTaskStatus error', error);
        return null;
    }
};

// ------------------------------------------------------------------ //
// 控制面板 — 预警
// ------------------------------------------------------------------ //

export const reportAlert = async (
    level: 'info' | 'warn' | 'error',
    message: string,
    taskId?: string
): Promise<void> => {
    try {
        await request('/api/control/alert', {
            method: 'post',
            data: { level, message, task_id: taskId || null },
        });
    } catch (error) {
        Record.error('reportAlert error', error);
    }
};

// ------------------------------------------------------------------ //
// 远程调试
// ------------------------------------------------------------------ //

export const pollDebugCommands = async (): Promise<any> => {
    try {
        const res = await request('/api/debug/commands/poll', {
            method: 'post',
            data: { limit: 5 },
        });
        return res.data;
    } catch (error) {
        Record.error('pollDebugCommands error', error);
        return null;
    }
};

export const claimDebugCommand = async (cmdId: string): Promise<void> => {
    try {
        await request(`/api/debug/command/${cmdId}`, {
            method: 'put',
            data: { status: 'running' },
        });
    } catch (error) {
        Record.error('claimDebugCommand error', error);
    }
};

export const reportDebugResult = async (
    cmdId: string,
    success: boolean,
    result?: any,
    error?: string
): Promise<void> => {
    try {
        await request(`/api/debug/command/${cmdId}`, {
            method: 'put',
            data: {
                status: success ? 'completed' : 'error',
                result: result ?? null,
                error: error ?? null,
            },
        });
    } catch (err) {
        Record.error('reportDebugResult error', err);
    }
};

// ------------------------------------------------------------------ //
// AI
// ------------------------------------------------------------------ //

export const aiRecognize = async (body: { [key: string]: unknown }): Promise<any> => {
    try {
        const res = await request('/api/ai/recognize', { method: 'post', data: body }, AI_HTTP_TIMEOUT_MS);
        return res.data;
    } catch (e) {
        Record.error('aiRecognize error', e);
        return null;
    }
};

export const aiDecide = async (body: { [key: string]: unknown }): Promise<any> => {
    try {
        const res = await request('/api/ai/decide', { method: 'post', data: body }, AI_HTTP_TIMEOUT_MS);
        return res.data;
    } catch (e) {
        Record.error('aiDecide error', e);
        return null;
    }
};

export const aiReport = async (
    taskId: string,
    step: number,
    beforeState: { [key: string]: unknown },
    decision: { [key: string]: unknown },
    execution: { [key: string]: unknown },
    afterState: { [key: string]: unknown },
    evaluation?: { [key: string]: unknown }
): Promise<void> => {
    try {
        await request('/api/ai/report', {
            method: 'post',
            data: {
                task_id: taskId,
                step,
                before_state: beforeState,
                decision,
                execution,
                after_state: afterState,
                evaluation: evaluation ?? null,
            },
        });
    } catch (e) {
        Record.error('aiReport error', e);
    }
};

export const aiOperationStart = async (
    taskDescription: string,
    deviceInfo?: { [key: string]: unknown }
): Promise<any> => {
    try {
        const res = await request('/api/ai/operation/start', {
            method: 'post',
            data: { task_description: taskDescription, device_info: deviceInfo ?? null },
        });
        return res.data;
    } catch (e) {
        Record.error('aiOperationStart error', e);
        return null;
    }
};

export const aiOperationComplete = async (taskId: string, result: string): Promise<any> => {
    try {
        const res = await request('/api/ai/operation/complete', {
            method: 'post',
            data: { task_id: taskId, result },
        });
        return res.data;
    } catch (e) {
        Record.error('aiOperationComplete error', e);
        return null;
    }
};
