import {
    back, currentActivity, currentPackage, select, swipe, takeScreenshot,
} from 'accessibility';
import { launch, launchApp, getPackageName, openAppSettings } from 'app';
import { coinExchange } from './getGold';
import { assertOnGoldCoinPage } from './goldPageDetect';
import { findDom } from './exposure';
import { startAutoComment } from './autoComment';
import { getGoldEntryClickFn } from '../utils/getGold';
import { closeApp, startMediaProjectionAutoConfirm, tryClickNode } from '../utils/common';
import { dumpActiveWindowLayout, layoutDumpConfig } from './layoutDump';
import { startAiLoop } from './aiExecutor';
import {
    clearTaskStop, shouldStopCurrentTask,
    startCancelWatcher, stopCancelWatcher,
} from './taskControl';
import {
    createLogs, fetchPendingTasks, claimTask, completeTask,
    reportAlert, pollDebugCommands, claimDebugCommand, reportDebugResult,
} from '../../../lib/service';
import { getScreenWidth, getScreenHeight } from '../../../lib/screenSize';
import { findByA11yId } from '../utils/common';
import { Record } from '../../../lib/logger';
import { sleep } from '../../../lib/sleep';

export { dumpActiveWindowLayout, layoutDumpConfig } from './layoutDump';
export type { ActiveWindowLayoutResult } from './layoutDump';

const jobs: string[] = [];

export const APPNAME = 'com.taobao.idlefish';

export enum PageType {
    'home'     = 'com.taobao.idlefish.maincontainer.activity.MainActivity',
    'layout'   = 'android.widget.FrameLayout',
    'goldCoin' = 'com.taobao.idlefish.webview.WebHybridActivity',
    'product'  = 'com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity',
    'comment'  = 'com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity',
}

// ─────────────────────────── 状态日志 ───────────────────────────

export const runInfo = { log: '开始', page: null as any };

export const initRunInfo = (_logUI: any) => {
    runInfo.page = _logUI;
    if (runInfo.log) console.log('[runInfo]', runInfo.log);
};

// ─────────────────────────── 操作轨迹 ───────────────────────────

let _taskContext = 'main';
export const setTaskContext  = (name: string) => { _taskContext = name; };
export const clearTaskContext = () => { _taskContext = 'main'; };
export const getTaskContext  = () => _taskContext;

const reportTrace = (action: string) => {
    const entry = { time: new Date().toLocaleTimeString('zh-CN'), action, task: _taskContext };
    createLogs('trace', entry).catch(() => {});
};

export const flushTraces = (_taskName = 'run') => {};

export const setRunInfo = (log: string) => {
    runInfo.log = log;
    console.log('[runInfo]', log);
    reportTrace(log);
};

export const getPageInfo = async () => {
    console.log(`currentPackage: ${currentPackage()}`);
    console.log(`currentActivity: ${currentActivity()}`);
};

// ─────────────────────────── 页面导航 ───────────────────────────

export interface PageResult {
    success: boolean;
    element: any | null;
    message: string;
}

export const isOnMyPage = (): PageResult => {
    const element = select().className('android.widget.TextView').textContains('我发布的').findOne(1500);
    return {
        success: !!element,
        element,
        message: element ? '已在我的页面' : '不在我的页面',
    };
};

export const navigateToMyTab = async (): Promise<PageResult> => {
    setRunInfo('navigateToMyTab: 点击我的 Tab');
    const myBtn = select().className('android.widget.FrameLayout').descContains('我的').clickable(true).findOne(2000);
    if (!myBtn) {
        const msg = 'navigateToMyTab: 未找到我的 Tab 按钮';
        setRunInfo(msg);
        return { success: false, element: null, message: msg };
    }
    myBtn.click();
    await sleep(1500);
    const result = isOnMyPage();
    setRunInfo(`navigateToMyTab: ${result.message}`);
    return { ...result, element: myBtn };
};

export const clickMyPageEntry = async (label: string): Promise<PageResult> => {
    setRunInfo(`clickMyPageEntry: 点击「${label}」`);
    const btn = select().className('android.widget.ImageView').descContains(label).findOne(2000);
    if (!btn) {
        const msg = `clickMyPageEntry: 未找到「${label}」入口`;
        setRunInfo(msg);
        return { success: false, element: null, message: msg };
    }
    btn.click();
    await sleep(1000);
    return { success: true, element: btn, message: `已点击「${label}」` };
};

let backMyPageMaxCount = 0;

export const goBackMyPage = async (): Promise<void> => {
    setRunInfo(`goBackMyPage: 尝试回到我的页面 (第${backMyPageMaxCount + 1}次)`);
    if (backMyPageMaxCount > 5) {
        setRunInfo('goBackMyPage: 超过最大重试次数，重启闲鱼');
        backMyPageMaxCount = 0;
        await closeApp('闲鱼');
        await sleep(2000);
        await findPage('home');
        return;
    }
    if (isOnMyPage().success) {
        backMyPageMaxCount = 0;
        setRunInfo('goBackMyPage: 已回到我的页面');
        return;
    }
    const tabResult = await navigateToMyTab();
    if (tabResult.success) {
        backMyPageMaxCount = 0;
        setRunInfo('goBackMyPage: 已回到我的页面');
        return;
    }
    setRunInfo('goBackMyPage: 未能进入我的页面，执行返回');
    backMyPageMaxCount++;
    await back();
    await sleep(1000);
    await goBackMyPage();
};

export const findPage = async (pageName: string): Promise<void> => {
    setRunInfo('findPage: ' + pageName);
    const pkg = currentPackage();
    const activity = currentActivity();

    if (pkg !== APPNAME) {
        setRunInfo('findPage: 闲鱼未在前台，重新启动');
        launch(APPNAME);
        await sleep(1000);
        await findPage(pageName);
        return;
    }

    if (!isOnMyPage().success) {
        setRunInfo('findPage: 不在我的页面，先回退');
        await goBackMyPage();
        await findPage(pageName);
        return;
    }

    switch (pageName) {
        case 'home':
            break;

        case 'goldCoin':
            if (activity === PageType.goldCoin) {
                if (assertOnGoldCoinPage('findPage', 1200)) {
                    await coinExchange();
                } else {
                    setRunInfo('findPage: WebHybrid 但未识别金币地图，等待加载');
                    await sleep(2500);
                    if (assertOnGoldCoinPage('findPage', 1500)) {
                        await coinExchange();
                    } else {
                        setRunInfo('findPage: 仍非金币地图，从「我的」重进');
                        await goBackMyPage();
                        await sleep(1000);
                        await findPage(pageName);
                    }
                }
            } else if (activity === PageType.home) {
                const goldButtons = isOnMyPage();
                if (goldButtons.success) {
                    setRunInfo('findPage: 点击进入金币页面');
                    await getGoldEntryClickFn(goldButtons.element);
                    await sleep(3000);
                    await coinExchange();
                } else {
                    setRunInfo('findPage: 未找到金币入口，重试');
                    await goBackMyPage();
                    await sleep(1000);
                    await findPage(pageName);
                }
            } else {
                await goBackMyPage();
                await sleep(1000);
                await findPage(pageName);
            }
            break;

        case 'product':
            if (activity === PageType.product) {
                const btn = select().className('android.view.View').descContains('今日曝光').findOne(1000);
                if (btn) {
                    setRunInfo('findPage: 进入商品详情页面');
                } else {
                    await goBackMyPage();
                    await findPage(pageName);
                }
            } else if (activity === PageType.home || activity === PageType.layout) {
                await navigateToMyTab();
                if ((await clickMyPageEntry('我发布的')).success) {
                    await findDom();
                }
            } else {
                await goBackMyPage();
                await sleep(1000);
                await findPage(pageName);
            }
            break;

        case 'comment':
            if (activity === PageType.comment) {
                const mySoleTab = select().className('android.view.View').descContains('我卖出的').findOne(1000);
                if (mySoleTab) {
                    const mySoleText = mySoleTab.contentDescription + '';
                    if (mySoleText.indexOf('我卖出的 0') > -1) {
                        setRunInfo('findPage: 没有待评论的订单');
                    } else {
                        setRunInfo('findPage: 进入评论页面');
                        await startAutoComment();
                    }
                } else {
                    await goBackMyPage();
                    await sleep(1000);
                    await findPage(pageName);
                }
            } else if (activity === PageType.home || activity === PageType.layout) {
                await navigateToMyTab();
                await clickMyPageEntry('待评价');
                await sleep(1000);
                await findPage(pageName);
            } else {
                await goBackMyPage();
                await sleep(1000);
                await findPage(pageName);
            }
            break;

        default:
            setRunInfo(`findPage: 未知页面 ${pageName}`);
    }
};

// ─────────────────────────── 任务执行器 ───────────────────────────

const MAX_TASK_DURATION_MS = 60 * 60 * 1000;
let _currentTaskId: string | null = null;
let _currentTaskStart = 0;

const executeTask = async (task: any): Promise<void> => {
    _currentTaskId = task.id;
    _currentTaskStart = Date.now();
    startCancelWatcher(task.id);
    setRunInfo(`任务开始: ${task.type}`);
    try {
        switch (task.type) {
            case 'goldCoin': await findPage('goldCoin'); break;
            case 'comment':  await findPage('comment');  break;
            case 'product':  await findPage('product');  break;
            case 'ai_task':
                startAiLoop(task, () => {
                    stopCancelWatcher();
                    clearTaskStop();
                    _currentTaskId = null;
                    setRunInfo('taskPoller: AI 任务已结束，可接收新任务');
                });
                return;
            default:
                setRunInfo(`未知任务类型: ${task.type}`);
                await completeTask(task.id, false, `未知任务类型: ${task.type}`);
                return;
        }
        if (shouldStopCurrentTask()) {
            setRunInfo(`任务已取消: ${task.type}`);
            return;
        }
        setRunInfo(`任务完成: ${task.type}`);
        await completeTask(task.id, true);
    } catch (e) {
        if (shouldStopCurrentTask()) { setRunInfo(`任务已取消: ${task.type}`); return; }
        const msg = String(e);
        setRunInfo(`任务异常: ${msg}`);
        await completeTask(task.id, false, msg);
        reportAlert('error', `任务「${task.type}」执行异常: ${msg}`, task.id).catch(() => {});
    } finally {
        stopCancelWatcher();
        clearTaskStop();
        if (task.type !== 'ai_task') _currentTaskId = null;
    }
};

/**
 * 启动任务轮询（async 循环替代 threads.start + while true）
 */
export const startTaskPoller = (): void => {
    (async () => {
        setRunInfo('taskPoller: 任务轮询已启动');
        while (true) {
            try {
                if (_currentTaskId && Date.now() - _currentTaskStart > MAX_TASK_DURATION_MS) {
                    const msg = `任务 ${_currentTaskId} 超过 60 分钟未完成`;
                    setRunInfo('taskPoller: ' + msg);
                    await reportAlert('warn', msg, _currentTaskId as string);
                    await completeTask(_currentTaskId as string, false, '超时');
                    _currentTaskId = null;
                }

                if (!_currentTaskId) {
                    const result = await fetchPendingTasks();
                    if (!result) {
                        setRunInfo('taskPoller: 拉取任务失败（网络/服务器异常）');
                    } else if (!result.data || result.data.length === 0) {
                        setRunInfo('taskPoller: 无待执行任务，等待下次轮询');
                    } else {
                        const task = result.data[0];
                        setRunInfo(`taskPoller: 收到任务 [${task.type}]`);
                        await claimTask(task.id);
                        await executeTask(task);
                    }
                } else {
                    setRunInfo(`taskPoller: 任务 [${_currentTaskId}] 执行中，跳过本次轮询`);
                }
            } catch (e) {
                setRunInfo(`taskPoller: 轮询异常 ${e}`);
            }
            await sleep(15000);
        }
    })();
};

// ─────────────────────────── 远程调试执行器 ───────────────────────────

const _logCapture = (msg: string) => {
    const line = `[capture] ${msg}`;
    console.log(line);
    setRunInfo(line);
    createLogs('trace', { time: new Date().toLocaleTimeString('zh-CN'), action: line }).catch(() => {});
};

let _screenshotReady = false;

const _runDebugScreenshot = async (params: any): Promise<any> => {
    _logCapture('screenshot: begin');
    await sleep(300);
    let img: Autox.Image | null = null;
    try {
        img = await takeScreenshot();
    } catch (e) {
        _logCapture(`screenshot: takeScreenshot error ${e}`);
        throw new Error(`takeScreenshot 失败: ${e}`);
    }
    if (!img) throw new Error('takeScreenshot 返回 null');
    _screenshotReady = true;

    // Autox.Image 转 base64（v7 方式）
    const quality = params.quality || 60;
    let base64: string | null = null;
    try {
        // @ts-ignore — AutoX.js Image 对象上的 toBase64 方法
        base64 = typeof (img as any).toBase64 === 'function'
            ? (img as any).toBase64('jpg', quality)
            : null;
    } catch {}
    if (typeof (img as any).recycle === 'function') (img as any).recycle();
    _logCapture(`screenshot: ok bytes=${base64 ? base64.length : 0}`);
    return {
        format: 'jpg',
        quality,
        package: currentPackage(),
        activity: currentActivity(),
        base64,
    };
};

const _runDebugPageInfo = (_params: any): any => ({
    package: currentPackage(),
    activity: currentActivity(),
    screenWidth: getScreenWidth(),
    screenHeight: getScreenHeight(),
});

const _extractElementInfo = (el: any): any => {
    if (!el) return null;
    const b = el.bounds();
    return {
        text: el.text() || '',
        desc: el.contentDescription || el.desc() || '',
        className: (typeof el.className === 'function' ? (el as any).className() : el.className) || '',
        id: el.id() || '',
        bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null,
        clickable: !!(typeof el.clickable === 'function' ? (el as any).clickable() : el.clickable),
        enabled: !!(typeof el.enabled === 'function' ? (el as any).enabled() : el.enabled),
        depth: typeof el.depth === 'function' ? el.depth() : -1,
        childCount: typeof el.childCount === 'function' ? el.childCount() : -1,
    };
};

const _runDebugElement = async (params: any): Promise<any> => {
    const method  = params.method  || 'text';
    const value   = params.value   || '';
    const action  = params.action  || 'info';
    const timeout = params.timeout || 3000;
    const index   = params.index   || 0;

    if (method === 'layoutId') {
        const el = await findByA11yId(value, timeout, index);
        if (action === 'exists') return { found: !!el, method, value, index };
        if (action === 'click') {
            if (!el) return { found: false, clicked: false, method, value, index };
            await tryClickNode(el);
            return { found: true, clicked: true, method, value, index, ..._extractElementInfo(el) };
        }
        if (!el) return { found: false, method, value, index };
        return { found: true, method, value, index, ..._extractElementInfo(el) };
    }

    let sel: any;
    switch (method) {
        case 'text':         sel = select().text(value); break;
        case 'textContains': sel = select().textContains(value); break;
        case 'id':           sel = select().id(value); break;
        case 'desc':         sel = select().desc(value); break;
        case 'descContains': sel = select().descContains(value); break;
        case 'className':    sel = select().className(value); break;
        default: throw new Error(`不支持的选择器方法: ${method}`);
    }

    if (action === 'exists') {
        const el = sel.findOne(timeout);
        return { found: !!el, method, value };
    }
    if (action === 'click') {
        const el = sel.findOne(timeout);
        if (!el) return { found: false, clicked: false, method, value };
        await tryClickNode(el);
        return { found: true, clicked: true, method, value, ..._extractElementInfo(el) };
    }
    if (action === 'bounds') {
        const el = sel.findOne(timeout);
        if (!el) return { found: false, method, value };
        const b = el.bounds();
        return { found: true, method, value, bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null };
    }
    if (index > 0) {
        const all = sel.find();
        if (!all || all.length === 0) return { found: false, method, value, total: 0 };
        const target = index < all.length ? all[index] : all[all.length - 1];
        return { found: true, method, value, total: all.length, index, ..._extractElementInfo(target) };
    }
    const el = sel.findOne(timeout);
    if (!el) return { found: false, method, value };
    return { found: true, method, value, ..._extractElementInfo(el) };
};

const _runDebugScript = (params: any): any => {
    const code = params.code || '';
    if (!code) throw new Error('代码不能为空');
    const fn = new Function(code);
    const result = fn();
    return { executed: true, result: result !== undefined ? String(result) : null };
};

const _runDebugLayout = (params: any): any => {
    let override: { maxDepth?: number } | undefined;
    if (params?.depth != null && params.depth !== '') {
        const n = Number(params.depth);
        if (!Number.isNaN(n)) override = { maxDepth: n };
    }
    return dumpActiveWindowLayout(override);
};

const _runDebugPageCapture = async (params: any): Promise<any> => {
    _logCapture('page_capture: 开始');
    const depth = Number(params?.maxDepth) || layoutDumpConfig.maxDepth || 30;
    _logCapture(`page_capture: dump layout depth=${depth}`);
    const layout = dumpActiveWindowLayout({ maxDepth: depth });
    _logCapture(`page_capture: layout ok package=${layout.package}`);
    let screenshotBase64: string | null = null;
    let screenshotError: string | null = null;
    try {
        const screenshot = await _runDebugScreenshot({ quality: params?.quality ?? 70 });
        screenshotBase64 = screenshot?.base64 ?? null;
    } catch (e) {
        screenshotError = String(e);
        _logCapture(`page_capture: 截图失败 ${screenshotError}`);
    }
    _logCapture(`page_capture: 完成 tree=${!!layout.tree} screenshot=${!!screenshotBase64}`);
    return {
        package: layout.package,
        activity: layout.activity,
        tree: layout.tree,
        screenshot_base64: screenshotBase64,
        screenshot_error: screenshotError,
        max_depth: depth,
    };
};

const executeDebugCommand = async (cmd: any): Promise<void> => {
    await claimDebugCommand(cmd.id);
    try {
        let result: any;
        switch (cmd.type) {
            case 'screenshot':   result = await _runDebugScreenshot(cmd.params); break;
            case 'page_info':    result = _runDebugPageInfo(cmd.params); break;
            case 'element':      result = await _runDebugElement(cmd.params); break;
            case 'script':       result = _runDebugScript(cmd.params); break;
            case 'layout':       result = _runDebugLayout(cmd.params); break;
            case 'page_capture': result = await _runDebugPageCapture(cmd.params); break;
            default:
                await reportDebugResult(cmd.id, false, null, `不支持的指令类型: ${cmd.type}`);
                return;
        }
        await reportDebugResult(cmd.id, true, result);
    } catch (e) {
        const err = String(e);
        _logCapture(`debug [${cmd.type}] 失败: ${err}`);
        await reportDebugResult(cmd.id, false, null, err);
    }
};

/**
 * 启动调试指令轮询（async 循环，每条指令独立 Promise）
 */
export const startDebugPoller = (): void => {
    (async () => {
        setRunInfo('debugPoller: 调试轮询已启动');
        while (true) {
            try {
                const result = await pollDebugCommands();
                if (result?.data?.length > 0) {
                    for (const cmd of result.data) {
                        setRunInfo(`debugPoller: 收到指令 [${cmd.type}] id=${(cmd.id || '').slice(0, 8)}`);
                        // 独立 Promise，不阻塞轮询循环
                        executeDebugCommand(cmd).catch(e => {
                            console.error(`debugPoller: 执行 [${cmd.type}] 异常: ${e}`);
                        });
                    }
                }
            } catch (e) {
                const msg = `debugPoller 异常: ${e}`;
                console.error(msg);
                setRunInfo(msg);
            }
            await sleep(3000);
        }
    })();
};

// ─────────────────────────── 主入口 ───────────────────────────

export const xyBaseRunWithLog = async (): Promise<void> => {
    await closeApp('闲鱼');
    await sleep(1000);
    launchApp('闲鱼');

    // 初始化（等待应用启动）
    await sleep(800);
    setRunInfo('初始化中...');
    await findDom();
    setRunInfo('findDom 完成');

    // 启动轮询（在后台异步运行）
    startTaskPoller();
    startDebugPoller();

    // 触发截图（v7 直接 takeScreenshot，无需 requestScreenCapture）
    setRunInfo('正在测试截图权限...');
    const stopAutoConfirm = startMediaProjectionAutoConfirm(35000);
    await sleep(300);
    try {
        const img = await takeScreenshot();
        if (img) {
            _screenshotReady = true;
            if (typeof (img as any).recycle === 'function') (img as any).recycle();
            setRunInfo('截图权限已就绪');
        } else {
            setRunInfo('截图权限未就绪，将只有布局树');
        }
    } catch (e) {
        setRunInfo(`截图权限失败: ${e}`);
    }
    stopAutoConfirm();
};
