/*
 * @Author: yaoyc yaoyunchou@bananain.com
 * @Date: 2024-11-04 10:54:46
 * @LastEditors: yaoyc yaoyunchou@bananain.com
 * @LastEditTime: 2024-11-05 12:22:10
 * @FilePath: \hamibot202041101\src\toolKit\xianyu\utils\index.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// 检查APP是否打开
// export function isAppOpen() {
//     // 获取当前页面的包名
//     const name = currentPackage();
//     console.log('当前页面的包名', name)
//     // currentPackage()

import { Record } from "../../../lib/logger";
import { getHeader, nestHost, host, xyLogin } from "../../../lib/service";
import { setRunInfo } from "../service/base";

    

// 线上环境

const shopNameArr=["蓝小飞鱼","tb133799136652"]
var storage = storages.create("shopName");
var spreadBookInfoStorage = storages.create("spreadBookInfo");

const shopIndex = storage.get('shopName') || 0;


const shopName = shopNameArr[shopIndex]
export var getInfo = function (text) {

    const regex = /(?:添加种草笔记，获得更多首页流量\s*)([^\n]+?)(?=\s*¥|\s*$)/;

    // [\s\S]*[曝光]?(\d*)[\s\S]*[浏览]?(\d*)[\s\S]*[想要]?(\d*);  
    const bgRegex = /曝光(\d+)/
    const llRegex = /浏览(\d+)/
    const xyRegex = /想要(\d+)/
    const matches = regex.exec(text);
    const bgMatches = bgRegex.exec(text);
    const llMatches = llRegex.exec(text);
    const xyMatches = xyRegex.exec(text);

    if (matches) {
        console.log('matches', matches)
        const title = matches[1].trim();
        const exposure = bgMatches && bgMatches[1] ||  0;
        const views = llMatches &&  llMatches[1] ||  0;
        const wants = xyMatches &&  xyMatches[1] || 0;

        console.log("标题: " + title);
        console.log("曝光次数: " + exposure);
        console.log("浏览次数: " + views);
        console.log("想要次数: " + wants);
        return {
            title,
            exposure,
            views,
            wants
        }
    } else {
        console.log("未找到匹配的结果", text);
    }
    return {

    }
}
var bookMaps = {}
// 获取所有数据， 用map key进行唯一标识
export  var buildBookSet= function (key,info) {
    var bookStorage = storages.create("book");
    
    if(info && info.title){
        if(bookMaps[key]) {
            Object.assign(bookMaps[key] , info);
        }else{
            
            bookMaps[key] = info;
        }
    }
    sleep(1000)
    Record.info(`${shopName} 开始获取数据 ${info.title}`)
    setRunInfo(`${info.title} 开始获取数据`)
    // 对数据进行推送
   
    // var url = "https://baidu.com";
    var book = http.request(`${nestHost}/api/v1/xyBook/book/getByOtherData?search=${info.title}`, {
        'method': 'GET',
        'headers':getHeader()
    } as any);
   

    if(book.statusCode === 401){
        // 重现授权
        console.log('401')
        setRunInfo("通过title获取数据失败")
        xyLogin()
    }else{
        const bookData:any = book.body.json()
        if(bookData.code ==='200'){
                // 更新数据
            var options = {
                'method': 'POST',
                'headers':getHeader(),
                body: JSON.stringify({
                    title:info.title,
                    shopName: shopName,
                    exposure: info.exposure,
                    views: info.views,
                    wants: info.wants,
                    product_id: bookData?.data?.product_id
                })
            };
            var result = http.request(`${nestHost}/api/v1/book/view`, options as any)
            if(result.statusCode === 200){
                const resultData:any = result.body.json()
                setRunInfo(`${info.title} 更新成功!`)
                Record.info('result', resultData?.message)
            }
        }
    } 
    bookStorage.put("bookMaps", bookMaps);  
}



// 获取需要推广的数据
var spreadBookInfo = () => {
    var options = {
        'method': 'GET',
        'headers': getHeader(),
     
     };
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/spreadBookInfo`, options as any);
    
    if(res.statusCode === 401){
        // 重现授权
        console.log('401')
        xyLogin()
    }else if(res.statusCode === 200){
        console.log('-------e------', res)
        const data:any = res.body.json()
        console.log('-------data------', data)
        spreadBookInfoStorage.put('spreadBookInfo', data.data[shopName])
        console.log('更新成功！')
    } 
}

// 收集樊登读书信息
var getFSBookInfo = (book) => {
    var options = {
        'method': 'POST',
        'headers': getHeader(),
        body: JSON.stringify(book)
     };
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/fsBook`, options as any);
    
    if(res.statusCode === 401){
        // 重现授权
        console.log('401')
        xyLogin()
    }else if(res.statusCode === 200){
        console.log('-------e------', res)
        const data = res.body.json()
        console.log('-------data------', data)
        console.log('更新成功！')
    } 
}

// 获取当前已经存在的书籍名称

var getSavedBooks = () => {
    var options = {
        'method': 'GET',
        'headers': getHeader(),
     
     };
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/fsBooks?omit=recommend,wonderful,authorIntroduction,explainContent,receive&pageSize=2000`, options as any);
    
    if(res.statusCode === 200) {
        try {
            const data:any = res.body.json()
            // console.log('-------data------', data.data)
            const names = data.data.list.map(item => item.title)
            // console.log('-------name------', names)
    
            return names
        } catch (error) {
            return []
        }
       
    }else{
        return []
    }
}


const getGoodInfo = (nickName, title) => {
    var options = {
        'method': 'POST',
        'headers': getHeader(),
        body: JSON.stringify({
            nickName,
            title
        })
     
     };
    var res = http.request(`${host}/api/goodsInfo?nickName=${nickName}&title=${title}`, options as any);
    if(res.statusCode === 200){
        const data:any = res.body.json()
        console.log('-------data------', data)
    }
}   
// module.exports = {
//     getInfo,
//     buildBookSet,
//     xyInit,
//     spreadBookInfo,
//     getFSBookInfo,
//     getSavedBooks
// };
// var str = `更多
// 降价
// 编辑
// 【​正​版​二​手​包​邮​】​ ​沟​通​的​艺​术​（​插​图​修​订​第​1​4​版​）​：​看​入​人​里​，​
// ¥
// 22
// .82
// 曝光4
//  · 
// 想要0`
// getInfo(str)
// xyInit()
// getSavedBooks()