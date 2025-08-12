/**
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 *
 *
 * 注意： 主弹框的元素都用mainPopup作为taskName
 *       页面里面的元素都用coinExchangeMain作为taskName
 */
import { Record } from "../../../lib/logger";
import {
  findTargetElementList,
  findTargetElementWithCache,
  findTargetElementWithCacheStrict,
} from "../utils/selector";
import { APPNAME, findPage, setRunInfo } from "./base";
import { backMainPage, closeMainPopup, taskList } from "./getMainPopup";

// 当前页同一个逻辑的循环最大次数
let maxLoopMap: any = {
  scrollUp: 1, // 连续上划次数
  scrollDown: 1, // 连续下划次数
  pageTime: 1, // 连续页面次数
  coinExchangeRunTime: 1, // 金币兑换执行次数
  allTaskOver: false, // 所有任务是否执行完毕
};

/**
 * 处理各种活动弹框，
 * 让程序能够正常运行， 总之一句话， 想方设法关闭弹框， 让主流程继续下去
 * 活动弹框：
 *  1. 获取聊天框的信息
 *  2. 扫雷获取金币
 *  3. 挖矿获取金币
 *  4.
 */
export function runActivePopups() {
  try {
    // 夏日活动勋章
    const summerActivity = findTargetElementWithCache('runActivePopups', '夏日活动勋章')

    // const
    if (summerActivity) {
      Record.info(`summerActivity, 处理`);
      //  找到关闭按钮进行关闭
      // summerActivity.click()
      const closeBtn = summerActivity.parent().child(3);
      console.log("-----closeBtn----", closeBtn);
      if (closeBtn) {
        closeBtn.click();
        return;
      }
    }
    // 限时惊喜 弹框
    const szBtn = findTargetElementWithCache('runActivePopups', '骰子')

    if (szBtn) {
      Record.info(`runActivePopups, 找到扔色子的按钮`);
      // 找到扔色子的按钮, 并进行点击
      const rszBtn = szBtn.parent().child(1);
      if (rszBtn) {
        rszBtn.click();
        return;
      }
    }
    // 没办法了， 用backMainPage
    Record.info(`runActivePopups, 没办法了， 用backMainPage`);

  } catch (error) {
    // 记录错误
    Record.error(`runActivePopups, ${error}`);
  }
}

export function checkGetGold() {
  sleep(1000);
  // 如果有领取奖励的按钮随手领取掉
  const getGold = findTargetElementList("mainPopup", "领取奖励",20);
  if (getGold) {
    Record.info(`checkGetGold, 找到${getGold.length}个领取奖励的按钮`);

    for (let i = 0; i < getGold.length; i++) {
      // console.log("-----getGold----", getGold[i]);
      Record.info(`checkGetGold, 点击领取奖励: ${getGold[i]}`);
      getGold[i].click();
      sleep(1000);
    }
  }
}

/**
 * 1. 对主弹框进行处理， 找到尽可能多的活动
 * 2. 针对每个活动进行处理
 * 3. 有些活动需要点击， 有些活动需要滑动， 有的需要进入新的app 然后再进行处理
 *
 * 注意： 主弹框的元素都用mainPopup作为taskName
 *
 */
export function mainPopupFn(title: string, callback, task: any) {
 

  //  处理搜一搜推荐商品
  const sysBtn = findTargetElementWithCacheStrict("mainPopup", title);    
  if (!sysBtn) {
    const jtBtn =findTargetElementWithCache("mainPopup", "今天",40);
    if(jtBtn){
      // 没有找到则，将当前任务改成已经运行
      task.hasRun = true;
      Record.info(`没有找到${title}， 将当前任务改成已经运行`);
      return;
    }else{
      backMainPage();
      // 再次执行当前任务
      mainPopupFn(title, callback, task);
    }
   
  }
  // 滚动容器
  const scrollBox = className("android.view.View")
    .scrollable(true)
    .findOne(1000);

  if (sysBtn && scrollBox) {
    // 如果title === 100
    if(title === '看视频奖励100币'){
      // 在执行这个任务的时候先检查领取奖励
      checkGetGold()
    }
    // 获取当前sysBtn的坐标
    const findBtn = () => {
      // 使用多级策略， 看看到底怎么样才能获取到
      const sysBtn = findTargetElementWithCacheStrict("mainPopup", title);
      const sysReact = sysBtn ? sysBtn.bounds() : { left: 0, top: 0 };
      console.log("-----sysReact----", sysReact);
      
      if (sysReact.top > 2300) {
        // 滚动到指定的位置
        maxLoopMap.scrollDown = maxLoopMap.scrollDown
          ? maxLoopMap.scrollDown + 1
          : 1;
        if (maxLoopMap.scrollDown > 10) {
          maxLoopMap.scrollDown = 1;
          // 先关闭再试
          closeMainPopup();
          backMainPage();
        }
        // scrollBox.scrollForward()
        swipe(10, 2200, 10, 1200, 500);
        findBtn();
      } else if (sysReact.top < 1000) {
        maxLoopMap.scrollUp = maxLoopMap.scrollUp ? maxLoopMap.scrollUp + 1 : 1;
        if (maxLoopMap.scrollUp > 10) {
          maxLoopMap.scrollUp = 1;
          // 先关闭再试
          closeMainPopup();
          backMainPage();
        }
        // 滚动到指定的位置
        // scrollBox.scrollBackward();
        swipe(10, 1259, 10, 2300, 500);
        findBtn();
      } else {
        const goBtns = findTargetElementList("mainPopup", "去完成");
        console.log("-----goBtns----", goBtns.length);
        for (let i = 0; i < goBtns.length; i++) {
          const btn = goBtns[i];
          //获取坐标
          const react = btn.bounds();
          if (sysReact.top - react.top < 20) {
            Record.info(`sysReact, x: ${react.left}, y: ${react.top}`);
            btn.click();
            // 进入活动页面， 定停留6s
            sleep(1000);
            Record.info(`运行++${title}`);
            // 进入对应的逻辑
            callback();
            task.hasRun = true;
            break;
          }
        }
        task.hasRun = true;
        //  如果没有找到则为已经获取了对应的金币
        Record.info(`已经获取了对应的金币`);
      }
    };
    // 执行查找
    findBtn();
  } else {
    task.hasRun = true;
  }
}

// 弹框列表任务处理
export function mainPopupTask() {
  try {
    // 执行完所有任务后检查是否有金币领取
    checkGetGold();
    // 查看所有任务执行的结果
    const result = taskList.every((item: any) => {
      Record.info(`${item.title}: ${item.hasRun}`);
      return item.hasRun;
    });
    if (result) {
      maxLoopMap.allTaskOver = true;
    }

    // 关闭弹框
    // closeMainPopup()
    // 再次执行主页面逻辑
    if (result) {
      Record.info(`所有任务执行完毕!!!`);
    } else {
       // 进入到任务弹框列表
      setRunInfo("进入到任务弹框列表");
        // 如果亲到没有点击随手签到
        const qdBtn = findTargetElementWithCacheStrict('mainPopup', '签到', { excludeContains: ['提醒','收益'], timeoutEach: 100, errorTime: 20})
        if (qdBtn) {
          qdBtn.click();
        }
       // 获取列表, 并执行， 先执行命中缓存不循环方案
       for (let i = 0; i < taskList.length; i++) {
         const task: any = taskList[i];
         // 执行对应的任务
         if (!task.hasRun) {
           setRunInfo(task.title);
           mainPopupFn(task.title, task.callBack, task);
         } else {
           continue;
         }
       }
       
       // 再次检查结果
       mainPopupTask()
    }
  } catch (error) {
    // 记录错误
    Record.error(`mainPopup, ${error}`);
  }
}

/**
 * 一直回退到闲鱼页面, 这里是金币页面
 */

export function xianyuBack() {
  // 获取当前页面的报名
  launch(APPNAME);
  sleep(2000);
  // 检查
  const name = currentPackage();
  if (name !== APPNAME) {
    xianyuBack();
  }
}

/**
 * 1. 金币兑换
 * 2. 做各种任务， 获取
 */
export function coinExchange() {
  try {
    // 进入领取金币页面，判断是是否有领取， 领取金币, 是否有 攻略按钮
    const guideButton = findTargetElementWithCache("coinExchangeMain", "闲鱼币抵扣", 40);
    /**
     *  1. 如果有则证明到了金币页面
     *  功能点：
     *    a. 收取金币
     *    b. 扔色子， 判断是真的扔色子， 还是进入到了核心弹窗页面
     *    c. 处理扔色子触发的各种弹窗
     *
     *    针对主弹框的处理
     *    1. 根据文字找到需要进行触发的， 比如 搜一搜推荐商品
     *    2. 由于没有结构， 批量找到到去完成的按钮， 然后根据坐标找到纵坐标差不多的按钮进行触发
     *    3. 根据每个场景不同做不同的处理逻辑
     *
     * */
    // 检查是否有弹框需要处理
   
    console.log("----------coinExchange()-----------");
    maxLoopMap.coinExchangeRunTime++;
    if (guideButton) {
      // 是否有主弹框
      const mainPopup = findTargetElementWithCache("mainPopup", "今天",40);
     
      // 如果是主弹框
      if (mainPopup) {
        //  如图有则需要处理弹框逻辑, 先看是否有没有收取的次数， TODO: 这里应该做成配置， 不应该写死
        mainPopupTask();
        // 运行到其他的核心逻辑则算成功， 进行数据清空
        maxLoopMap.coinExchangeRunTime = 1;
      } else {
        
        // 查找一赚到底的“新”, 然后再定位到扔色子寻宝按钮
        let mainBtn = boundsContains(452, 916, 452, 920)
          .clickable()
          .depth(15)
          .findOne(1000);
        // 暴力一点， 直接点击扔色子，然后退出， 再重新执行
        console.log('-----mainBtn----', mainBtn)
        if (mainBtn) {
          sleep(500)
          setRunInfo("点击扔色子寻宝按钮");
          // 点击扔色子寻宝按钮
          console.log("点击扔色子寻宝按钮");
          mainBtn.click();
          // 检查点击了寻宝按钮后是否有今天，如果没有则肯定是到了弹框了， 则需要处理弹框
          let checkjt = findTargetElementWithCache("mainPopup", "今天",40);
          if(!checkjt){
            // 处理各种弹框
            mainBtn = boundsContains(452, 916, 452, 920)
            .clickable()
            .depth(15)
            .findOne(1000);
            if(mainBtn){
              mainBtn.click();
              coinExchange();
            }else{
              backMainPage();
              coinExchange();
            }
            // 点击扔色子寻宝按钮两次
          }else{
            // 处理完成后再执行
            coinExchange();
          }
        } else {
          // 没有找到就重新执行一次
          console.log("找不到今天， 应该是可能进入到了弹窗， 进行弹窗检查");
          // 处理完弹框后， 再进行查找  
          coinExchange();
        }
      }
    } else {
      Record.error(`coinExchange, 金币页面未找到闲鱼币抵扣`);
      backMainPage()
    }
  } catch (error) {
    // 记录错误
    Record.error(`coinExchange, ${error}`);
    // 重新执行
    findPage("goldCoin");
  }
}
