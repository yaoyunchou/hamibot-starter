/**
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 * 
 */
import { Record } from "../../../lib/logger";
import { APPNAME, findPage } from "./base";


// 搜一搜喜欢的商品
const searchForLikedGoods = () => {
    // 进入的页面为1688页面
    const page =  id("center_text").text('1688').findOne()
    if(page){

    }else{
        back();
    }

}

// 去蚂蚁森林逛一逛
const goAntForest = () => {
    // 进入的页面为蚂蚁森林页面


}

// 搜一搜推荐商品
export const searchForRecommendedGoods = () => {
    // 进入的页面为1688页面
    const page =  className("android.view.View").text("搜索有福利").findOne()
    if(page){
        // 进入到了搜索页面
        setText(0,"iphone")
        const searchBtn = className("android.widget.Button").findOne(300)
        if(searchBtn){
            searchBtn.click()
        }
        sleep(2000)
        for(let i = 0; i < 20;){
            const result = swipe(10,2200,10,1700,400)
            console.log('-----result----', result)
            if(result){
                console.log('-----scrollForward----', i)

                i++
            }else{
                i ++ 
            }
            
            
        }
    
       
        // 搜索完后要进行页面滚动

    }else{
        back();
    }

}


export const taskList = [
    // {
    //     title: '搜一搜喜欢的商品',
    //     callBack:searchForLikedGoods
    // },
    // {
    //     title: '去蚂蚁森林逛一逛',
    //     callBack:goAntForest
    // },
    {
        title: '搜一搜推荐商品',
        callBack:searchForRecommendedGoods
    }
]
