/**
 * 主弹框核心任务列表， 哪些可以做自动化的列表
 * 1. 爬取关注的店铺数据
 * 2. 进入店铺， 获取对应的商品信息
 * 3. 处理商品信息， 抓取对应的数据
 *
 */
import { Record } from "../../../lib/logger";
import { findByA11yId, tryClickNode } from "../utils/common";
import {
  findTargetElementWithCache,
  findTargetElementWithCacheStrict,
} from "../utils/selector";
import { APPNAME, findPage, flushTraces, PageType, setRunInfo } from "./base";
import { assertOnGoldCoinPage, isOnGoldCoinPage, probeGoldCoinPage } from "./goldPageDetect";

function isGoldTaskPopupOpen(): boolean {
  return !!(findByA11yId("taskWrap", 500) || findByA11yId("taskListWrap", 500));
}

/**
 * 各种活动完成后则回退到主坦克页面，
 *  各种操作之后必须回到主弹框就对了， 就做这一个事情
 *
 */
const MAX_BACK_MAIN_PAGE_ATTEMPTS = 20;
let maxLoopTime = 0;

/** 新一轮「任务完成后回金币页」前重置，避免跨任务累积触发误判 */
export function resetBackMainPageLoop() {
  maxLoopTime = 0;
}

function backMainPageRetryDelayMs(): number {
  if (maxLoopTime <= 0) return 0;
  return Math.min(12000, maxLoopTime * 2000);
}

/**
 * 从淘宝/支付宝等外部 App 拉回闲鱼前台。
 * 注意：launchApp 只认应用名，包名必须用 launch()。
 */
export function returnToXianyuApp(maxRetry = 5): boolean {
  const from = currentPackage();
  if (from === APPNAME) return true;

  setRunInfo(`returnToXianyu: 从 ${from} 切回闲鱼`);
  Record.info(`returnToXianyu: start from ${from}`);

  for (let i = 0; i < maxRetry; i++) {
    const pkg = currentPackage();
    if (pkg === APPNAME) {
      setRunInfo("returnToXianyu: 已在闲鱼");
      Record.info("returnToXianyu: ok already on xianyu");
      return true;
    }

    setRunInfo(`returnToXianyu: 第 ${i + 1}/${maxRetry} 次，当前 ${pkg}`);
    Record.info(`returnToXianyu: attempt ${i + 1}/${maxRetry} pkg=${pkg}`);

    setRunInfo("returnToXianyu: 执行 back()");
    Record.info("returnToXianyu: back()");
    back();
    sleep(2000);
    let after = currentPackage();
    Record.info(`returnToXianyu: after back pkg=${after}`);
    if (after === APPNAME) {
      setRunInfo("returnToXianyu: back() 已回闲鱼");
      return true;
    }

    setRunInfo("returnToXianyu: 执行 launch(闲鱼包名)");
    Record.info(`returnToXianyu: launch(${APPNAME})`);
    launch(APPNAME);
    sleep(4000);
    after = currentPackage();
    Record.info(`returnToXianyu: after launch pkg=${after}`);
    if (after === APPNAME) {
      setRunInfo("returnToXianyu: launch 已回闲鱼");
      return true;
    }

    try {
      setRunInfo("returnToXianyu: 执行 launchApp(闲鱼)");
      Record.info("returnToXianyu: launchApp(闲鱼)");
      launchApp("闲鱼");
      sleep(4000);
      after = currentPackage();
      Record.info(`returnToXianyu: after launchApp pkg=${after}`);
      if (after === APPNAME) {
        setRunInfo("returnToXianyu: launchApp 已回闲鱼");
        return true;
      }
    } catch (e) {
      Record.warn(`returnToXianyu: launchApp error ${e}`);
    }

    setRunInfo("returnToXianyu: home + launch");
    Record.info("returnToXianyu: home + launch");
    home();
    sleep(1200);
    launch(APPNAME);
    sleep(4000);
    after = currentPackage();
    Record.info(`returnToXianyu: after home+launch pkg=${after}`);
    if (after === APPNAME) {
      setRunInfo("returnToXianyu: home+launch 已回闲鱼");
      return true;
    }
  }

  const still = currentPackage();
  setRunInfo(`returnToXianyu: 失败，仍在 ${still}`);
  Record.warn(`returnToXianyu: failed still ${still}`);
  return false;
}

export const backMainPage = () => {
  if (maxLoopTime >= MAX_BACK_MAIN_PAGE_ATTEMPTS) {
    setRunInfo(`backMainPage: 已达 ${MAX_BACK_MAIN_PAGE_ATTEMPTS} 次仍无法回到金币页，停止重试`);
    Record.error(`backMainPage: 超过最大重试 ${MAX_BACK_MAIN_PAGE_ATTEMPTS}`);
    maxLoopTime = 0;
    return;
  }

  const delay = backMainPageRetryDelayMs();
  if (delay > 0) {
    setRunInfo(`backMainPage: 等待 ${delay}ms 后重试 (${maxLoopTime + 1}/${MAX_BACK_MAIN_PAGE_ATTEMPTS})`);
    sleep(delay);
  }

  setRunInfo(`backMainPage: 尝试回到金币页 (${maxLoopTime + 1}/${MAX_BACK_MAIN_PAGE_ATTEMPTS})`);
  const appName = currentPackage();

  if (appName !== APPNAME) {
    if (returnToXianyuApp(5)) {
      maxLoopTime = 0;
      sleep(2000);
      if (isOnGoldCoinPage(1200)) {
        assertOnGoldCoinPage("backMainPage", 300);
        return;
      }
      if (currentActivity() === PageType.goldCoin) {
        sleep(2000);
        if (isOnGoldCoinPage(1200)) {
          assertOnGoldCoinPage("backMainPage", 300);
          return;
        }
      }
      setRunInfo("backMainPage: 已回闲鱼但未在金币地图，导航到金币页");
      findPage("goldCoin");
      return;
    }
    maxLoopTime++;
    backMainPage();
    return;
  }

  // 新流程：任务弹框在金币 H5 内，已在金币页则不应 back() 退出
  if (isOnGoldCoinPage(600)) {
    maxLoopTime = 0;
    assertOnGoldCoinPage("backMainPage", 200);
    if (isGoldTaskPopupOpen()) {
      setRunInfo('backMainPage: 任务弹框已打开');
    }
    return;
  }

  const mainPopup = findTargetElementWithCache("mainPopup", "今天", 3);
  const guideButton = findTargetElementWithCache(
    "coinExchangeMain",
    "闲鱼币抵扣",
    20
  );
  if (mainPopup || isGoldTaskPopupOpen()) {
    maxLoopTime = 0;
    setRunInfo('backMainPage: 已回到主弹框页面');
    Record.info("回到主弹框页面!");
  } else if (guideButton) {
    setRunInfo('backMainPage: 有闲鱼币抵扣但不在金币 H5，执行返回');
    back();
    maxLoopTime++;
    backMainPage();
  } else {
    const activity = currentActivity();
    setRunInfo(`backMainPage: 无主弹框/无金币按钮，当前 activity=${activity}，maxLoopTime=${maxLoopTime}`);
    if (activity === PageType.goldCoin) {
      const probe = probeGoldCoinPage(800);
      setRunInfo(`backMainPage: goldCoin activity 但未识别地图 (${probe.reason})`);
      sleep(2500);
      maxLoopTime++;
      backMainPage();
    } else if (activity === PageType.home || activity === PageType.product) {
      setRunInfo(`backMainPage: 主页/商品页(${activity})，前往金币页`);
      maxLoopTime = 0;
      findPage("goldCoin");
    } else {
      setRunInfo(`backMainPage: 未知页面(${activity})，执行 back 后重试`);
      back();
      sleep(2000);
      back();
      sleep(2000);
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
  setRunInfo('scrollPage: 浏览完成');
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

// 去其他运用逛一逛（停留时间需覆盖外部 App 任务；不在此调 backMainPage，由 mainPopupFn 统一收口）
const EXTERNAL_APP_DWELL_MS = 12000;

const goOtherApp = () => {
  setRunInfo(`goOtherApp: 外部任务执行中，等待 ${EXTERNAL_APP_DWELL_MS / 1000}s`);
  sleep(EXTERNAL_APP_DWELL_MS);
  setRunInfo("goOtherApp: 外部任务结束，等待 mainPopupFn 拉回闲鱼");
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
