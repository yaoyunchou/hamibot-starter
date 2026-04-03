/**
 * 无障碍布局树抓取（供 base 调试与 aiExecutor 共用，避免与 base 循环依赖）
 */

/** 直接调用 `dumpActiveWindowLayout()` 时的默认参数 */
export const layoutDumpConfig = {
    maxDepth: 30,
};

export type ActiveWindowLayoutResult = {
    package: string;
    activity: string;
    tree: any;
};

const _layoutNodeA11y = (node: any, treeDepth: number): any => {
    const meta: any = {
        depth: treeDepth,
        childCount: typeof node.childCount === 'function' ? node.childCount() : 0,
    };
    const putBool = (key: string, method: string) => {
        const fn = node[method];
        if (typeof fn !== 'function') return;
        try {
            meta[key] = !!fn.call(node);
        } catch {
            /* skip */
        }
    };
    putBool('clickable', 'clickable');
    putBool('scrollable', 'scrollable');
    putBool('longClickable', 'longClickable');
    putBool('enabled', 'enabled');
    putBool('selected', 'selected');
    putBool('focusable', 'focusable');
    putBool('editable', 'editable');
    putBool('checkable', 'checkable');
    if (typeof node.depth === 'function') {
        try {
            meta.winDepth = node.depth();
        } catch {
            /* skip */
        }
    }
    return meta;
};

const _buildLayoutTree = (node: any, depth: number, maxDepth: number): any => {
    if (!node || depth > maxDepth) return null;
    const b = node.bounds();
    const info: any = {
        cls: node.className() || '',
        text: node.text() || undefined,
        desc: node.contentDescription || node.desc() || undefined,
        id: node.id() || undefined,
        bounds: b ? [b.left, b.top, b.right, b.bottom] : undefined,
        ..._layoutNodeA11y(node, depth),
    };
    const childCount = typeof node.childCount === 'function' ? node.childCount() : 0;
    if (childCount > 0 && depth < maxDepth) {
        info.children = [];
        for (let i = 0; i < childCount; i++) {
            const child = node.child(i);
            const childInfo = _buildLayoutTree(child, depth + 1, maxDepth);
            if (childInfo) info.children.push(childInfo);
        }
    }
    return info;
};

/**
 * 抓取当前活动窗口的无障碍布局树
 */
export const dumpActiveWindowLayout = (override?: { maxDepth?: number }): ActiveWindowLayoutResult => {
    const fromOverride =
        override?.maxDepth !== undefined && override?.maxDepth !== null
            ? Number(override.maxDepth)
            : NaN;
    const maxDepth = !Number.isNaN(fromOverride) ? fromOverride : layoutDumpConfig.maxDepth;
    const root = (auto as any).rootInActiveWindow || (auto as any).root;
    if (!root) throw new Error('无法获取根节点（无障碍服务未就绪）');
    return {
        package: currentPackage(),
        activity: currentActivity(),
        tree: _buildLayoutTree(root, 0, maxDepth),
    };
};
