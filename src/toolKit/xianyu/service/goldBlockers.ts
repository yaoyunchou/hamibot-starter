/**
 * 金币页拦截弹框 — 统一引擎
 *
 * 所有具体弹框定义见 goldBlockerCatalog.ts（声明式规则表）。
 * 主流程各处调用 dismissGoldPageBlockers() 即可，无需再写 runActivePopups 分支。
 */
import { Record } from "../../../lib/logger";
import { setRunInfo } from "./base";
import { buildGoldBlockerRules } from "./goldBlockerCatalog";

export type GoldBlockerRule = {
  id: string;
  enabled?: boolean;
  optional?: boolean;
  detect: () => boolean;
  handle: () => boolean;
};

const _optionalAbsentThisRun = new Set<string>();

export function resetGoldBlockerRunState() {
  _optionalAbsentThisRun.clear();
}

function runDetect(rule: GoldBlockerRule): boolean {
  if (rule.enabled === false) return false;
  if (rule.optional && _optionalAbsentThisRun.has(rule.id)) return false;
  const hit = rule.detect();
  if (!hit && rule.optional) {
    _optionalAbsentThisRun.add(rule.id);
  }
  return hit;
}

/**
 * 扫描并关闭拦截弹框（最多 maxPass 轮，每轮至多处理 1 个）。
 * detect 使用 findOnce，optional 规则每轮运行只探测一次。
 */
export function dismissGoldPageBlockers(maxPass = 3): number {
  const rules = buildGoldBlockerRules();
  let handled = 0;

  for (let pass = 0; pass < maxPass; pass++) {
    if (pass > 0) sleep(400);
    let matched = false;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      try {
        if (!runDetect(rule)) continue;
        setRunInfo(`goldBlocker: 检测到[${rule.id}]`);
        Record.info(`goldBlocker detect: ${rule.id}`);
        if (rule.handle()) {
          handled++;
          matched = true;
          break;
        }
        setRunInfo(`goldBlocker: [${rule.id}] 处理失败，请采集 pages 补充 handle`);
      } catch (e) {
        Record.warn(`goldBlocker[${rule.id}]: ${e}`);
      }
    }
    if (!matched) break;
  }

  if (handled > 0) {
    setRunInfo(`goldBlocker: 共处理 ${handled} 个拦截弹框`);
  }
  return handled;
}
