/**
 * exposure.ts — v7 版本
 * 商品列表采集 + 推广逻辑，全部改为 async/await
 */
import { back, select, swipe } from 'accessibility';
import { Record } from '../../../lib/logger';
import { getInfo, buildBookSet } from '../utils';
import { setRunInfo } from './base';
import { sleep } from '../../../lib/sleep';

const SWIPE_DURATION = 1000;
const SWIPE_DELAY    = 2000;
const SCROLL_DELAY   = 3000;
const MAX_RETRY      = 20;
const ITEMS_PER_PAGE = 6;
const SWIPE_X        = 500;
const SWIPE_START_Y  = 448 * 5;
const SWIPE_END_Y    = 100;

async function safeSwipe(sx: number, sy: number, ex: number, ey: number, dur: number): Promise<boolean> {
    try { return await swipe(sx, sy, ex, ey, dur); }
    catch (error) {
        Record.error(`滑动操作失败: ${error}`);
        return false;
    }
}

function safeClick(element: any): boolean {
    try {
        if (!element) return false;
        return !!element.click();
    } catch (error) {
        Record.error(`点击操作失败: ${error}`);
        return false;
    }
}

function isEndOfPage(text: string): boolean {
    setRunInfo('数据获取逻辑运行完成！');
    return text.indexOf('哎呀，到底啦') !== -1;
}

export async function findDom(): Promise<void> {
    Record.info('开始查找商品详情');
    await sleep(SWIPE_DELAY);
    try {
        let list = select().className('android.widget.ImageView').descContains('降价').find();
        if (!list || list.length === 0) {
            list = select().className('android.view.View').descContains('编辑').find();
        }
        Record.info(`找到商品数量: ${list?.length ?? 0}`);
        if (!list) return;

        for (let i = 0; i < list.length; i++) {
            try {
                const item = list[i];
                setRunInfo(`处理第${i + 1}个商品`);
                const text = String(item.contentDescription);
                const info = getInfo(text);
                if (info?.title) buildBookSet(info.title, info);

                if (i === list.length - 1) {
                    await safeSwipe(SWIPE_X, SWIPE_START_Y, SWIPE_X, SWIPE_END_Y, SWIPE_DURATION);
                    await sleep(SCROLL_DELAY);
                    if (!isEndOfPage(text)) await findDom();
                    else Record.info('已到达页面底部');
                }
            } catch (error) {
                Record.error(`处理商品失败: ${error}`);
            }
        }
    } catch (error) {
        Record.error(`查找商品详情失败: ${error}`);
    }
}
