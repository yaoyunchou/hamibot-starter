/**
 * 1. 通过简历认证的坐标定位金币的入口
 */
import { click } from 'accessibility';

export const getGoldEntryClickFn = async (element: any): Promise<void> => {
    // 通过简历认证的坐标定位金币的入口, 
    const jlReact = element.bounds()
    console.log('-----jlReact----', jlReact)
    // 通过坐标找到对应的元素， 然后直接模拟点击坐标
    await click(jlReact.left + 100, jlReact.bottom + 1000)
}



