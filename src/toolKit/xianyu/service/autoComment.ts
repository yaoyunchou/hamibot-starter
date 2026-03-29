/**
 * 自动评论功能
 * 1. 自动进行评论
 * 2. 将没有运行成功的数据， 记录到commentErrorNikeNameList， 下次运行时， 跳过这些数据
 * 3. 自动进行品论
 */

import { Record } from "../../../lib/logger";
import { getGoodInfo, getGoodInfoByOrderNumber } from "../../../lib/service";
import { APPNAME, findPage, flushTraces, goBackMyPage, setRunInfo } from "./base";
import { backMainPage, closeMainPopup, taskList } from "./getMainPopup";

// 定义最大循环次数接口
interface MaxLoopConfig {
    scrollUp: number;
    scrollDown: number;
    pageTime: number;
    coinExchangeRunTime: number;
    allTaskOver: boolean;
}

// 初始化配置
const maxLoopMap: MaxLoopConfig = {
    scrollUp: 1,
    scrollDown: 1,
    pageTime: 1,
    coinExchangeRunTime: 1,
    allTaskOver: false
};

// 错误处理相关常量
const MAX_ERROR_COUNT = 40;
const DEFAULT_TIMEOUT = 1000;
const commentErrorNikeNameList: string[] = [];
let maxErrorCount = 0;

/**
 * 安全地获取元素，带超时处理
 * @param selector 选择器
 * @param timeout 超时时间
 * @returns 元素或null
 */
function safeFindOne(selector: string, timeout: number = DEFAULT_TIMEOUT): any {
    try {
        return className("android.view.View").descContains(selector).findOne(timeout);
    } catch (error) {
        Record.error(`查找元素失败: ${selector}, 错误: ${error}`);
        setRunInfo(`查找元素失败: ${selector}, 错误: ${error}`);
        return null;
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
        const bounds = element.bounds();
        return click(bounds.centerX(), bounds.centerY());
    } catch (error) {
        Record.error(`点击元素失败: ${error}`);
        setRunInfo(`点击元素失败: ${error}`);
        return false;
    }
}

/**
 * 处理商品评论
 * @param contentDescription 商品描述
 * @returns 是否处理成功
 */
async function handleComment(contentDescription: string): Promise<boolean> {
    try {
        if (commentErrorNikeNameList.includes(contentDescription)) {
            setRunInfo(`handleComment: 跳过错误数据 ${contentDescription}`);
            return false;
        }

        setRunInfo(`handleComment: 开始处理昵称「${contentDescription}」`);

        const parent = className("android.widget.ImageView")
            .descContains("闲鱼号")
            .findOne()
            ?.parent();

        if (!parent) {
            maxErrorCount++;
            setRunInfo(`handleComment: 未找到父级元素，跳过`);
            return false;
        }

        setRunInfo(`handleComment: 点击进入商品详情`);
        if (!safeClick(parent)) {
            maxErrorCount++;
            return false;
        }
        sleep(DEFAULT_TIMEOUT);

        const goodsDetail = safeFindOne("订单编号");
        if (!goodsDetail) {
            maxErrorCount++;
            setRunInfo(`handleComment: 未找到订单编号，跳过`);
            return false;
        }

        const orderText = goodsDetail.contentDescription + '';
        const orderNumberMatch = orderText.match(/订单编号\s*(\d+)/);
        if (!orderNumberMatch) {
            maxErrorCount++;
            setRunInfo(`handleComment: 订单编号匹配失败，跳过`);
            return false;
        }

        const orderNumber = orderNumberMatch[1];
        setRunInfo(`handleComment: 获取订单 ${orderNumber} 的评价内容`);
        Record.info(`订单编号: ${orderNumber}`);

        const goodsInfo = await getGoodInfoByOrderNumber(orderNumber);
        if (!goodsInfo || goodsInfo.code !== 0 || !goodsInfo.data.items.length) {
            setRunInfo(`handleComment: 无评价内容，跳过订单 ${orderNumber}`);
            commentErrorNikeNameList.push(contentDescription);
            back();
            return false;
        }

        const comment = goodsInfo.data.items[0].fields["评价"].value[0].text;
        setRunInfo(`handleComment: 点击「去评价」按钮`);
        const goodCommentPopup = safeFindOne("按钮, 去评价");
        if (!goodCommentPopup || !safeClick(goodCommentPopup)) {
            maxErrorCount++;
            back();
            return false;
        }

        setRunInfo(`handleComment: 输入评价内容`);
        const inputItem = className("android.widget.EditText").findOne(DEFAULT_TIMEOUT);
        if (!inputItem) {
            maxErrorCount++;
            back();
            return false;
        }
        inputItem.click();
        inputItem.setText(comment);

        setRunInfo(`handleComment: 点击好评`);
        const goodCommentIconBox = safeFindOne("好评");
        if (!goodCommentIconBox || !safeClick(goodCommentIconBox.child(0))) {
            maxErrorCount++;
            back();
            return false;
        }

        setRunInfo(`handleComment: 提交评价`);
        const submit = safeFindOne("提交评价");
        if (!submit || !safeClick(submit)) {
            maxErrorCount++;
            back();
            return false;
        }

        setRunInfo(`handleComment: 评价提交成功，订单 ${orderNumber}`);
        maxErrorCount = 0;
        return true;

    } catch (error) {
        setRunInfo(`handleComment: 异常 ${error}`);
        Record.error(`处理评论失败: ${error}`);
        maxErrorCount++;
        return false;
    }
}

/**
 * 开始自动评论
 */
export async function startAutoComment() {
    try {
        if (maxErrorCount > MAX_ERROR_COUNT) {
            setRunInfo('startAutoComment: 错误次数过多，停止执行');
            Record.error('错误次数过多，出现死循环');
            flushTraces('comment');
            return;
        }

        setRunInfo('startAutoComment: 获取待评价列表');
        const list = className("android.widget.ImageView")
            .descContains("闲鱼号")
            .find();

        setRunInfo(`startAutoComment: 找到 ${list.length} 条待评价`);
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const contentDescription = item.contentDescription + '';
            setRunInfo(`startAutoComment: 处理第 ${i + 1}/${list.length} 条`);
            if (await handleComment(contentDescription)) {
                setRunInfo('startAutoComment: 评论成功，回到评论列表');
                goBackMyPage();
                findPage('comment');
                break;
            }
        }

        setRunInfo('startAutoComment: 本轮评论执行完成');
        Record.info('自动评论执行完成，进入下一个任务');
        flushTraces('comment');

    } catch (error) {
        setRunInfo(`startAutoComment: 异常 ${error}`);
        Record.error(`自动评论执行失败: ${error}`);
        flushTraces('comment');
        findPage('comment');
    }
}


