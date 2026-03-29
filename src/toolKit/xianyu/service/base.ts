import { coinExchange } from "./getGold";
import { findDom } from "./exposure";
import { startAutoComment } from "./autoComment";
import { getGoldEntryClickFn } from "../utils/getGold";
import { closeApp } from "../utils/common";
import { createLogs, fetchPendingTasks, claimTask, completeTask, reportAlert } from "../../../lib/service";
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
        ui.run(function () {
            runInfo.page.runLog.setText(runInfo.log);
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
                setRunInfo('findPage: 已在金币页面，执行兑换');
                coinExchange();
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

/**
 * OCR 截图识别任务
 * 截图权限在 xyBaseRunWithLog 启动时统一申请，这里直接 captureScreen。
 * 优先用 ocr.recognize，不可用时降级保存 base64 截图。
 */
const runOcrTask = (task: any) => {
    setRunInfo('OCR: 开始截图识别');
    try {
        sleep(300);
        const img = captureScreen();
        if (!img) throw new Error('captureScreen 返回 null，请确认已授予截图权限');

        let ocrResult: any;
        let method = '';

        try {
            ocrResult = (ocr as any).recognize(img);
            method = 'ocr';
        } catch {
            // ocr 模块不可用，改存 base64 截图
            ocrResult = (images as any).toBase64(img, 'jpg', 60);
            method = 'screenshot_base64';
        }

        if (img && typeof (img as any).recycle === 'function') (img as any).recycle();

        const payload = JSON.stringify({
            time: new Date().toLocaleString('zh-CN'),
            method,
            package: currentPackage(),
            activity: currentActivity(),
            result: ocrResult,
        });

        createLogs('ocr', payload);

        const count = Array.isArray(ocrResult) ? ocrResult.length : 1;
        setRunInfo(`OCR完成(${method})，${count} 条结果已上传`);
        completeTask(task.id, true, `${method} 完成，${count} 条`);
    } catch (e) {
        const msg = `OCR失败: ${e}`;
        setRunInfo(msg);
        completeTask(task.id, false, msg);
    }
};

/** 执行单个任务（阻塞，完成后返回） */
const executeTask = (task: any) => {
    _currentTaskId = task.id;
    _currentTaskStart = Date.now();
    setRunInfo(`任务开始: ${task.type}`);
    try {
        switch (task.type) {
            case 'goldCoin': findPage('goldCoin'); break;
            case 'comment':  findPage('comment');  break;
            case 'product':  findPage('product');  break;
            case 'ocr':      runOcrTask(task);     return; // runOcrTask 内部自行 completeTask
            default:
                setRunInfo(`未知任务类型: ${task.type}`);
                completeTask(task.id, false, `未知任务类型: ${task.type}`);
                return;
        }
        setRunInfo(`任务完成: ${task.type}`);
        completeTask(task.id, true);
    } catch (e) {
        const msg = String(e);
        setRunInfo(`任务异常: ${msg}`);
        completeTask(task.id, false, msg);
        // 上报预警（后台线程，不阻塞）
        threads.start(function () {
            reportAlert('error', `任务「${task.type}」执行异常: ${msg}`, task.id);
        });
    } finally {
        _currentTaskId = null;
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
                        // 没有待执行任务，默认执行一次获取金币（不上报服务器）
                        setRunInfo('taskPoller: 无待执行任务，默认执行获取金币任务');
                        _currentTaskId = 'default_goldCoin';
                        _currentTaskStart = Date.now();
                        try {
                            findPage('goldCoin');
                            setRunInfo('taskPoller: 默认金币任务完成');
                        } catch (e) {
                            setRunInfo(`taskPoller: 默认金币任务异常 ${e}`);
                        } finally {
                            _currentTaskId = null;
                        }
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

// ─────────────────────────── 主入口 ───────────────────────────

export const xyBaseRunWithLog = () => {
    closeApp('闲鱼');
    sleep(1000);
    launchApp("闲鱼");

    // 先启动子线程（悬浮窗 + 任务轮询），不等截图权限
    threads.start(function () {
        try {
            setRunInfo('子线程启动，开始初始化...');
            findDom();
            setRunInfo('findDom 完成，创建悬浮窗...');
            const window = floaty.window(
                `<vertical>
                    <text id="runLog" fontSize="8" padding="10 5 10 5" bg="#ff0000" w="300" h="auto" text="启动中..." />
                    <button id="ocrBtn" text="OCR" fontSize="9" bg="#222222" textColor="#ffffff" w="300" h="auto" padding="4 4 4 4" />
                </vertical>` as any
            );
            window.setPosition(window.getX(), window.getY());
            initRunInfo(window);

            // OCR 按钮点击：在后台线程截图识别并上传日志
            window.ocrBtn.on('click', function () {
                threads.start(function () {
                    runOcrTask({ id: 'manual_ocr_' + Date.now(), type: 'ocr' });
                });
            });

            // 启动任务轮询，等待控制面板下发任务
            startTaskPoller();
        } catch (e) {
            const msg = 'xyBaseRunWithLog 子线程异常: ' + e;
            console.error(msg);
            setRunInfo(msg);
            sleep(60000);
        }
    });

    // 主线程申请截图权限（MIUI 上可能阻塞数十秒，但不影响已启动的子线程）
    setRunInfo('主线程: 正在申请截图权限，请点击允许...');
    try {
        requestScreenCapture(false);
        setRunInfo('截图权限已获取，OCR 可用');
    } catch (e) {
        setRunInfo(`截图权限申请失败: ${e}，OCR 功能不可用`);
    }
}
