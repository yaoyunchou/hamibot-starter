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
 * 处理各种活动弹框， 
 * 让程序能够正常运行
 * 活动弹框：
 *  1. 获取聊天框的信息
 *  2. 扫雷获取金币
 *  3. 挖矿获取金币
 *  4. 
 */
export function runActivePopups() {
    try {
        // 夏日活动勋章
        const summerActivity = className("android.view.View").textContains("夏日头像挂件").findOne(1000)
        
        // const 
        if(summerActivity){
            Record.info(`summerActivity, 处理`)
            //  找到关闭按钮进行关闭
            // summerActivity.click()
            const closeBtn = summerActivity.parent().child(3)
            console.log('-----closeBtn----', closeBtn)
            if(closeBtn){
                closeBtn.click()
            }

        }
        // 限时惊喜 弹框
        const szBtn = className("android.view.View").textContains("骰子").findOne(100)

        if(szBtn){
            Record.info(`runActivePopups, 找到扔色子的按钮`)
            // 找到扔色子的按钮, 并进行点击
            const rszBtn =  szBtn.parent().child(1)
            if (rszBtn){
                rszBtn.click()
            }
        }

        // 

        //
    } catch (error) {
        // 记录错误
        Record.error(`runActivePopups, ${error}`)
        
    }
}

export function checkGetGold() {
 sleep(1000)
 // 如果有领取奖励的按钮随手领取掉
 const getGold = className("android.view.View").text("领取奖励").find()
 if(getGold){
     for(let i = 0; i< getGold.length; i++){
        console.log('-----getGold----', getGold[i])

         getGold[i].click()
         sleep(1000)
     }
 }
}

/**
 * 1. 对主弹框进行处理， 找到尽可能多的活动
 * 2. 针对每个活动进行处理
 * 3. 有些活动需要点击， 有些活动需要滑动， 有的需要进入新的app 然后再进行处理
 * 
 */
export function mainPopupFn(title:string, callback,task:any) {

    checkGetGold()
    // 如果亲到没有点击随手签到
    const qdBtn = className("android.view.View").text("签到").findOne(1000)
    if(qdBtn){
        qdBtn.click()
        sleep(1000)
    }

    //  处理搜一搜推荐商品
    const sysBtn = className("android.view.View").text(title).findOne(1000)
    // 滚动容器
    const scrollBox = className("android.view.View").scrollable(true).findOne(1000)
  
    if(sysBtn && scrollBox){
        // 获取当前sysBtn的坐标
        const findBtn = () => {
            const sysBtn = className("android.view.View").text(title).findOne(1000)
            const sysReact = sysBtn.bounds()

            Record.info(`baseReact2222, x: ${sysReact.left}, y: ${sysReact.top}`)
            if(sysReact.top > 2300){
                // 滚动到指定的位置
                maxLoopMap.scrollDown = maxLoopMap.scrollDown ? maxLoopMap.scrollDown + 1 : 1
                if(maxLoopMap.scrollDown > 10){
                    maxLoopMap.scrollDown = 1;
                    // 先关闭再试
                    closeMainPopup()
                    backMainPage();
                }
                // scrollBox.scrollForward()
                swipe(10,2200,10,1700,1000)
                sleep(1000)
                findBtn()
            } else if(sysReact.top < 1320){
                maxLoopMap.scrollUp = maxLoopMap.scrollUp ? maxLoopMap.scrollUp + 1 : 1
                if(maxLoopMap.scrollUp > 10){
                    maxLoopMap.scrollUp = 1;
                    // 先关闭再试
                    closeMainPopup();
                    backMainPage();
                }
                // 滚动到指定的位置
                scrollBox.scrollBackward()
                swipe(10,1859,10,2300,1000)
                sleep(1000)
                findBtn()
            }else{
                sleep(1000)
                const goBtns = className("android.view.View").text("去完成").find()
                console.log('-----goBtns----', goBtns.length)
                for(let i = 0; i< goBtns.length; i++){
                    const btn = goBtns[i]
                    //获取坐标
                    const react = btn.bounds()
                    if(sysReact.top - react.top < 20){
                        Record.info(`sysReact, x: ${react.left}, y: ${react.top}`)
                        btn.click()
                        // 进入活动页面， 定停留6s
                        sleep(1000)
                        Record.info(`运行++${title}`)
                        // 进入对应的逻辑
                        callback();
                        task.hasRun = true
                        break
                    }
                }
                task.hasRun = true
                //  如果没有找到则为已经获取了对应的金币
                Record.info(`已经获取了对应的金币`)
            }
        }
        // 执行查找
        findBtn()
    }else{
        task.hasRun = true
    }
}

export function mainPopupTask() {
    try {
        // 获取列表
        for(let i = 0; i< taskList.length; i++){
            const task:any = taskList[i]
            // 执行对应的任务
            if(!task.hasRun){
                setRunInfo(task.title)
                mainPopupFn(task.title, task.callBack, task)
            }
          
        }
        // 查看所有任务执行的结果
        const result = taskList.every((item:any) => {
            Record.info(`${item.title}: ${item.hasRun}`)
            return item.hasRun
            })
        if(result){
           maxLoopMap.allTaskOver = true
        }
        // 执行完所有任务后检查是否有金币领取
        checkGetGold()
        // 关闭弹框
        // closeMainPopup()
        // 再次执行主页面逻辑
        if(result){
            Record.info(`所有任务执行完毕!!!`)
        }else{
            coinExchange()
        }

    
    } catch (error) {
        // 记录错误
        Record.error(`mainPopup, ${error}`)
    }
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
export function coinExchange() {
    try {
        // 进入领取金币页面，判断是是否有领取， 领取金币, 是否有 攻略按钮
        const guideButton = className("android.view.View").text("攻略").findOne(5000)
        /**
         *  1. 如果有则证明到了金币页面
         *  功能点：
         *    a. 收取金币
         *    b. 扔色子， 判断是真的扔色子， 还是进入到了核心弹窗页面
         *    c. 处理扔色子触发的各种弹窗
         * 
         *    针对主弹框的处理
         *    1. 根据文字找到需要进行触发的， 比如 搜一搜推荐商品
         *    2. 由于没有结构， 批量找到到去完成的按钮， 然后根据坐标找到纵坐标差不多的按钮进行触发
         *    3. 根据每个场景不同做不同的处理逻辑
         *
         * */ 
        // 检查是否有弹框需要处理
        // 处理活动弹框
        runActivePopups()
        console.log('----------coinExchange()-----------')
        maxLoopMap.coinExchangeRunTime ++
        if(guideButton){
            // 是否有主弹框
            const mainPopup = className("android.view.View").text("今天").findOne(1000)
            console.log('----------mainPopup---------- ', mainPopup) 
            // 领取酬金
            const lqcjBtn = className("android.view.View").text("领取酬金").findOne(1000)
            if(lqcjBtn){
                lqcjBtn.parent().click()
            }
            // 如果是主弹框
            if(mainPopup){
                //  如图有则需要处理弹框逻辑, 先看是否有没有收取的次数， TODO: 这里应该做成配置， 不应该写死
                console.log('2222')
                mainPopupTask()
                // 运行到其他的核心逻辑则算成功， 进行数据清空
                maxLoopMap.coinExchangeRunTime = 1
            }else{
                console.log('----------!!!!----------')
                // 查找一赚到底的“新”, 然后再定位到扔色子寻宝按钮

                const yzddxBtn =  className("android.view.View").text("新").findOne(1000)
                if(yzddxBtn){
                    // 找到扔色子寻宝按钮
                    const mainBtn = yzddxBtn.parent().parent().child(4);
                    if(mainBtn){
                        console.log('111111111111')
                        if(mainBtn.child(1).text() === "赚"){
                            mainBtn.click();
                            sleep(1000)
                            // 处理主弹框逻辑
                            coinExchange()
                        }else{
                            mainBtn.click();
                            sleep(1000)
                            
                            // 处理完成后再执行
                            coinExchange()
                        }
                       
                    }
                }else{
                    // 没有找到就重新执行一次
                    console.log('----------没有找到就重新执行一次----------')
                    back();
                    coinExchange()
                }
            }
        }else{
            Record.error(`coinExchange, 金币页面未找到攻略按钮`)
            maxLoopMap.pageTime = maxLoopMap.pageTime ? maxLoopMap.pageTime + 1 : 1
            // 当次数大于3的时候就进行回退， 不然就进行重试
            if(maxLoopMap.pageTime > 3){
                maxLoopMap.pageTime = 1;
                findPage('goldCoin')
                coinExchange();
            }else{
                coinExchange();
            }
        }
        
        
       

        // // 找到中间的按钮
        // id("mapDiceBtn").findOne().click()
        // // 有弹框直接关闭
        // if(className("android.widget.Image").clickable(true).depth(8).exists()){
        //     className("android.widget.Image").clickable(true).depth(8).click()
        // }
    
        // // 如果存在"用闲鱼币兑权益"文本
        // if(className("android.view.View").text("用闲鱼币兑权益").exists()) {
        //     // 点击领取按钮
        //     click(780, 1100);
        //     sleep(2000)
        //     // 有签到按钮直接顺手签到
        //     if(className("android.view.View").text("签到").exists()){
        //         console.log('----------coinExchange()-----------', '签到')
        //         className("android.view.View").text("签到").findOne().click()
        //     }
        //     for(let i =0; i< 100; i++) {
        //         console.log('执行第'+i+'次')
        //         let list = className("android.view.View").textContains("领取").find()
        //         console.log('----list--------',list.nonEmpty())
        //         if(list.nonEmpty()) {
        //             list.each(function(item){
        //                 item.click();
        //             })
        //         }
        //         var zoo = className("android.view.View").textMatches(/00:[54]\d:[0-9]{2}/).find()
        //         console.log('----zoo--------',zoo.nonEmpty())

        //         if(zoo.nonEmpty()){
        //             exit()
        //         }
        //         // 超过30次应该是程序卡了，回退修复
        //         sleep(10000)
        //     }
        //     exit();
        // }else{
        //     // fixPage()

        // }
    } catch (error) {
        // 记录错误
        Record.error(`coinExchange, ${error}`)
        // 重新执行
        findPage('goldCoin')

    }
   
}

