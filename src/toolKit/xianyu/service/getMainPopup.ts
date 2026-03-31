/**
 * 主弹框核心任务列表， 哪些可以做自动化的列表
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 *
 */
import { Record } from "../../../lib/logger";
import { closeApp, tryClickNode } from "../utils/common";
import {
  findTargetElementWithCache,
  findTargetElementWithCacheStrict,
} from "../utils/selector";
import { APPNAME, findPage, flushTraces, PageType, setRunInfo } from "./base";

/**
 * 各种活动完成后则回退到主坦克页面，
 *  各种操作之后必须回到主弹框就对了， 就做这一个事情
 *
 */
let maxLoopTime = 5;
export const backMainPage = () => {
  if (maxLoopTime > 5) {
    setRunInfo('backMainPage: 死循环，关闭闲鱼');
    Record.error("死循环了， 关闭app");
    closeApp("闲鱼");
    maxLoopTime = 0;
    sleep(5000);
    findPage("goldCoin");
    backMainPage();
    return;
  }
  setRunInfo('backMainPage: 尝试回到主弹框页面');
  // 去到其他app了
  const appName = currentPackage();
  const mainPopup = findTargetElementWithCache("mainPopup", "今天", 3);
  const guideButton = findTargetElementWithCache(
    "coinExchangeMain",
    "闲鱼币抵扣",
    20
  );
  if (appName !== APPNAME) {
    setRunInfo(`backMainPage: 当前非闲鱼(${appName})，切回`);
    Record.info("当前app不是闲鱼，直接回退", appName);
    back();
    back();
    launchApp(APPNAME);
    maxLoopTime = maxLoopTime + 2;
    backMainPage();
  } else if (mainPopup) {
    maxLoopTime = 0;
    setRunInfo('backMainPage: 已回到主弹框页面');
    Record.info("回到主弹框页面!");
  } else if (guideButton) {
    setRunInfo('backMainPage: 在金币主页，执行返回');
    back();
    maxLoopTime++;
    backMainPage();
  } else {
    const activity = currentActivity();
    setRunInfo(`backMainPage: 无主弹框/无金币按钮，当前 activity=${activity}，maxLoopTime=${maxLoopTime}`);
    if (activity === PageType.goldCoin) {
      if (mainPopup) {
        maxLoopTime = 0;
        setRunInfo('backMainPage: goldCoin 页已有主弹框，继续');
        backMainPage();
      } else {
        setRunInfo('backMainPage: goldCoin 页无主弹框，执行 back 后重试');
        back();
        sleep(1000);
        maxLoopTime++;
        backMainPage();
      }
    } else if (activity === PageType.home || activity === PageType.product) {
      setRunInfo(`backMainPage: 主页/商品页(${activity})，前往金币页`);
      maxLoopTime = 0;
      findPage("goldCoin");
      backMainPage();
    } else {
      setRunInfo(`backMainPage: 未知页面(${activity})，执行 back*2 后重试(第${maxLoopTime + 1}次)`);
      back();
      back();
      sleep(1000);
      maxLoopTime++;
      backMainPage();
    }
  }
};

// 搜一搜喜欢的商品
const searchForLikedGoods = () => {
  setRunInfo('searchForLikedGoods: 进入1688页面');
  const page = findTargetElementWithCache("searchForLikedGoods", "1688");
  if (page) {
    setRunInfo('searchForLikedGoods: 开始滑动浏览');
    let progressBar = className("android.widget.ProgressBar").findOne(1000);
    while (progressBar) {
      const result = swipe(10, 2200, 10, 1700, 1000);
      if (result) {
        sleep(1000);
        progressBar = className("android.widget.ProgressBar").findOne(1000);
      }
    }
    setRunInfo('searchForLikedGoods: 浏览完成，返回');
    backMainPage();
  }
};

const scrollPage = () => {
  setRunInfo('scrollPage: 开始滑动浏览');
  let progressBar = findTargetElementWithCache("scrollPage", "滑动浏览");

  let max_loop = 40;
  while (progressBar && max_loop > 0) {
    const result = swipe(200, 2200, 200, 1700, 1000);
    if (result) {
      sleep(1000);
      max_loop--;
      setRunInfo(`scrollPage: 滑动中，剩余 ${max_loop} 次`);
      if (max_loop < 23) {
        progressBar = findTargetElementWithCache("scrollPage", "滑动浏览");
      }
    }
  }
  setRunInfo('scrollPage: 浏览完成，返回');
  backMainPage();
};

// 100coin
const get100Coin = () => {
  try {
    setRunInfo('get100Coin: 等待页面加载');
    sleep(10000);
    
    const buttonPatterns = [
      "前往加速",
      "直接拿奖励",
      "去加速",
      "加速领奖",
      "去看看"
    ];
    
    let foundButton = null;
    let buttonText = "";
    
    for (const pattern of buttonPatterns) {
      const btn = findTargetElementWithCache("get100Coin", pattern);
      if (btn) {
        foundButton = btn;
        buttonText = pattern;
        break;
      }
    }
    
    if (foundButton) {
      setRunInfo(`get100Coin: 找到按钮「${buttonText}」，点击`);
      Record.info(`找到按钮: ${buttonText}`, foundButton);
      tryClickNode(foundButton);
      sleep(4000);
      setRunInfo('get100Coin: 点击完成，返回主弹框');
      backMainPage();
    } else {
      const scrollPageBtn = findTargetElementWithCache("get100Coin", "滑动浏览");
      if (scrollPageBtn) {
        setRunInfo('get100Coin: 执行滑动浏览策略');
        Record.info("找到滑动浏览按钮，执行滚动策略");
        scrollPage();
      } else {
        setRunInfo('get100Coin: 未找到可用按钮，直接返回');
        Record.info("没有找到任何可用按钮，直接返回");
        backMainPage();
      }
    }

    const overBut = findTargetElementWithCache("get100Coin", "奖励已领取");
    if (overBut) {
      setRunInfo('get100Coin: 奖励已领取，点击后返回');
      Record.info("找到奖励已领取按钮，点击后返回");
      tryClickNode(overBut);
      sleep(1000);
      backMainPage();
    }

  } catch (error) {
    setRunInfo(`get100Coin: 异常 ${error.message}`);
    Record.error("get100Coin", error.message);
  }
};

// 去其他运用逛一逛
const goOtherApp = () => {
  setRunInfo('goOtherApp: 进入其他应用，等待6s');
  sleep(6000);
  setRunInfo('goOtherApp: 返回闲鱼');
  back();
  back();
  backMainPage();
};

// 搜一搜推荐商品
export const searchForRecommendedGoods = () => {
  setRunInfo('searchForRecommendedGoods: 检查搜索页面');
  const page = findTargetElementWithCache(
    "searchForRecommendedGoods",
    "搜索有福利"
  );
  if (page) {
    setRunInfo('searchForRecommendedGoods: 输入关键词搜索');
    setText(0, "iphone");
    const searchBtn = className("android.widget.Button").findOne(300);
    if (searchBtn) {
      searchBtn.click();
    }
    sleep(1000);
    let number = 1;
    let gameOver = findTargetElementWithCache(
      "searchForRecommendedGoods",
      "任务完成"
    );
    while (!gameOver) {
      const result = swipe(200, 2200, 200, 1700, 1000);
      if (result) {
        sleep(1000);
      }
      number++;
      setRunInfo(`searchForRecommendedGoods: 滑动第${number}次`);
      if (number > 15) {
        gameOver = findTargetElementWithCache(
          "searchForRecommendedGoods",
          "任务完成"
        );
      }
      if (number > 40) {
        break;
      }
    }
    setRunInfo('searchForRecommendedGoods: 完成，返回');
    backMainPage();
  } else {
    setRunInfo('searchForRecommendedGoods: 未找到搜索页面，返回');
    back();
  }
};

// 浏览指定频道好物
export const browseGoodsInSpecifiedChannel = () => {
  try {
    setRunInfo('browseGoodsInSpecifiedChannel: 开始浏览频道好物');
    let gameOver = findTargetElementWithCache(
      "browseGoodsInSpecifiedChannel",
      "点击领取",
      30
    );
    let maxRunTime = 20;
    while (!gameOver && maxRunTime > 0) {
      const result = swipe(10, 2200, 10, 1200, 1000);
      if (result) {
        sleep(500);
      }
      setRunInfo(`browseGoodsInSpecifiedChannel: 滑动中，剩余 ${maxRunTime} 次`);
      if (maxRunTime < 5) {
        gameOver = findTargetElementWithCache(
          "browseGoodsInSpecifiedChannel",
          "任务完成",
          30
        );
      }
      maxRunTime--;
    }
    if (gameOver) {
      setRunInfo('browseGoodsInSpecifiedChannel: 找到领取按钮，点击');
      gameOver.click();
      sleep(1000);
    }
    setRunInfo('browseGoodsInSpecifiedChannel: 浏览完成');
  } catch (error) {
    setRunInfo(`browseGoodsInSpecifiedChannel: 异常 ${error?.message}`);
    console.log("------error----------", error?.message);
  }
};

// 发布一件新宝贝， 这个功能相对独立可以抽离出来
export const publishNewGoods = () => {
  setRunInfo('publishNewGoods: 开始发布新宝贝');
  let flog = true;
  let msg = "";
  const aiGoodButton = findTargetElementWithCache(
    "publishNewGoods",
    "宝贝不在身边？点我"
  );
  if (aiGoodButton) {
    setRunInfo('publishNewGoods: 点击「宝贝不在身边？点我」');
    aiGoodButton.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "宝贝不在身边？点我失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }
  const newIphone12But = findTargetElementWithCache("publishNewGoods", "iPhone 12");
  if (flog && newIphone12But) {
    setRunInfo('publishNewGoods: 点击「iPhone 12」');
    newIphone12But.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "iPhone 12 点击失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }
  const recommendGoods = className("android.widget.ScrollView").findOne(1000);
  if (flog && recommendGoods) {
    setRunInfo('publishNewGoods: 选择推荐商品');
    recommendGoods.child(0).click();
    sleep(1000);
  } else {
    flog = false;
    msg = "选择推荐的商品失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  const publishBtn = findTargetElementWithCache("publishNewGoods", "发布");
  if (flog && publishBtn) {
    setRunInfo('publishNewGoods: 点击发布按钮');
    publishBtn.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "发布按钮未找到失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  const continuePublish = findTargetElementWithCache("publishNewGoods", "继续发布");
  if (continuePublish) {
    setRunInfo('publishNewGoods: 点击继续发布');
    continuePublish.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "不填，继续发布失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  const publishSuccessButton = findTargetElementWithCache("publishNewGoods", "发布成功");
  if (flog && publishSuccessButton) {
    setRunInfo('publishNewGoods: 发布成功，关闭弹框');
    publishSuccessButton.parent().child(0).click();
    sleep(1000);
  } else {
    flog = false;
    msg = "关闭不填数据发布弹框确认弹框失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  const editButton = findTargetElementWithCache("publishNewGoods", "管理");
  if (flog && editButton) {
    setRunInfo('publishNewGoods: 点击管理按钮');
    editButton.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "点击管理失败";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  const deleteButton = findTargetElementWithCache("publishNewGoods", "删除");
  if (flog && deleteButton) {
    setRunInfo('publishNewGoods: 点击删除商品');
    deleteButton.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "删除商品";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  const deleteButtonQueRen = findTargetElementWithCache("publishNewGoods", "确定");
  if (flog && deleteButtonQueRen) {
    setRunInfo('publishNewGoods: 确认删除');
    deleteButtonQueRen.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "确认删除";
    setRunInfo(`publishNewGoods: ${msg}`);
  }

  if (!flog) {
    Record.error(msg);
  } else {
    setRunInfo('publishNewGoods: 发布+删除流程完成');
  }
  return flog;
};

export const taskList = [
 
  {
    title: "浏览指定频道好物",
    callBack: browseGoodsInSpecifiedChannel,
    hasRun: false,
  },
  {
      title: '搜一搜喜欢的商品',
      callBack:searchForLikedGoods,
      hasRun: false
  },
  {
    title: "去浏览全新好物",
    callBack: scrollPage,
    hasRun: false,
  },
  {
    title: "浏览推荐的国补商品",
    callBack: scrollPage,
    hasRun: false,
  },
  {
    title: "去蚂蚁森林逛一逛",
    callBack: goOtherApp,
  },
  {
    title: "去支付宝农场领水果",
    callBack: goOtherApp,
    hasRun: false,
  },
  {
    title: "去淘宝签到领红包",
    callBack: goOtherApp,
    hasRun: false,
  },
  {
    title: "去蚂蚁森林逛一逛",
    callBack: goOtherApp,
    hasRun: false,
  },

  {
    title: "去蚂蚁庄园逛一逛",
    callBack: goOtherApp,
    hasRun: false,
  },
  {
    title: "去支付宝领积分",
    callBack: goOtherApp,
    hasRun: false,
  },
  {
    title: "浏览鱼小铺工作台",
    callBack: goOtherApp,
    hasRun: false,
  },
  {
    title: "搜一搜推荐商品",
    callBack: searchForRecommendedGoods,
    hasRun: false,
  },
  {
    title: "领至高20元外卖红包",
    callBack: goOtherApp,
    hasRun: false,
  },
  {
    title: "看视频奖励100币",
    callBack: get100Coin,
    hasRun: false,
  },
  {
    title: "看视频奖励100币",
    callBack: get100Coin,
    hasRun: false,
  },
  {
    title: "看视频奖励100币",
    callBack: get100Coin,
    hasRun: false,
  },
  {
    title: "看视频奖励100币",
    callBack: get100Coin,
    hasRun: false,
  },
  {
    title: "发布一件新宝贝",
    callBack: publishNewGoods,
    hasRun: false,
  },
];

/** 脚本刚跑完、顶栏可能出现「领取奖励」时置 true；checkGetGold 只对这些项做标题同行查找，避免扫全表 */
(taskList as { awaitingRewardClaim?: boolean }[]).forEach((t) => {
  if (t.awaitingRewardClaim === undefined) t.awaitingRewardClaim = false;
});

/**
 * 关闭主弹框的逻辑
 */
export const closeMainPopup = () => {
  setRunInfo('closeMainPopup: 尝试关闭主弹框');
  sleep(1000);
  const btnList = className("android.view.View").clickable(true).find();

  let flog = false;
  for (let i = 0; i < btnList.length; i++) {
    const btn = btnList[i];
    const react = btn.bounds();
    if (react.left < 1000 && react.left > 900 && react.top > 600) {
      setRunInfo('closeMainPopup: 找到关闭按钮，点击');
      btn.click();
      sleep(1000);
      flog = true;
      return;
    }
  }
  if (flog) {
    return;
  } else {
    setRunInfo('closeMainPopup: 关闭主弹框失败');
    Record.error("关闭主弹框失败");
  }
};
