import { Record } from "../../../lib/logger";
import { getElementCache, saveElementCache } from "../../../lib/service";
import { setRunInfo } from "../service/base";



// 元素查找缓存 - 存储 taskName + title 对应的策略索引
const elementCache = getElementCache()

export const getRunElementCache = () => {
    return elementCache
}

// 本次运行的调用次数计数（内存中，重启清零）
const _callCount: Map<string, number> = new Map();
const _incCall = (key: string) => {
    _callCount.set(key, (_callCount.get(key) || 0) + 1);
    return _callCount.get(key)!;
};

const MAX_CACHED_INDICES = 3;

// 兼容旧格式 { index, errorTime } → 新格式 { indices, errorTime }
const migrateCache = (value: any): { indices: number[]; errorTime: number } => {
    if (Array.isArray(value?.indices)) {
        const idx = value.indices.slice(0, MAX_CACHED_INDICES);
        return { indices: idx, errorTime: value.errorTime ?? 0 };
    }
    return { indices: [value.index], errorTime: value.errorTime ?? 0 };
};

// 将命中的 index 移到首位，保留最多 MAX_CACHED_INDICES 个
const promoteIndex = (indices: number[], hitIndex: number): number[] => {
    const filtered = indices.filter(i => i !== hitIndex);
    return [hitIndex, ...filtered].slice(0, MAX_CACHED_INDICES);
};

/**
 * 生成元素查找策略数组
 * @param title 要查找的元素标题
 * @param findMethod 查找方法，默认为 findOne
 * @returns 策略数组
 */
/**
 * find() 模式辅助：先用 findOnce() 快速探测是否存在，不存在则跳过 find() 全树遍历。
 * findOnce() 非阻塞，立即返回，不受 Accessibility Service 超时行为影响。
 */
const probeAndFind = (selector: any): any => {
    if (!selector.findOnce()) return null;
    return selector.find();
};

/**
 * 串行执行所有策略，找到即停并返回
 * 注：Android Accessibility Service 内部串行处理，多线程并发反而因 join-all 等待所有线程
 * 而无法提前退出，实测比串行慢数倍，故保持串行逐条尝试。
 */
const runStrategiesSerial = <T>(
    strategies: Array<() => T | null | undefined>,
    isValid: (r: T | null | undefined) => boolean
): { index: number; element: T } | null => {
    for (let i = 0; i < strategies.length; i++) {
        const r = strategies[i]();
        if (isValid(r)) return { index: i, element: r as T };
    }
    return null;
};

const createElementStrategies = (title: string, findMethod: 'findOne' | 'find' = 'findOne') => {
    // 策略分两段：精准匹配（text/desc）在前，模糊匹配（textContains/descContains）在后
    // 每段内部按 View → TextView → ImageView 排列
    // 缓存命中精准策略后下次直接走精准路径，保证语义准确性
    const timeout = 10;
    if (findMethod === 'findOne') {
        return [
            // === 精准匹配 ===
            () => className("android.view.View").text(title).findOne(timeout),
            () => className("android.view.View").desc(title).findOne(timeout),
            () => className("android.widget.TextView").text(title).findOne(timeout),
            () => className("android.widget.TextView").desc(title).findOne(timeout),
            () => className("android.widget.ImageView").text(title).findOne(timeout),
            () => className("android.widget.ImageView").desc(title).findOne(timeout),
            // === 模糊匹配 ===
            () => className("android.view.View").textContains(title).findOne(timeout),
            () => className("android.view.View").descContains(title).findOne(timeout),
            () => className("android.widget.TextView").textContains(title).findOne(timeout),
            () => className("android.widget.TextView").descContains(title).findOne(timeout),
            () => className("android.widget.ImageView").textContains(title).findOne(timeout),
            () => className("android.widget.ImageView").descContains(title).findOne(timeout),
        ];
    }
    // find 模式同上：精准在前，模糊在后
    return [
        () => probeAndFind(className("android.view.View").text(title)),
        () => probeAndFind(className("android.view.View").desc(title)),
        () => probeAndFind(className("android.widget.TextView").text(title)),
        () => probeAndFind(className("android.widget.TextView").desc(title)),
        () => probeAndFind(className("android.widget.ImageView").text(title)),
        () => probeAndFind(className("android.widget.ImageView").desc(title)),
        () => probeAndFind(className("android.view.View").textContains(title)),
        () => probeAndFind(className("android.view.View").descContains(title)),
        () => probeAndFind(className("android.widget.TextView").textContains(title)),
        () => probeAndFind(className("android.widget.TextView").descContains(title)),
        () => probeAndFind(className("android.widget.ImageView").textContains(title)),
        () => probeAndFind(className("android.widget.ImageView").descContains(title)),
    ];
};
/**
 * 带缓存的元素查找函数
 * @param taskName 任务名称
 * @param title 要查找的元素标题
 * @returns 找到的元素或null
 * runLoop 是否执行循环策略, 如果有缓存， runLoop 为false 则跳过本次查找
 */
export const findTargetElementWithCache = (taskName: string, title: string, errorTime:number = 3) => {
    const startTs = Date.now();
    const cacheKey = `${taskName}_${title}`;
    const callN = _incCall(cacheKey);
    const strategies = createElementStrategies(title, 'findOne');

    // 检查缓存（支持多个候选索引，按最近命中顺序尝试）
    if (elementCache.has(cacheKey)) {
        const cached = migrateCache(elementCache.get(cacheKey)!);
        const { indices } = cached;
        setRunInfo(`findTargetElementWithCache:${taskName} [${title}] 缓存候选${indices.map(i => i + 1).join(',')} errorTime=${cached.errorTime}`);

        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const element = strategies[idx]() as UiObject;
            if (element) {
                const elapsed = Date.now() - startTs;
                const promoted = promoteIndex(indices, idx);
                elementCache.set(cacheKey, { indices: promoted, errorTime });
                Record.info(`[sel#${callN}] ${taskName}/${title} 缓存#${idx + 1}(${i + 1}/${indices.length}) ✓ ${elapsed}ms`);
                return element;
            }
        }

        const elapsed = Date.now() - startTs;
        elementCache.set(cacheKey, { indices, errorTime: cached.errorTime - 1 });
        if (cached.errorTime >= 0) {
            Record.info(`[sel#${callN}] ${taskName}/${title} 缓存[${indices.map(i => i + 1).join(',')}] 全部✗ 剩余errorTime=${cached.errorTime - 1} ${elapsed}ms`);
            return null;
        }
        Record.info(`[sel#${callN}] ${taskName}/${title} 缓存[${indices.map(i => i + 1).join(',')}] errorTime耗尽，降级串行 ${elapsed}ms`);
    }

    // 缓存未命中或已耗尽，串行逐条尝试，找到即停
    const serialTs = Date.now();
    Record.info(`[sel#${callN}] ${taskName}/${title} 串行启动 ${strategies.length} 条策略`);
    const found = runStrategiesSerial(strategies, r => !!r);
    const serialElapsed = Date.now() - serialTs;
    const totalElapsed = Date.now() - startTs;

    if (found) {
        Record.info(`[sel#${callN}] ${taskName}/${title} 串行#${found.index + 1} ✓ 串行${serialElapsed}ms 总${totalElapsed}ms`);
        setRunInfo(`findTargetElementWithCache:${taskName} [${title}] 策略${found.index + 1} 命中 总耗${totalElapsed}ms`);
        const oldIndices = elementCache.has(cacheKey) ? migrateCache(elementCache.get(cacheKey)!).indices : [];
        elementCache.set(cacheKey, { indices: promoteIndex(oldIndices, found.index), errorTime });
        saveElementCache(elementCache);
        return found.element as UiObject;
    }

    Record.info(`[sel#${callN}] ${taskName}/${title} 串行全部✗ 串行${serialElapsed}ms 总${totalElapsed}ms`);
    setRunInfo(`findTargetElementWithCache:${taskName} [${title}] 全部策略未命中 总耗${totalElapsed}ms`);
    // 串行仍失败：清掉该 key，避免 errorTime 已为负时下次仍带着失效索引反复跑满串行（约 12×findOne 超时）
    if (elementCache.has(cacheKey)) {
        elementCache.delete(cacheKey);
        saveElementCache(elementCache);
    }
    return null;
};


// 使用多种策略查找元素列表
export const findTargetElementList = ( taskName: string,title: string, errorTime:number = 3) => {
    const startTs = Date.now();
    const cacheKey = `${taskName}_${title}`;
    const callN = _incCall(cacheKey + '_list');
    setRunInfo(`findTargetElementWithCache:${taskName} 开始查找元素: ${title}`);

    const strategies = createElementStrategies(title, 'find');

    if (elementCache.has(cacheKey)) {
        const cached = migrateCache(elementCache.get(cacheKey)!);
        const { indices } = cached;

        for (let i = 0; i < indices.length; i++) {
            const idx = indices[i];
            const cacheTs = Date.now();
            const element = strategies[idx]() as UiCollection;
            const cacheElapsed = Date.now() - cacheTs;
            if (element?.length > 0) {
                const promoted = promoteIndex(indices, idx);
                elementCache.set(cacheKey, { indices: promoted, errorTime });
                Record.info(`[sel-list#${callN}] ${taskName}/${title} 缓存#${idx + 1}(${i + 1}/${indices.length}) ✓ ${element.length}个 ${cacheElapsed}ms`);
                return element;
            }
        }

        const elapsed = Date.now() - startTs;
        elementCache.set(cacheKey, { indices, errorTime: cached.errorTime - 1 });
        if (cached.errorTime >= 0) {
            Record.info(`[sel-list#${callN}] ${taskName}/${title} 缓存[${indices.map(i => i + 1).join(',')}] 全部✗ 剩余errorTime=${cached.errorTime - 1} ${elapsed}ms`);
            return null;
        }
        Record.info(`[sel-list#${callN}] ${taskName}/${title} 缓存[${indices.map(i => i + 1).join(',')}] errorTime耗尽，降级串行 ${elapsed}ms`);
    }

    // 串行逐条尝试，找到即停
    const serialTs = Date.now();
    Record.info(`[sel-list#${callN}] ${taskName}/${title} 串行启动 ${strategies.length} 条策略`);
    const found = runStrategiesSerial(strategies, r => (r as any)?.length > 0);
    const serialElapsed = Date.now() - serialTs;
    const totalElapsed = Date.now() - startTs;

    if (found) {
        Record.info(`[sel-list#${callN}] ${taskName}/${title} 串行#${found.index + 1} ✓ ${(found.element as any)?.length}个 串行${serialElapsed}ms 总${totalElapsed}ms`);
        const oldIndices = elementCache.has(cacheKey) ? migrateCache(elementCache.get(cacheKey)!).indices : [];
        elementCache.set(cacheKey, { indices: promoteIndex(oldIndices, found.index), errorTime });
        saveElementCache(elementCache);
        return found.element as UiCollection;
    }

    Record.error(`[sel-list#${callN}] ${taskName}/${title} 串行全部✗ 串行${serialElapsed}ms 总${totalElapsed}ms`);
    return null;
}


/**
 * 
 * 
    const el = findTargetElementWithCacheStrict('taskKey', '去浏览全新好物', {
    excludeContains: ['下单'],
    timeoutEach: 800,
    });
 */

// 严格匹配：优先精确，其次包含但排除指定后缀（解决“去浏览全新好物”误匹配“去浏览全新好物下单”的问题）
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export interface StrictFindOptions {
    // 需要排除的包含匹配的关键字或正则。出现任意一个则丢弃候选
    excludeContains?: (string | RegExp)[];
    // 每次查找超时时间（毫秒）
    timeoutEach?: number;
    // 错误次数
    errorTime?: number;
}

export const findTargetElementWithCacheStrict = (
    taskName: string,
    title: string,
    options: StrictFindOptions = {}
) => {
    const { excludeContains = ["下单"], timeoutEach = 100 , errorTime = 3} = options;
    const cacheKey = `${taskName}_${title}_strict`;

    const exactRegex = new RegExp(`^\\s*${escapeRegExp(title)}\\s*$`);
    const isExcluded = (txt: string) => {
        const t = (txt || "").trim();
        return excludeContains.some((k) =>
            typeof k === "string" ? t.includes(k) : (k as RegExp).test(t)
        );
    };

    // 辅助：用 findOnce() 非阻塞预检 + find() 全量过滤
    const containsFilter = (sel: any): UiObject | null => {
        if (!sel.findOnce()) return null;
        const list = sel.find();
        for (let i = 0; i < list.length; i++) {
            const node = list[i];
            const txt = (node.text && node.text()) || (node as any).contentDescription || "";
            if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) return node;
        }
        return null;
    };

    // 统一策略数组（包含 exact 与 contains 两段），以便缓存命中时可直接索引
    // 使用 findOnce() 替代 findOne(timeout)，避免每条策略阻塞 11-15 秒
    const strategies: Array<() => UiObject | null> = [
        // exact（findOnce 非阻塞）
        () => className("android.view.View").textMatches(exactRegex).findOnce(),
        () => className("android.view.View").descMatches(exactRegex).findOnce(),
        () => className("android.widget.TextView").textMatches(exactRegex).findOnce(),
        () => className("android.widget.TextView").descMatches(exactRegex).findOnce(),
        () => className("android.widget.Button").textMatches(exactRegex).findOnce(),
        () => className("android.widget.Button").descMatches(exactRegex).findOnce(),
        // contains with filter（findOnce 预检 + find 过滤）
        () => containsFilter(className("android.view.View").textContains(title)),
        () => containsFilter(className("android.view.View").descContains(title)),
        () => containsFilter(className("android.widget.TextView").textContains(title)),
        () => containsFilter(className("android.widget.TextView").descContains(title)),
        () => containsFilter(className("android.widget.Button").textContains(title)),
        () => containsFilter(className("android.widget.Button").descContains(title)),
    ];

    const startTs = Date.now();
    const callN = _incCall(cacheKey);

    // 优先尝试缓存策略（支持多个候选索引）
    if (elementCache.has(cacheKey)) {
        const cached = migrateCache(elementCache.get(cacheKey)!);
        const { indices } = cached;
        try {
            for (let i = 0; i < indices.length; i++) {
                const idx = indices[i];
                const cacheTs = Date.now();
                const candidate = strategies[idx]() as UiObject | null;
                const cacheElapsed = Date.now() - cacheTs;
                if (candidate) {
                    const promoted = promoteIndex(indices, idx);
                    elementCache.set(cacheKey, { indices: promoted, errorTime });
                    Record.info(`[sel-strict#${callN}] ${taskName}/${title} 缓存#${idx + 1}(${i + 1}/${indices.length}) ✓ ${cacheElapsed}ms`);
                    return candidate;
                }
            }

            const elapsed = Date.now() - startTs;
            elementCache.set(cacheKey, { indices, errorTime: (cached.errorTime || 0) - 1 });
            if (cached.errorTime >= 0) {
                Record.info(`[sel-strict#${callN}] ${taskName}/${title} 缓存[${indices.map(i => i + 1).join(',')}] 全部✗ 剩余errorTime=${cached.errorTime - 1} ${elapsed}ms`);
                return null;
            }
            Record.info(`[sel-strict#${callN}] ${taskName}/${title} 缓存[${indices.map(i => i + 1).join(',')}] errorTime耗尽，降级串行 ${elapsed}ms`);
        } catch {}
    }

    // 未命中缓存或已耗尽，串行逐条尝试，找到即停
    const serialTs = Date.now();
    Record.info(`[sel-strict#${callN}] ${taskName}/${title} 串行启动 ${strategies.length} 条策略`);
    const found = runStrategiesSerial(strategies, r => !!r);
    const serialElapsed = Date.now() - serialTs;
    const totalElapsed = Date.now() - startTs;

    if (found) {
        Record.info(`[sel-strict#${callN}] ${taskName}/${title} 串行#${found.index + 1} ✓ 串行${serialElapsed}ms 总${totalElapsed}ms`);
        const oldIndices = elementCache.has(cacheKey) ? migrateCache(elementCache.get(cacheKey)!).indices : [];
        elementCache.set(cacheKey, { indices: promoteIndex(oldIndices, found.index), errorTime });
        saveElementCache(elementCache);
        return found.element as UiObject | null;
    }

    Record.error(`[sel-strict#${callN}] ${taskName}/${title} 串行全部✗ 串行${serialElapsed}ms 总${totalElapsed}ms`);
    return null;
};

// 暴露手动刷新函数给其他模块调用（例如关闭应用动作完成时）
export const flushElementCache = () => {
    try {
        if (elementCache) {
          
            saveElementCache(elementCache);
           
            Record.info('已触发异步刷新元素查找缓存');
        }
    } catch (err) {
        Record.error('手动刷新元素查找缓存失败', (err as any)?.message || err);
    }
};

