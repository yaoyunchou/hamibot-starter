import { Record } from '../../../lib/logger';
import  { getInfo,buildBookSet, xyInit}  from '../utils';
import { runInfo, setRunInfo } from './base';


// 找到商品详情并过滤数据， 进行数据的查找
export function findDom() {
    console.log('-----真的进来了！----')
	// var list = className("android.view.View").depth(13).find();
    sleep(2000)
	var list = className("android.widget.ImageView").descContains('更多').find();
    if(list?.length === 0){
        list = className("android.view.View").descContains('更多').find();
    }
    Record.info(`list: ${list.length}`)

	for(let i = 0; i < list.length; i++) {
		var rect =  list[i].boundsInParent()
        setRunInfo(`第${i}个页面获取`);
		try {
			var text = String(list[i].contentDescription);

			// console.log('-------------text----------',text)
			var info = getInfo(text);
			if(info && info.title) {
				buildBookSet(info.title, info);
			}
		
			if(i === list.length -1){
				// var scrollDowninfo = scrollDom.scrollForward()
				const swipeinfo = swipe(500, 448 * 5, 500, 100,1000)
				// console.log('---------swipeinfo-----------', swipeinfo, text.toString())
				sleep(3000)
				console.log('---------哎呀，到底啦--------------', text.indexOf('哎呀，到底啦')!== -1)
				if(text.indexOf('哎呀，到底啦')  === -1){
					findDom()
				}else{
                    Record.info('-----end----')
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

