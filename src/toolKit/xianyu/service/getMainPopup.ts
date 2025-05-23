/**
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 * 
 */
import { Record } from "../../../lib/logger";
import { APPNAME, findPage, PageType } from "./base";
import { coinExchange } from "./getGold";

/**
 * 各种活动完成后则回退到主坦克页面
 * 
 */
export const backMainPage = () => {
    // 去到其他app了
    const appName = currentPackage();
    // 执行完成后需要返回两次回到主弹窗页面
    const mainPopup = className("android.widget.TextView").text("今天").findOne(1000)
    const guideButton = className("android.widget.TextView").text("攻略").findOne(1000)
    if(appName !== APPNAME){
        // 当前app不是闲鱼，直接回退
        back();
        sleep(1000);
        backMainPage()
    }else if(mainPopup){
      // 返回到主弹框页面,可以继续执行下一个任务
      Record.info('回到主弹框页面!')
    }else if(guideButton){
        // 执行主页面的逻辑
        coinExchange()
    }else{
        const activity = currentActivity();
        if(activity === PageType.goldCoin){
            // 执行完成后需要返回两次回到主弹窗页面
            if(mainPopup){
                coinExchange()
            }else{
                back();
                sleep(1000);
                backMainPage()
            }
        }else if(activity === PageType.home || activity === PageType.product){
            findPage('goldCoin')
            coinExchange()
        }else{
            back();
            sleep(1000);
            backMainPage()
        }
       
    }
}

// 搜一搜喜欢的商品
const searchForLikedGoods = () => {
    // 进入的页面为1688页面
    const page =  id("center_text").text('1688').findOne(1000)
    // 如果进入了页面， 再执行滑动逻辑
    if(page){
        // 有进度条就证明没有结束， 结束后进度条和提示窗会消失不见
        let progressBar =  className("android.widget.ProgressBar").findOne(1000)
        while(progressBar){
            const result = swipe(10,2200,10,1700,1000)
            if(result){
                console.log('-----scrollForward----')
                sleep(1000)
                progressBar =  className("android.widget.ProgressBar").findOne(1000)
            }
            
            
        }
        // 执行完成后需要返回两次回到主弹窗页面
        backMainPage()
    }

}

// 搜一搜喜欢的商品
const brandNewGoods = () => {
    // 进入的页面为1688页面
    const page =  className("android.webkit.WebView").text('全新好物').findOne(1000)
    // 如果进入了页面， 再执行滑动逻辑
    if(page){
        // 有进度条就证明没有结束， 结束后进度条和提示窗会消失不见
        let progressBar =  className("android.widget.ProgressBar").findOne(1000)
        while(progressBar){
            const result = swipe(200,2200,200,1700,1000)
            if(result){
                console.log('-----scrollForward----')
                sleep(1000)
                progressBar =  className("android.widget.ProgressBar").findOne(1000)
            }
            
            
        }
        // 执行完成后需要返回两次回到主弹窗页面
        backMainPage()
    }

}

// 去蚂蚁森林逛一逛
const goAntForest = () => {
    // 进入的页面为蚂蚁森林页面


}

// 去其他运用逛一逛
const goOtherApp = () => {
    // 进入其他页面后，等待6s后返回
    sleep(6000)
    backMainPage()
}

// 搜一搜推荐商品
export const searchForRecommendedGoods = () => {
    // 进入的页面为1688页面
    const page =  className("android.widget.TextView").text("搜索有福利").findOne(1000)
    if(page){
        // 进入到了搜索页面
        setText(0,"iphone")
        const searchBtn = className("android.widget.Button").findOne(300)
        if(searchBtn){
            searchBtn.click()
        }
        sleep(1000)
        let number = 1
        let gameOver = className("android.widget.TextView").textContains("任务完成逛逛宝贝").findOne(1000)
        while(!gameOver){
            const result = swipe(200,2200,200,1700,1000)
            if(result){
                console.log('-----scrollForward----')
                sleep(1000)
            }
            number++
            console.log('-----number----', number)
            gameOver = className("android.widget.TextView").textContains("任务完成逛逛宝贝").findOne(100)
            if(number > 60){
                break;
            }
        }
        // 执行完成后需要返回两次回到主弹窗页面
        backMainPage()
    }else{
        back();
    }

}

// 浏览指定频道好物
export const browseGoodsInSpecifiedChannel = () => {
    try {
        console.log('浏览指定频道好物')
        let gameOver = className("android.widget.TextView").text("点击领取").findOne(100)
   
        while(!gameOver){
            const result = swipe(10,2200,10,1200,1000)
            if(result){
                sleep(500)
            }
            gameOver = className("android.widget.TextView").text("点击领取").findOne(100)
            
        } 
        if(gameOver){
            gameOver.click()
            sleep(1000)
        }
    } catch (error) {
       console.log('------error----------', error?.message) 
    }
  
}

// 发布一件新宝贝， 这个功能相对独立可以抽离出来
export const publishNewGoods = () => {
    let flog = true
    let msg = ''
    // 进入新增页面
    const aiGoodButton = className("android.widget.ImageView").desc("宝贝不在身边？点我").findOne(1000)
    if(aiGoodButton){
        aiGoodButton.click()
        sleep(1000)
    }else{
        flog = false
        msg = '宝贝不在身边？点我失败'
    }
    // 进入发布页面
    const newIphone12But =  className("android.widget.ImageView").desc("iPhone 12").findOne(1000)
    if(flog && newIphone12But){
        newIphone12But.click()
        sleep(1000)
    }else{
        flog = false
        msg = 'iPhone 12 点击失败'
    }
    // 选择推荐的商品
    const recommendGoods = className("android.widget.ScrollView").findOne(1000)
    if(flog && recommendGoods){
        recommendGoods.child(0).click()
        sleep(1000)
    }else{
        flog = false;
        msg = '选择推荐的商品失败'
    }

    // 点击发布按钮
    const publishBtn = className("android.view.View").desc("发布").findOne(1000)
    if(flog && publishBtn){
        publishBtn.click()
        sleep(1000)
    }else{
        flog = false
        msg = '发布按钮未找到失败'
    }

    // 点击不填，继续发布
    const continuePublish = className("android.widget.Button").descContains("继续发布").findOne(1000)
    if(continuePublish){
        continuePublish.click()
        sleep(1000)
    }else{
        flog = false
        msg = '不填，继续发布失败'
    }

    // ------------------删除商品-------------------

    // 
    const publishSuccessButton= className("android.view.View").desc("发布成功").findOne(1000)
    if(flog && publishSuccessButton){
        // 找到关闭弹框按钮
        publishSuccessButton.parent().child(0).click()
        sleep(1000)
    }else{
        flog = false
        msg = '关闭不填数据发布弹框确认弹框失败'
    }

    // 点击管理按钮
    const editButton =  className("android.view.View").desc("管理").findOne(1000)
    if(flog && editButton){
        editButton.click()
        sleep(1000)
    }else{
        flog = false
        msg = '点击管理失败'
    }
    // 删除商品
    const deleteButton =  className("android.view.View").desc("删除").findOne(1000)
    if(flog && deleteButton){
        deleteButton.click()
        sleep(1000)
    }else{
        flog = false
        msg = '删除商品'
    }

    // 确认删除商品
    const deleteButtonQueRen =  className("android.widget.Button").desc("确定").findOne(1000)
    if(flog && deleteButtonQueRen){
        deleteButtonQueRen.click()
        sleep(1000)
    }else{
        flog = false
        msg = '确认删除'
    }
    if(!flog){
        Record.error(msg)
    }
    return flog
}

export const taskList = [
    {
        title: '浏览指定频道好物',
        callBack:browseGoodsInSpecifiedChannel,
        hasRun: false
    },
    {
        title: '搜一搜喜欢的商品',
        callBack:searchForLikedGoods,
        hasRun: false
    },
    {
        title: '去浏览全新好物',
        callBack:brandNewGoods,
        hasRun: false
    },
    {
        title: '去蚂蚁森林逛一逛',
        callBack:goOtherApp
    },
    {
        title: '去支付宝农场领水果',
        callBack:goOtherApp,
        hasRun: false
    },
    {
        title: '去蚂蚁森林逛一逛',
        callBack:goOtherApp,
        hasRun: false
    },
   
    {
        title: '去蚂蚁庄园逛一逛',
        callBack:goOtherApp,
        hasRun: false
    },
    {
        title: '去支付宝领积分',
        callBack:goOtherApp,
        hasRun: false
    },
    {
        title: '搜一搜推荐商品',
        callBack:searchForRecommendedGoods
    },
    {
        title: '发布一件新宝贝',
        callBack:publishNewGoods
    }
]

/**
 * 关闭主弹框的逻辑
 */
export const closeMainPopup = () => {
    sleep(1000)
    const btnList  = className("android.view.View").clickable(true).find();
    console.log('----- btnList?.length----', btnList?.length)

    let flog = false
    for(let i = 0; i< btnList.length; i++){
        const btn = btnList[i]
        const react = btn.bounds()
        console.log('-----react----', react)
        if(react.left < 1000 && react.left > 900 &&  react.top > 600 ){
            btn.click()
            sleep(1000)
            flog = true
            return;
        }
    }
    if(flog){
        return;
    }else {
        // 非常严重的错误
        Record.error('关闭主弹框失败')
    }
}