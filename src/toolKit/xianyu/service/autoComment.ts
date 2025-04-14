/**
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 * 
 */
import { Record } from "../../../lib/logger";
import { APPNAME, findPage, setRunInfo } from "./base";
import { backMainPage, closeMainPopup, taskList } from "./getMainPopup";

// 当前页同一个逻辑的循环最大次数
let maxLoopMap:any = {
    scrollUp: 1, // 连续上划次数
    scrollDown: 1,// 连续下划次数
    pageTime: 1, // 连续页面次数
    coinExchangeRunTime:1, // 金币兑换执行次数
    allTaskOver:false // 所有任务是否执行完毕
    
    
}


/**
 * 一直回退到闲鱼页面
 */

export function xianyuBack(){
    // 获取当前页面的报名
    launch(APPNAME);
    sleep(2000)
    // 检查
    const name = currentPackage();
    if(name !== APPNAME){
        xianyuBack()
    }
}

/**
 * 1. 金币兑换
 * 2. 做各种任务， 获取
 */
export function startAutoComment() {
    try {
        // 查看列表
        // 检查当前页面和app
        
        console.log('----------coinExchange()-----------')
        maxLoopMap.coinExchangeRunTime ++
    
    } catch (error) {
        // 记录错误
        Record.error(`coinExchange, ${error}`)
        // 重新执行
        findPage('goldCoin')

    }
   
}


