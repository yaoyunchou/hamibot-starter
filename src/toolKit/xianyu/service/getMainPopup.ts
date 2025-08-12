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
import { APPNAME, findPage, PageType } from "./base";

/**
 * 各种活动完成后则回退到主坦克页面，
 *  各种操作之后必须回到主弹框就对了， 就做这一个事情
 *
 */
let maxLoopTime = 5;
export const backMainPage = () => {
  if (maxLoopTime > 5) {
    Record.error("死循环了， 关闭app");
    closeApp("闲鱼");
    maxLoopTime = 0;
    sleep(5000);
    findPage("getGold");
    backMainPage();
    return;
  }
  // 去到其他app了
  const appName = currentPackage();
  // 执行完成后需要返回两次回到主弹窗页面
  const mainPopup = findTargetElementWithCache("mainPopup", "今天", 20);
  const guideButton = findTargetElementWithCache(
    "coinExchangeMain",
    "闲鱼币抵扣",
    20
  );
  if (appName !== APPNAME) {
    // 当前app不是闲鱼，直接回退
    Record.info("当前app不是闲鱼，直接回退", appName);
    
    back();
    back();
    launchApp(APPNAME);
    maxLoopTime = maxLoopTime + 2;
    backMainPage();
  } else if (mainPopup) {
    // 返回到主弹框页面,可以继续执行下一个任务
    maxLoopTime = 0;
    Record.info("回到主弹框页面!");
  } else if (guideButton) {
    // 执行主页面的逻辑
    back();
    maxLoopTime++;
    backMainPage();
  } else {
    const activity = currentActivity();
    if (activity === PageType.goldCoin) {
      // 执行完成后需要返回两次回到主弹窗页面
      if (mainPopup) {
        maxLoopTime = 0;
        backMainPage();
      } else {
        back();
        sleep(1000);
        maxLoopTime++;
        backMainPage();
      }
    } else if (activity === PageType.home || activity === PageType.product) {
      maxLoopTime = 0;
      findPage("goldCoin");
      backMainPage();
    } else {
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
  // 进入的页面为1688页面
  const page = findTargetElementWithCache("searchForLikedGoods", "1688");
  // 如果进入了页面， 再执行滑动逻辑
  if (page) {
    // 有进度条就证明没有结束， 结束后进度条和提示窗会消失不见
    let progressBar = className("android.widget.ProgressBar").findOne(1000);
    while (progressBar) {
      const result = swipe(10, 2200, 10, 1700, 1000);
      if (result) {
        console.log("-----scrollForward----");
        sleep(1000);
        progressBar = className("android.widget.ProgressBar").findOne(1000);
      }
    }
    // 执行完成后需要返回两次回到主弹窗页面
    backMainPage();
  }
};

//  滚动浏览页面， 当进度条满了，或者消失的时候， 则证明已经浏览完成
const scrollPage = () => {
  // 有进度条就证明没有结束， 结束后进度条和提示窗会消失不见
  let progressBar = findTargetElementWithCache("scrollPage", "滑动浏览");

  let max_loop = 40;
  while (progressBar && max_loop > 0) {
    const result = swipe(200, 2200, 200, 1700, 1000);
    if (result) {
      console.log("-----scrollForward----");
      sleep(1000);
      max_loop--;

      if (max_loop < 23) {
        progressBar = findTargetElementWithCache("scrollPage", "滑动浏览");
      }
    }
  }
  // 执行完成后需要返回两次回到主弹窗页面
  backMainPage();
};

// 100coin
const get100Coin = () => {
  try {
   
    // 加载比较慢， 先等待6s
    sleep(10000);
    
    // 使用正则表达式查找多个可能的按钮
    const buttonPatterns = [
      "前往加速",
      "直接拿奖励",
      "去加速",
      "加速领奖",
      "去看看"
    ];
    
    // 创建正则表达式，匹配任意一个按钮文本
    const buttonRegex = new RegExp(`(${buttonPatterns.join('|')})`);
    
    // 查找匹配的按钮
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
      Record.info(`找到按钮: ${buttonText}`, foundButton);

      // 在这个按钮中间点击一下，按钮没有click方法
      tryClickNode(foundButton)
      // 根据按钮类型决定等待时间
      sleep(4000)
      backMainPage();
    } else {
        //  获取是否有滑动浏览 如果有则进入滚动策略
        const scrollPageBtn = findTargetElementWithCache("get100Coin", "滑动浏览");
        if(scrollPageBtn){
          Record.info("找到滑动浏览按钮，执行滚动策略");
          scrollPage();
        }else{
          Record.info("没有找到任何可用按钮，直接返回");
          // 没有滑动浏览， 则直接返回
          backMainPage();
        }
    }

    // 检查是否有奖励已经领取的按钮
    const overBut = findTargetElementWithCache(
      "get100Coin",
      "奖励已领取"
    );
    if(overBut){
      Record.info("找到奖励已领取按钮，点击后返回");
      tryClickNode(overBut)
      sleep(1000);
      backMainPage();
    }

  } catch (error) {
    Record.error("get100Coin", error.message);
  }
};

// 去其他运用逛一逛
const goOtherApp = () => {
  // 进入其他页面后，等待6s后返回
  sleep(6000);
   back();
   back();
  backMainPage();
};

// 搜一搜推荐商品
export const searchForRecommendedGoods = () => {
  // 进入的页面为1688页面
  const page = findTargetElementWithCache(
    "searchForRecommendedGoods",
    "搜索有福利"
  );
  if (page) {
    // 进入到了搜索页面
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
        console.log("-----scrollForward----");
        sleep(1000);
      }
      number++;
      console.log("-----number----", number);
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
    // 执行完成后需要返回两次回到主弹窗页面
    backMainPage();
  } else {
    back();
  }
};

// 浏览指定频道好物
export const browseGoodsInSpecifiedChannel = () => {
  try {
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
      gameOver.click();
      sleep(1000);
    }
  } catch (error) {
    console.log("------error----------", error?.message);
  }
};

// 发布一件新宝贝， 这个功能相对独立可以抽离出来
export const publishNewGoods = () => {
  let flog = true;
  let msg = "";
  // 进入新增页面
  const aiGoodButton = findTargetElementWithCache(
    "publishNewGoods",
    "宝贝不在身边？点我"
  );
  if (aiGoodButton) {
    aiGoodButton.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "宝贝不在身边？点我失败";
  }
  // 进入发布页面
  const newIphone12But = findTargetElementWithCache(
    "publishNewGoods",
    "iPhone 12"
  );
  if (flog && newIphone12But) {
    newIphone12But.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "iPhone 12 点击失败";
  }
  // 选择推荐的商品
  const recommendGoods = className("android.widget.ScrollView").findOne(1000);
  if (flog && recommendGoods) {
    recommendGoods.child(0).click();
    sleep(1000);
  } else {
    flog = false;
    msg = "选择推荐的商品失败";
  }

  // 点击发布按钮
  const publishBtn = findTargetElementWithCache("publishNewGoods", "发布");
  if (flog && publishBtn) {
    publishBtn.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "发布按钮未找到失败";
  }

  // 点击不填，继续发布
  const continuePublish = findTargetElementWithCache(
    "publishNewGoods",
    "继续发布"
  );
  if (continuePublish) {
    continuePublish.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "不填，继续发布失败";
  }

  // ------------------删除商品-------------------

  //
  const publishSuccessButton = findTargetElementWithCache(
    "publishNewGoods",
    "发布成功"
  );
  if (flog && publishSuccessButton) {
    // 找到关闭弹框按钮
    publishSuccessButton.parent().child(0).click();
    sleep(1000);
  } else {
    flog = false;
    msg = "关闭不填数据发布弹框确认弹框失败";
  }

  // 点击管理按钮
  const editButton = findTargetElementWithCache("publishNewGoods", "管理");
  if (flog && editButton) {
    editButton.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "点击管理失败";
  }
  // 删除商品
  const deleteButton = findTargetElementWithCache("publishNewGoods", "删除");
  if (flog && deleteButton) {
    deleteButton.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "删除商品";
  }

  // 确认删除商品
  const deleteButtonQueRen = findTargetElementWithCache(
    "publishNewGoods",
    "确定"
  );
  if (flog && deleteButtonQueRen) {
    deleteButtonQueRen.click();
    sleep(1000);
  } else {
    flog = false;
    msg = "确认删除";
  }
  if (!flog) {
    Record.error(msg);
  }
  return flog;
};

export const taskList = [
 
  // {
  //   title: "浏览指定频道好物",
  //   callBack: browseGoodsInSpecifiedChannel,
  //   hasRun: false,
  // },
  // // {
  // //     title: '搜一搜喜欢的商品',
  // //     callBack:searchForLikedGoods,
  // //     hasRun: false
  // // },
  // {
  //   title: "去浏览全新好物",
  //   callBack: scrollPage,
  //   hasRun: false,
  // },
  // {
  //   title: "浏览推荐的国补商品",
  //   callBack: scrollPage,
  //   hasRun: false,
  // },
  // {
  //   title: "去蚂蚁森林逛一逛",
  //   callBack: goOtherApp,
  // },
  // {
  //   title: "去支付宝农场领水果",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },
  // {
  //   title: "去淘宝签到领红包",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },
  // {
  //   title: "去蚂蚁森林逛一逛",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },

  // {
  //   title: "去蚂蚁庄园逛一逛",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },
  // {
  //   title: "去支付宝领积分",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },
  // {
  //   title: "浏览鱼小铺工作台",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },
  // {
  //   title: "搜一搜推荐商品",
  //   callBack: searchForRecommendedGoods,
  //   hasRun: false,
  // },
  // {
  //   title: "领至高20元外卖红包",
  //   callBack: goOtherApp,
  //   hasRun: false,
  // },
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

/**
 * 关闭主弹框的逻辑
 */
export const closeMainPopup = () => {
  sleep(1000);
  const btnList = className("android.view.View").clickable(true).find();
  console.log("----- btnList?.length----", btnList?.length);

  let flog = false;
  for (let i = 0; i < btnList.length; i++) {
    const btn = btnList[i];
    const react = btn.bounds();
    console.log("-----react----", react);
    if (react.left < 1000 && react.left > 900 && react.top > 600) {
      btn.click();
      sleep(1000);
      flog = true;
      return;
    }
  }
  if (flog) {
    return;
  } else {
    // 非常严重的错误
    Record.error("关闭主弹框失败");
  }
};
