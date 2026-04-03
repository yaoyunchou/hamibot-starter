"""
AI：页面识别、决策、打标、操作日志。
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core.local_store import read_json, write_json
from services.agents.main_agent import decide_next_action
from services.agents.page_recognizer import recognize_page
from services import operation_logger
from services.tree_analyzer import analyze_layout_tree

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai"])

DEBUG_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "debug"


def _ok(data: Any = None, message: str = "ok") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data}


def _err(message: str, code: int = 1) -> dict[str, Any]:
    return {"code": code, "message": message, "data": None}


# ── Request models ──────────────────────────────────────────


class RecognizeBody(BaseModel):
    package: str = ""
    activity: str = ""
    tree: dict[str, Any]
    screenshot_base64: Optional[str] = None
    save_snapshot: bool = True
    max_depth: int = 8


class DecideBody(BaseModel):
    task: str = ""
    tree: dict[str, Any]
    package: str = ""
    activity: str = ""
    screenshot_base64: Optional[str] = None
    task_id: Optional[str] = None
    step_count: int = 0
    skip_recognize: bool = False
    max_depth: int = 8


class ReportBody(BaseModel):
    task_id: str
    step: int
    before_state: dict[str, Any] = Field(default_factory=dict)
    decision: dict[str, Any] = Field(default_factory=dict)
    execution: dict[str, Any] = Field(default_factory=dict)
    after_state: dict[str, Any] = Field(default_factory=dict)
    evaluation: Optional[dict[str, Any]] = None


class OperationStartBody(BaseModel):
    task_description: str
    device_info: Optional[dict[str, Any]] = None


class OperationCompleteBody(BaseModel):
    task_id: str
    result: str = "success"


class LabelBody(BaseModel):
    id: Optional[str] = None
    page_type: str
    page_name: str = ""
    activity: str = ""
    fingerprint: str = ""
    features: Optional[dict[str, Any]] = None
    has_popup: bool = False
    popups: list[Any] = Field(default_factory=list)


class LabelFromDebugBody(BaseModel):
    debug_cmd_id: str
    page_type: str
    page_name: str = ""
    has_popup: bool = False
    popups: list[Any] = Field(default_factory=list)


class ConfirmReviewBody(BaseModel):
    page_type: str
    page_name: str = ""
    has_popup: bool = False
    popups: list[Any] = Field(default_factory=list)


# ── Recognize / Decide ───────────────────────────────────────


@router.post("/ai/recognize")
async def api_recognize(body: RecognizeBody):
    try:
        result = recognize_page(
            body.package or "unknown",
            body.activity or "",
            body.tree,
            screenshot_base64=body.screenshot_base64,
            save_snapshot=body.save_snapshot,
            max_depth=body.max_depth,
        )
        return _ok(result)
    except Exception as e:
        logger.exception("recognize")
        return _err(str(e))


@router.post("/ai/decide")
async def api_decide(body: DecideBody):
    try:
        analyzed = analyze_layout_tree(body.tree, max_depth=body.max_depth)
        compressed = analyzed["compressed_text"]
        elements = [e for e in analyzed["actionable_elements"]]
        from services.tree_analyzer import tree_to_json_serializable_elements

        el_json = tree_to_json_serializable_elements(elements)

        if body.skip_recognize:
            page_rec = {
                "page_type": "unknown",
                "page_name": "",
                "confidence": 0.0,
                "has_popup": False,
                "popups": [],
                "clickable_elements": el_json,
                "fingerprint": analyzed["fingerprint"],
                "source": "skipped",
            }
        else:
            page_rec = recognize_page(
                body.package or "unknown",
                body.activity or "",
                body.tree,
                screenshot_base64=body.screenshot_base64,
                save_snapshot=True,
                max_depth=body.max_depth,
            )

        hist: list[dict[str, Any]] = []
        if body.task_id:
            hist = operation_logger.get_recent_steps(body.task_id, 12)

        instruction = decide_next_action(
            task=body.task or "",
            page_recognition=page_rec,
            clickable_elements=page_rec.get("clickable_elements") or el_json,
            compressed_tree=compressed,
            screenshot_base64=body.screenshot_base64,
            history=hist,
            step_count=body.step_count,
        )

        return _ok(
            {
                "page_recognition": page_rec,
                "compressed_tree": compressed,
                "instruction": instruction,
                "fingerprint": analyzed["fingerprint"],
            }
        )
    except Exception as e:
        logger.exception("decide")
        return _err(str(e))


@router.post("/ai/report")
async def api_report(body: ReportBody):
    try:
        step_data = {
            "step": body.step,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "before_state": body.before_state,
            "decision": body.decision,
            "execution": body.execution,
            "after_state": body.after_state,
            "evaluation": body.evaluation or {},
        }
        path = operation_logger.save_step(body.task_id, step_data)
        return _ok({"saved": path})
    except Exception as e:
        logger.exception("report")
        return _err(str(e))


# ── Operation log ─────────────────────────────────────────────


@router.post("/ai/operation/start")
async def op_start(body: OperationStartBody):
    try:
        tid = operation_logger.create_task(body.task_description, body.device_info)
        return _ok({"task_id": tid})
    except Exception as e:
        return _err(str(e))


@router.post("/ai/operation/complete")
async def op_complete(body: OperationCompleteBody):
    try:
        operation_logger.complete_task(body.task_id, body.result)
        return _ok({"task_id": body.task_id})
    except Exception as e:
        return _err(str(e))


@router.get("/ai/operations")
async def op_list(limit: int = 50):
    return _ok(operation_logger.list_tasks(limit))


@router.get("/ai/operation/{task_id}")
async def op_get(task_id: str):
    meta = operation_logger.read_task_meta(task_id)
    if not meta:
        raise HTTPException(404, "任务不存在")
    steps = operation_logger.get_task_history(task_id)
    return _ok({"meta": meta, "steps": steps})


@router.get("/ai/operation/{task_id}/replay")
async def op_replay(task_id: str):
    steps = operation_logger.get_task_history(task_id)
    return _ok({"task_id": task_id, "steps": steps})


# ── Labels ──────────────────────────────────────────────────


def _ensure_label_store() -> None:
    p = Path(__file__).resolve().parent.parent / "data" / "page_labels.json"
    if not p.exists():
        write_json("page_labels", [])


def _ensure_pending_store() -> None:
    p = Path(__file__).resolve().parent.parent / "data" / "pending_reviews.json"
    if not p.exists():
        write_json("pending_reviews", [])


@router.get("/ai/labels")
async def labels_list():
    _ensure_label_store()
    data = read_json("page_labels")
    return _ok(data if isinstance(data, list) else [])


@router.post("/ai/label")
async def label_upsert(body: LabelBody):
    _ensure_label_store()
    rows = read_json("page_labels")
    if not isinstance(rows, list):
        rows = []
    lid = body.id or f"label_{uuid.uuid4().hex[:10]}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = {
        "id": lid,
        "page_type": body.page_type,
        "page_name": body.page_name or body.page_type,
        "activity": body.activity,
        "fingerprint": body.fingerprint,
        "features": body.features or {},
        "has_popup": body.has_popup,
        "popups": body.popups,
        "created_at": now,
        "source": "human",
    }
    replaced = False
    for i, r in enumerate(rows):
        if isinstance(r, dict) and r.get("id") == lid:
            entry["created_at"] = r.get("created_at", now)
            rows[i] = entry
            replaced = True
            break
    if not replaced:
        rows.append(entry)
    write_json("page_labels", rows)
    return _ok(entry)


@router.delete("/ai/label/{label_id}")
async def label_delete(label_id: str):
    _ensure_label_store()
    rows = read_json("page_labels")
    if not isinstance(rows, list):
        rows = []
    new_rows = [r for r in rows if isinstance(r, dict) and r.get("id") != label_id]
    write_json("page_labels", new_rows)
    return _ok({"deleted": label_id})


@router.post("/ai/label/from-debug")
async def label_from_debug(body: LabelFromDebugBody):
    """从 data/debug 下查找 debug 指令 id 对应的 JSON，读取 result.tree 计算指纹并写入标注。"""
    _ensure_label_store()
    found: Optional[Path] = None
    needle = body.debug_cmd_id.strip()
    for day_dir in sorted(DEBUG_DATA_DIR.glob("*"), reverse=True):
        if not day_dir.is_dir():
            continue
        for f in day_dir.glob("*.json"):
            try:
                doc = json.loads(f.read_text(encoding="utf-8"))
                if doc.get("id") == needle:
                    found = f
                    break
            except Exception:
                continue
        if found:
            break
    if not found or not found.exists():
        return _err(f"未找到调试记录: {body.debug_cmd_id}")

    raw = json.loads(found.read_text(encoding="utf-8"))
    result = raw.get("result") or {}
    tree = result.get("tree")
    if not tree:
        return _err("该调试记录无 layout tree")

    analyzed = analyze_layout_tree(tree, max_depth=12)
    fp = analyzed["fingerprint"]
    act = result.get("activity") or ""

    rows = read_json("page_labels")
    if not isinstance(rows, list):
        rows = []
    lid = f"label_{uuid.uuid4().hex[:10]}"
    entry = {
        "id": lid,
        "page_type": body.page_type,
        "page_name": body.page_name or body.page_type,
        "activity": act,
        "fingerprint": fp,
        "features": {},
        "has_popup": body.has_popup,
        "popups": body.popups,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": "from_debug",
        "debug_file": str(found.name),
    }
    rows.append(entry)
    write_json("page_labels", rows)
    return _ok(entry)


@router.get("/ai/pending-reviews")
async def pending_list():
    _ensure_pending_store()
    data = read_json("pending_reviews")
    return _ok(data if isinstance(data, list) else [])


@router.post("/ai/confirm-review/{review_id}")
async def pending_confirm(review_id: str, body: ConfirmReviewBody):
    _ensure_pending_store()
    rows = read_json("pending_reviews")
    if not isinstance(rows, list):
        rows = []
    target: Optional[dict[str, Any]] = None
    for r in rows:
        if isinstance(r, dict) and r.get("id") == review_id:
            target = r
            break
    if not target:
        return _err("记录不存在")

    rest = [r for r in rows if isinstance(r, dict) and r.get("id") != review_id]

    _ensure_label_store()
    labels = read_json("page_labels")
    if not isinstance(labels, list):
        labels = []
    lid = f"label_{uuid.uuid4().hex[:10]}"
    entry = {
        "id": lid,
        "page_type": body.page_type,
        "page_name": body.page_name or body.page_type,
        "activity": target.get("activity") or "",
        "fingerprint": target.get("fingerprint") or "",
        "features": {},
        "has_popup": body.has_popup,
        "popups": body.popups,
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source": "human_confirm",
    }
    labels.append(entry)
    write_json("page_labels", labels)
    write_json("pending_reviews", rest)
    return _ok({"label": entry, "removed_review": review_id})
