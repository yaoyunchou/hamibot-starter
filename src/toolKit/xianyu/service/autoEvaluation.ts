/**
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 * 
 */
import { Record } from "../../../lib/logger";


/**
 * 处理各种活动弹框， 
 * 让程序能够正常运行
 */
export function runActivePopups() {
    try {
        
    } catch (error) {
        // 记录错误
        Record.error(`runActivePopups, ${error}`)
        
    }
}


/**
 * 1. 对主弹框进行处理， 找到尽可能多的活动
 * 2. 针对每个活动进行处理
 * 3. 有些活动需要点击， 有些活动需要滑动， 有的需要进入新的app 然后再进行处理
 */

export function mainPopup() {
    try {
        // 获取列表
        
       
    } catch (error) {
        // 记录错误
        Record.error(`mainPopup, ${error}`)
    }
}

/**
 * 1. 金币兑换
 * 2. 做各种任务， 获取
 */
export function coinExchange() {
    try {
         // 进入领取金币页面，判断是是否有领取， 领取金币

       
        // 是摇色子， 还是进入到了弹窗页面

        // 进入页面的时候，判断是否有弹窗
        const hasPopup = className("android.view.View").text("第3天").findOne(1000)

        if(hasPopup){
            //  如图有则需要处理弹框逻辑
        
        }else{
            // 点击领取金币
            const mainBtn = id("mapDiceBtn").findOne(500)
            if(mainBtn){
                mainBtn.click()
            }else{

            }  

        }

        // 找到中间的按钮
        id("mapDiceBtn").findOne().click()
        // 有弹框直接关闭
        if(className("android.widget.Image").clickable(true).depth(8).exists()){
            className("android.widget.Image").clickable(true).depth(8).click()
        }
    
        // 如果存在"用闲鱼币兑权益"文本
        if(className("android.view.View").text("用闲鱼币兑权益").exists()) {
            // 点击领取按钮
            click(780, 1100);
            sleep(2000)
            // 有签到按钮直接顺手签到
            if(className("android.view.View").text("签到").exists()){
                console.log('----------coinExchange()-----------', '签到')
                className("android.view.View").text("签到").findOne().click()
            }
            for(let i =0; i< 100; i++) {
                console.log('执行第'+i+'次')
                let list = className("android.view.View").textContains("领取").find()
                console.log('----list--------',list.nonEmpty())
                if(list.nonEmpty()) {
                    list.each(function(item){
                        item.click();
                    })
                }
                var zoo = className("android.view.View").textMatches(/00:[54]\d:[0-9]{2}/).find()
                console.log('----zoo--------',zoo.nonEmpty())

                if(zoo.nonEmpty()){
                    exit()
                }
                // 超过30次应该是程序卡了，回退修复
                sleep(10000)
            }
            exit();
        }else{
            // fixPage()

        }
    } catch (error) {
        // 记录错误
        Record.error(`coinExchange, ${error}`)
    }
   
}