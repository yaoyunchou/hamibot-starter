"""
AI 操作任务日志：server/data/ai_operations/{task_id}/meta.json + step_NNN.json
"""
from __future__ import annotations

import json
import logging
import shutil
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_DATA = Path(__file__).parent.parent / "data"
_OPS = _DATA / "ai_operations"


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _ensure_dir() -> None:
    _OPS.mkdir(parents=True, exist_ok=True)


def _task_dir(task_id: str) -> Path:
    return _OPS / task_id


def create_task(task_description: str, device_info: Optional[dict[str, Any]] = None) -> str:
    _ensure_dir()
    task_id = f"ai_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    d = _task_dir(task_id)
    d.mkdir(parents=True, exist_ok=True)
    meta = {
        "task_id": task_id,
        "task_description": task_description,
        "started_at": _now(),
        "completed_at": None,
        "total_steps": 0,
        "result": None,
        "device_info": device_info or {},
    }
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("创建 AI 操作任务: %s", task_id)
    return task_id


def _read_meta(task_id: str) -> dict[str, Any]:
    p = _task_dir(task_id) / "meta.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _write_meta(task_id: str, meta: dict[str, Any]) -> None:
    p = _task_dir(task_id) / "meta.json"
    p.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")


def save_step(task_id: str, step_data: dict[str, Any]) -> str:
    d = _task_dir(task_id)
    if not d.is_dir():
        raise FileNotFoundError(f"任务不存在: {task_id}")
    step = int(step_data.get("step") or 1)
    name = f"step_{step:03d}.json"
    path = d / name
    path.write_text(json.dumps(step_data, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = _read_meta(task_id)
    meta["total_steps"] = max(meta.get("total_steps") or 0, step)
    _write_meta(task_id, meta)
    return str(path)


def complete_task(task_id: str, result: str, success: bool = True) -> None:
    meta = _read_meta(task_id)
    if not meta:
        return
    meta["completed_at"] = _now()
    meta["result"] = "success" if success and result == "success" else result
    _write_meta(task_id, meta)


def get_task_history(task_id: str) -> list[dict[str, Any]]:
    d = _task_dir(task_id)
    if not d.is_dir():
        return []
    steps: list[tuple[int, Path]] = []
    for p in d.glob("step_*.json"):
        try:
            n = int(p.stem.split("_")[1])
            steps.append((n, p))
        except (ValueError, IndexError):
            continue
    steps.sort(key=lambda x: x[0])
    out: list[dict[str, Any]] = []
    for _, p in steps:
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception as e:
            logger.warning("读取步骤失败 %s: %s", p, e)
    return out


def get_recent_steps(task_id: str, n: int = 8) -> list[dict[str, Any]]:
    hist = get_task_history(task_id)
    return hist[-n:] if n else hist


def read_task_meta(task_id: str) -> dict[str, Any]:
    p = _task_dir(task_id) / "meta.json"
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def list_tasks(limit: int = 50) -> list[dict[str, Any]]:
    _ensure_dir()
    rows: list[dict[str, Any]] = []
    for child in sorted(_OPS.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if not child.is_dir():
            continue
        meta_path = child / "meta.json"
        if meta_path.exists():
            try:
                m = json.loads(meta_path.read_text(encoding="utf-8"))
                rows.append(m)
            except Exception:
                rows.append({"task_id": child.name, "error": "invalid meta"})
        if len(rows) >= limit:
            break
    return rows


def cleanup_old_tasks(days: int = 30) -> int:
    """删除 completed_at 早于 cutoff 的任务目录。"""
    _ensure_dir()
    cutoff = datetime.now() - timedelta(days=days)
    removed = 0
    for child in _OPS.iterdir():
        if not child.is_dir():
            continue
        meta_path = child / "meta.json"
        try:
            if meta_path.exists():
                m = json.loads(meta_path.read_text(encoding="utf-8"))
                ca = m.get("completed_at") or m.get("started_at")
                if ca:
                    dt = datetime.strptime(ca[:19], "%Y-%m-%d %H:%M:%S")
                    if dt < cutoff:
                        shutil.rmtree(child, ignore_errors=True)
                        removed += 1
        except Exception:
            continue
    return removed
