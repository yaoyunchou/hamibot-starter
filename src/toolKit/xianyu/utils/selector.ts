import { Record } from "../../../lib/logger";
import { getElementCache, saveElementCache } from "../../../lib/service";



// 元素查找缓存 - 存储 taskName + title 对应的策略索引
const elementCache = getElementCache()

export const getRunElementCache = () => {
    return elementCache
}

/**
 * 生成元素查找策略数组
 * @param title 要查找的元素标题
 * @param findMethod 查找方法，默认为 findOne
 * @returns 策略数组
 */
const createElementStrategies = (title: string, findMethod: 'findOne' | 'find' = 'findOne') => {
    const timeout = findMethod === 'findOne' ? 10 : undefined;
    return [
        () => timeout? className("android.view.View").text(title)[findMethod](timeout) : className("android.view.View").text(title)[findMethod](),
        () => timeout ? className("android.view.View").textContains(title)[findMethod](timeout) : className("android.view.View").textContains(title)[findMethod](),
        () => timeout ? className("android.view.View").desc(title)[findMethod](timeout) : className("android.view.View").desc(title)[findMethod](),
        () => timeout ? className("android.view.View").descContains(title)[findMethod](timeout) : className("android.view.View").descContains(title)[findMethod](),
        () => timeout ? className("android.widget.TextView").desc(title)[findMethod](timeout) : className("android.widget.TextView").desc(title)[findMethod](),
        () => timeout ? className("android.widget.TextView").text(title)[findMethod](timeout) : className("android.widget.TextView").text(title)[findMethod](),
        () => timeout ? className("android.widget.TextView").textContains(title)[findMethod](timeout) : className("android.widget.TextView").textContains(title)[findMethod](),
        () => timeout ? className("android.widget.TextView").descContains(title)[findMethod](timeout) : className("android.widget.TextView").descContains(title)[findMethod](),
        () => timeout ? className("android.widget.ImageView").text(title)[findMethod](timeout) : className("android.widget.ImageView").text(title)[findMethod](),
        () => timeout ? className("android.widget.ImageView").textContains(title)[findMethod](timeout) : className("android.widget.ImageView").textContains(title)[findMethod](),
        () => timeout ? className("android.widget.ImageView").desc(title)[findMethod](timeout) : className("android.widget.ImageView").desc(title)[findMethod](),
        () => timeout ? className("android.widget.ImageView").descContains(title)[findMethod](timeout) : className("android.widget.ImageView").descContains(title)[findMethod](),
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
    const cacheKey = `${taskName}_${title}`;
    Record.info(`正在查找元素: ${title}`);

    const strategies = createElementStrategies(title, 'findOne');

    // 检查缓存
    if (elementCache.has(cacheKey)) {
        const cachedStrategy = elementCache.get(cacheKey)!;
        Record.info(`使用缓存策略 ${cachedStrategy.index + 1} 查找元素: ${title}`);
        
        const element = strategies[cachedStrategy.index]() as UiObject; // 
        if (element) {
            Record.info(`缓存策略 ${cachedStrategy.index + 1} 成功找到元素: ${title}----- ${element.text() || element.contentDescription}`);
            return element;
        } else {
            Record.error(`缓存策略失败，清除缓存并重新查找: ${title}`);
            // 更新缓存
            elementCache.set(cacheKey, {index:cachedStrategy.index, errorTime:cachedStrategy.errorTime - 1});
            if(cachedStrategy.errorTime >= 0){
                return null
            }
        }
    }

    // 缓存未命中，使用多种策略查找元素
    for (let i = 0; i < strategies.length; i++) {
        const element = strategies[i]() as UiObject;
        if (element) {
            Record.info(`策略 ${i + 1} 成功找到元素: ${title}----- ${element.text() || element.contentDescription}`);
            // 将成功的策略索引存入缓存
            elementCache.set(cacheKey, {index:i, errorTime:errorTime});
            // 将缓存放入
            Record.info(`已将策略 ${i + 1} 缓存为: ${cacheKey}`);
            saveElementCache(elementCache);
            return element;
        }
    }
    
    Record.error(`所有策略都未找到元素: ${title}`);
    return null;
};


// 使用多种策略查找元素列表
export const findTargetElementList = ( taskName: string,title: string, errorTime:number = 3) => {
    Record.info(`正在查找元素: ${title}`)
    const cacheKey = `${taskName}_${title}`;
    const strategies = createElementStrategies(title, 'find');


    if (elementCache.has(cacheKey)) {
        const cachedStrategy = elementCache.get(cacheKey)!;
        Record.info(`使用缓存策略 ${cachedStrategy.index + 1} 查找元素: ${title}`);
        
        const element = strategies[cachedStrategy.index]() as UiCollection; // 
        if (element?.length > 0) {
            Record.info(`缓存策略 ${cachedStrategy.index + 1} 成功找到元素: ${title}----`);
            elementCache.set(cacheKey, {index:cachedStrategy.index, errorTime:errorTime});  
            return element;
        } else {
            Record.error(`缓存策略失败，清除缓存并重新查找: ${title}`);
            elementCache.set(cacheKey, {index:cachedStrategy.index, errorTime:cachedStrategy.errorTime - 1});
            if(cachedStrategy.errorTime >= 0){
                return null
            }
        }
    }
    for (let i = 0; i < strategies.length; i++) {
        const element = strategies[i]() as UiCollection
        if (element?.length > 0) {
            Record.info(`策略 ${i + 1} 成功找到列表元素: ${title}--`, element?.length)
            elementCache.set(cacheKey, {index:i, errorTime:errorTime});  
            // 将缓存放入
            saveElementCache(elementCache);
            return element
        }
    }
    
    Record.error(`所有策略都未找到元素: ${title}`)
    return null
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

    // 统一策略数组（包含 exact 与 contains 两段），以便缓存命中时可直接索引
    const strategies: Array<() => UiObject | null> = [
        // exact
        () => className("android.view.View").textMatches(exactRegex).findOne(timeoutEach),
        () => className("android.view.View").descMatches(exactRegex).findOne(timeoutEach),
        () => className("android.widget.TextView").textMatches(exactRegex).findOne(timeoutEach),
        () => className("android.widget.TextView").descMatches(exactRegex).findOne(timeoutEach),
        () => className("android.widget.Button").textMatches(exactRegex).findOne(timeoutEach),
        () => className("android.widget.Button").descMatches(exactRegex).findOne(timeoutEach),
        // contains with filter
        () => {
            const list = className("android.view.View").textContains(title).find();
            Record.info(`策略 7 (View.textContains): 找到 ${list.length} 个候选元素`);
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                const txt = (node.text && node.text()) || (node as any).contentDescription || "";
                if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) {
                    Record.info(`策略 7 匹配成功: "${txt}"`);
                    return node;
                }
            }
            Record.info(`策略 7 未找到匹配元素`);
            return null;
        },
        () => {
            const list = className("android.view.View").descContains(title).find();
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                const txt = (node.text && node.text()) || (node as any).contentDescription || "";
                if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) return node;
            }
            return null;
        },
        () => {
            const list = className("android.widget.TextView").textContains(title).find();
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                const txt = (node.text && node.text()) || (node as any).contentDescription || "";
                if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) return node;
            }
            return null;
        },
        () => {
            const list = className("android.widget.TextView").descContains(title).find();
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                const txt = (node.text && node.text()) || (node as any).contentDescription || "";
                if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) return node;
            }
            return null;
        },
        () => {
            const list = className("android.widget.Button").textContains(title).find();
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                const txt = (node.text && node.text()) || (node as any).contentDescription || "";
                if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) return node;
            }
            return null;
        },
        () => {
            const list = className("android.widget.Button").descContains(title).find();
            for (let i = 0; i < list.length; i++) {
                const node = list[i];
                const txt = (node.text && node.text()) || (node as any).contentDescription || "";
                if (txt && txt.trim().startsWith(title) && !isExcluded(txt)) return node;
            }
            return null;
        },
    ];

    // 优先尝试缓存策略
    if (elementCache.has(cacheKey)) {
        const cached = elementCache.get(cacheKey) as { index: number; errorTime: number };
        try {
            const candidate = strategies[cached.index]() as UiObject | null;
            if (candidate) {
                Record.info(`strict 缓存策略 ${cached.index + 1} 命中: ${title}`);
                // 恢复
                elementCache.set(cacheKey, { index: cached.index, errorTime: errorTime});
                return candidate;
            } else {
                elementCache.set(cacheKey, { index: cached.index, errorTime: (cached.errorTime || 0) - 1 });
                // 若多次失败，可选择清理缓存（此处保留，交由调用侧控制）
                if(cached.errorTime >= 0){
                    return null
                }
            }
        } catch {}
    }

    // 未命中缓存，遍历策略
    for (let i = 0; i < strategies.length; i++) {
        const element = strategies[i]() as UiObject | null;
        if (element) {
            elementCache.set(cacheKey, { index: i, errorTime: errorTime });
            saveElementCache(elementCache);
            Record.info(`strict 策略 ${i + 1} 命中: ${title}`);
            return element;
        }
    }

    Record.error(`strict 模式未命中: ${title}`);
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

