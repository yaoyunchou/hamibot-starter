/*
 * @Author: yaoyc yaoyunchou@bananain.com
 * @Date: 2024-11-04 19:02:19
 * @LastEditors: yaoyc yaoyunchou@bananain.com
 * @LastEditTime: 2024-11-05 12:25:20
 * @FilePath: \hamibot202041101\src\lib\service.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// login

import { Record } from "./logger"

let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Il9pZCI6ImI5ODM2OTg4NjQzY2M0ZDIwMDBiZTQzZDcxZTk3YzU3IiwibmFtZSI6Inlhb3ljIiwidXNlcm5hbWUiOiJ5YW95YyJ9LCJleHAiOjE3MTIxODUzMDMsImlhdCI6MTcwNDk4NTMwM30.1ymfrT0S8xdxjYPUXDPfEqM5IGGUKT9e91DfrkGpP5Y'
let access_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Inlhb3l1bmNob3UiLCJzdWIiOjEsImlhdCI6MTczMDc3MTc1MCwiZXhwIjoxNzMwODU4MTUwfQ.47PjS1P9r9NYF1r94xtqPPSI3cQJgHrNl0kQKtGPHeY"
const header = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
 }
const nestHeader = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
}
// 线上环境
const host = 'https://xfyapi.xfysj.top'
const nestHost = 'https://nestapi.zeabur.app'

export const getToken = () => {
    return header
}
export const getNestToken = () => {
    return nestHeader
}

export const setToken = (token:string) => {
    header.Authorization = `Bearer ${token}`
}

export var xyLogin = () => {
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
        if(data.code=== 0  && data.token){
            token = data.token
            header.Authorization = `Bearer ${token}`
        }
    }

    var options = {
        'method': 'POST',
        'headers': header,
        body: JSON.stringify({
            "username": "yaoyunchou",
            "password": "123456"
        })
     
     };
    // var url = "https://baidu.com";
    var res = http.request(`${nestHost}/api/v1/auth/signin`, options as any);
    if(res.statusCode === 200 || res.statusCode === 201) {
        const data:any = res.body.json()
        if(data){
            access_token = data.access_token
        }
    }
}

export var createLogs = (name, data) => {
    try {
        var options = {
            'method': 'POST',
            'headers': nestHeader,
            body: JSON.stringify({
                "msg": JSON.stringify(data),
                name, 
                appName: 'hamibot',
                appId: 'b9836988643cc4d200be43d71e97c57'
            })
         
         };
        var res = http.request(`${nestHost}/api/v1/logs`, options as any);
       
    } catch (error) {
        Record.error('createLogs error', error)  
    }
   

}
