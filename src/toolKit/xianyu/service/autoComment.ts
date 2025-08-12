/**
 * 自动评论功能
 * 1. 自动进行评论
 * 2. 将没有运行成功的数据， 记录到commentErrorNikeNameList， 下次运行时， 跳过这些数据
 * 3. 自动进行品论
 */

import { Record } from "../../../lib/logger";
import { getGoodInfo, getGoodInfoByOrderNumber } from "../../../lib/service";
import { APPNAME, findPage, goBackMyPage, setRunInfo } from "./base";
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
        // 检查是否在错误列表中
        if (commentErrorNikeNameList.includes(contentDescription)) {
            setRunInfo(`${contentDescription} 这个数据有问题，跳过,执行下一次循环`);
            return false;
        }

        setRunInfo(`开始自动评论，昵称：${contentDescription}`);

        // 获取父元素
        const parent = className("android.widget.ImageView")
            .descContains("闲鱼号")
            .findOne()
            ?.parent();

        if (!parent) {
            maxErrorCount++;
            setRunInfo(`没有找到父级，跳过,执行下一次循环`);
            return false;
        }

        // 点击进入商品详情
        if (!safeClick(parent)) {
            maxErrorCount++;
            return false;
        }
        sleep(DEFAULT_TIMEOUT);

        // 获取商品详情
        const goodsDetail = safeFindOne("订单编号");
        if (!goodsDetail) {
            maxErrorCount++;
            setRunInfo(`没有找到订单编号，跳过,执行下一次循环`);
            return false;
        }

        // 提取订单编号
        const orderText = goodsDetail.contentDescription + '';
        const orderNumberMatch = orderText.match(/订单编号\s*(\d+)/);
        if (!orderNumberMatch) {
            maxErrorCount++;
            setRunInfo(`没有匹配到订单编号，跳过,执行下一次循环`);
            return false;
        }

        const orderNumber = orderNumberMatch[1];
        Record.info(`订单编号: ${orderNumber}`);

        // 获取商品信息
        const goodsInfo = await getGoodInfoByOrderNumber(orderNumber);
        if (!goodsInfo || goodsInfo.code !== 0 || !goodsInfo.data.items.length) {
            setRunInfo(`没有对应的评价，跳过,执行下一次循环`);
            commentErrorNikeNameList.push(contentDescription);
            back();
            return false;
        }

        // 处理评价
        const comment = goodsInfo.data.items[0].fields["评价"].value[0].text;
        const goodCommentPopup = safeFindOne("按钮, 去评价");
        if (!goodCommentPopup || !safeClick(goodCommentPopup)) {
            maxErrorCount++;
            back();
            return false;
        }

        // 输入评价
        const inputItem = className("android.widget.EditText").findOne(DEFAULT_TIMEOUT);
        if (!inputItem) {
            maxErrorCount++;
            back();
            return false;
        }

        inputItem.click();
        inputItem.setText(comment);

        // 点击好评
        const goodCommentIconBox = safeFindOne("好评");
        if (!goodCommentIconBox || !safeClick(goodCommentIconBox.child(0))) {
            maxErrorCount++;
            back();
            return false;
        }

        // 提交评价
        const submit = safeFindOne("提交评价");
        if (!submit || !safeClick(submit)) {
            maxErrorCount++;
            back();
            return false;
        }

        // 重置错误计数
        maxErrorCount = 0;
        return true;

    } catch (error) {
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
            Record.error('错误次数过多，出现死循环');
            return;
        }

        const list = className("android.widget.ImageView")
            .descContains("闲鱼号")
            .find();

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const contentDescription = item.contentDescription + '';
            if (await handleComment(contentDescription)) {
                // 回到主页并找到评论列表
                goBackMyPage()
                findPage('comment');
                break;
            }
        }

        Record.info('自动评论执行完成，进入下一个任务');

    } catch (error) {
        Record.error(`自动评论执行失败: ${error}`);
        findPage('comment');
    }
}


