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
    
// }

// 获取正在运行的APP列表（可能需要根据Hamibot版本和设备情况进行调整）
function getRunningApps() {
    // 这里使用Hamibot的特定方法来获取正在运行的APP信息，实际实现可能因版本而异
    return device.getRunningApps(); 
}



// 开发环境
// const host = 'http://192.168.3.3:3000'
let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6ImI5ODM2OTg4NjQzY2M0ZDIwMDBiZTQzZDcxZTk3YzU3IiwibmFtZSI6Inlhb3ljIiwidXNlcm5hbWUiOiJ5YW95YyJ9LCJleHAiOjE3MTIxODUzMDMsImlhdCI6MTcwNDk4NTMwM30.1ymfrT0S8xdxjYPUXDPfEqM5IGGUKT9e91DfrkGpP5Y'
const header = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
 }
// 线上环境
const host = 'https://xfyapi.xfysj.top'

const shopNameArr=["蓝小飞鱼","tb133799136652"]
var storage = storages.create("shopName");
var spreadBookInfoStorage = storages.create("spreadBookInfo");

const shopIndex = storage.get('shopName') || 0;


const shopName = shopNameArr[shopIndex]
export var getInfo = function (text) {

    const regex = /(【[^】]+】)?(.{10,15}\S+)/;
    // [\s\S]*[曝光]?(\d*)[\s\S]*[浏览]?(\d*)[\s\S]*[想要]?(\d*);  
    const bgRegex = /曝光(\d+)/
    const llRegex = /浏览(\d+)/
    const xyRegex = /想要(\d+)/
    const matches = regex.exec(text);
    const bgMatches = bgRegex.exec(text);
    const llMatches = llRegex.exec(text);
    const xyMatches = xyRegex.exec(text);

    if (matches) {
        const title = matches[2] || null;
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
    console.log(shopName)
    // 对数据进行推送
    var options = {
        'method': 'PUT',
        'headers':header,
        body: JSON.stringify({
            title:info.title,
            shopName: shopName,
            exposure: info.exposure,
            views: info.views,
            wants: info.wants,
        })
     
     };
    console.log('info.title', info)
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/updateByTitle`, options as any);
    console.log('------res====' , res)
    if(res.statusCode === 401){
        // 重现授权
        console.log('401-----')
        xyInit()
    }else{
        console.log('更新成功!!!！')
    } 
    bookStorage.put("bookMaps", bookMaps);  
}

export var xyInit = () => {
    var options = {
        'method': 'POST',
        'headers': header,
        body: JSON.stringify({
            "username": "yaoyunchou",
            "password": "123456"
        })
     
     };
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/login`, options as any);
    
    if(res.statusCode === 200) {
        const data:any = res.body.json()
        console.log('-------data------', data)
        if(data.code=== 0  && data.token){
            token = data.token
            header.Authorization = `Bearer ${token}`
        }
    }
}


// 获取需要推广的数据
var spreadBookInfo = () => {
    var options = {
        'method': 'GET',
        'headers': header,
     
     };
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/spreadBookInfo`, options as any);
    
    if(res.statusCode === 401){
        // 重现授权
        console.log('401')
        xyInit()
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
        'headers': header,
        body: JSON.stringify(book)
     };
    // var url = "https://baidu.com";
    var res = http.request(`${host}/api/fsBook`, options as any);
    
    if(res.statusCode === 401){
        // 重现授权
        console.log('401')
        xyInit()
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
        'headers': header,
     
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