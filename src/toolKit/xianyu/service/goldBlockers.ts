/**
 * 金币页拦截弹框 — 统一引擎
 *
 * 所有具体弹框定义见 goldBlockerCatalog.ts（声明式规则表）。
 * 主流程各处调用 dismissGoldPageBlockers() 即可，无需再写 runActivePopups 分支。
 */
import { sleep } from '../../../lib/sleep';
import { Record } from "../../../lib/logger";
import { setRunInfo } from "./base";
import { buildGoldBlockerRules } from "./goldBlockerCatalog";

export type GoldBlockerRule = {
  id: string;
  enabled?: boolean;
  optional?: boolean;
  detect: () => boolean | Promise<boolean>;
  handle: () => boolean | Promise<boolean>;
};

const _optionalAbsentThisRun = new Set<string>();

export function resetGoldBlockerRunState() {
  _optionalAbsentThisRun.clear();
}

async function runDetect(rule: GoldBlockerRule): Promise<boolean> {
  if (rule.enabled === false) return false;
  if (rule.optional && _optionalAbsentThisRun.has(rule.id)) return false;
  const hit = await rule.detect();
  if (!hit && rule.optional) {
    _optionalAbsentThisRun.add(rule.id);
  }
  return !!hit;
}

/**
 * 扫描并关闭拦截弹框（最多 maxPass 轮，每轮至多处理 1 个）。
 */
export async function dismissGoldPageBlockers(maxPass = 3): Promise<number> {
  const rules = buildGoldBlockerRules();
  let handled = 0;

  for (let pass = 0; pass < maxPass; pass++) {
    if (pass > 0) await sleep(400);
    let matched = false;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      try {
        if (!await runDetect(rule)) continue;
        setRunInfo(`goldBlocker: 检测到[${rule.id}]`);
        Record.info(`goldBlocker detect: ${rule.id}`);
        if (await rule.handle()) {
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
