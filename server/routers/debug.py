"""
远程调试工具 — 向 Hamibot 客户端下发调试指令并收集结果

指令 API:
  POST   /api/debug/command           — 创建调试指令（Dashboard 调用）
  GET    /api/debug/commands           — 查询指令列表（含结果）
  POST   /api/debug/commands/poll      — 客户端轮询待执行指令（POST，兼容 Hamibot）
  PUT    /api/debug/command/{cmd_id}  — 客户端上报执行结果
  GET    /api/debug/command/{cmd_id}  — 查询单条指令详情（Dashboard 轮询结果用）
  DELETE /api/debug/commands           — 清空全部指令记录
"""
import json
import uuid
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.local_store import read_json, write_json

logger = logging.getLogger(__name__)
router = APIRouter(tags=["debug"])

STORE_NAME = "debug_commands"
AUTO_CLEAN_HOURS = 1

DEBUG_DATA_DIR = Path(__file__).parent.parent / "data" / "debug"


# ─────────────────────────── helpers ───────────────────────────

def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _read_commands() -> list:
    data = read_json(STORE_NAME)
    return data if isinstance(data, list) else []


def _write_commands(commands: list):
    write_json(STORE_NAME, commands)


def _save_raw_result(cmd: dict):
    """将指令的完整原始数据持久化到 data/debug/YYYY-MM-DD/{type}_{HHmmss}_{id[:8]}.json"""
    try:
        day_dir = DEBUG_DATA_DIR / datetime.now().strftime("%Y-%m-%d")
        day_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%H%M%S")
        short_id = cmd.get("id", "unknown")[:8]
        filename = f"{cmd.get('type', 'unknown')}_{ts}_{short_id}.json"
        filepath = day_dir / filename
        filepath.write_text(
            json.dumps(cmd, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("调试结果已保存: %s", filepath)
    except Exception as e:
        logger.error("保存调试结果失败: %s", e)


def _auto_clean(commands: list) -> list:
    """清理超过 AUTO_CLEAN_HOURS 小时的已完成/已失败指令"""
    cutoff = datetime.now() - timedelta(hours=AUTO_CLEAN_HOURS)
    kept = []
    for cmd in commands:
        if cmd.get("status") in ("completed", "error"):
            try:
                created = datetime.strptime(cmd["created_at"], "%Y-%m-%d %H:%M:%S")
                if created < cutoff:
                    continue
            except Exception:
                pass
        kept.append(cmd)
    return kept


# ─────────────────────────── Models ───────────────────────────

VALID_TYPES = {"element", "script", "screenshot", "page_info", "layout"}


class CommandBody(BaseModel):
    type: str
    params: Optional[dict[str, Any]] = None


class CommandResultBody(BaseModel):
    status: str                        # completed | error
    result: Optional[Any] = None
    error: Optional[str] = None


class PollBody(BaseModel):
    limit: int = 1


# ─────────────────────────── Routes ───────────────────────────

@router.post("/debug/command")
async def create_command(body: CommandBody):
    if body.type not in VALID_TYPES:
        return {"code": 1, "message": f"不支持的指令类型: {body.type}，可选: {', '.join(sorted(VALID_TYPES))}"}

    commands = _auto_clean(_read_commands())

    cmd = {
        "id": str(uuid.uuid4()),
        "type": body.type,
        "params": body.params or {},
        "status": "pending",
        "created_at": _now(),
        "completed_at": None,
        "result": None,
        "error": None,
    }
    commands.append(cmd)
    _write_commands(commands)
    logger.info("新调试指令: %s (%s)", cmd["id"], cmd["type"])
    return {"code": 0, "message": "指令已创建", "data": cmd}


@router.get("/debug/commands")
async def get_commands(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
):
    commands = _read_commands()
    if status:
        statuses = status.split(",")
        commands = [c for c in commands if c.get("status") in statuses]
    commands = sorted(commands, key=lambda c: c.get("created_at", ""), reverse=True)
    return {"code": 0, "data": commands[:limit], "total": len(commands)}


@router.post("/debug/commands/poll")
async def poll_commands(body: PollBody):
    """客户端轮询：返回 pending 状态的指令（按创建时间正序，先进先出）"""
    commands = _read_commands()
    pending = [c for c in commands if c.get("status") == "pending"]
    pending = sorted(pending, key=lambda c: c.get("created_at", ""))
    return {"code": 0, "data": pending[: body.limit]}


@router.get("/debug/command/{cmd_id}")
async def get_command(cmd_id: str):
    commands = _read_commands()
    for cmd in commands:
        if cmd.get("id") == cmd_id:
            return {"code": 0, "data": cmd}
    raise HTTPException(status_code=404, detail="指令不存在")


@router.put("/debug/command/{cmd_id}")
async def update_command(cmd_id: str, body: CommandResultBody):
    """客户端上报执行结果（或认领时先标记为 running）"""
    commands = _read_commands()
    for cmd in commands:
        if cmd.get("id") == cmd_id:
            cmd["status"] = body.status
            if body.result is not None:
                cmd["result"] = body.result
            if body.error is not None:
                cmd["error"] = body.error
            if body.status in ("completed", "error"):
                cmd["completed_at"] = _now()
                _save_raw_result(cmd)
            _write_commands(commands)
            return {"code": 0, "message": "已更新", "data": cmd}
    raise HTTPException(status_code=404, detail="指令不存在")


@router.delete("/debug/commands")
async def clear_commands():
    commands = _read_commands()
    count = len(commands)
    _write_commands([])
    return {"code": 0, "message": f"已清空 {count} 条指令"}
