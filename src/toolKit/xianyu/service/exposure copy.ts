import { Record } from '../../../lib/logger';
import  { getInfo,buildBookSet}  from '../utils';

export enum PageType {
    'home'="android.widget.RelativeLayout",
    'goldCoin'="com.taobao.idlefish.webview.WebHybridActivity",
    "product"='com.idlefish.flutterbridge.flutterboost.boost.FishFlutterBoostActivity'
}

// 通过页面名称找到对应的页面

// 找到商品详情并过滤数据， 进行数据的查找
function findDom(logText?:any) {
    // 检查页面情况, 找到对应的页面后再执行，寻找页面
    // findPage('home', logText)
    return

	

	// var list = className("android.view.View").depth(13).find();
	var list = className("android.widget.ImageView").descContains('更多').find();
    if(list?.length === 0){
        list = className("android.view.View").descContains('更多').find();
    }
    // Record.info('-----list----', list)

	for(let i = 0; i < list.length; i++) {
		var rect =  list[i].boundsInParent()
		try {
			var text = String(list[i].contentDescription);

			// console.log('-------------text----------',text)
			var info = getInfo(text);
			if(info && info.title) {
				buildBookSet(info.title, info);
			}
		
			if(i === list.length -1){
				// var scrollDowninfo = scrollDom.scrollForward()
				const swipeinfo = swipe(500, 448 * 4.5, 500, 100,1000)
				// console.log('---------swipeinfo-----------', swipeinfo, text.toString())
				sleep(3000)
				console.log('---------哎呀，到底啦--------------', text.indexOf('哎呀，到底啦')!== -1)
				if(text.indexOf('哎呀，到底啦')  === -1){
					findDom()
				}else{
					console.log('-----end----')
				}
			}
		} catch (error) {
			console.log('error', error)
		}
		
	}
	
}
// 获取对应的按钮
// 抵扣逻辑
function handlerDikou() {
	var list = className("android.view.View").text('立即开启').find();
    console.log('-----list----', list.length)
	for(let i = 0; i < list.length; i++) {
		var item =  list[i]
		try {
			var text = String(list[i].text());
			console.log('-------------text----------',text)

			list[i].click()
			sleep(5000)
			if(i  % 4 === 0) {
				var swipeinfo = swipe(500, 448 * 5, 500, 100,1000)
				sleep(2000)
			}
			// console.log('-----text----', text)
			if(i === list.length -1){
				// var scrollDowninfo = scrollDom.scrollForward()
				// console.log('---------swipeinfo-----------', swipeinfo, text.toString())
				// 检查是否到了底部
				console.log('---------哎呀，到底啦--------------', text.indexOf('哎呀，到底啦')=== -1)
				if(text.indexOf('哎呀，到底啦')  === -1){
					handlerDikou()
				}else{
					console.log('-----end----')
				}
			}
		} catch (error) {
			console.log('error', error)
		}
	}
}


// 获取对应的按钮
// 金币推广
function handleTuiguang() {
    for(let i =0; i<20; i++) {
        try {
            var hotTitle = '【清仓包邮】正版二手 新概念51单片机C语言教程——入门';
            var listLength = 0;
            var list = className("android.view.View").textContains('去推广').find();
          
            var parent = list[0].parent().parent()
            var itemBoxHeight = list[0].parent().parent().bounds().height()
            console.log('-----list----', list.length,'----parent------',  parent.bounds()  )
        
            while(listLength < list.length) {
                var swipeinfo
                for(let i = listLength; i< list.length; ){
                    swipeinfo = swipe(500, itemBoxHeight * 8, 500, 10,100)
                    sleep(1000)
                    i = i + 6
                }
                listLength = list.length;
        
                if(swipeinfo){
                    list = className("android.view.View").textContains('去推广').find();
                    console.log('-----list----', list.length)
                }else{
                    console.log('-----end----')
                }
              
            } 
        
            for(let i = 0; i < list.length; i++) {
                var item =  list[i]
                var parent = list[i].parent().parent();
                // 找到info
                var info = []
                parent.children().forEach(function(tv, index){
                    if(tv.text() != ""){
                        log('-----------------text---------------',index,  tv.text());
                        // 获取标题
                        // var title = tv.text();
                        // var price = 
                        info.push(tv.text())
                    }
                });
                if(info && info.length && info[0]) {
                    // 对比数据
                    var title = info[0]
                    if( title.indexOf(hotTitle)!== -1) {
                        // 进入设置页面
                        item.click()
                        sleep(2000)
                        handleSetting()
                        sleep(2000)

                    }
                }
            } 
        } catch (error) {
            console.log('------error----------', error)
            sleep(1000)
            continue
        }
    }
  
}


// 进入设置页面后的操作
function handleSetting() {
    // 设置1000金币的
    var btn100 = className("android.view.View").text("100人").findOne()
    btn100.click()

    // 确认按钮
    var btn开始推广 =className("android.view.View").text("开始推广").findOne();

    // 点击推广按钮
    btn开始推广.click()

    sleep(1000)
    var btn确认推广 =  className("android.view.View").text("确认推广").findOne()
    btn确认推广.click()
    back()
}




// 不要视觉了， 直接找页面,然后执行对应的 逻辑

// 获取曝光
export const xyBaseRun = () =>{
    // 打开闲鱼
    launchApp("闲鱼");
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
            const myBtn = id("tab_title").className("android.widget.TextView").text("我的").findOne()
            console.log('-----myBtn----', myBtn)
            if(myBtn){
                myBtn.parent().parent().parent().click()
            }else{
                // 多次退出， 希望能退出闲鱼
                back();
            }
           } catch (error) {
               Record.error(error?.message)
           }
        });

        var time = setInterval(() => {
            if(window && window.runLog){
                ui.run(function () {
                 window.runLog.setText(runLog);   
                })
            }
        }, 2000);
        // 执行获取商品信息的逻辑
        findDom(runLog)
       
    }); 

}