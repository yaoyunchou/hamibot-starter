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
import { APPNAME, findPage, flushTraces, setRunInfo } from "./base";
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
    setRunInfo('runActivePopups: 检查活动弹框');
    const summerActivity = findTargetElementWithCache('runActivePopups', '夏日活动勋章');
    if (summerActivity) {
      setRunInfo('runActivePopups: 处理夏日活动勋章弹框');
      Record.info(`summerActivity, 处理`);
      const closeBtn = summerActivity.parent().child(3);
      if (closeBtn) {
        closeBtn.click();
        return;
      }
    }
    const szBtn = findTargetElementWithCache('runActivePopups', '骰子');
    if (szBtn) {
      setRunInfo('runActivePopups: 找到骰子按钮，点击扔色子');
      Record.info(`runActivePopups, 找到扔色子的按钮`);
      const rszBtn = szBtn.parent().child(1);
      if (rszBtn) {
        rszBtn.click();
        return;
      }
    }
    setRunInfo('runActivePopups: 无可处理弹框，执行 backMainPage');
    Record.info(`runActivePopups, 没办法了， 用backMainPage`);

  } catch (error) {
    setRunInfo(`runActivePopups: 异常 ${error}`);
    Record.error(`runActivePopups, ${error}`);
  }
}

export function checkGetGold() {
  setRunInfo('checkGetGold: 检查是否有可领取的奖励');
  sleep(1000);
  const getGold = findTargetElementList("mainPopup", "领取奖励", 20);
  if (getGold) {
    setRunInfo(`checkGetGold: 找到 ${getGold.length} 个领取奖励按钮`);
    Record.info(`checkGetGold, 找到${getGold.length}个领取奖励的按钮`);
    for (let i = 0; i < getGold.length; i++) {
      setRunInfo(`checkGetGold: 点击第 ${i + 1} 个领取奖励`);
      Record.info(`checkGetGold, 点击领取奖励: ${getGold[i]}`);
      getGold[i].click();
      sleep(1000);
    }
  } else {
    setRunInfo('checkGetGold: 无可领取奖励');
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
  setRunInfo(`mainPopupFn: 开始处理任务[${title}]`);

  //  处理搜一搜推荐商品
  const sysBtn = findTargetElementWithCacheStrict("mainPopup", title);
  if (!sysBtn) {
    setRunInfo(`mainPopupFn: 未找到[${title}]，检查主弹框是否还在`);
    const jtBtn = findTargetElementWithCache("mainPopup", "今天", 40);
    if (jtBtn) {
      setRunInfo(`mainPopupFn: 主弹框在但无[${title}]，标记任务已完成`);
      task.hasRun = true;
      Record.info(`没有找到${title}， 将当前任务改成已经运行`);
      return;
    } else {
      setRunInfo(`mainPopupFn: 主弹框不在，执行 backMainPage 后重试[${title}]`);
      backMainPage();
      mainPopupFn(title, callback, task);
    }
  }

  // 滚动容器
  const scrollBox = className("android.view.View")
    .scrollable(true)
    .findOne(1000);

  setRunInfo(`mainPopupFn: sysBtn=${!!sysBtn}, scrollBox=${!!scrollBox}`);

  if (sysBtn && scrollBox) {
    if (title === '看视频奖励100币') {
      setRunInfo(`mainPopupFn: 任务[${title}]，先执行 checkGetGold`);
      checkGetGold();
    }

    const findBtn = () => {
      const sysBtn = findTargetElementWithCacheStrict("mainPopup", title);
      const sysReact = sysBtn ? sysBtn.bounds() : { left: 0, top: 0 };
      setRunInfo(`mainPopupFn: [${title}] 坐标 top=${sysReact.top}`);

      if (sysReact.top > 2300) {
        maxLoopMap.scrollDown = maxLoopMap.scrollDown ? maxLoopMap.scrollDown + 1 : 1;
        setRunInfo(`mainPopupFn: [${title}] 偏下，向上滑动(第${maxLoopMap.scrollDown}次)`);
        if (maxLoopMap.scrollDown > 10) {
          maxLoopMap.scrollDown = 1;
          setRunInfo(`mainPopupFn: 下滑超过10次，关闭弹框并 backMainPage`);
          closeMainPopup();
          backMainPage();
        }
        swipe(10, 2200, 10, 1200, 500);
        findBtn();
      } else if (sysReact.top < 1000) {
        maxLoopMap.scrollUp = maxLoopMap.scrollUp ? maxLoopMap.scrollUp + 1 : 1;
        setRunInfo(`mainPopupFn: [${title}] 偏上，向下滑动(第${maxLoopMap.scrollUp}次)`);
        if (maxLoopMap.scrollUp > 10) {
          maxLoopMap.scrollUp = 1;
          setRunInfo(`mainPopupFn: 上滑超过10次，关闭弹框并 backMainPage`);
          closeMainPopup();
          backMainPage();
        }
        swipe(10, 1259, 10, 2300, 500);
        findBtn();
      } else {
        setRunInfo(`mainPopupFn: [${title}] 坐标在范围内，查找[去完成]按钮`);
        const goBtns = findTargetElementList("mainPopup", "去完成");
        setRunInfo(`mainPopupFn: 找到 ${goBtns ? goBtns.length : 0} 个[去完成]按钮`);
        for (let i = 0; i < goBtns.length; i++) {
          const btn = goBtns[i];
          const react = btn.bounds();
          setRunInfo(`mainPopupFn: 第${i+1}个[去完成] top=${react.top}，任务 top=${sysReact.top}，差值=${sysReact.top - react.top}`);
          if (sysReact.top - react.top < 20) {
            Record.info(`sysReact, x: ${react.left}, y: ${react.top}`);
            setRunInfo(`mainPopupFn: 点击第${i+1}个[去完成]，进入[${title}]`);
            btn.click();
            sleep(1000);
            Record.info(`运行++${title}`);
            callback();
            task.hasRun = true;
            break;
          }
        }
        if (!task.hasRun) {
          setRunInfo(`mainPopupFn: 未匹配到[去完成]按钮，任务[${title}]标记为已完成`);
        }
        task.hasRun = true;
        Record.info(`已经获取了对应的金币`);
      }
    };
    findBtn();
  } else {
    setRunInfo(`mainPopupFn: sysBtn 或 scrollBox 不存在，任务[${title}]标记为已完成`);
    task.hasRun = true;
  }
}

// 弹框列表任务处理
export function mainPopupTask() {
  try {
    setRunInfo('mainPopupTask: 开始执行');
    checkGetGold();

    const pendingTasks = taskList.filter((item: any) => !item.hasRun);
    setRunInfo(`mainPopupTask: 剩余未完成任务 ${pendingTasks.length}/${taskList.length} 个`);
    taskList.forEach((item: any) => {
      Record.info(`${item.title}: hasRun=${item.hasRun}`);
    });

    const result = pendingTasks.length === 0;
    if (result) {
      maxLoopMap.allTaskOver = true;
      setRunInfo('mainPopupTask: 所有任务执行完毕');
      Record.info(`所有任务执行完毕!!!`);
      flushTraces('goldCoin');
    } else {
      setRunInfo('mainPopupTask: 进入任务弹框列表，处理未完成任务');
      // 如果亲到没有点击随手签到
      const qdBtn = findTargetElementWithCacheStrict('mainPopup', '签到', { excludeContains: ['提醒', '收益'], timeoutEach: 100, errorTime: 20 });
      if (qdBtn) {
        setRunInfo('mainPopupTask: 找到签到按钮，点击');
        qdBtn.click();
      } else {
        setRunInfo('mainPopupTask: 未找到签到按钮');
      }

      // 获取列表, 并执行， 先执行命中缓存不循环方案
      for (let i = 0; i < taskList.length; i++) {
        const task: any = taskList[i];
        if (!task.hasRun) {
          setRunInfo(`mainPopupTask: 执行任务[${task.title}] (${i + 1}/${taskList.length})`);
          mainPopupFn(task.title, task.callBack, task);
        } else {
          setRunInfo(`mainPopupTask: 跳过已完成任务[${task.title}]`);
        }
      }

      setRunInfo('mainPopupTask: 本轮结束，再次检查结果');
      mainPopupTask();
    }
  } catch (error) {
    setRunInfo(`mainPopupTask: 异常 ${error}`);
    Record.error(`mainPopup, ${error}`);
  }
}

/**
 * 一直回退到闲鱼页面, 这里是金币页面
 */

export function xianyuBack() {
  setRunInfo('xianyuBack: 尝试回到闲鱼');
  launch(APPNAME);
  sleep(2000);
  const name = currentPackage();
  if (name !== APPNAME) {
    setRunInfo(`xianyuBack: 当前还在 ${name}，继续重试`);
    xianyuBack();
  } else {
    setRunInfo('xianyuBack: 已回到闲鱼');
  }
}

/**
 * 1. 金币兑换
 * 2. 做各种任务， 获取
 */
export function coinExchange() {
  try {
    // 防止无限递归打满日志/网络，每次重入至少等 500ms
    if (maxLoopMap.coinExchangeRunTime > 1) {
      sleep(500);
    }
    maxLoopMap.coinExchangeRunTime++;
    setRunInfo(`coinExchange: 第 ${maxLoopMap.coinExchangeRunTime} 次执行`);

    // 进入领取金币页面，判断是是否有领取， 领取金币, 是否有 攻略按钮
    const guideButton = findTargetElementWithCache("coinExchangeMain", "闲鱼币", 3);
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
    if (guideButton) {
      setRunInfo('coinExchange: 找到[闲鱼币]，检查主弹框[今天]是否存在');
      const mainPopup = findTargetElementWithCache("mainPopup", "今天", 40);

      if (mainPopup) {
        setRunInfo('coinExchange: 主弹框[今天]已出现，进入 mainPopupTask');
        mainPopupTask();
        maxLoopMap.coinExchangeRunTime = 1;
      } else {
        setRunInfo('coinExchange: 未找到主弹框[今天]，查找扔色子寻宝按钮');
        // 暴力一点， 直接点击扔色子，然后退出， 再重新执行
        let mainBtn = boundsContains(452, 916, 452, 920)
          .clickable()
          .depth(15)
          .findOne(1000);

        if (mainBtn) {
          setRunInfo('coinExchange: 找到扔色子按钮，点击');
          sleep(500);
          mainBtn.click();
          // 检查点击了寻宝按钮后是否有今天，如果没有则肯定是到了弹框了， 则需要处理弹框
          setRunInfo('coinExchange: 已点击扔色子，等待主弹框出现');
          let checkjt = findTargetElementWithCache("mainPopup", "今天", 40);
          if (!checkjt) {
            setRunInfo('coinExchange: 点击扔色子后仍未见主弹框[今天]，再次查找扔色子');
            // 点击扔色子寻宝按钮两次
            mainBtn = boundsContains(452, 916, 452, 920)
              .clickable()
              .depth(15)
              .findOne(1000);
            if (mainBtn) {
              setRunInfo('coinExchange: 再次找到扔色子，点击后重试');
              mainBtn.click();
              coinExchange();
            } else {
              setRunInfo('coinExchange: 扔色子按钮消失，执行 backMainPage 后重试');
              backMainPage();
              coinExchange();
            }
          } else {
            // 处理完成后再执行
            setRunInfo('coinExchange: 点击扔色子后主弹框已出现，重新进入');
            coinExchange();
          }
        } else {
          // 没有找到就重新执行一次，找不到今天，应该是可能进入到了弹窗，进行弹窗检查
          setRunInfo('coinExchange: 既无主弹框[今天]也无扔色子按钮，可能在其他弹窗，重试');
          coinExchange();
        }
      }
    } else {
      setRunInfo('coinExchange: 未找到[闲鱼币]，不在金币页面，执行 backMainPage');
      Record.error(`coinExchange, 金币页面未找到闲鱼币`);
      backMainPage();
    }
  } catch (error) {
    setRunInfo(`coinExchange: 异常 ${error}`);
    Record.error(`coinExchange, ${error}`);
    // 重新执行
    findPage("goldCoin");
  }
}
