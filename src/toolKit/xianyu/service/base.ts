import { Record } from "../../../lib/logger";
import { coinExchange } from "./getGold";
import { findDom } from "./exposure";
import { startAutoComment } from "./autoComment";

export const APPNAME = 'com.taobao.idlefish'

export enum PageType {
    'home'="com.taobao.idlefish.maincontainer.activity.MainActivity",
    'layout'=" android.widget.FrameLayout",
    'goldCoin'="com.taobao.idlefish.webview.WebHybridActivity",
    "product"='com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity',
    "comment" = "com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity"
}

/**
 * 根据页面名称， 返回对应的页面
 * @param pageName 
 */
export function backPageByName(pageName:string){
    setRunInfo('backPageByName');
    // 当前页面的信息
    const name = currentPackage();
    // 当前页面的activity
    const activity = currentActivity();
    if(name !== APPNAME){
        launch(APPNAME);
        sleep(1000)
        const newPageName = currentPackage();
        console.log('-----name----', newPageName)
        backPageByName(pageName)
        return;
    }
    console.log('-----activity----', activity, pageName)
    // 检查页面情况, 找到对应的页面后再执行，寻找页面
    switch(pageName){
        case 'main':
            const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne(1000)
            if(myBtn){
                myBtn.click()
                sleep(1000)
                console.log('进入我的页面')
            }else{
                back();
                sleep(1000)
                backPageByName(pageName)
            }
           
            break;
        case 'home':
            // 判断当前是否为主页
            
            break;
        case 'goldCoin':
            if(activity === PageType.goldCoin){
                console.log('已经进度到金币页面')
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne()
               
                    if(myBtn){
                        myBtn.click()
                    }
                    sleep(2000)
                    //  找到金币入口
                    const goldButtons =  className("android.view.View").clickable(true).depth(12).find()

                    console.log('-----goldButtons----', goldButtons.length)
                    for(let i = 0; i < goldButtons.length; i++){
                        const btn = goldButtons[i]
                        const react = btn.bounds()
                        console.log('-----btn----', react.left, react.top, react.right, react.bottom)
                        console.log('-----btn-children---', btn.childCount())
                        // 找到后进行点击进入领取金币页面
                        if(react.left === 23 && react.right ===435){
                            btn.click()
                            Record.info('进入金币页面')
                            setRunInfo('进入金币页面')
                            sleep(1000)
                            return;
                        }
                    }
                    // 如果没有命中则再次执行定位页面逻辑
                    back();
                    sleep(1000)
                    backPageByName(pageName)
                    // findDom(log)
                }else{
                    back();
                    sleep(1000)
                    backPageByName(pageName)
                }
            }
            break;
        case 'product':
            if(activity === PageType.product){
                console.log('进入商品详情页面')
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne()
                    console.log('-----myBtn----')
                    if(myBtn){
                        myBtn.click()
                    }
                    sleep(1000)
                    //  找到我发布的
                    const productBtn =  className("android.widget.ImageView").descContains("我发布的").findOne()
                    if(productBtn){
                        productBtn.click()
                    }
                    sleep(1000)
                    backPageByName(pageName)
                }else{
                    back();
                    sleep(1000)
                    backPageByName(pageName)
                }
            }
            break;
        case 'comment':
            // 进行检查， 是否是comment, 并且有我卖出的导航
            if(activity === PageType.comment){
                const mySoleTab =className("android.view.View").descContains("我卖出的").findOne(1000)
                if(mySoleTab){
                    console.log('已经进度到评论页面')
                }else{
                    back();
                    sleep(1000)
                    backPageByName(pageName) 
                }
            }else{
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne()
                    if(myBtn){
                        myBtn.click()
                    }
                    sleep(1000)
                    //  找到我的待评价
                    const commentEntryBtn =  className("android.widget.ImageView").descContains("待评价").findOne()
                    if(commentEntryBtn){
                        console.log('进入待评价页面')
                    }
                    // findDom(log)
                }else{
                    back();
                    sleep(1000)
                    backPageByName(pageName)
                }
            }
            break;
        default:
            console.log('dddd');
            
    }
   
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

// 通过页面名称找到对应的页面
export const findPage = (pageName:string) =>{
    setRunInfo('findPage');
    // 当前页面的信息
    const name = currentPackage();
    // 当前页面的activity
    const activity = currentActivity();
    if(name !== APPNAME){
        launch(APPNAME);
        sleep(1000)
        const newPageName = currentPackage();
        console.log('-----name----', newPageName)
        findPage(pageName)
        return;
    }
    console.log('-----activity----', activity, pageName)
    // 检查页面情况, 找到对应的页面后再执行，寻找页面
    switch(pageName){
        case 'home':
            break;
        case 'goldCoin':
            if(activity === PageType.goldCoin){
                
                console.log('进入金币页面了！！！')
                setRunInfo('进入金币页面')
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne()
               
                    if(myBtn){
                        myBtn.click()
                    }
                    sleep(2000)
                    //  找到金币入口
                    const goldButtons =  className("android.view.View").clickable(true).depth(12).find()

                    console.log('-----goldButtons----', goldButtons.length)
                    for(let i = 0; i < goldButtons.length; i++){
                        const btn = goldButtons[i]
                        const react = btn.bounds()
                        console.log('-----btn----', react.left, react.top, react.right, react.bottom)
                        console.log('-----btn-children---', btn.childCount())
                        // 找到后进行点击进入领取金币页面
                        if(react.left === 23 && react.right ===435){
                            btn.click()
                            Record.info('进入金币页面')
                            setRunInfo('进入金币页面')
                            sleep(1000)
                            return;
                        }
                    }
                    // 如果没有命中则再次执行定位页面逻辑
                    back();
                    sleep(1000)
                    findPage(pageName)
                    // findDom(log)
                }else{
                    back();
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
                }else{
                    back();
                    findPage(pageName)
                }
               
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne()
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
                        // 执行曝光逻辑
                        findDom()
                    }
                   
                    // findDom(log)
                }else{
                    back();
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
                        // 执行自动品论
                        startAutoComment()
                    }
                   
                }else{
                    back();
                    sleep(1000)
                    findPage(pageName) 
                }
            }else{
                if(activity === PageType.home || activity === PageType.layout){
                    console.log('-----PageType.home----')

                    // 找到对应的商品
                    const myBtn = className("android.widget.FrameLayout").descContains("我的").findOne()
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
                    // findDom(log)
                }else{
                    back();
                    sleep(1000)
                    findPage(pageName)
                }
            }
            break;
        default:
            console.log('dddd');
            
    }
    // const myBtn = id("tab_title").className("android.widget.TextView").text("我的").findOne()
    // console.log('-----myBtn----', myBtn)
    // if(myBtn){
    //     myBtn.parent().parent().click()
    // }else{
    //     // 多次退出， 希望能退出闲鱼
    //     back();
    // }
    
}


// 获取曝光
export const xyBaseRun = () =>{
    // 打开闲鱼
    // launchApp("闲鱼");
    // 运行对应的收集数据代码
    // findDom();
    // 执行曝光， 先找到对应的页面，然后执行对应的逻辑
    // var time = setInterval(() => {

    // }, 2000);
    // threads.start(function () {
    //     var time = setInterval(() => {
           
    //     }, 2000);
    //     var window = floaty.window(
    //         `<vertical>
    //             <button id="center"  margin="0" w="60">页面信息</button>
    //             <button id="start"  margin="0" w="60">尝试</button>
        
    //             <button id="exit"   margin="0" w="60">退出</button>
    //             <text id="runLog"  padding="10 5 10 5" bg="#ff0000" w="300" h="auto" text="Hello" />
    //         </vertical>` as any
    //     );
    //     window.setPosition(window.getX(), window.getY() + 100);
    //        var x = 0,
    //         y = 0,
    //         windowX = 0,
    //         windowY = 0,
    //         isRuning = false,
    //         showConsole = false,
    //         isShowingAll = true;
    
    //     window.center.setOnTouchListener(function (view, event) {
    //         switch (event.getAction()) {
    //             case event.ACTION_DOWN:
    //                 x = event.getRawX();
    //                 y = event.getRawY();
    //                 windowX = window.getX();
    //                 windowY = window.getY();
    //                 break;
    //             case event.ACTION_MOVE:
    //                 window.setPosition(windowX + (event.getRawX() - x), windowY + (event.getRawY() - y));
    //                 break;
    //             case event.ACTION_UP:
    //                 // 获取当前页面的信息，并且打印出来
    //                 try {
    //                     // Record.info(`currentActivity: ${currentActivity()}`)
    //                     // console.log('currentActivity', currentActivity())
    //                     // const name = currentPackage();
    //                     // Record.info(`currentPackage: ${name}`)
    //                 } catch (error) {
    //                     // Record.error(error?.message)
    //                     console.log(error?.message)
    //                 }
                   
    //                 break;
    //         }
    //         return true;
    //     });
        
    //     window.exit.click(function () {
    //         window.close();
    //     });
    //     window.start.click(function () {
    //        try {
    //          getPageInfo()
          
           
    //     // 搜索完后要进行页面滚动
            
    //        } catch (error) {
    //            console.log(error)
    //        }
    //     });

        
    //     // 初始化
    //     initRunInfo(window)
    //     // 进入获取金币页面
    //     findPage('comment')
    //     // // 执行获取金币的逻辑
    //     // coinExchange()
    //     // 进入商品详情页面
    //     // findPage('product')
    //     // 执行曝光逻辑
    //     // findDom()

    //     // 到达金币页面执行金币逻辑

    //     // 进入特定页面执行对应的逻辑
       
    // }); 

    // 执行曝光逻辑
    findPage('comment')
    // 执行金币逻辑
    findPage('goldCoin')
    // 执行商品详情逻辑
    findPage('product')

}

