import { coinExchange } from "./getGold";
import { assertOnGoldCoinPage } from "./goldPageDetect";
import { findDom } from "./exposure";
import { startAutoComment } from "./autoComment";
import { getGoldEntryClickFn } from "../utils/getGold";
import { closeApp, findByA11yId, startMediaProjectionAutoConfirm } from "../utils/common";
import { dumpActiveWindowLayout, layoutDumpConfig } from "./layoutDump";
import { startAiLoop } from "./aiExecutor";
import {
    clearTaskStop,
    shouldStopCurrentTask,
    startCancelWatcher,
    stopCancelWatcher,
} from "./taskControl";
import { createLogs, fetchPendingTasks, claimTask, completeTask, reportAlert, pollDebugCommands, claimDebugCommand, reportDebugResult } from "../../../lib/service";
import { getScreenWidth, getScreenHeight } from "../../../lib/screenSize";

export { dumpActiveWindowLayout, layoutDumpConfig } from "./layoutDump";
export type { ActiveWindowLayoutResult } from "./layoutDump";

const { jobs=[] } = hamibot.env;

export const APPNAME = 'com.taobao.idlefish'

export enum PageType {
    'home'="com.taobao.idlefish.maincontainer.activity.MainActivity",
    'layout'=" android.widget.FrameLayout",
    'goldCoin'="com.taobao.idlefish.webview.WebHybridActivity",
    "product"='com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity',
    "comment" = "com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity"
}

// 优化日志
export const runInfo = {
    log: '开始',
    page:null
}

export const initRunInfo = (logUI:any) =>{
    runInfo.page = logUI;
    // 悬浮窗创建后，把启动阶段已积累的日志刷到 UI 上
    if (runInfo.log) {
        ui.post(function () {
            try {
                runInfo.page.runLog.setText(runInfo.log);
            } catch (_) {}
        });
    }
}

// ---------------------- 操作轨迹 -------------------------

/**
 * 上报一条操作轨迹到服务器（后台线程，不阻塞主流程）
 * name 固定为 "trace"，data 为操作内容
 */
const reportTrace = (action: string) => {
    const entry = {
        time: new Date().toLocaleTimeString('zh-CN'),
        action
    };
    threads.start(function () {
        try {
            createLogs('trace', entry);
        } catch (e) {}
    });
};

/**
 * flushTraces 保留为空操作，兼容现有调用点，无需修改其他文件
 */
export const flushTraces = (_taskName: string = 'run') => {};

// 设置日志（同时实时上报操作轨迹）
export const setRunInfo = (log: string) => {
    runInfo.log = log;
    reportTrace(log);
    if (runInfo.page) {
        // ui.post 异步更新，避免子线程 ui.run 阻塞导致悬浮窗卡死
        ui.post(function () {
            try {
                runInfo.page.runLog.setText(runInfo.log);
            } catch (_) {}
        });
    }
}
// 获取当前页面的信息
export const getPageInfo = () =>{
    const name = currentPackage();
    console.log(`currentPackage: ${name}`)
    const activity = currentActivity();
    console.log(`currentActivity: ${activity}`)
}

let backMyPageMaxCount = 0;
// 回退到我的页面
export const goBackMyPage = () => {
    setRunInfo(`goBackMyPage: 尝试回到我的页面 (第${backMyPageMaxCount + 1}次)`);

    if (backMyPageMaxCount > 5) {
        setRunInfo('goBackMyPage: 超过最大重试次数，重启闲鱼');
        backMyPageMaxCount = 0;
        closeApp('闲鱼');
        sleep(2000);
        findPage('home');
        return;
    }

    // 已在我的页面，直接返回
    if (isOnMyPage().success) {
        backMyPageMaxCount = 0;
        setRunInfo('goBackMyPage: 已回到我的页面');
        return;
    }

    // 尝试点击我的 Tab
    const tabResult = navigateToMyTab();
    if (tabResult.success) {
        backMyPageMaxCount = 0;
        setRunInfo('goBackMyPage: 已回到我的页面');
        return;
    }

    // Tab 点击失败，执行系统返回后重试
    setRunInfo('goBackMyPage: 未能进入我的页面，执行返回');
    backMyPageMaxCount++;
    back();
    sleep(1000);
    goBackMyPage();
}

// ----------- 「我的」页面相关工具函数 -----------

export interface PageResult {
    success: boolean;
    element: any | null;
    message: string;
}

/**
 * 判断当前是否已在「我的」页面
 * 以「我发布的」快捷入口是否可见作为判断依据
 */
export const isOnMyPage = (): PageResult => {
    const element = className("android.widget.TextView").textContains("我发布的").findOne(1500);
    return {
        success: !!element,
        element,
        message: element ? '已在我的页面' : '不在我的页面'
    };
}

/**
 * 点击底部「我的」Tab，并等待页面切换完成
 */
export const navigateToMyTab = (): PageResult => {
    setRunInfo('navigateToMyTab: 点击我的 Tab');
    const myBtn = className("android.widget.FrameLayout").descContains("我的").clickable(true).findOne(2000);
    if (!myBtn) {
        const msg = 'navigateToMyTab: 未找到我的 Tab 按钮';
        setRunInfo(msg);
        return { success: false, element: null, message: msg };
    }
    myBtn.click();
    sleep(1500);
    const result = isOnMyPage();
    setRunInfo(`navigateToMyTab: ${result.message}`);
    return { ...result, element: myBtn };
}

/**
 * 点击「我的」页面中的快捷入口（我发布的 / 待评价 等）
 * @param label 入口文案
 */
export const clickMyPageEntry = (label: string): PageResult => {
    setRunInfo(`clickMyPageEntry: 点击「${label}」`);
    const btn = className("android.widget.ImageView").descContains(label).findOne(2000);
    if (!btn) {
        const msg = `clickMyPageEntry: 未找到「${label}」入口`;
        setRunInfo(msg);
        return { success: false, element: null, message: msg };
    }
    btn.click();
    sleep(1000);
    return { success: true, element: btn, message: `已点击「${label}」` };
}

// ----------- 通过页面名称导航到对应页面 -----------

export const findPage = (pageName: string) => {
    setRunInfo('findPage: ' + pageName);

    const name = currentPackage();
    const activity = currentActivity();

    // 确保闲鱼在前台
    if (name !== APPNAME) {
        setRunInfo('findPage: 闲鱼未在前台，重新启动');
        launch(APPNAME);
        sleep(1000);
        findPage(pageName);
        return;
    }

    // 所有流程起点都要求在「我的」页面
    if (!isOnMyPage().success) {
        setRunInfo('findPage: 不在我的页面，先回退');
        goBackMyPage();
        // 回退后重新进入，避免 activity 使用旧值导致逻辑错误
        findPage(pageName);
        return;
    }

    switch (pageName) {
        case 'home':
            break;
        // 金币页面
        case 'goldCoin':
            if (activity === PageType.goldCoin) {
                if (assertOnGoldCoinPage('findPage', 1200)) {
                    coinExchange();
                } else {
                    setRunInfo('findPage: WebHybrid 但未识别金币地图，等待加载');
                    sleep(2500);
                    if (assertOnGoldCoinPage('findPage', 1500)) {
                        coinExchange();
                    } else {
                        setRunInfo('findPage: 仍非金币地图，从「我的」重进');
                        goBackMyPage();
                        sleep(1000);
                        findPage(pageName);
                    }
                }
            } else if (activity === PageType.home) {
                const goldButtons = isOnMyPage();
                if (goldButtons.success) {
                    setRunInfo('findPage: 点击进入金币页面');
                    getGoldEntryClickFn(goldButtons.element);
                    sleep(3000); // 等待金币页面完全加载，避免过早查找元素触发无限递归
                    coinExchange();
                } else {
                    setRunInfo('findPage: 未找到金币入口，重试');
                    goBackMyPage();
                    sleep(1000);
                    findPage(pageName);
                }
            } else {
                goBackMyPage();
                sleep(1000);
                findPage(pageName);
            }
            break;
        // 商品详情页面
        case 'product':
            if (activity === PageType.product) {
                const btn = className("android.view.View").descContains("今日曝光").findOne(1000);
                if (btn) {
                    setRunInfo('findPage: 进入商品详情页面');
                } else {
                    goBackMyPage();
                    findPage(pageName);
                }
            } else if (activity === PageType.home || activity === PageType.layout) {
                navigateToMyTab();
                if (clickMyPageEntry('我发布的').success) {
                    findDom();
                }
            } else {
                goBackMyPage();
                sleep(1000);
                findPage(pageName);
            }
            break;
        // 评论页面
        case 'comment':
            if (activity === PageType.comment) {
                const mySoleTab = className("android.view.View").descContains("我卖出的").findOne(1000);
                if (mySoleTab) {
                    const mySoleText = mySoleTab.contentDescription + '';
                    if (mySoleText.indexOf("我卖出的 0") > -1) {
                        setRunInfo('findPage: 没有待评论的订单');
                    } else {
                        setRunInfo('findPage: 进入评论页面');
                        startAutoComment();
                    }
                } else {
                    goBackMyPage();
                    sleep(1000);
                    findPage(pageName);
                }
            } else if (activity === PageType.home || activity === PageType.layout) {
                navigateToMyTab();
                clickMyPageEntry('待评价');
                sleep(1000);
                findPage(pageName);
            } else {
                goBackMyPage();
                sleep(1000);
                findPage(pageName);
            }
            break;

        default:
            setRunInfo(`findPage: 未知页面 ${pageName}`);
    }
}


// 获取曝光
export const xyBaseRun = () =>{
    launchApp("闲鱼");
    findDom();
    threads.start(function () {
        const window = floaty.window(
            `<vertical>
                <text id="runLog"  padding="10 5 10 5" bg="#ff0000" w="300" h="auto" text="Hello" />
            </vertical>` as any
        );
        window.setPosition(window.getX(), window.getY() + 100);
        initRunInfo(window)
        if(jobs.includes('goldCoin')){
            findPage('goldCoin')
            coinExchange()
        }
    }); 
}

// ─────────────────────────── 任务执行器 ───────────────────────────

/** 每个任务最长允许执行时间（毫秒） */
const MAX_TASK_DURATION_MS = 60 * 60 * 1000;

/** 当前正在执行的任务 id（null 表示空闲） */
let _currentTaskId: string | null = null;
let _currentTaskStart: number = 0;

/** 执行单个任务（阻塞，完成后返回） */
const executeTask = (task: any) => {
    _currentTaskId = task.id;
    _currentTaskStart = Date.now();
    startCancelWatcher(task.id);
    setRunInfo(`任务开始: ${task.type}`);
    try {
        switch (task.type) {
            case 'goldCoin': findPage('goldCoin'); break;
            case 'comment':  findPage('comment');  break;
            case 'product':  findPage('product');  break;
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
                completeTask(task.id, false, `未知任务类型: ${task.type}`);
                return;
        }
        if (shouldStopCurrentTask()) {
            setRunInfo(`任务已取消: ${task.type}`);
            return;
        }
        setRunInfo(`任务完成: ${task.type}`);
        completeTask(task.id, true);
    } catch (e) {
        if (shouldStopCurrentTask()) {
            setRunInfo(`任务已取消: ${task.type}`);
            return;
        }
        const msg = String(e);
        setRunInfo(`任务异常: ${msg}`);
        completeTask(task.id, false, msg);
        threads.start(function () {
            reportAlert('error', `任务「${task.type}」执行异常: ${msg}`, task.id);
        });
    } finally {
        stopCancelWatcher();
        clearTaskStop();
        if (task.type !== 'ai_task') {
            _currentTaskId = null;
        }
    }
};

/**
 * 启动任务轮询线程
 * - 每 15 秒向服务器拉取一次 pending 任务
 * - 同一时间只执行一个任务，执行中不拉新任务
 * - 当前任务超过 MAX_TASK_DURATION_MS 时上报超时预警
 */
export const startTaskPoller = () => {
    threads.start(function () {
        setRunInfo('taskPoller: 任务轮询已启动');
        while (true) {
            try {
                // 超时检测
                if (_currentTaskId && Date.now() - _currentTaskStart > MAX_TASK_DURATION_MS) {
                    const msg = `任务 ${_currentTaskId} 超过 60 分钟未完成，请检查客户端状态`;
                    setRunInfo('taskPoller: ' + msg);
                    threads.start(function () {
                        reportAlert('warn', msg, _currentTaskId);
                        completeTask(_currentTaskId, false, '超时');
                    });
                    _currentTaskId = null;
                }

                // 空闲时才拉新任务
                if (!_currentTaskId) {
                    const result = fetchPendingTasks();
                    if (!result) {
                        setRunInfo('taskPoller: 拉取任务失败（网络/服务器异常）');
                    } else if (!result.data || result.data.length === 0) {
                        setRunInfo('taskPoller: 无待执行任务，等待下次轮询');
                        // ── 暂关：无待执行任务时默认执行一次获取金币（不上报服务器）。要恢复：删掉上一行，并取消下面整段每行前的 //
                        // setRunInfo('taskPoller: 无待执行任务，默认执行获取金币任务');
                        // _currentTaskId = 'default_goldCoin';
                        // _currentTaskStart = Date.now();
                        // try {
                        //     findPage('goldCoin');
                        //     setRunInfo('taskPoller: 默认金币任务完成');
                        // } catch (e) {
                        //     setRunInfo(`taskPoller: 默认金币任务异常 ${e}`);
                        // } finally {
                        //     _currentTaskId = null;
                        // }
                    } else {
                        const task = result.data[0];
                        setRunInfo(`taskPoller: 收到任务 [${task.type}]`);
                        claimTask(task.id);
                        executeTask(task);
                    }
                } else {
                    setRunInfo(`taskPoller: 任务 [${_currentTaskId}] 执行中，跳过本次轮询`);
                }
            } catch (e) {
                setRunInfo(`taskPoller: 轮询异常 ${e}`);
            }
            sleep(15000);
        }
    });
};

// ─────────────────────────── 远程调试执行器 ───────────────────────────

const _logCapture = (msg: string) => {
    const line = `[capture] ${msg}`;
    console.log(line);
    setRunInfo(line);
    try {
        createLogs('trace', {
            time: new Date().toLocaleTimeString('zh-CN'),
            action: line,
        });
    } catch (_) {}
};

/** 截图权限：granted / denied / unknown */
let _screenCaptureState = 'unknown';

const _runDebugScreenshot = (params: any): any => {
    _logCapture(`screenshot: begin state=${_screenCaptureState}`);
    sleep(300);
    let img: any = null;
    try {
        img = captureScreen();
    } catch (e) {
        _logCapture(`screenshot: captureScreen error ${e}`);
        throw new Error(`captureScreen 失败: ${e}`);
    }
    if (!img) throw new Error('captureScreen 返回 null');
    _screenCaptureState = 'granted';
    const quality = params.quality || 60;
    const base64 = (images as any).toBase64(img, 'jpg', quality);
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

const _runDebugPageInfo = (_params: any): any => {
    return {
        package: currentPackage(),
        activity: currentActivity(),
        screenWidth: getScreenWidth(),
        screenHeight: getScreenHeight(),
    };
};

const _extractElementInfo = (el: any): any => {
    if (!el) return null;
    const b = el.bounds();
    return {
        text: el.text() || '',
        desc: el.contentDescription || el.desc() || '',
        className: el.className() || '',
        id: el.id() || '',
        bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null,
        clickable: !!el.clickable(),
        enabled: !!el.enabled(),
        depth: typeof el.depth === 'function' ? el.depth() : -1,
        childCount: typeof el.childCount === 'function' ? el.childCount() : -1,
    };
};

const _runDebugElement = (params: any): any => {
    const method = params.method || 'text';
    const value = params.value || '';
    const action = params.action || 'info';
    const timeout = params.timeout || 3000;
    const index = params.index || 0;

    /** layout JSON / node.id() 上的 id（如 taskWrap），非 Android 资源 id */
    if (method === 'layoutId') {
        const el = findByA11yId(value, timeout, index);
        if (action === 'exists') {
            return { found: !!el, method, value, index };
        }
        if (action === 'click') {
            if (!el) return { found: false, clicked: false, method, value, index };
            el.click();
            return { found: true, clicked: true, method, value, index, ..._extractElementInfo(el) };
        }
        if (action === 'bounds') {
            if (!el) return { found: false, method, value, index };
            const b = el.bounds();
            return { found: true, method, value, index, bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null };
        }
        if (!el) return { found: false, method, value, index };
        return { found: true, method, value, index, ..._extractElementInfo(el) };
    }

    let selector: any;
    switch (method) {
        case 'text':          selector = text(value); break;
        case 'textContains':  selector = textContains(value); break;
        case 'id':            selector = id(value); break;
        case 'desc':          selector = desc(value); break;
        case 'descContains':  selector = descContains(value); break;
        case 'className':     selector = className(value); break;
        default:              throw new Error(`不支持的选择器方法: ${method}`);
    }

    if (action === 'exists') {
        const el = selector.findOne(timeout);
        return { found: !!el, method, value };
    }

    if (action === 'click') {
        const el = selector.findOne(timeout);
        if (!el) return { found: false, clicked: false, method, value };
        el.click();
        return { found: true, clicked: true, method, value, ..._extractElementInfo(el) };
    }

    if (action === 'bounds') {
        const el = selector.findOne(timeout);
        if (!el) return { found: false, method, value };
        const b = el.bounds();
        return { found: true, method, value, bounds: b ? { left: b.left, top: b.top, right: b.right, bottom: b.bottom } : null };
    }

    // action === 'info' (default): return full info, support index for multiple matches
    if (index > 0) {
        const all = selector.find();
        if (!all || all.length === 0) return { found: false, method, value, total: 0 };
        const target = index < all.length ? all[index] : all[all.length - 1];
        return { found: true, method, value, total: all.length, index, ..._extractElementInfo(target) };
    }
    const el = selector.findOne(timeout);
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
    if (params != null && params.depth != null && params.depth !== '') {
        const n = Number(params.depth);
        if (!Number.isNaN(n)) override = { maxDepth: n };
    }
    return dumpActiveWindowLayout(override);
};

const _runDebugPageCapture = (params: any): any => {
    _logCapture('page_capture: 开始');
    const depth = Number(params?.maxDepth) || layoutDumpConfig.maxDepth || 30;
    _logCapture(`page_capture: dump layout depth=${depth}`);
    const layout = dumpActiveWindowLayout({ maxDepth: depth });
    _logCapture(`page_capture: layout ok package=${layout.package}`);
    let screenshotBase64: string | null = null;
    let screenshotError: string | null = null;
    try {
        const screenshot = _runDebugScreenshot({ quality: params?.quality ?? 70 });
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

const executeDebugCommand = (cmd: any) => {
    claimDebugCommand(cmd.id);
    try {
        let result: any;
        switch (cmd.type) {
            case 'screenshot':  result = _runDebugScreenshot(cmd.params); break;
            case 'page_info':   result = _runDebugPageInfo(cmd.params); break;
            case 'element':     result = _runDebugElement(cmd.params); break;
            case 'script':      result = _runDebugScript(cmd.params); break;
            case 'layout':      result = _runDebugLayout(cmd.params); break;
            case 'page_capture': result = _runDebugPageCapture(cmd.params); break;
            default:
                reportDebugResult(cmd.id, false, null, `不支持的指令类型: ${cmd.type}`);
                return;
        }
        reportDebugResult(cmd.id, true, result);
    } catch (e) {
        const err = String(e);
        _logCapture(`debug [${cmd.type}] 失败: ${err}`);
        reportDebugResult(cmd.id, false, null, err);
    }
};

/**
 * 启动调试指令轮询线程
 * 独立于任务轮询，3 秒间隔，不阻塞主任务流
 */
export const startDebugPoller = () => {
    threads.start(function () {
        setRunInfo('debugPoller: 调试轮询已启动');
        while (true) {
            try {
                const result = pollDebugCommands();
                if (result && result.data && result.data.length > 0) {
                    for (let i = 0; i < result.data.length; i++) {
                        const cmd = result.data[i];
                        setRunInfo(`debugPoller: 收到指令 [${cmd.type}] id=${(cmd.id || '').slice(0, 8)}`);
                        // 独立线程执行，避免大树 dump 阻塞轮询导致服务端超时
                        threads.start(function () {
                            setRunInfo(`debugPoller: 执行 [${cmd.type}] id=${(cmd.id || '').slice(0, 8)}`);
                            executeDebugCommand(cmd);
                        });
                    }
                }
            } catch (e) {
                const msg = `debugPoller 异常: ${e}`;
                console.error(msg);
                setRunInfo(msg);
            }
            sleep(3000);
        }
    });
};

// ─────────────────────────── 主入口 ───────────────────────────

export const xyBaseRunWithLog = () => {
    closeApp('闲鱼');
    sleep(1000);
    launchApp("闲鱼");

    // ① 先启动子线程（悬浮窗 + 轮询），保证 log 立刻可见——与改 page_capture 之前一致
    threads.start(function () {
        try {
            setRunInfo('子线程启动，开始初始化...');
            findDom();
            setRunInfo('findDom 完成，创建悬浮窗...');
            const window = floaty.window(
                `<vertical>
                    <text id="runLog" fontSize="8" padding="10 5 10 5" bg="#ff0000" w="300" h="auto" text="启动中..." />
                </vertical>` as any
            );
            window.setPosition(window.getX(), window.getY());
            initRunInfo(window);

            startTaskPoller();
            startDebugPoller();
        } catch (e) {
            const msg = 'xyBaseRunWithLog 子线程异常: ' + e;
            console.error(msg);
            setRunInfo(msg);
            sleep(60000);
        }
    });

    // ② 主线程稍后申请截图权限（不阻塞悬浮窗创建；与原先 _REQUEST_SCREEN_CAPTURE 时机相同）
    sleep(800);
    setRunInfo('主线程: 正在申请截图权限，等待系统弹框…');
    startMediaProjectionAutoConfirm(35000);
    sleep(300);
    try {
        if (requestScreenCapture(false)) {
            _screenCaptureState = 'granted';
            sleep(800);
            setRunInfo('主线程: 截图权限已获取');
            _logCapture('startup: requestScreenCapture ok');
        } else {
            _screenCaptureState = 'denied';
            setRunInfo('主线程: 截图权限被拒绝，采集将只有布局树');
            _logCapture('startup: requestScreenCapture false');
        }
    } catch (e) {
        _screenCaptureState = 'denied';
        setRunInfo(`主线程: 截图权限失败: ${e}`);
        _logCapture(`startup: requestScreenCapture error ${e}`);
    }
};
