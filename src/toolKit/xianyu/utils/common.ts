import { Record } from "../../../lib/logger";
import { flushElementCache } from "./selector";

// 尝试点击节点（含父节点），失败则坐标点击
export const tryClickNode = (node: UiObject | null | undefined) => {
  Record.info('tryClickNode', node)
  if (!node) {
    Record.error('tryClickNode: 传入的节点为空');
    return false;
  }
  
  try {
    Record.log('tryClickNode: 开始尝试点击节点', node);
    
    // 调试：检查clickable的类型和行为
    Record.log(`tryClickNode: 节点clickable值: ${node.clickable}`);
    Record.log(`tryClickNode: 节点clickable toString: ${node.clickable?.toString?.() || '无toString方法'}`);
    
    // 获取clickable的实际值（如果是函数则调用，否则直接使用）
    const isClickable = typeof node.clickable === 'function' ? (node.clickable as any)() : node.clickable;
    Record.log(`tryClickNode: 解析后的clickable值: ${isClickable}`);
    
    // 尝试直接点击节点
    if (isClickable) {
      Record.log('tryClickNode: 节点本身可点击，执行直接点击');
      const result = node.click();
      Record.log(`tryClickNode: 直接点击结果: ${result}`);
      return result;
    }
    
    Record.log('tryClickNode: 节点本身不可点击，跳过直接点击，开始查找父级可点击节点');
    
    // 尝试查找父级可点击节点
    let parent: UiObject | null = node.parent();
    for (let i = 0; i < 4 && parent; i++) {
      // 同样处理父节点的clickable
      const parentClickable = typeof parent.clickable === 'function' ? (parent.clickable as any)() : parent.clickable;
      Record.log(`tryClickNode: 检查第${i + 1}级父节点，clickable: ${parentClickable}`);
      
      if (parentClickable) {
        Record.log(`tryClickNode: 找到第${i + 1}级父节点可点击，执行父节点点击`);
        const result = parent.click();
        Record.log(`tryClickNode: 父节点点击结果: ${result}`);
        return result;
      }
      
      Record.log(`tryClickNode: 第${i + 1}级父节点不可点击，继续向上查找`);
      parent = parent.parent();
    }
    
    Record.log('tryClickNode: 所有父级节点都不可点击，开始尝试坐标点击');
    
    // 尝试坐标点击
    const b = node.bounds();
    const centerX = b.centerX();
    const centerY = b.centerY();
    
    Record.log(`tryClickNode: 获取节点边界，中心坐标: (${centerX}, ${centerY})`);
    
    const result = click(centerX, centerY);
    Record.log(`tryClickNode: 坐标点击结果: ${result}`);
    
    return result;
    
  } catch (e) {
    const errorMsg = (e as any)?.message || e;
    Record.error(`tryClickNode 执行异常: ${errorMsg}`);
    return false;
  }
};


// 在弹窗场景下，选择“最右侧”的按钮作为确认兜底
const pickRightMostButton = (buttons: UiCollection | null | undefined) => {
  if (!buttons || buttons.length === 0) return null;
  let candidate: UiObject | null = null;
  let maxRight = -1;
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    try {
      const b = btn.bounds();
      if (b.right > maxRight) {
        maxRight = b.right;
        candidate = btn;
      }
    } catch {}
  }
  return candidate;
};

// 多策略查找确认按钮（优先资源ID，其次文案，最后结构兜底）
const findConfirmButton = (timeout = 3500) => {
  const endAt = Date.now() + timeout;
  const confirmRegex = /(确定|强制停止|强行停止|停止|结束|允许|是|Yes|OK|好|确定停止|结束运行|关闭应用)/i;
  const confirmIds = [
    "android:id/button1",
    "miui:id/button1",
    "com.android.settings:id/left_button",
    "com.android.settings:id/confirm_button",
    "com.miui.securitycenter:id/accept",
    "com.huawei.systemmanager:id/btn_right",
    "com.coloros.oppoguardelf:id/btn_ok",
    "com.oplus.securitycenter:id/btn_ok",
    "com.vivo.permissionmanager:id/btn_right",
  ];

  const tryFind = () => {
    // 1) 资源ID直查
    for (const rid of confirmIds) {
      try {
        const byId = id(rid).findOne(200);
        if (byId) return byId;
      } catch {}
    }
    // 2) 文案匹配
    const byText =
      textMatches(confirmRegex).findOne(200) ||
      descMatches(confirmRegex).findOne(200) ||
      className("android.widget.Button").textMatches(confirmRegex).findOne(200) ||
      className("android.widget.Button").descMatches(confirmRegex).findOne(200);
    if (byText) return byText;
    // 3) 兜底：取对话框中最右侧按钮
    const buttons = className("android.widget.Button").find();
    const rightMost = pickRightMostButton(buttons);
    if (rightMost) return rightMost;
    return null;
  };

  let btn = tryFind();
  while (!btn && Date.now() < endAt) {
    sleep(150);
    btn = tryFind();
  }
  return btn;
};

// 关闭应用（优先：最近任务页关闭 → 设置页强制停止）
export const closeApp = (appNameOrPackage: string) => {
  try {
    try { flushElementCache(); } catch {}
    //激活hamibot应用, 小米手机老是关闭不了当前运行的应用， 所以让当前应用变成hamibot应用,再执行关闭相关逻辑
    const openHamibot =  app.launch('com.hamibot.hamibot');
    Record.info('openHamibot', openHamibot)
    sleep(1000)
    const packageName = appNameOrPackage.includes(".")
      ? appNameOrPackage
      : getPackageName(appNameOrPackage);

    if (!packageName) {
      Record.error(`未找到应用包名: ${appNameOrPackage}`);
      return false;
    }

    // 方式一：通过最近任务页关闭（你已设置不需要关闭的应用为“锁定”）
    try {
      recents();
      sleep(500);
      // 先找到desc 
      // 优先点击“关闭全部/清理全部”
      const closeAllBtn = findCloseAllButton(2000);
      if (closeAllBtn && tryClickNode(closeAllBtn)) {
        sleep(600);
        Record.info("已通过最近任务页‘关闭全部’关闭应用");
        sleep(200);
        return true;
      }
      // 找不到“关闭全部”则尝试定向滑动卡片（尽量少滑，避免误伤锁定）
      const card = textMatches(new RegExp(appNameOrPackage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).findOne(800) ||
                   textMatches(new RegExp(packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).findOne(800);
      if (card) {
        const b = card.bounds();
        swipe(b.centerX(), b.centerY(), b.centerX(), Math.max(0, b.centerY() - device.height * 0.6), 250);
        sleep(300);
        Record.info("已通过最近任务页卡片滑动关闭应用");
        try { flushElementCache(); } catch {}
        return true;
      }
      home();
    } catch {}

    // 方式二：打开应用设置点击“强制停止/停止运行/结束运行”
    app.openAppSetting(packageName);
    sleep(1500);



    const stopBtn = findCloseAllButton( 4000);
    if (stopBtn) {
      // 某些系统上需要确保按钮是可用状态
      if (stopBtn.enabled || true) {
        tryClickNode(stopBtn);
        sleep(600);
        const confirmBtn = findConfirmButton(3500);
        if (confirmBtn) {
          tryClickNode(confirmBtn);
          sleep(600);
          Record.info(`已通过设置页强制停止: ${packageName}`);
          back();
          sleep(300);
          return true;
        }
      }
    }
    Record.warn(`关闭应用未确认成功: ${packageName}`);
    return false;
  } catch (err) {
    Record.error(`closeApp 异常: ${(err as any)?.message || err}`);
    return false;
  }
};

// -----------------------------
// 关闭最近任务中的所有应用（保留被系统“锁定”的应用）
// -----------------------------
// 查找“关闭全部/清除全部”等按钮（优先资源ID，再文案匹配）
const findCloseAllButton = (timeout = 200) => {
  const endAt = Date.now() + timeout;
  const textRegex = /^(清除全部|全部清除|一键清理|全部关闭|关闭全部|清理全部|全部移除|关闭所有|全部结束|全部清理|全部清除|Clear\s*all|Close\s*all|Dismiss\s*all|Remove\s*all)$/i;
  const ids = [
    // SystemUI / Launcher 常见
    "com.huawei.android.launcher:id/clear_all_recents_image_button",
    "com.android.systemui:id/clear_all",
    "com.android.systemui:id/dismiss_text",
    "com.android.launcher3:id/clear_all",
    "com.miui.home:id/clearAnimView",
    "com.miui.systemui:id/clear_all",
    "com.huawei.android.launcher:id/clear_all",
    "com.huawei.android.launcher:id/clearbox",
    "com.samsung.android.recents:id/recents_clear_all_button",
    "com.coloros.recents:id/clear_all",
    "com.oplus.systemui:id/clear_all",
    "com.vivo.recents:id/clear",
    "com.transsion.phonemanager:id/clear_all",
    // 用户补充的有效 ID
    "com.taobao.taobao:id/close_all_btn",
    "com.taobao.taobao:id/clear_all_btn",
    "com.taobao.taobao:id/remove_all_btn",
    "clearbox",
  ];
  const tryFind = () => {
    // 1) 资源ID直查
    for (const rid of ids) {
      try {
        const w = id(rid).findOne(150);
        if (w) return w;
      } catch {}
    }
    // 2) 文案匹配
    return (
      textMatches(textRegex).findOne(200) ||
      descMatches(textRegex).findOne(200) ||
      className("android.widget.Button").textMatches(textRegex).findOne(200) ||
      className("android.widget.Button").descMatches(textRegex).findOne(200)
    );
  };

  let btn = tryFind();
  while (!btn && Date.now() < endAt) {
    sleep(150);
    btn = tryFind();
  }
  return btn;
};

export const closeAllRecentApps = (options?: { preferButton?: boolean; maxSwipes?: number }) => {
  const preferButton = options?.preferButton !== false; // 默认优先按钮
  const maxSwipes = Math.max(3, Math.min(options?.maxSwipes ?? 12, 30));
  try {
    // 打开最近任务
    recents();
    sleep(500);

    // 方式1：点击“关闭全部/清除全部”按钮
    if (preferButton) {
      const closeAllBtn = findCloseAllButton(2500);
      if (closeAllBtn) {
        if (tryClickNode(closeAllBtn)) {
          sleep(600);
          Record.info("已点击‘关闭全部’按钮");
          home();
          sleep(200);
          return true;
        }
      }
    }

    // 方式2：兜底 - 通过滑动卡片关闭（各列多次上滑）
    const columns = [
      Math.floor(device.width * 0.33),
      Math.floor(device.width * 0.5),
      Math.floor(device.width * 0.67),
    ];
    const startY = Math.floor(device.height * 0.6);
    const endY = Math.floor(device.height * 0.15);
    let swiped = 0;
    for (let i = 0; i < maxSwipes; i++) {
      const x = columns[i % columns.length];
      if (swipe(x, startY, x, endY, 250)) {
        swiped++;
        sleep(150);
      }
    }
    Record.info(`已尝试通过滑动关闭最近任务卡片，次数: ${swiped}`);
    home();
    sleep(200);
    return swiped > 0;
  } catch (err) {
    Record.error(`closeAllRecentApps 异常: ${(err as any)?.message || err}`);
    return false;
  }
};

// 只通过最近任务页“底部关闭按钮”关闭最近应用（不做滑动兜底）
// 在最近任务页底部查找关闭按钮（优先资源ID，再文案匹配）
const findBottomCloseButton = (timeout = 2500) => {
  const endAt = Date.now() + timeout;
  const bottomThreshold = Math.floor(device.height * 0.75);
  const textRegex = /(关闭|清理|清除|一键清理|关闭全部|清理全部|全部清除|全部关闭|结束全部|清除全部|Clear\s*all|Close\s*all|Dismiss\s*all|Remove\s*all|Close)/i;
  const ids = [
    // 与 findCloseAllButton 同步的 ID 集
    "com.android.systemui:id/clear_all",
    "com.android.systemui:id/dismiss_text",
    "com.android.launcher3:id/clear_all",
    "com.miui.home:id/clearAnimView",
    "com.miui.systemui:id/clear_all",
    "com.huawei.android.launcher:id/clear_all",
    "com.samsung.android.recents:id/recents_clear_all_button",
    "com.coloros.recents:id/clear_all",
    "com.oplus.systemui:id/clear_all",
    "com.vivo.recents:id/clear",
    "com.transsion.phonemanager:id/clear_all",
    // 用户补充
    "com.taobao.taobao:id/close_all_btn",
    "com.taobao.taobao:id/clear_all_btn",
    "com.taobao.taobao:id/remove_all_btn",
    "clearbox",
  ];

  const isBottom = (w: UiObject) => {
    try {
      const b = w.bounds();
      return b.top >= bottomThreshold;
    } catch { return false; }
  };

  const tryFind = () => {
    // 1) 资源ID直查 + 底部过滤
    for (const rid of ids) {
      try {
        const w = id(rid).findOne(150);
        if (w && isBottom(w)) return w;
      } catch {}
    }
    // 2) 文案匹配，过滤底部
    const candidates: (UiObject | null)[] = [
      textMatches(textRegex).findOne(200),
      descMatches(textRegex).findOne(200),
      className("android.widget.Button").textMatches(textRegex).findOne(200),
      className("android.widget.Button").descMatches(textRegex).findOne(200),
    ];
    for (const c of candidates) {
      if (c && isBottom(c)) return c;
    }
    // 3) 兜底：在底部区域找任意可点击的控件
    const allButtons = className("android.widget.Button").find();
    let bottomMost: UiObject | null = null;
    let maxBottom = -1;
    for (let i = 0; i < allButtons.length; i++) {
      const btn = allButtons[i];
      try {
        const b = btn.bounds();
        if (b.top >= bottomThreshold && b.bottom > maxBottom) {
          bottomMost = btn;
          maxBottom = b.bottom;
        }
      } catch {}
    }
    return bottomMost;
  };

  let btn = tryFind();
  while (!btn && Date.now() < endAt) {
    sleep(150);
    btn = tryFind();
  }
  return btn;
};

export const closeRecentsByBottomButton = () => {
  try {
    recents();
    sleep(500);
    const btn = findBottomCloseButton(3000);
    if (btn) {
      const clicked = tryClickNode(btn);
      sleep(600);
      if (clicked) {
        Record.info("已点击最近任务页底部关闭按钮");
        home();
        sleep(200);
      return true;
      }
    }
    Record.warn("未找到最近任务页底部关闭按钮");
    home();
    return false;
  } catch (e) {
    Record.error(`closeRecentsByBottomButton 异常: ${(e as any)?.message || e}`);
    return false;
  }
};
