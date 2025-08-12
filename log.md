# Hamibot Starter 开发日志

## 2024-12-19 - Auto.js 弹框内容获取问题分析

### 问题描述
在 `src/toolKit/xianyu/service/getGold.ts` 第107行，代码尝试获取弹框中的内容：
```typescript
const sysBtn = className("android.view.View").text(title).findOne(1000)
```

用户反馈：明明能看见弹框内容，但是代码获取不到。

### 问题分析

#### 1. 可能的原因
1. **元素层级问题**：弹框可能在不同的层级，需要调整查找策略
2. **文本匹配问题**：`text(title)` 可能匹配不到，需要使用 `textContains()` 或其他匹配方式
3. **等待时间问题**：1000ms 可能不够，弹框加载需要更长时间
4. **元素状态问题**：元素可能还未完全渲染或处于不可见状态
5. **权限问题**：可能需要无障碍权限或其他权限

#### 2. 常见解决方案

##### 方案1：使用更宽松的匹配条件
```typescript
// 使用 textContains 而不是 text
const sysBtn = className("android.view.View").textContains(title).findOne(3000)

// 或者使用 desc 属性
const sysBtn = className("android.view.View").desc(title).findOne(3000)
```

##### 方案2：增加等待时间和重试机制
```typescript
const findElement = (title: string, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
        const element = className("android.view.View").textContains(title).findOne(2000)
        if (element) return element
        sleep(1000)
    }
    return null
}
```

##### 方案3：使用多种查找策略
```typescript
const findElementWithMultipleStrategies = (title: string) => {
    // 策略1：直接文本匹配
    let element = className("android.view.View").text(title).findOne(1000)
    if (element) return element
    
    // 策略2：包含文本匹配
    element = className("android.view.View").textContains(title).findOne(1000)
    if (element) return element
    
    // 策略3：描述匹配
    element = className("android.view.View").desc(title).findOne(1000)
    if (element) return element
    
    // 策略4：ID匹配（如果有ID的话）
    element = id(title).findOne(1000)
    if (element) return element
    
    return null
}
```

##### 方案4：调试信息输出
```typescript
const debugElementFinding = (title: string) => {
    console.log(`正在查找元素: ${title}`)
    
    // 输出所有可见的 View 元素
    const allViews = className("android.view.View").find()
    console.log(`找到 ${allViews.length} 个 View 元素`)
    
    for (let i = 0; i < allViews.length; i++) {
        const view = allViews[i]
        const text = view.text()
        const desc = view.desc()
        if (text || desc) {
            console.log(`元素 ${i}: text="${text}", desc="${desc}"`)
        }
    }
    
    // 尝试查找目标元素
    const target = className("android.view.View").textContains(title).findOne(1000)
    if (target) {
        console.log(`找到目标元素: ${target.text()}`)
        return target
    } else {
        console.log(`未找到包含 "${title}" 的元素`)
        return null
    }
}
```

### 建议的改进方案

#### 1. 修改 getGold.ts 中的查找逻辑
```typescript
// 在 mainPopupFn 函数中替换第107行
const findTargetElement = (title: string) => {
    // 增加调试信息
    console.log(`查找元素: ${title}`)
    
    // 多种查找策略
    const strategies = [
        () => className("android.view.View").text(title).findOne(2000),
        () => className("android.view.View").textContains(title).findOne(2000),
        () => className("android.view.View").desc(title).findOne(2000),
        () => className("android.view.View").descContains(title).findOne(2000)
    ]
    
    for (let i = 0; i < strategies.length; i++) {
        const element = strategies[i]()
        if (element) {
            console.log(`策略 ${i + 1} 成功找到元素`)
            return element
        }
    }
    
    console.log(`所有策略都未找到元素: ${title}`)
    return null
}

// 替换原来的查找代码
const sysBtn = findTargetElement(title)
```

#### 2. 添加元素状态检查
```typescript
const isElementVisible = (element: any) => {
    if (!element) return false
    
    const bounds = element.bounds()
    const screenHeight = device.height
    const screenWidth = device.width
    
    // 检查元素是否在屏幕范围内
    return bounds.top >= 0 && bounds.bottom <= screenHeight && 
           bounds.left >= 0 && bounds.right <= screenWidth
}
```

#### 3. 添加页面状态检查
```typescript
const waitForPageLoad = (maxWait = 5000) => {
    const startTime = Date.now()
    while (Date.now() - startTime < maxWait) {
        // 检查是否有加载指示器
        const loadingIndicator = className("android.view.View").textContains("加载").findOne(100)
        if (!loadingIndicator) {
            break
        }
        sleep(500)
    }
}
```

### 后续优化建议

1. **添加更多调试信息**：在关键查找点添加日志输出
2. **实现重试机制**：对于重要的元素查找，实现自动重试
3. **优化等待时间**：根据网络状况和设备性能调整等待时间
4. **添加元素验证**：查找元素后验证其是否可点击和可见
5. **实现备用方案**：当主要查找策略失败时，使用备用方案

### 相关文件
- `src/toolKit/xianyu/service/getGold.ts` - 主要问题文件
- `src/toolKit/xianyu/service/base.ts` - 基础服务文件
- `src/lib/docs/logger.md` - 日志模块文档

## 2024-12-19 - 具体修改实施

### 修改内容
1. **替换了第107行的元素查找逻辑**：
   - 原来：`const sysBtn = className("android.view.View").text(title).findOne(1000)`
   - 现在：使用多种查找策略的 `findTargetElement()` 函数

2. **添加了多种查找策略**：
   - 策略1：精确文本匹配 `text(title)`
   - 策略2：包含文本匹配 `textContains(title)`
   - 策略3：描述匹配 `desc(title)`
   - 策略4：描述包含匹配 `descContains(title)`

3. **增加了等待时间**：
   - 从1000ms增加到2000ms，给弹框更多加载时间

4. **添加了详细的调试信息**：
   - 当找不到元素时，输出所有可见的View元素
   - 显示前20个有文本的元素
   - 查找相似文本的元素

5. **修复了TypeScript类型错误**：
   - 将 `element.desc()` 改为 `element.contentDescription`
   - UiObject没有desc()方法，但有contentDescription属性

### 使用方法
运行脚本后，如果仍然获取不到弹框内容，控制台会输出详细的调试信息，包括：
- 所有可见的View元素数量
- 前20个有文本的元素内容
- 包含目标文本前2个字符的相似元素

这些信息可以帮助你：
1. 确认弹框是否真的加载了
2. 查看实际的文本内容是什么
3. 调整查找策略中的文本匹配条件

### 下一步建议
如果修改后仍然无法获取到元素，请：
1. 查看控制台输出的调试信息
2. 根据实际输出的文本内容调整查找条件
3. 考虑增加更多的等待时间
4. 检查是否需要特殊的权限设置 

### 技术细节
- 使用函数参数 `findMethod` 来控制使用 `findOne` 还是 `find` 方法
- 根据查找方法动态设置超时时间
- 保持了原有的缓存机制和日志输出功能

## 2024-12-19 - Map数据转换修复

### 问题描述
在 `src/lib/service.ts` 的 `getElementCache` 函数中，从数据库读取缓存数据后转换为Map时出现问题，导致Map没有正确还原。

### 问题分析
原来的代码：
```typescript
const cacheMap = new Map<string, any>(cacheData)
```

这种构造方式是不正确的，因为：
1. `cacheData` 是一个对象数组 `[{key: "xxx", value: "xxx"}, ...]`
2. `new Map()` 构造函数不能直接接受这种格式的数据
3. 正确的Map构造需要是 `[key, value]` 格式的数组

### 修复方案
```typescript
export const getElementCache = () => {
    var options = {
        'method': 'GET',
        'headers': getNestHeader(),
    }
    var res = http.request(`${nestHostXcx}/api/v1/dictionary/category/hamibot/name/elementCatch`, options as any)
    const data:any = res.body.json()
    // 需要将类型为string的value转换成map
    if(data.code ===0 && data.data.value){
        const cacheData = JSON.parse(data.data.value)
        // 将cacheData转换成map - 修复Map构造方式
        const cacheMap = new Map<string, any>();
        if (Array.isArray(cacheData)) {
            cacheData.forEach((item: any) => {
                if (item && item.key && item.value !== undefined) {
                    cacheMap.set(item.key, item.value);
                }
            });
        }
        console.log('cacheMap', cacheMap)
        return cacheMap
    }else{
        return new Map<string, any>()
    }
}
```

### 修复要点
1. **正确的Map构造**：使用 `new Map()` 创建空Map，然后通过 `set()` 方法添加键值对
2. **数据验证**：检查 `cacheData` 是否为数组，以及每个item是否包含必要的key和value
3. **类型安全**：确保key和value都存在才添加到Map中
4. **错误处理**：如果数据格式不正确，返回空Map

### 数据流程
1. **保存时**：`Map` → `Array.from(entries())` → `JSON.stringify()` → 数据库
2. **读取时**：数据库 → `JSON.parse()` → `Array` → `Map.set()` → `Map`

### 相关文件
- `src/lib/service.ts` - 修复了Map转换逻辑

## 2024-12-19 - Auto.js关闭指定应用实现

### 功能描述
在 `src/toolKit/xianyu/utils/selector.ts` 中实现了 `closeApp` 函数，提供多种方式关闭指定应用。

### 实现方法

#### 方法1: 通过应用设置强制停止
```typescript
// 打开应用设置页面
app.openAppSetting(appName);
sleep(2000);

// 查找并点击"强制停止"按钮
const forceStopBtn = text("强制停止").findOne(3000) || 
                   text("Force Stop").findOne(3000) ||
                   text("停止").findOne(3000);

if (forceStopBtn) {
    forceStopBtn.click();
    sleep(1000);
    
    // 确认强制停止
    const confirmBtn = text("确定").findOne(2000) || 
                     text("OK").findOne(2000) ||
                     text("确认").findOne(2000);
    if (confirmBtn) {
        confirmBtn.click();
        return true;
    }
}
```

#### 方法2: 使用shell命令强制停止
```typescript
// 获取应用包名
const packageName = app.getPackageName(appName);
if (packageName) {
    // 使用adb shell命令强制停止应用
    shell(`am force-stop ${packageName}`, true);
    return true;
}
```

#### 方法3: 通过最近任务列表关闭
```typescript
// 打开最近任务列表
recents();
sleep(1000);

// 查找应用卡片并向上滑动关闭
const appCard = text(appName).findOne(3000);
if (appCard) {
    const bounds = appCard.bounds();
    swipe(bounds.centerX(), bounds.centerY(), bounds.centerX(), bounds.bottom, 500);
    return true;
}
```

### 使用示例
```typescript
// 关闭闲鱼应用
const success = closeApp("闲鱼");
if (success) {
    console.log("成功关闭闲鱼应用");
} else {
    console.log("关闭闲鱼应用失败");
}
```

### 技术特点
1. **多种备选方案**：提供3种不同的关闭方法，提高成功率
2. **错误处理**：每个方法都有独立的try-catch，确保一个方法失败不影响其他方法
3. **多语言支持**：支持中文、英文等多种语言的按钮文本
4. **详细日志**：提供详细的操作日志，便于调试

### 注意事项
- 需要无障碍权限才能使用UI操作
- 某些应用可能有保护机制，无法强制停止
- 建议在使用前检查应用是否正在运行

### 相关文件
- `src/toolKit/xianyu/utils/selector.ts` - 实现了closeApp函数 
 
## 2025-01-18 - selector 严格匹配与误匹配规避

### 背景
`findTargetElementWithCache` 在使用包含匹配时，标题“去浏览全新好物”容易误命中“去浏览全新好物下单”。

### 变更
- 新增 `findTargetElementWithCacheStrict(taskName, title, options)`：
  - 第一步严格等值匹配（忽略前后空白）
  - 第二步包含匹配，但要求以 title 开头，并排除 `excludeContains`（默认含“下单”）
  - 维持缓存、日志与原有策略风格
- 文档：`src/toolKit/xianyu/utils/README.md` 增加使用说明与优化建议

### 使用示例
```typescript
import { findTargetElementWithCacheStrict } from './selector';
const node = findTargetElementWithCacheStrict('taskKey', '去浏览全新好物', {
  excludeContains: ['下单'],
  timeoutEach: 800,
});
```

### 文件
- 更新：`src/toolKit/xianyu/utils/selector.ts`
- 新增：`src/toolKit/xianyu/utils/README.md`

## 2025-01-18 - tryClickNode 方法日志优化

### 背景
`tryClickNode` 方法在执行过程中缺乏详细的日志记录，当点击失败时无法准确定位是在哪个环节出现的问题。

### 问题分析
原代码只有简单的错误日志，缺少：
1. 方法执行的开始和结束标记
2. 每个执行步骤的详细状态
3. 成功操作的确认信息
4. 失败原因的具体说明

### 重要发现
在调试过程中发现了一个关键问题：**`node.clickable` 实际上是一个函数，而不是布尔值属性**。

#### 运行时行为分析
- **类型定义**：`readonly clickable: boolean` - TypeScript 类型定义
- **实际运行时**：`function clickable() { /* boolean clickable() */ }` - 实际是 Java 方法的反射
- **原因**：Hamibot 在某些情况下将 `clickable` 属性包装成了函数，可能是为了提供更好的兼容性或动态计算能力

### 变更内容
为 `src/toolKit/xianyu/utils/common.ts` 中的 `tryClickNode` 方法添加了完整的日志记录和类型兼容处理：

#### 1. 输入验证日志
- 检查传入节点是否为空
- 记录空节点错误

#### 2. 执行步骤日志
- 记录方法开始执行
- 记录节点clickable状态和类型
- 记录直接点击尝试
- 记录父节点查找过程
- 记录坐标点击尝试

#### 3. 结果反馈日志
- 记录每次点击操作的结果
- 记录坐标获取的详细信息
- 记录异常捕获的具体错误信息

#### 4. 类型兼容处理
```typescript
// 获取clickable的实际值（如果是函数则调用，否则直接使用）
const isClickable = typeof node.clickable === 'function' ? (node.clickable as any)() : node.clickable;
Record.log(`tryClickNode: 解析后的clickable值: ${isClickable}`);

// 同样处理父节点的clickable
const parentClickable = typeof parent.clickable === 'function' ? (parent.clickable as any)() : parent.clickable;
```

#### 5. 改进的代码结构
```typescript
export const tryClickNode = (node: UiObject | null | undefined) => {
  if (!node) {
    Record.error('tryClickNode: 传入的节点为空');
    return false;
  }
  
  try {
    Record.log('tryClickNode: 开始尝试点击节点', node);
    
    // 调试：检查clickable的类型和行为
    Record.log(`tryClickNode: 节点clickable类型: ${typeof node.clickable}`);
    Record.log(`tryClickNode: 节点clickable值: ${node.clickable}`);
    
    // 获取clickable的实际值（兼容函数和属性两种情况）
    const isClickable = typeof node.clickable === 'function' ? (node.clickable as any)() : node.clickable;
    
    if (isClickable) {
      // 执行点击逻辑
    }
    
    // ... 其他步骤的详细日志 ...
    
  } catch (e) {
    const errorMsg = (e as any)?.message || e;
    Record.error(`tryClickNode 执行异常: ${errorMsg}`);
    return false;
  }
};
```

### 技术特点
1. **完整的执行追踪**：从方法开始到结束的每个步骤都有日志记录
2. **清晰的状态反馈**：每个操作的结果都有明确的成功/失败反馈
3. **详细的错误信息**：异常情况下提供具体的错误原因
4. **便于调试**：开发人员可以通过日志快速定位问题所在
5. **执行流程清晰**：明确显示每个分支的执行情况和跳过原因
6. **类型兼容性**：自动处理 `clickable` 是函数或属性的两种情况

### 执行流程说明
当节点 `clickable` 为函数时，代码会：
1. 检测到 `clickable` 是函数
2. 调用 `node.clickable()` 获取实际的布尔值
3. 根据返回值决定是否执行直接点击
4. 如果不可点击，继续查找父级可点击节点
5. 如果父节点都不可点击，执行坐标点击

### 使用效果
现在调用 `tryClickNode` 方法时，可以通过日志清楚地知道：
- 方法是否正常启动
- 节点的clickable类型（函数或属性）
- 解析后的clickable值
- 节点是否可点击
- 父节点查找是否成功
- 坐标点击是否执行
- 最终失败的具体原因

### 相关文件
- 更新：`src/toolKit/xianyu/utils/common.ts`

## 2025-01-18 - get100Coin 函数按钮查找优化

### 背景
`get100Coin` 函数中硬编码查找特定按钮文本，当按钮文本发生变化时容易失效，需要更灵活的查找策略。

### 问题分析
原代码存在的问题：
1. **硬编码按钮文本**：只查找 "立即前往加速" 和 "我要直接拿奖励" 两个固定文本
2. **查找策略单一**：如果按钮文本变化，整个功能就会失效
3. **代码重复**：多个 `findTargetElementWithCache` 调用，逻辑分散
4. **维护困难**：新增按钮类型需要修改多处代码

### 变更内容
为 `src/toolKit/xianyu/service/getMainPopup.ts` 中的 `get100Coin` 函数添加了正则表达式查找策略：

#### 1. 按钮模式数组
```typescript
const buttonPatterns = [
  "立即前往加速",
  "我要直接拿奖励", 
  "去加速",
  "加速获取",
  "直接拿奖励",
  "领取奖励"
];
```

#### 2. 正则表达式匹配
```typescript
// 创建正则表达式，匹配任意一个按钮文本
const buttonRegex = new RegExp(`(${buttonPatterns.join('|')})`);
```

#### 3. 循环查找策略
```typescript
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
```

#### 4. 智能等待时间
```typescript
// 根据按钮类型决定等待时间
if (buttonText.includes("加速")) {
  // 等待18s 然后返回到面板
  Record.info("执行加速任务，等待18秒");
  sleep(18000);
} else {
  // 其他任务等待20秒
  Record.info("执行其他任务，等待20秒");
  sleep(20000);
}
```

#### 5. 增强的日志记录
- 记录找到的按钮文本
- 记录任务类型和执行时间
- 记录各种状态的变化

### 技术特点
1. **灵活性**：支持多种按钮文本模式，提高查找成功率
2. **可扩展性**：新增按钮类型只需在数组中添加，无需修改核心逻辑
3. **智能识别**：根据按钮文本自动判断任务类型和等待时间
4. **统一管理**：所有按钮模式集中在一个数组中，便于维护
5. **详细日志**：提供完整的执行过程记录，便于调试

### 使用效果
现在 `get100Coin` 函数能够：
- 自动识别多种类型的按钮
- 根据按钮类型执行相应的等待策略
- 提供详细的执行日志
- 更容易适应界面变化

### 扩展建议
未来可以进一步优化：
1. **配置文件**：将按钮模式配置化，支持动态加载
2. **模糊匹配**：使用更智能的文本匹配算法
3. **机器学习**：基于历史数据自动识别新按钮类型

### 相关文件
- 更新：`src/toolKit/xianyu/service/getMainPopup.ts`