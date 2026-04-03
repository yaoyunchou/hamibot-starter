import { Record } from "./logger"

// 本地代理服务器地址，通过 Hamibot 配置面板的 _LOCAL_SERVER 字段填写电脑局域网 IP
// 例如：http://192.168.1.100:3000
const localHost: string = (hamibot.env as any)._LOCAL_SERVER || 'http://10.10.30.129:3000'

const baseHeaders = { 'Content-Type': 'application/json' }

type RequestOptions = { method?: string; headers?: object; body?: string }

const request = (path: string, options: RequestOptions = {}, timeoutMs: number = 10000) => {
    return http.request(`${localHost}${path}`, {
        ...options,
        headers: { ...baseHeaders, ...(options.headers || {}) },
        timeout: timeoutMs,
    } as any)
}

// token 由本地服务器统一管理，脚本端无需登录
export const xyLogin = () => {
    // 登录在本地服务器启动时自动完成，此处保留空实现以兼容现有调用
}

// getHeader / getNestHeader 已无需返回 Authorization，保留空实现以兼容现有调用
export const getHeader = () => baseHeaders
export const getNestHeader = () => baseHeaders

// ------------------------------------------------------------------ //
// 日志
// ------------------------------------------------------------------ //

export const createLogs = (name: string, data: unknown): void => {
    try {
        request('/api/logs', {
            method: 'POST',
            body: JSON.stringify({ name, data }),
        })
    } catch (error) {
        Record.error('createLogs error', error)
    }
}

// ------------------------------------------------------------------ //
// 订单查询
// ------------------------------------------------------------------ //

export const getGoodInfo = (nickName: string, title: string) => {
    const res = request(`/api/order/good?nickName=${encodeURIComponent(nickName)}&title=${encodeURIComponent(title)}`)
    return (res.body.json() as any)
}

export const getGoodInfoByOrderNumber = (orderNumber: string) => {
    const res = request(`/api/order/number?orderNumber=${encodeURIComponent(orderNumber)}`)
    return (res.body.json() as any)
}

// ------------------------------------------------------------------ //
// Element 缓存（读写本地文件，速度极快）
// ------------------------------------------------------------------ //

const _loadElementCache = (): Map<string, any> => {
    // 直接用 http.get 避免带 Content-Type 请求头影响 Hamibot 对响应的处理
    const res = (http as any).get(`${localHost}/api/cache/element`, { timeout: 10000 })
    const data: any = res.body.json()
    if (data && data.code === 0 && Array.isArray(data.data)) {
        const cacheMap = new Map<string, any>()
        data.data.forEach((item: any) => {
            if (item && item.key !== undefined) {
                cacheMap.set(item.key, item.value)
            }
        })
        return cacheMap
    }
    return new Map<string, any>()
}

export const getElementCache = (): Map<string, any> => {
    // 启动阶段服务器可能尚未就绪，最多重试3次，每次间隔500ms
    let lastError: any = null
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const cacheMap = _loadElementCache()
            Record.info(`getElementCache 加载成功，共 ${cacheMap.size} 条 (第${attempt}次)`)
            return cacheMap
        } catch (error) {
            lastError = error
            Record.warn(`getElementCache 第${attempt}次失败: ${error}`)
            if (attempt < 3) sleep(500)
        }
    }
    Record.error('getElementCache 3次均失败，使用空缓存', lastError)
    return new Map<string, any>()
}

export const saveElementCache = (cache: Map<string, any>) => {
    try {
        const cacheData = Array.from(cache.entries()).map(([key, value]) => ({ key, value }))
        const res = request('/api/cache/element', {
            method: 'PUT',
            body: JSON.stringify(cacheData),
        })
        const result: any = res.body.json()
        // count 是服务端合并后的总条数（含历史数据）
        const serverCount = result?.count ?? cache.size
        Record.info(`saveElementCache 服务端共 ${serverCount} 条 (本次新增/更新 ${cache.size} 条)`)
    } catch (error) {
        Record.error('saveElementCache 保存失败', error)
    }
}

// ------------------------------------------------------------------ //
// 控制面板 — 任务队列
// ------------------------------------------------------------------ //

/** 拉取指定状态的任务列表，客户端用于轮询待执行任务（POST 接口，兼容 Hamibot GET 限制） */
export const fetchPendingTasks = (): any => {
    let raw = ''
    try {
        const res = request('/api/control/tasks/poll', {
            method: 'POST',
            body: JSON.stringify({ status: 'pending', limit: 1 }),
        })
        raw = res.body.string()
        Record.info('fetchPendingTasks raw[' + raw.length + ']: ' + raw.substring(0, 100))
        if (!raw) return null
        return JSON.parse(raw)
    } catch (error) {
        Record.error('fetchPendingTasks raw: ' + raw.substring(0, 100))
        Record.error('fetchPendingTasks error', error)
        return null
    }
}

/** 认领任务（将状态置为 running） */
export const claimTask = (taskId: string): void => {
    try {
        request(`/api/control/task/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: 'running',
                started_at: new Date().toLocaleString('zh-CN', { hour12: false })
            }),
        })
    } catch (error) {
        Record.error('claimTask error', error)
    }
}

/** 上报任务完成 */
export const completeTask = (taskId: string, success: boolean, message?: string): void => {
    try {
        request(`/api/control/task/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: success ? 'completed' : 'error',
                completed_at: new Date().toLocaleString('zh-CN', { hour12: false }),
                message: message || null,
            }),
        })
    } catch (error) {
        Record.error('completeTask error', error)
    }
}

// ------------------------------------------------------------------ //
// 控制面板 — 预警
// ------------------------------------------------------------------ //

/** 上报预警（在需要预警的地方调用此函数） */
export const reportAlert = (
    level: 'info' | 'warn' | 'error',
    message: string,
    taskId?: string
): void => {
    try {
        request('/api/control/alert', {
            method: 'POST',
            body: JSON.stringify({ level, message, task_id: taskId || null }),
        })
    } catch (error) {
        Record.error('reportAlert error', error)
    }
}

// ------------------------------------------------------------------ //
// 远程调试
// ------------------------------------------------------------------ //

/** 轮询待执行的调试指令（POST，兼容 Hamibot） */
export const pollDebugCommands = (): any => {
    let raw = ''
    try {
        const res = request('/api/debug/commands/poll', {
            method: 'POST',
            body: JSON.stringify({ limit: 5 }),
        })
        raw = res.body.string()
        if (!raw) return null
        return JSON.parse(raw)
    } catch (error) {
        Record.error('pollDebugCommands error', error)
        return null
    }
}

/** 认领调试指令（标记为 running） */
export const claimDebugCommand = (cmdId: string): void => {
    try {
        request(`/api/debug/command/${cmdId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'running' }),
        })
    } catch (error) {
        Record.error('claimDebugCommand error', error)
    }
}

/** 上报调试指令执行结果 */
export const reportDebugResult = (cmdId: string, success: boolean, result?: any, error?: string): void => {
    try {
        request(`/api/debug/command/${cmdId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: success ? 'completed' : 'error',
                result: result ?? null,
                error: error ?? null,
            }),
        })
    } catch (err) {
        Record.error('reportDebugResult error', err)
    }
}

// ------------------------------------------------------------------ //
// AI（页面识别 / 决策 / 操作日志）
// ------------------------------------------------------------------ //

/** AI 接口可能含多轮 LLM，超时单独放宽（毫秒） */
const AI_HTTP_TIMEOUT_MS = 180000

export const aiRecognize = (body: { [key: string]: unknown }): any => {
    try {
        const res = request(
            '/api/ai/recognize',
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
            AI_HTTP_TIMEOUT_MS
        )
        return res.body.json() as any
    } catch (e) {
        Record.error('aiRecognize error', e)
        return null
    }
}

export const aiDecide = (body: { [key: string]: unknown }): any => {
    try {
        const res = request(
            '/api/ai/decide',
            {
                method: 'POST',
                body: JSON.stringify(body),
            },
            AI_HTTP_TIMEOUT_MS
        )
        return res.body.json() as any
    } catch (e) {
        Record.error('aiDecide error', e)
        return null
    }
}

export const aiReport = (
    taskId: string,
    step: number,
    beforeState: { [key: string]: unknown },
    decision: { [key: string]: unknown },
    execution: { [key: string]: unknown },
    afterState: { [key: string]: unknown },
    evaluation?: { [key: string]: unknown }
): void => {
    try {
        request('/api/ai/report', {
            method: 'POST',
            body: JSON.stringify({
                task_id: taskId,
                step,
                before_state: beforeState,
                decision,
                execution,
                after_state: afterState,
                evaluation: evaluation ?? null,
            }),
        })
    } catch (e) {
        Record.error('aiReport error', e)
    }
}

export const aiOperationStart = (taskDescription: string, deviceInfo?: { [key: string]: unknown }): any => {
    try {
        const res = request('/api/ai/operation/start', {
            method: 'POST',
            body: JSON.stringify({ task_description: taskDescription, device_info: deviceInfo ?? null }),
        })
        return res.body.json() as any
    } catch (e) {
        Record.error('aiOperationStart error', e)
        return null
    }
}

export const aiOperationComplete = (taskId: string, result: string): any => {
    try {
        const res = request('/api/ai/operation/complete', {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, result }),
        })
        return res.body.json() as any
    } catch (e) {
        Record.error('aiOperationComplete error', e)
        return null
    }
}
