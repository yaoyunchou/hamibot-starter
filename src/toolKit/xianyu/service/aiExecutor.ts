/**
 * AI 决策循环 — v7 版本（async/await）
 */
import { back, click, longClick, select, swipe, takeScreenshot } from 'accessibility';
import { Record } from '../../../lib/logger';
import { getScreenWidth, getScreenHeight } from '../../../lib/screenSize';
import { tryClickNode } from '../utils/common';
import { dumpActiveWindowLayout } from './layoutDump';
import { sleep } from '../../../lib/sleep';
import {
    aiDecide, aiOperationComplete, aiOperationStart, aiReport,
    completeTask, createLogs,
} from '../../../lib/service';

const aiTrace = (action: string) => {
    createLogs('trace', { time: new Date().toLocaleTimeString('zh-CN'), action }).catch(() => {});
};

const clip = (s: string, n: number) => (!s ? '' : s.length <= n ? s : s.slice(0, n) + '…');

export type ActionInstruction = {
    action: string;
    target_ref?: string | null;
    target_bounds?: number[] | null;
    target_text?: string | null;
    params?: { [key: string]: any };
    reasoning?: string;
    expected_result?: string;
    wait_after_ms?: number;
};

let _stop = false;
export const stopAiLoop = () => { _stop = true; };

const captureScreenshotBase64 = async (): Promise<string | null> => {
    try {
        await sleep(200);
        const img = await takeScreenshot();
        if (!img) return null;
        const base64 = typeof (img as any).toBase64 === 'function'
            ? (img as any).toBase64('jpg', 60)
            : null;
        if (typeof (img as any).recycle === 'function') (img as any).recycle();
        return base64 as string;
    } catch (e) {
        Record.warn('captureScreenshotBase64: ' + e);
        return null;
    }
};

export const captureCurrentState = async (opts?: { withScreenshot?: boolean }) => {
    const layout = dumpActiveWindowLayout();
    const shot = opts?.withScreenshot !== false ? await captureScreenshotBase64() : null;
    return { package: layout.package, activity: layout.activity, tree: layout.tree, screenshot_base64: shot };
};

const findElementMetaByRef = (elements: any[], ref: string) =>
    elements.find(e => e && e.ref === ref) ?? null;

export const executeAction = async (
    instruction: ActionInstruction,
    pageRecognition: any
): Promise<{ success: boolean; actual_action: string; actual_bounds: number[] | null; error?: string }> => {
    const act = (instruction.action || '').toLowerCase();
    const params = instruction.params || {};
    const popups = pageRecognition?.popups || [];

    const centerClick = async (bounds: number[]) => {
        if (!bounds || bounds.length < 4) return false;
        return await click(Math.floor((bounds[0] + bounds[2]) / 2), Math.floor((bounds[1] + bounds[3]) / 2));
    };

    try {
        if (act === 'back') {
            await back();
            return { success: true, actual_action: 'back', actual_bounds: null };
        }
        if (act === 'wait') {
            await sleep(Number(params.duration_ms) || 1000);
            return { success: true, actual_action: 'wait', actual_bounds: null };
        }
        if (act === 'done' || act === 'abort') {
            return { success: true, actual_action: act, actual_bounds: null };
        }
        if (act === 'swipe') {
            const ok = await swipe(Number(params.startX), Number(params.startY), Number(params.endX), Number(params.endY), Number(params.duration) || 300);
            return { success: !!ok, actual_action: 'swipe', actual_bounds: null };
        }
        if (act === 'scroll_down' || act === 'scroll_up') {
            const b = instruction.target_bounds;
            if (b && b.length >= 4) {
                const cx = Math.floor((b[0] + b[2]) / 2);
                const y1 = act === 'scroll_down' ? Math.floor(b[1] + (b[3] - b[1]) * 0.75) : Math.floor(b[1] + (b[3] - b[1]) * 0.25);
                const y2 = act === 'scroll_down' ? Math.floor(b[1] + (b[3] - b[1]) * 0.25) : Math.floor(b[1] + (b[3] - b[1]) * 0.75);
                await swipe(cx, y1, cx, y2, 400);
                return { success: true, actual_action: act, actual_bounds: b };
            }
            const w = getScreenWidth(); const h = getScreenHeight(); const cx = Math.floor(w / 2);
            if (act === 'scroll_down') await swipe(cx, Math.floor(h * 0.7), cx, Math.floor(h * 0.3), 400);
            else await swipe(cx, Math.floor(h * 0.3), cx, Math.floor(h * 0.7), 400);
            return { success: true, actual_action: act, actual_bounds: null };
        }
        if (act === 'close_popup') {
            for (const p of popups) {
                const bb = p?.close_hint?.bounds || p?.bounds;
                if (bb && bb.length >= 4 && await centerClick(bb)) {
                    return { success: true, actual_action: 'click', actual_bounds: bb };
                }
            }
            return { success: false, actual_action: 'close_popup', actual_bounds: null, error: '无关闭区域' };
        }
        if (act === 'click' || act === 'long_click') {
            const els = pageRecognition?.clickable_elements || [];
            const ref = instruction.target_ref;
            const meta = ref ? findElementMetaByRef(els, ref) : null;
            let bounds = (instruction.target_bounds as number[]) || (meta && meta.bounds) || null;
            if (!bounds && instruction.target_text) {
                const t = String(instruction.target_text);
                try {
                    const w = select().textContains(t).findOne(2000);
                    if (w) {
                        await tryClickNode(w);
                        const b = w.bounds();
                        return { success: true, actual_action: act, actual_bounds: b ? [b.left, b.top, b.right, b.bottom] : null };
                    }
                } catch {}
            }
            if (bounds && bounds.length >= 4) {
                const cx = Math.floor((bounds[0] + bounds[2]) / 2);
                const cy = Math.floor((bounds[1] + bounds[3]) / 2);
                if (act === 'long_click') await longClick(cx, cy);
                else await centerClick(bounds);
                return { success: true, actual_action: act, actual_bounds: bounds };
            }
            return { success: false, actual_action: act, actual_bounds: null, error: '无法定位' };
        }
        if (act === 'input_text' && params.text) {
            const els = pageRecognition?.clickable_elements || [];
            const ref = instruction.target_ref;
            const meta = ref ? findElementMetaByRef(els, ref) : null;
            if (meta && meta.bounds) {
                const b = meta.bounds;
                await click(Math.floor((b[0] + b[2]) / 2), Math.floor((b[1] + b[3]) / 2));
                await sleep(300);
            }
            try {
                // v7 通过 select().inputText 或 Java 互操作输入文本
                // @ts-ignore
                if (typeof (globalThis as any).setText === 'function') (globalThis as any).setText(String(params.text));
            } catch (e) { Record.warn('setText ' + e); }
            return { success: true, actual_action: 'input_text', actual_bounds: meta?.bounds || null };
        }
        return { success: false, actual_action: act, actual_bounds: null, error: '未实现' };
    } catch (e) {
        return { success: false, actual_action: act, actual_bounds: null, error: String(e) };
    }
};

export const startAiLoop = (task: any, onFinished?: () => void) => {
    _stop = false;
    const payload = task.payload || task.meta || task.extra || {};
    const description = payload.task_description || task.message || 'AI 任务';
    const maxSteps = Math.min(Number(payload.max_steps) || 30, 50);
    const withScreenshot = payload.with_screenshot !== false;

    (async () => {
        let opTaskId: string | null = null;
        let screenshotMissingLogged = false;
        try {
            aiTrace(`AI 任务说明: ${clip(description, 120)}`);
            const startRes = await aiOperationStart(description, { screen: [getScreenWidth(), getScreenHeight()] });
            if (startRes?.code === 0 && startRes?.data?.task_id) opTaskId = startRes.data.task_id;
            Record.info('aiExecutor opTaskId=' + opTaskId);
            aiTrace(`AI 已启动 服务端op=${opTaskId || '无'} 最多${maxSteps}步`);

            let decideFailed = false;
            for (let step = 1; step <= maxSteps && !_stop; step++) {
                const before = await captureCurrentState({ withScreenshot });
                if (withScreenshot && !before.screenshot_base64 && !screenshotMissingLogged) {
                    screenshotMissingLogged = true;
                    aiTrace('AI: 未取到截图，仅用无障碍树决策');
                }
                aiTrace(`AI 步${step} 采集中 pkg=${clip(before.package, 40)}`);
                const decideRes = await aiDecide({
                    task: description, tree: before.tree, package: before.package,
                    activity: before.activity, screenshot_base64: before.screenshot_base64 || undefined,
                    task_id: opTaskId || undefined, step_count: step,
                });
                if (!decideRes || decideRes.code !== 0 || !decideRes.data) {
                    Record.error('aiDecide 失败 ' + JSON.stringify(decideRes));
                    decideFailed = true; break;
                }
                const pageRec = decideRes.data.page_recognition;
                const ins: ActionInstruction = decideRes.data.instruction;
                const action = (ins.action || '').toLowerCase();
                aiTrace(`AI 步${step} 识别页=${pageRec?.page_type || '?'} 指令=${ins.action || '?'}`);

                if (action === 'done') {
                    aiTrace(`AI 步${step} 任务完成`);
                    if (opTaskId) { await aiReport(opTaskId, step, { activity: before.activity, package: before.package }, ins as any, { success: true, actual_action: 'done' }, {}, {}); await aiOperationComplete(opTaskId, 'success'); }
                    await completeTask(task.id, true, 'ai_done');
                    return;
                }
                if (action === 'abort') {
                    aiTrace(`AI 步${step} 中止`);
                    if (opTaskId) await aiOperationComplete(opTaskId, 'abort');
                    await completeTask(task.id, false, 'ai_abort');
                    return;
                }

                const exec = await executeAction(ins, pageRec);
                aiTrace(`AI 步${step} ${exec.actual_action} ${exec.success ? 'ok' : '失败'}`);
                await sleep(Number(ins.wait_after_ms) || 1500);
                const after = await captureCurrentState({ withScreenshot: false });
                if (opTaskId) {
                    await aiReport(opTaskId, step, { activity: before.activity, package: before.package, page_type: pageRec?.page_type }, ins as any, exec, { activity: after.activity, package: after.package }, { expected_met: exec.success });
                }
            }
            if (_stop) { aiTrace('AI 结束: 用户取消'); if (opTaskId) await aiOperationComplete(opTaskId, 'cancelled'); return; }
            if (decideFailed) { aiTrace('AI 结束: 决策失败'); if (opTaskId) await aiOperationComplete(opTaskId, 'error'); await completeTask(task.id, false, 'ai_decide_fail'); return; }
            aiTrace(`AI 结束: 已达最大步数 ${maxSteps}`);
            if (opTaskId) await aiOperationComplete(opTaskId, 'max_steps');
            await completeTask(task.id, true, 'ai_max_steps');
        } catch (e) {
            Record.error('startAiLoop ' + e);
            aiTrace(`AI 异常退出: ${clip(String(e), 120)}`);
            try { await completeTask(task.id, false, String(e)); } catch {}
        } finally {
            try { if (typeof onFinished === 'function') onFinished(); } catch {}
        }
    })();
};
