import { Record } from "./logger"

// 本地代理服务器地址，通过 Hamibot 配置面板的 _LOCAL_SERVER 字段填写电脑局域网 IP
// 例如：http://192.168.1.100:3000
const localHost: string = (hamibot.env as any)._LOCAL_SERVER || 'http://192.168.1.100:3000'

const baseHeaders = { 'Content-Type': 'application/json' }

type RequestOptions = { method?: string; headers?: object; body?: string }

const request = (path: string, options: RequestOptions = {}) => {
    return http.request(`${localHost}${path}`, {
        ...options,
        headers: { ...baseHeaders, ...(options.headers || {}) }
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

export const getElementCache = (): Map<string, any> => {
    try {
        const res = request('/api/cache/element')
        const data: any = res.body.json()
        if (data.code === 0 && data.data?.value) {
            const cacheData = JSON.parse(data.data.value)
            const cacheMap = new Map<string, any>()
            if (Array.isArray(cacheData)) {
                cacheData.forEach((item: any) => {
                    if (item && item.key !== undefined) {
                        cacheMap.set(item.key, item.value)
                    }
                })
            }
            return cacheMap
        }
    } catch (error) {
        Record.error('getElementCache error', error)
    }
    return new Map<string, any>()
}

export const saveElementCache = (cache: Map<string, any>) => {
    try {
        const cacheData = Array.from(cache.entries()).map(([key, value]) => ({ key, value }))
        request('/api/cache/element', {
            method: 'PUT',
            body: JSON.stringify(cacheData),
        })
    } catch (error) {
        Record.error('saveElementCache error', error)
    }
}
