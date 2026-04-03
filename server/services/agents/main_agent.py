"""
Agent 2：根据任务与当前页面状态，生成下一条可执行操作指令。
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from core.config import settings
from services import ai_client

logger = logging.getLogger(__name__)

DECIDE_SYSTEM = """你是闲鱼 App 自动化执行决策器。你只能从给定的「可交互元素列表」中选择目标，或选择系统级操作（返回、等待、完成、中止）。

操作类型 action 必须是：
- click — 点击某元素，需提供 target_ref（如 C03）或 target_text / target_bounds
- long_click
- scroll_down / scroll_up — 在目标区域滚动，需 target_ref 或 target_bounds
- swipe — params: startX,startY,endX,endY,duration
- back — 系统返回键
- wait — params.duration_ms
- close_popup — 关闭弹层（优先用页面识别给出的弹窗关闭区域）
- input_text — params.text，需 target_ref 指向输入框
- done — 任务已完成
- abort — 无法继续

输出严格 JSON：
{
  "action": "...",
  "target_ref": "C01" 或 null,
  "target_bounds": [l,t,r,b] 或 null,
  "target_text": "按钮文案片段" 或 null,
  "params": {},
  "reasoning": "...",
  "expected_result": "...",
  "fallback": null,
  "wait_after_ms": 1500
}

防呆：若历史显示连续 3 次相同 action+target，请改换策略；若 step_count>30 请优先 abort 或 done。"""


def decide_next_action(
    task: str,
    page_recognition: dict[str, Any],
    clickable_elements: list[dict[str, Any]],
    compressed_tree: str,
    screenshot_base64: Optional[str] = None,
    history: Optional[list[dict[str, Any]]] = None,
    step_count: int = 0,
) -> dict[str, Any]:
    hist = history or []
    hist_lines: list[str] = []
    for h in hist[-8:]:
        dec = h.get("decision") or h.get("decision_summary") or {}
        hist_lines.append(
            json.dumps(
                {
                    "step": h.get("step"),
                    "action": dec.get("action"),
                    "target_ref": dec.get("target_ref"),
                    "success": (h.get("execution") or {}).get("success"),
                },
                ensure_ascii=False,
            )
        )

    el_lines = []
    for e in clickable_elements[:80]:
        el_lines.append(
            f"[{e.get('ref')}] {e.get('action_type')} text={str(e.get('text'))[:30]} bounds={e.get('bounds')} → {e.get('predicted_effect')}"
        )

    user = f"""任务: {task or settings.DEFAULT_TASK}
当前步数: {step_count}

--- 页面识别 ---
{json.dumps(page_recognition, ensure_ascii=False)[:12000]}

--- 最近操作 ---
{chr(10).join(hist_lines) if hist_lines else "(无)"}

--- 可交互元素 ---
{chr(10).join(el_lines)}

--- 布局摘要 ---
{compressed_tree[:25000]}
"""

    messages = [
        {"role": "system", "content": DECIDE_SYSTEM},
        {"role": "user", "content": user},
    ]

    try:
        if screenshot_base64:
            raw = ai_client.chat_with_image(messages, screenshot_base64, json_mode=True)
        else:
            raw = ai_client.chat(messages, json_mode=True)
        data = ai_client.parse_json_loose(raw)
    except Exception as e:
        logger.exception("决策 AI 失败: %s", e)
        return {
            "action": "abort",
            "target_ref": None,
            "target_bounds": None,
            "target_text": None,
            "params": {},
            "reasoning": f"决策服务异常: {e}",
            "expected_result": "",
            "fallback": None,
            "wait_after_ms": 0,
        }

    return {
        "action": str(data.get("action") or "wait"),
        "target_ref": data.get("target_ref"),
        "target_bounds": data.get("target_bounds"),
        "target_text": data.get("target_text"),
        "params": data.get("params") if isinstance(data.get("params"), dict) else {},
        "reasoning": str(data.get("reasoning") or ""),
        "expected_result": str(data.get("expected_result") or ""),
        "fallback": data.get("fallback"),
        "wait_after_ms": int(data.get("wait_after_ms") or 1500),
    }
