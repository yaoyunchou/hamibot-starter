import { coinExchange } from "./getGold";
import { findDom } from "./exposure";
import { startAutoComment } from "./autoComment";
import { getGoldEntryClickFn } from "../utils/getGold";
import { closeApp } from "../utils/common";
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

// 设置日志
export const setRunInfo = (log:string) =>{
    runInfo.log = log;
    if(runInfo.page){
        ui.run(function () {
            runInfo.page.runLog.setText(runInfo.log);   
        })
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
// 回退到我的页面， 所有的逻辑都是回到我的页面然后在做别的
export const goBackMyPage = () =>{
    // 每次回退后检查是否是回到我的页面 
    const myBtn = className("android.widget.FrameLayout").descContains("我的").clickable(true).findOne(2000)
    if(myBtn){
        backMyPageMaxCount = 0
        // 如果看见我的按钮了， 再检查当前页面是否有我的交易这个文案， 如果没有则做点击操作
        const myTradeBtn = className("android.view.View").desc("我的交易").findOne(2000)
        if(myTradeBtn){
            // 如果看见我的交易这个文案了， 则结束
            console.log('回到我的页面, 请开始后面的逻辑！')
            return;
        }else {
            myBtn.click()
            // 点击后再检查一次
            const myTradeBtn = className("android.view.View").desc("我的交易").findOne(2000)
            if(myTradeBtn){
                console.log('回到我的页面, 请开始后面的逻辑！')
                return;
            }else{
                // 如果还是没有找到， 则继续回退
                goBackMyPage()
            }
        }
    }else{
        console.log('没有找到我的按钮')
        backMyPageMaxCount++
        if(backMyPageMaxCount > 3){
           closeApp('闲鱼')
           sleep(2000)
           findPage('home')
           goBackMyPage()
        }
        // 如果不在我的页面， 则继续回退
        back();
        sleep(1000)
        goBackMyPage()
    }
}

// 通过页面名称找到对应的页面
export const findPage = (pageName:string) =>{
    setRunInfo('findPage:'+ pageName);
    // 当前页面的信息
    const name = currentPackage();
    // 当前页面的activity
    const activity = currentActivity();
    if(name !== APPNAME){
        launch(APPNAME);
        sleep(1000)
        findPage(pageName)
        return;
    }
    console.log('-----activity----', activity, pageName)
    // 所有的起点都是我的页面开始的，检查当前页面是否有我的交易这个文案
    const myTradeBtn = className("android.view.View").desc("我的交易").findOne(2000)
    if(!myTradeBtn){
       // 调用回退，直到回到我的页面，
       goBackMyPage()
    }
    
    // 检查页面情况, 找到对应的页面后再执行，寻找页面
    switch(pageName){
        case 'home':
            break;
        case 'goldCoin':
            if(activity === PageType.goldCoin){
                console.log('已经进度到金币页面')
                setRunInfo('进入金币页面')
                 // 执行金币逻辑
                 coinExchange()
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home){
                    const goldButtons = className("android.widget.ImageView").desc("简历认证").findOne(1000)
                    if(goldButtons){
                        setRunInfo('点击进入金币页面')
                        // 点击后， 检查是否是金币页面
                        getGoldEntryClickFn(goldButtons)
                        sleep(1000)
                        coinExchange()
                    }else{
                        goBackMyPage()
                        sleep(1000)
                        findPage(pageName)
                    }
                }else{
                    goBackMyPage()
                    sleep(1000)
                    findPage(pageName)
                }
            }
            break;
        case 'product':
            if(activity === PageType.product){
                
                console.log('进入商品详情页面')
                const btn = className("android.view.View").descContains("今日曝光").findOne(1000)
                if(btn){
                    // 执行对应的逻辑
                    setRunInfo('进入商品详情页面')
                    // findDom()
                }else{
                    goBackMyPage()
                    findPage(pageName)
                }
               
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").clickable(true).findOne()
                    console.log('-----myBtn----')
                    if(myBtn){
                        myBtn.click()
                    }
                    sleep(1000)
                    //  找到我发布的
                    const productBtn =  className("android.widget.ImageView").descContains("我发布的").findOne()
                    if(productBtn){
                        productBtn.click()
                        sleep(1000)
                        findDom()
                    }
                }else{
                    goBackMyPage()
                    sleep(1000)
                    findPage(pageName)
                }
            }
            break;
        case 'comment':
           
            // 进行检查， 是否是comment, 并且有我卖出的导航
            if(activity === PageType.comment){
                const mySoleTab =className("android.view.View").descContains("我卖出的").findOne(1000)
                if(mySoleTab){
                    const mySoleText = mySoleTab.contentDescription +''
                    if(mySoleText.indexOf("我卖出的 0") > -1){
                        //没有需要执行的内容了
                        console.log('没有需要执行的评论')
                    }else{
                        console.log('in comment !!!!!')
                        setRunInfo('进入评论页面')
                        // 执行自动品论
                        startAutoComment()
                    }
                   
                }else{
                    goBackMyPage()
                    sleep(1000)
                    findPage(pageName) 
                }
            }else{
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").clickable(true).findOne()    
                    if(myBtn){
                        myBtn.click()
                    }
                    sleep(1000)
                    //  找到我的待评价
                    const commentEntryBtn =  className("android.widget.ImageView").descContains("待评价").findOne()
                    if(commentEntryBtn){
                        commentEntryBtn.click()
                    }
                    sleep(1000)
                    findPage(pageName)
                }else{
                    goBackMyPage()
                    sleep(1000)
                    findPage(pageName)
                }
            }
            break;
        default:
            console.log('dddd');
            
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

export const xyBaseRunWithLog = () =>{
    closeApp('闲鱼')
    sleep(1000)
    launchApp("闲鱼");
    findDom();
    threads.start(function () {
        const window = floaty.window(
            `<vertical>
                <text id="runLog" fontSize="8"  padding="10 5 10 5" bg="#ff0000" w="300" h="auto" text="Hello" />
            </vertical>` as any
        );
        window.setPosition(window.getX(), window.getY());
        initRunInfo(window)
        findPage('goldCoin')
    }); 
}
