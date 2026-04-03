"""
Agent 1：页面识别（指纹匹配 → AI → 待人工确认队列）。
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from core.config import settings
from core.local_store import read_json, write_json
from services import ai_client
from services.tree_analyzer import (
    ActionableElement,
    analyze_layout_tree,
    tree_to_json_serializable_elements,
)

logger = logging.getLogger(__name__)

PAGE_LABELS_STORE = "page_labels"
PENDING_REVIEWS_STORE = "pending_reviews"
_SNAPSHOT_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "page_snapshots"

SYSTEM = """你是闲鱼 Android 客户端界面分析助手。根据无障碍布局树摘要与可交互元素列表（及可选截图），判断当前页面类型与是否存在弹层。

页面类型 page_type 必须是以下之一：
- home（首页 Tab 为主）
- my_page（「我的」个人中心）
- product_detail（商品详情）
- gold_coin（金币/任务类 WebView 活动页）
- comment（评价/订单相关）
- unknown（无法判断）

输出严格 JSON，字段：
{
  "page_type": "...",
  "page_name": "简短中文名",
  "confidence": 0.0-1.0,
  "has_popup": true/false,
  "popups": [{"popup_type":"ad|reward|confirm|guide|unknown","description":"...","bounds":[l,t,r,b]或null}],
  "reasoning": "一句话理由"
}
弹窗 bounds 若无法从结构确定可为 null。confidence 表示你对 page_type 的把握。"""


def _labels() -> list[dict[str, Any]]:
    data = read_json(PAGE_LABELS_STORE)
    return data if isinstance(data, list) else []


def _save_labels(rows: list[dict[str, Any]]) -> None:
    write_json(PAGE_LABELS_STORE, rows)


def _pending() -> list[dict[str, Any]]:
    data = read_json(PENDING_REVIEWS_STORE)
    return data if isinstance(data, list) else []


def _save_pending(rows: list[dict[str, Any]]) -> None:
    write_json(PENDING_REVIEWS_STORE, rows)


def _match_fingerprint(fingerprint: str, _activity: str) -> Optional[dict[str, Any]]:
    for row in _labels():
        if row.get("fingerprint") == fingerprint:
            return row
    return None


def _save_snapshot(
    fingerprint: str,
    package: str,
    activity: str,
    compressed_text: str,
    elements: list[dict[str, Any]],
    recognition: dict[str, Any],
) -> None:
    _SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{fingerprint[:16]}_{datetime.now().strftime('%H%M%S')}_{uuid.uuid4().hex[:6]}.json"
    path = _SNAPSHOT_DIR / name
    path.write_text(
        json.dumps(
            {
                "package": package,
                "activity": activity,
                "fingerprint": fingerprint,
                "compressed_tree": compressed_text[:200000],
                "actionable_elements": elements,
                "recognition": recognition,
                "saved_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def _push_pending(
    fingerprint: str,
    activity: str,
    package: str,
    ai_guess: dict[str, Any],
    elements: list[dict[str, Any]],
    compressed_text: str,
) -> str:
    rid = f"review_{uuid.uuid4().hex[:12]}"
    row = {
        "id": rid,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "package": package,
        "activity": activity,
        "fingerprint": fingerprint,
        "ai_guess": ai_guess,
        "clickable_elements": elements,
        "compressed_tree_excerpt": compressed_text[:8000],
        "status": "pending",
    }
    rows = _pending()
    rows.insert(0, row)
    _save_pending(rows[:200])
    return rid


def recognize_page(
    package: str,
    activity: str,
    tree: dict[str, Any],
    screenshot_base64: Optional[str] = None,
    save_snapshot: bool = True,
    max_depth: int = 8,
) -> dict[str, Any]:
    analyzed = analyze_layout_tree(tree, max_depth=max_depth)
    fingerprint = analyzed["fingerprint"]
    compressed_text = analyzed["compressed_text"]
    elements: list[ActionableElement] = analyzed["actionable_elements"]
    el_json = tree_to_json_serializable_elements(elements)
    actionable_lines = analyzed["actionable_lines"]

    matched = _match_fingerprint(fingerprint, activity)
    if matched:
        out = {
            "page_type": matched.get("page_type") or "unknown",
            "page_name": matched.get("page_name") or "",
            "confidence": 1.0,
            "has_popup": bool(matched.get("has_popup")),
            "popups": matched.get("popups") or [],
            "clickable_elements": el_json,
            "fingerprint": fingerprint,
            "source": "fingerprint",
            "need_human_confirm": False,
            "compressed_tree": compressed_text,
            "activity": activity,
            "package": package,
        }
        if save_snapshot:
            _save_snapshot(fingerprint, package, activity, compressed_text, el_json, out)
        return out

    user_text = f"""package: {package}
activity: {activity}

--- 布局压缩树 ---
{compressed_text[:40000]}

--- {actionable_lines[:20000]}
"""

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": user_text},
    ]

    try:
        if screenshot_base64:
            raw = ai_client.chat_with_image(
                messages,
                screenshot_base64,
                json_mode=True,
            )
        else:
            raw = ai_client.chat(messages, json_mode=True)
        parsed = ai_client.parse_json_loose(raw)
    except Exception as e:
        logger.exception("页面识别 AI 失败: %s", e)
        parsed = {
            "page_type": "unknown",
            "page_name": "识别失败",
            "confidence": 0.0,
            "has_popup": False,
            "popups": [],
            "reasoning": str(e),
        }

    conf = float(parsed.get("confidence") or 0)
    if conf > 1.0:
        conf = 1.0
    if conf < 0:
        conf = 0.0

    need_human = conf < 0.8 or (parsed.get("page_type") or "").lower() == "unknown"
    review_id = None
    if need_human:
        review_id = _push_pending(
            fingerprint,
            activity,
            package,
            {"page_type": parsed.get("page_type"), "confidence": conf},
            el_json,
            compressed_text,
        )

    out = {
        "page_type": parsed.get("page_type") or "unknown",
        "page_name": parsed.get("page_name") or "",
        "confidence": conf,
        "has_popup": bool(parsed.get("has_popup")),
        "popups": parsed.get("popups") or [],
        "clickable_elements": el_json,
        "fingerprint": fingerprint,
        "source": "ai",
        "need_human_confirm": need_human,
        "pending_review_id": review_id,
        "reasoning": parsed.get("reasoning") or "",
        "compressed_tree": compressed_text,
        "activity": activity,
        "package": package,
    }

    if save_snapshot:
        _save_snapshot(fingerprint, package, activity, compressed_text, el_json, out)

    return out
