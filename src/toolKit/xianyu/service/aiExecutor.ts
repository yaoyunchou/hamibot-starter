/**
 * AI 决策循环：采集状态 → /api/ai/decide → 执行指令 → /api/ai/report
 */
import { Record } from "../../../lib/logger";
import { getScreenWidth, getScreenHeight } from "../../../lib/screenSize";
import { tryClickNode } from "../utils/common";
import { dumpActiveWindowLayout } from "./layoutDump";
import {
    aiDecide,
    aiOperationComplete,
    aiOperationStart,
    aiReport,
    completeTask,
    createLogs,
} from "../../../lib/service";

/** 与 setRunInfo 同源：写入 logs/device/trace，便于控制台查看 AI 步骤 */
const aiTrace = (action: string) => {
    threads.start(function () {
        try {
            createLogs("trace", {
                time: new Date().toLocaleTimeString("zh-CN"),
                action,
            });
        } catch (_) {}
    });
};

const clip = (s: string, n: number) => {
    if (!s) return "";
    return s.length <= n ? s : s.slice(0, n) + "…";
};

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

export const stopAiLoop = () => {
    _stop = true;
};

const captureScreenshotBase64 = (): string | null => {
    try {
        sleep(200);
        const img = captureScreen();
        if (!img) return null;
        const base64 = (images as any).toBase64(img, "jpg", 60);
        if (typeof (img as any).recycle === "function") (img as any).recycle();
        return base64 as string;
    } catch (e) {
        Record.warn("captureScreenshotBase64: " + e);
        return null;
    }
};

export const captureCurrentState = (opts?: { withScreenshot?: boolean }) => {
    const layout = dumpActiveWindowLayout();
    const shot = opts?.withScreenshot !== false ? captureScreenshotBase64() : null;
    return {
        package: layout.package,
        activity: layout.activity,
        tree: layout.tree,
        screenshot_base64: shot,
    };
};

const findElementMetaByRef = (elements: any[], ref: string) => {
    for (let i = 0; i < elements.length; i++) {
        const e = elements[i];
        if (e && e.ref === ref) return e;
    }
    return null;
};

export const executeAction = (
    instruction: ActionInstruction,
    pageRecognition: any
): { success: boolean; actual_action: string; actual_bounds: number[] | null; error?: string } => {
    const act = (instruction.action || "").toLowerCase();
    const params = instruction.params || {};
    const popups = pageRecognition?.popups || [];

    const centerClick = (bounds: number[]) => {
        if (!bounds || bounds.length < 4) return false;
        const cx = Math.floor((bounds[0] + bounds[2]) / 2);
        const cy = Math.floor((bounds[1] + bounds[3]) / 2);
        return click(cx, cy);
    };

    try {
        if (act === "back") {
            back();
            return { success: true, actual_action: "back", actual_bounds: null };
        }
        if (act === "wait") {
            sleep(Number(params.duration_ms) || 1000);
            return { success: true, actual_action: "wait", actual_bounds: null };
        }
        if (act === "done" || act === "abort") {
            return { success: true, actual_action: act, actual_bounds: null };
        }
        if (act === "swipe") {
            const ok = swipe(
                Number(params.startX),
                Number(params.startY),
                Number(params.endX),
                Number(params.endY),
                Number(params.duration) || 300
            );
            return { success: !!ok, actual_action: "swipe", actual_bounds: null };
        }
        if (act === "scroll_down" || act === "scroll_up") {
            const b = instruction.target_bounds;
            if (b && b.length >= 4) {
                const cx = Math.floor((b[0] + b[2]) / 2);
                const y1 =
                    act === "scroll_down"
                        ? Math.floor(b[1] + (b[3] - b[1]) * 0.75)
                        : Math.floor(b[1] + (b[3] - b[1]) * 0.25);
                const y2 =
                    act === "scroll_down"
                        ? Math.floor(b[1] + (b[3] - b[1]) * 0.25)
                        : Math.floor(b[1] + (b[3] - b[1]) * 0.75);
                swipe(cx, y1, cx, y2, 400);
                return { success: true, actual_action: act, actual_bounds: b };
            }
            const w = getScreenWidth();
            const h = getScreenHeight();
            const cx = Math.floor(w / 2);
            if (act === "scroll_down") swipe(cx, Math.floor(h * 0.7), cx, Math.floor(h * 0.3), 400);
            else swipe(cx, Math.floor(h * 0.3), cx, Math.floor(h * 0.7), 400);
            return { success: true, actual_action: act, actual_bounds: null };
        }
        if (act === "close_popup") {
            for (let i = 0; i < popups.length; i++) {
                const p = popups[i];
                const hint = p?.close_hint;
                const bb = hint?.bounds || p?.bounds;
                if (bb && bb.length >= 4 && centerClick(bb)) {
                    return { success: true, actual_action: "click", actual_bounds: bb };
                }
            }
            return { success: false, actual_action: "close_popup", actual_bounds: null, error: "无关闭区域" };
        }
        if (act === "click" || act === "long_click") {
            const els = pageRecognition?.clickable_elements || [];
            const ref = instruction.target_ref;
            const meta = ref ? findElementMetaByRef(els, ref) : null;
            let bounds = (instruction.target_bounds as number[]) || (meta && meta.bounds) || null;
            if (!bounds && instruction.target_text) {
                const t = String(instruction.target_text);
                try {
                    const w = textContains(t).findOne(2000);
                    if (w) {
                        tryClickNode(w);
                        const b = w.bounds();
                        return {
                            success: true,
                            actual_action: act,
                            actual_bounds: b ? [b.left, b.top, b.right, b.bottom] : null,
                        };
                    }
                } catch (e) {}
            }
            if (bounds && bounds.length >= 4) {
                if (act === "long_click")
                    longClick(
                        Math.floor((bounds[0] + bounds[2]) / 2),
                        Math.floor((bounds[1] + bounds[3]) / 2)
                    );
                else centerClick(bounds);
                return { success: true, actual_action: act, actual_bounds: bounds };
            }
            return { success: false, actual_action: act, actual_bounds: null, error: "无法定位" };
        }
        if (act === "input_text" && params.text) {
            const els = pageRecognition?.clickable_elements || [];
            const ref = instruction.target_ref;
            const meta = ref ? findElementMetaByRef(els, ref) : null;
            if (meta && meta.bounds) {
                const b = meta.bounds;
                click(Math.floor((b[0] + b[2]) / 2), Math.floor((b[1] + b[3]) / 2));
                sleep(300);
            }
            try {
                setText(String(params.text));
            } catch (e) {
                Record.warn("setText " + e);
            }
            return { success: true, actual_action: "input_text", actual_bounds: meta?.bounds || null };
        }
        return { success: false, actual_action: act, actual_bounds: null, error: "未实现" };
    } catch (e) {
        return { success: false, actual_action: act, actual_bounds: null, error: String(e) };
    }
};

/**
 * task.payload: { task_description?, max_steps?, with_screenshot? }
 * onFinished：AI 线程完全退出时调用（用于任务轮询器释放槽位，避免异步执行期间误判空闲）
 */
export const startAiLoop = (task: any, onFinished?: () => void) => {
    _stop = false;
    const payload = task.payload || task.meta || task.extra || {};
    const description = payload.task_description || task.message || "AI 任务";
    const maxSteps = Math.min(Number(payload.max_steps) || 30, 50);
    const withScreenshot = payload.with_screenshot !== false;

    threads.start(function () {
        let opTaskId: string | null = null;
        let screenshotMissingLogged = false;
        try {
            aiTrace(`AI 任务说明: ${clip(description, 120)}`);
            const startRes = aiOperationStart(description, {
                screen: [getScreenWidth(), getScreenHeight()],
            });
            if (startRes && startRes.code === 0 && startRes.data && startRes.data.task_id) {
                opTaskId = startRes.data.task_id;
            }
            Record.info("aiExecutor opTaskId=" + opTaskId);
            aiTrace(`AI 已启动 服务端op=${opTaskId || "无"} 最多${maxSteps}步`);

            let decideFailed = false;
            for (let step = 1; step <= maxSteps && !_stop; step++) {
                const before = captureCurrentState({ withScreenshot: withScreenshot });
                if (withScreenshot && !before.screenshot_base64 && !screenshotMissingLogged) {
                    screenshotMissingLogged = true;
                    aiTrace("AI: 未取到截图(需 Hamibot 截图权限)，仅用无障碍树决策");
                }
                aiTrace(
                    `AI 步${step} 采集中 pkg=${clip(before.package, 40)} act=${clip(before.activity || "", 50)}`
                );
                const decideRes = aiDecide({
                    task: description,
                    tree: before.tree,
                    package: before.package,
                    activity: before.activity,
                    screenshot_base64: before.screenshot_base64 || undefined,
                    task_id: opTaskId || undefined,
                    step_count: step,
                });
                if (!decideRes || decideRes.code !== 0 || !decideRes.data) {
                    Record.error("aiDecide 失败 " + JSON.stringify(decideRes));
                    aiTrace(`AI 步${step} 决策接口失败: ${clip(String(decideRes && decideRes.message || decideRes || "null"), 100)}`);
                    decideFailed = true;
                    break;
                }
                const pageRec = decideRes.data.page_recognition;
                const ins: ActionInstruction = decideRes.data.instruction;
                const action = (ins.action || "").toLowerCase();
                const pageType = pageRec?.page_type || "?";
                aiTrace(
                    `AI 步${step} 识别页=${pageType} 指令=${ins.action || "?"} ref=${ins.target_ref || "-"}`
                );

                if (action === "done") {
                    aiTrace(`AI 步${step} 模型判定任务完成 done`);
                    if (opTaskId) {
                        aiReport(
                            opTaskId,
                            step,
                            { activity: before.activity, package: before.package },
                            ins as any,
                            { success: true, actual_action: "done" },
                            {},
                            {}
                        );
                        aiOperationComplete(opTaskId, "success");
                    }
                    completeTask(task.id, true, "ai_done");
                    return;
                }
                if (action === "abort") {
                    aiTrace(`AI 步${step} 模型中止 abort`);
                    if (opTaskId) aiOperationComplete(opTaskId, "abort");
                    completeTask(task.id, false, "ai_abort");
                    return;
                }

                const exec = executeAction(ins, pageRec);
                aiTrace(
                    `AI 步${step} 执行 ${exec.actual_action} ${exec.success ? "ok" : "失败"}${exec.error ? " " + clip(exec.error, 60) : ""}`
                );
                sleep(Number(ins.wait_after_ms) || 1500);
                const after = captureCurrentState({ withScreenshot: false });

                if (opTaskId) {
                    aiReport(
                        opTaskId,
                        step,
                        {
                            activity: before.activity,
                            package: before.package,
                            page_type: pageRec?.page_type,
                        },
                        ins as any,
                        exec,
                        { activity: after.activity, package: after.package },
                        { expected_met: exec.success }
                    );
                }
            }
            if (decideFailed) {
                aiTrace("AI 结束: 决策接口失败，任务标记为异常");
                if (opTaskId) aiOperationComplete(opTaskId, "error");
                completeTask(task.id, false, "ai_decide_fail");
                return;
            }
            aiTrace(`AI 结束: 已达最大步数 ${maxSteps}`);
            if (opTaskId) aiOperationComplete(opTaskId, "max_steps");
            completeTask(task.id, true, "ai_max_steps");
        } catch (e) {
            Record.error("startAiLoop " + e);
            aiTrace(`AI 异常退出: ${clip(String(e), 120)}`);
            try {
                completeTask(task.id, false, String(e));
            } catch (_) {}
        } finally {
            try {
                if (typeof onFinished === "function") onFinished();
            } catch (_) {}
        }
    });
};
