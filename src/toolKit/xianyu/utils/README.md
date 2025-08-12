# selector 使用与优化建议

## 精准查找避免误匹配

当标题为“去浏览全新好物”时，容易误命中“去浏览全新好物下单”。建议：

1) 首选严格匹配：完全等于目标文案（忽略前后空白）。
2) 其次包含匹配：必须以目标文案开头，且排除黑名单关键字（如“下单”）。

可以使用新增的函数：

```ts
import { findTargetElementWithCacheStrict } from './selector';

const node = findTargetElementWithCacheStrict('taskKey', '去浏览全新好物', {
  excludeContains: ['下单'],
  timeoutEach: 800,
});
```

保持原有缓存与日志能力，同时降低误配概率。

## 其他建议

- 在包含匹配时优先使用 `startsWith(title)` 的候选，区别“标题 + 补充说明”的多个版本。
- 将 `excludeContains` 做为业务层配置（如不同任务的排除词不同）。
- 当命中多个候选时，优先选择可点击且在屏幕中可见的节点（可用 `bounds` 校验）。
- 对高频元素引入 Map 缓存并同步到服务端，减少下一次查找成本（当前已支持）。
