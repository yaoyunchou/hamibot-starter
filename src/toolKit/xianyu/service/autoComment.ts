/**
 * 自动评论功能 — v7 版本
 */
import { back, click, select, setText } from 'accessibility';
import { Record } from '../../../lib/logger';
import { sleep } from '../../../lib/sleep';
import { getGoodInfoByOrderNumber } from '../../../lib/service';
import { APPNAME, findPage, flushTraces, goBackMyPage, setRunInfo } from './base';

const MAX_ERROR_COUNT = 40;
const DEFAULT_TIMEOUT = 1000;
const commentErrorNikeNameList: string[] = [];
let maxErrorCount = 0;

function safeFindOne(selector: string, timeout = DEFAULT_TIMEOUT): Autox.UiObject | null {
    try {
        return select().className('android.view.View').descContains(selector).findOne(timeout);
    } catch {
        return null;
    }
}

async function safeClick(element: Autox.UiObject | null): Promise<boolean> {
    try {
        if (!element) return false;
        const b = element.bounds();
        return await click(b.centerX(), b.centerY());
    } catch {
        return false;
    }
}

async function handleComment(contentDescription: string): Promise<boolean> {
    try {
        if (commentErrorNikeNameList.includes(contentDescription)) {
            setRunInfo(`handleComment: 跳过错误数据 ${contentDescription}`);
            return false;
        }
        setRunInfo(`handleComment: 处理昵称「${contentDescription}」`);

        const parent = select().className('android.widget.ImageView').descContains('闲鱼号').findOne()?.parent();
        if (!parent) { maxErrorCount++; return false; }

        if (!await safeClick(parent)) { maxErrorCount++; return false; }
        await sleep(DEFAULT_TIMEOUT);

        const goodsDetail = safeFindOne('订单编号');
        if (!goodsDetail) { maxErrorCount++; return false; }

        const orderText = goodsDetail.contentDescription + '';
        const orderNumberMatch = orderText.match(/订单编号\s*(\d+)/);
        if (!orderNumberMatch) { maxErrorCount++; return false; }

        const orderNumber = orderNumberMatch[1];
        setRunInfo(`handleComment: 获取订单 ${orderNumber} 的评价内容`);

        const goodsInfo = await getGoodInfoByOrderNumber(orderNumber);
        if (!goodsInfo || goodsInfo.code !== 0 || !goodsInfo.data.items.length) {
            commentErrorNikeNameList.push(contentDescription);
            await back();
            return false;
        }

        const comment = goodsInfo.data.items[0].fields['评价'].value[0].text;
        const goodCommentPopup = safeFindOne('按钮, 去评价');
        if (!goodCommentPopup || !await safeClick(goodCommentPopup)) { maxErrorCount++; await back(); return false; }

        const inputItem = select().className('android.widget.EditText').findOne(DEFAULT_TIMEOUT);
        if (!inputItem) { maxErrorCount++; await back(); return false; }
        inputItem.click();
        await setText(comment);

        const goodCommentIconBox = safeFindOne('好评');
        if (!goodCommentIconBox || !await safeClick(goodCommentIconBox.child(0))) { maxErrorCount++; await back(); return false; }

        const submit = safeFindOne('提交评价');
        if (!submit || !await safeClick(submit)) { maxErrorCount++; await back(); return false; }

        setRunInfo(`handleComment: 评价提交成功，订单 ${orderNumber}`);
        maxErrorCount = 0;
        return true;
    } catch (error) {
        setRunInfo(`handleComment: 异常 ${error}`);
        maxErrorCount++;
        return false;
    }
}

export async function startAutoComment(): Promise<void> {
    try {
        if (maxErrorCount > MAX_ERROR_COUNT) {
            setRunInfo('startAutoComment: 错误次数过多，停止执行');
            flushTraces('comment');
            return;
        }

        setRunInfo('startAutoComment: 获取待评价列表');
        const list = select().className('android.widget.ImageView').descContains('闲鱼号').find();
        setRunInfo(`startAutoComment: 找到 ${list?.length ?? 0} 条待评价`);

        if (!list) return;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const contentDescription = item.contentDescription + '';
            setRunInfo(`startAutoComment: 处理第 ${i + 1}/${list.length} 条`);
            if (await handleComment(contentDescription)) {
                setRunInfo('startAutoComment: 评论成功，回到评论列表');
                await goBackMyPage();
                await findPage('comment');
                break;
            }
        }
        setRunInfo('startAutoComment: 本轮评论执行完成');
        flushTraces('comment');
    } catch (error) {
        setRunInfo(`startAutoComment: 异常 ${error}`);
        Record.error(`自动评论执行失败: ${error}`);
        flushTraces('comment');
        await findPage('comment');
    }
}
