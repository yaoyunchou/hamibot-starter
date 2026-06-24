/**
 * 无障碍布局树抓取（v7 版本）
 * 使用 accessibility 模块的 select() 获取根节点
 */
import { currentActivity, currentPackage, select } from 'accessibility';

export const layoutDumpConfig = { maxDepth: 30 };

export type ActiveWindowLayoutResult = {
    package: string;
    activity: string;
    tree: any;
};

/** 通过 select 找到一个 top-level 节点，然后向上遍历到根 */
function getRootNode(): any {
    // 尝试找到根节点（depth=0 的 FrameLayout 或任意节点）
    try {
        const root = select().className('android.widget.FrameLayout').depth(0).findOnce();
        if (root) return root;
    } catch {}
    // 兜底：找任意节点并向上遍历到根
    try {
        let node: any = select().findOnce();
        if (!node) return null;
        while (true) {
            const p = node.parent();
            if (!p) break;
            node = p;
        }
        return node;
    } catch { return null; }
}

const _layoutNodeA11y = (node: any, treeDepth: number): any => {
    const meta: any = {
        depth: treeDepth,
        childCount: typeof node.childCount === 'function' ? node.childCount() : 0,
    };
    const putBool = (key: string, method: string) => {
        const fn = node[method];
        if (typeof fn !== 'function') return;
        try { meta[key] = !!fn.call(node); } catch {}
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
        try { meta.winDepth = node.depth(); } catch {}
    }
    return meta;
};

const _buildLayoutTree = (node: any, depth: number, maxDepth: number): any => {
    if (!node || depth > maxDepth) return null;
    const b = node.bounds();
    const info: any = {
        cls: (typeof node.className === 'function' ? (node as any).className() : node.className) || '',
        text: node.text() || undefined,
        desc: node.contentDescription || node.desc?.() || undefined,
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

export const dumpActiveWindowLayout = (override?: { maxDepth?: number }): ActiveWindowLayoutResult => {
    const fromOverride = override?.maxDepth != null ? Number(override.maxDepth) : NaN;
    const maxDepth = !Number.isNaN(fromOverride) ? fromOverride : layoutDumpConfig.maxDepth;
    const root = getRootNode();
    if (!root) throw new Error('无法获取根节点（无障碍服务未就绪）');
    return {
        package: currentPackage() ?? '',
        activity: currentActivity() ?? '',
        tree: _buildLayoutTree(root, 0, maxDepth),
    };
};
