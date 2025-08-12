import { Record } from '../../../lib/logger';
import { getInfo, buildBookSet } from '../utils';
import { runInfo, setRunInfo } from './base';

// 常量定义
const CONSTANTS = {
    SWIPE_DURATION: 1000,
    SWIPE_DELAY: 2000,
    SCROLL_DELAY: 3000,
    MAX_RETRY: 20,
    ITEMS_PER_PAGE: 6,
    SWIPE_DISTANCE: {
        START_Y: 448 * 5,
        END_Y: 100,
        X: 500
    }
};

/**
 * 安全地执行滑动操作
 * @param startX 起始X坐标
 * @param startY 起始Y坐标
 * @param endX 结束X坐标
 * @param endY 结束Y坐标
 * @param duration 滑动持续时间
 * @returns 是否滑动成功
 */
function safeSwipe(startX: number, startY: number, endX: number, endY: number, duration: number): boolean {
    try {
        return swipe(startX, startY, endX, endY, duration);
    } catch (error) {
        Record.error(`滑动操作失败: ${error}`);
        setRunInfo(`滑动操作失败: ${error}`);
        return false;
    }
}

/**
 * 安全地点击元素
 * @param element 要点击的元素
 * @returns 是否点击成功
 */
function safeClick(element: any): boolean {
    try {
        if (!element) return false;
        return element.click();
    } catch (error) {
        Record.error(`点击操作失败: ${error}`);
        setRunInfo(`点击操作失败: ${error}`);
        return false;
    }
}

/**
 * 检查是否到达页面底部
 * @param text 页面文本
 * @returns 是否到达底部
 */
function isEndOfPage(text: string): boolean {
    setRunInfo(`数据获取逻辑运行完成！`);
    return text.indexOf('哎呀，到底啦') !== -1;
    
}

/**
 * 查找商品详情并处理数据
 */
export function findDom() {
    Record.info('开始查找商品详情');
    sleep(CONSTANTS.SWIPE_DELAY);

    try {
        // 查找商品列表
        let list = className("android.widget.ImageView").descContains('降价').find();
        if (list?.length === 0) {
            list = className("android.view.View").descContains('编辑').find();
        }
        Record.info(`找到商品数量: ${list.length}`);

        // 处理每个商品
        for (let i = 0; i < list.length; i++) {
            try {
                const item = list[i];
                setRunInfo(`处理第${i + 1}个商品`);
                
                const text = String(item.contentDescription);
                const info = getInfo(text);
                
                if (info?.title) {
                    buildBookSet(info.title, info);
                }

                // 处理最后一个商品
                if (i === list.length - 1) {
                    const swipeResult = safeSwipe(
                        CONSTANTS.SWIPE_DISTANCE.X,
                        CONSTANTS.SWIPE_DISTANCE.START_Y,
                        CONSTANTS.SWIPE_DISTANCE.X,
                        CONSTANTS.SWIPE_DISTANCE.END_Y,
                        CONSTANTS.SWIPE_DURATION
                    );

                    sleep(CONSTANTS.SCROLL_DELAY);

                    if (!isEndOfPage(text)) {
                        findDom(); // 递归处理下一页
                    } else {
                        Record.info('已到达页面底部');
                    }
                }
            } catch (error) {
                Record.error(`处理商品失败: ${error}`);
                continue;
            }
        }
    } catch (error) {
        Record.error(`查找商品详情失败: ${error}`);
    }
}

/**
 * 处理抵扣逻辑
 */
function handlerDikou() {
    Record.info('开始处理抵扣逻辑');
    
    try {
        const list = className("android.view.View").text('立即开启').find();
        Record.info(`找到抵扣按钮数量: ${list.length}`);

        for (let i = 0; i < list.length; i++) {
            try {
                const item = list[i];
                const text = String(item.text());
                
                if (!safeClick(item)) {
                    continue;
                }
                
                sleep(CONSTANTS.SWIPE_DELAY);

                // 每处理4个商品滑动一次
                if (i % 4 === 0) {
                    safeSwipe(
                        CONSTANTS.SWIPE_DISTANCE.X,
                        CONSTANTS.SWIPE_DISTANCE.START_Y,
                        CONSTANTS.SWIPE_DISTANCE.X,
                        CONSTANTS.SWIPE_DISTANCE.END_Y,
                        CONSTANTS.SWIPE_DURATION
                    );
                    sleep(CONSTANTS.SWIPE_DELAY);
                }

                // 处理最后一个商品
                if (i === list.length - 1 && !isEndOfPage(text)) {
                    handlerDikou(); // 递归处理下一页
                }
            } catch (error) {
                Record.error(`处理抵扣按钮失败: ${error}`);
                continue;
            }
        }
    } catch (error) {
        Record.error(`处理抵扣逻辑失败: ${error}`);
    }
}

/**
 * 处理推广逻辑
 */
function handleTuiguang() {
    Record.info('开始处理推广逻辑');
    const hotTitle = '【清仓包邮】正版二手 新概念51单片机C语言教程——入门';

    for (let retry = 0; retry < CONSTANTS.MAX_RETRY; retry++) {
        try {
            let list = className("android.view.View").textContains('去推广').find();
            if (list.length === 0) {
                Record.info('未找到推广按钮');
                break;
            }

            const parent = list[0].parent().parent();
            const itemBoxHeight = parent.bounds().height();
            Record.info(`找到推广按钮数量: ${list.length}`);

            // 处理滑动加载
            let listLength = 0;
            while (listLength < list.length) {
                for (let i = listLength; i < list.length; i += CONSTANTS.ITEMS_PER_PAGE) {
                    safeSwipe(500, itemBoxHeight * 8, 500, 10, 100);
                    sleep(CONSTANTS.SWIPE_DELAY);
                }
                listLength = list.length;
                list = className("android.view.View").textContains('去推广').find();
            }

            // 处理每个推广项
            for (let i = 0; i < list.length; i++) {
                const item = list[i];
                try {
                    const parent = item.parent().parent();
                    const info = parent.children()
                        .filter(tv => tv.text())
                        .map(tv => tv.text());

                    if (info[0]?.includes(hotTitle)) {
                        if (safeClick(item)) {
                            sleep(CONSTANTS.SWIPE_DELAY);
                            handleSetting();
                            sleep(CONSTANTS.SWIPE_DELAY);
                        }
                    }
                } catch (error) {
                    Record.error(`处理推广项失败: ${error}`);
                    continue;
                }
            }
        } catch (error) {
            Record.error(`处理推广逻辑失败: ${error}`);
            sleep(CONSTANTS.SWIPE_DELAY);
        }
    }
}

/**
 * 处理推广设置
 */
function handleSetting() {
    Record.info('开始处理推广设置');
    
    try {
        // 设置1000金币
        const btn100 = className("android.view.View").text("100人").findOne();
        if (!safeClick(btn100)) {
            return;
        }

        // 点击开始推广
        const btnStart = className("android.view.View").text("开始推广").findOne();
        if (!safeClick(btnStart)) {
            return;
        }

        sleep(CONSTANTS.SWIPE_DELAY);

        // 确认推广
        const btnConfirm = className("android.view.View").text("确认推广").findOne();
        if (!safeClick(btnConfirm)) {
            return;
        }

        back();
    } catch (error) {
        Record.error(`处理推广设置失败: ${error}`);
    }
}


