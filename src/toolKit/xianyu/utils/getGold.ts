/**
 * 1. 通过简历认证的坐标定位金币的入口
 */
export const getGoldEntryClickFn = (element:any) => {
    // 通过简历认证的坐标定位金币的入口, 
    const jlReact = element.bounds()
    console.log('-----jlReact----', jlReact)
    // 通过坐标找到对应的元素， 然后直接模拟点击坐标
    click(jlReact.left + 100, jlReact.bottom + 200)
}



