/**
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 * 
 */
import { Record } from "../../../lib/logger";
import { getGoodInfo, getGoodInfoByOrderNumber } from "../../../lib/service";
import { APPNAME, backPageByName, findPage, setRunInfo } from "./base";
import { backMainPage, closeMainPopup, taskList } from "./getMainPopup";

// 当前页同一个逻辑的循环最大次数
let maxLoopMap:any = {
    scrollUp: 1, // 连续上划次数
    scrollDown: 1,// 连续下划次数
    pageTime: 1, // 连续页面次数
    coinExchangeRunTime:1, // 金币兑换执行次数
    allTaskOver:false // 所有任务是否执行完毕
    
    
}


let maxErrorCount = 0

/**
 * 1. 金币兑换
 * 2. 做各种任务， 获取
 */
export function startAutoComment() {
    try {
        // 检查流程错误次数
        if(maxErrorCount > 40){
            // 重置所有错误
            console.log('错误次数过多，出现死循环了')
            return
        }
        // 查看列表
        const list = className("android.widget.ImageView").descContains("闲鱼号").find()
        // 循环list
        for(let i = 0; i < list.length; i++){
            const item = list[i]
            // 获取内容
            const contentDescription = item.contentDescription + ''
            
            console.log("昵称===================", contentDescription)
            // 寻找父级
            const parent = item.parent()
            if(!parent){
                maxErrorCount++
                continue
                
            }
            // 点击parent的中间， 进入商品详情
            const parentReact = parent.bounds()
            click(parentReact.centerX(), parentReact.centerY())
            sleep(1000)
            // 获取商品详情
            const goodsDetail = className("android.view.View").descContains("订单编号").findOne()
            if(!goodsDetail){
                maxErrorCount++
                continue
            }
            // 获取订单编号
            const orderText = goodsDetail.contentDescription + ''
            // 从商品详情中提取订单编号
            const orderNumberMatch = orderText.match(/订单编号\s*(\d+)/);
            if (!orderNumberMatch) {
                maxErrorCount++
                continue
            }
            // 获取订单编号
            const orderNumber = orderNumberMatch[1]
            console.log("订单编号===================", orderNumber)

           
            

            // 处理数据
            if(orderNumber){
                // 通过昵称和标题， 获取对应的商品信息
               
                const goodsInfo =  getGoodInfoByOrderNumber(orderNumber)
                console.log("商品信息===================", goodsInfo)
                // 获取评价
                if(goodsInfo.code === 0){
                    try {
                        // 获取评价
                        const comment = goodsInfo.data.items[0].fields["评价"].value[0].text
                        console.log("评价===================", comment)
                        // 进入好评弹框入口
                        const goodCommentPopup =className("android.view.View").descContains("按钮, 去评价").findOne(1000)
                        // 获取他的位置信息
                        const react = goodCommentPopup.bounds()
                        console.log("react===================", react, react.centerX(), react.centerY())
                        // 模拟点击对应的坐标
                        const clickInfo = click(react.centerX(), react.centerY())
                        console.log("clickInfo===================", clickInfo)
                        sleep(1000)
                    
                    
                    
                        
                        // 获取输入框
                        const inputItem = className("android.widget.EditText").findOne(1000)
                        if(inputItem){  
                            console.log("inputItem===================", inputItem)
                            inputItem.click()
                            // 输入评价 
                            inputItem.setText(comment)
                        }else{
                            maxErrorCount++
                            back()
                            continue
                        }
                        // 点击好评位置
                        const goodCommentIconBox = className("android.view.View").descContains("好评").findOne(1000)
                    
                        const goodCommentIcon = goodCommentIconBox.child(0)

                        // 获取他的位置信息
                        const goodCommentIconReact = goodCommentIcon.bounds()
                        console.log("goodCommentIconReact===================", goodCommentIconReact)
                        // 模拟点击对应的坐标
                        click(goodCommentIconReact.centerX() , goodCommentIconReact.centerY() )
                        // 点击提交
                        const submit = className("android.view.View").descContains("提交评价").findOne(1000)
                        console.log("submit===================", submit)
                        if(submit){
                            // 找到这个地方的坐标
                            const submitReact = submit.bounds()
                            console.log("submitReact===================", submitReact)
                            // 模拟点击对应的坐标
                            sleep(1000)
                            const clickInfo = click(submitReact.centerX() , submitReact.centerY() )
                            console.log("clickInfo===================", clickInfo)
                            // 先回到主页
                            backPageByName('main')
                            // 再次找到评论列表
                            findPage('comment')
                            // 主要正确执行一次就重置所有错误
                            maxErrorCount = 0
                          
                            
                            break;
                        }else{
                            back()
                            maxErrorCount++
                            continue
                        }
                    } catch (error) {
                        maxErrorCount++
                        continue
                    }
                    
                }

            }else{
                continue
            }
            
            // 通过昵称和标题， 获取对应的商品信息
            // const goodsInfo = getGoodsInfo(content, title)
            // console.log("商品信息===================", goodsInfo)
            // 获取child的text
            
        }
        // 自动评论执行完成， 进入下一个任务
        console.log('自动评论执行完成， 进入下一个任务')
        
    
    } catch (error) {
        // 记录错误
        Record.error(`comment, ${error}`)
        // 重新执行
        findPage('comment')

    }
   
}


