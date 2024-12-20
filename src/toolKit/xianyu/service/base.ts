import { Record } from "../../../lib/logger";
import { findDom } from "./exposure";

const APPNAME = 'com.taobao.idlefish'

export enum PageType {
    'home'="com.taobao.idlefish.maincontainer.activity.MainActivity",
    'goldCoin'="com.taobao.idlefish.webview.WebHybridActivity",
    "product"='com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity'
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

// 通过页面名称找到对应的页面
const findPage = (pageName:string) =>{
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
            break;
        case 'product':
            if(activity === PageType.product){
                
                console.log('进入商品详情页面, 进入新的页面3333')
                const btn = className("android.view.View").descContains("今日曝光").findOne(1000)
                console.log('-----btn----', btn)
                if(btn){
                    // 执行对应的逻辑
                    setRunInfo('进入商品详情页面')
                }else{
                    back();
                    findPage(pageName)
                }
               
            }else {
                // 默认是在主页进行路径的查找
                if(activity === PageType.home){
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

    threads.start(function () {
        let runLog = '执行闲鱼任务'
        var window = floaty.window(
            `<vertical>
                <button id="center"  margin="0" w="60">页面信息</button>
                <button id="start"  margin="0" w="60">尝试</button>
        
                <button id="exit"   margin="0" w="60">退出</button>
                <text id="runLog"  padding="10 5 10 5" bg="#ff0000" w="300" h="auto" text="Hello" />
            </vertical>` as any
        );
        window.setPosition(window.getX(), window.getY() + 200);
           var x = 0,
            y = 0,
            windowX = 0,
            windowY = 0,
            isRuning = false,
            showConsole = false,
            isShowingAll = true;
    
        window.center.setOnTouchListener(function (view, event) {
            switch (event.getAction()) {
                case event.ACTION_DOWN:
                    x = event.getRawX();
                    y = event.getRawY();
                    windowX = window.getX();
                    windowY = window.getY();
                    break;
                case event.ACTION_MOVE:
                    window.setPosition(windowX + (event.getRawX() - x), windowY + (event.getRawY() - y));
                    break;
                case event.ACTION_UP:
                    // 获取当前页面的信息，并且打印出来
                    try {
                        Record.info(`currentActivity: ${currentActivity()}`)
                        // console.log('currentActivity', currentActivity())
                        const name = currentPackage();
                        Record.info(`currentPackage: ${name}`)
                    } catch (error) {
                        Record.error(error?.message)
                    }
                   
                    break;
            }
            return true;
        });
        
        window.exit.click(function () {
            window.close();
        });
        window.start.click(function () {
           try {
            
            // const packageName = 'com.taobao.idlefish';
            // const activityName = 'com.taobao.idlefish.webview.WebHybridActivity'
            // const activityName = 'WebHybridActivity'
            // app.openAppSetting(packageName);//打开app的详细信息
          
           } catch (error) {
               Record.error(error?.message)
           }
        });

        var time = setInterval(() => {
            if(window && window.runLog){
                // console.log('-----runInfo.log----', runInfo.log)
                ui.run(function () {
                 window.runLog.setText(runInfo.log);   
                })
            }
        }, 2000);
        // 初始化
        initRunInfo(window)
        // 执行获取商品信息的逻辑
        findPage('product')
        // 执行曝光逻辑
        findDom()

        // 到达金币页面执行金币逻辑

        // 进入特定页面执行对应的逻辑
       
    }); 

}

