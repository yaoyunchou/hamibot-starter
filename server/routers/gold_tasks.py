"""
金币任务状态管理（按日期存储）

GET   /api/gold/tasks              — 获取今日任务列表
POST  /api/gold/tasks/sync         — 设备同步当前任务状态
POST  /api/gold/tasks/add          — 添加自定义任务条目
PATCH /api/gold/task/{title}/reset — 重置单个任务执行标志
POST  /api/gold/tasks/reset-all    — 重置全部任务
"""
import logging
import urllib.parse
from datetime import datetime
from typing import Any, Optional, List

from fastapi import APIRouter
from pydantic import BaseModel

from core.local_store import read_json, write_json

logger = logging.getLogger(__name__)
router = APIRouter(tags=["gold"])

STORE = "gold_tasks"


# ─────────────────────────── helpers ───────────────────────────

def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _now_time() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _read_all() -> dict:
    data = read_json(STORE)
    return data if isinstance(data, dict) else {}


def _read_today() -> list:
    return _read_all().get(_today(), {}).get("tasks", [])


def _write_today(tasks: list):
    data = _read_all()
    date = _today()
    if date not in data:
        data[date] = {}
    data[date]["tasks"] = tasks
    write_json(STORE, data)


# ─────────────────────────── Models ───────────────────────────

class TaskSyncItem(BaseModel):
    title: str
    hasRun: bool = False
    rewardVerified: Optional[bool] = None
    failCount: int = 0
    lastResult: Optional[str] = None          # "done" | "failed"
    failRecords: Optional[List[Any]] = None


class SyncBody(BaseModel):
    tasks: List[TaskSyncItem]


class AddTaskBody(BaseModel):
    title: str


# ─────────────────────────── Routes ───────────────────────────

@router.get("/gold/tasks")
async def get_gold_tasks():
    """返回今日金币任务列表及汇总统计"""
    tasks = _read_today()
    total  = len(tasks)
    done   = sum(1 for t in tasks if t.get("hasRun"))
    failed = sum(1 for t in tasks if not t.get("hasRun") and t.get("failCount", 0) > 0)
    return {
        "code": 0,
        "date": _today(),
        "data": tasks,
        "stats": {"total": total, "done": done, "failed": failed, "pending": total - done - failed},
    }


@router.post("/gold/tasks/sync")
async def sync_gold_tasks(body: SyncBody):
    """
    设备在每个任务结束后调用，合并更新今日任务状态。
    已存在的条目按 title 合并，新条目追加。
    """
    existing = _read_today()
    title_map: dict = {t["title"]: t for t in existing}

    for item in body.tasks:
        d = item.dict()
        d["lastUpdated"] = _now_time()
        # 保留 custom 标记（用户手动添加的条目）
        if item.title in title_map:
            d["custom"] = title_map[item.title].get("custom", False)
        title_map[item.title] = d

    _write_today(list(title_map.values()))
    logger.info("gold task sync: %d tasks", len(title_map))
    return {"code": 0, "message": f"已同步 {len(body.tasks)} 个任务"}


@router.post("/gold/tasks/add")
async def add_gold_task(body: AddTaskBody):
    """从 Web 端手动添加一个任务条目（custom=True）"""
    if not body.title.strip():
        return {"code": 1, "message": "任务名称不能为空"}
    tasks = _read_today()
    for t in tasks:
        if t.get("title") == body.title:
            return {"code": 1, "message": "任务已存在"}
    tasks.append({
        "title": body.title.strip(),
        "hasRun": False,
        "rewardVerified": None,
        "failCount": 0,
        "lastResult": None,
        "lastUpdated": _now_time(),
        "custom": True,
        "failRecords": [],
    })
    _write_today(tasks)
    logger.info("gold task added: %s", body.title)
    return {"code": 0, "message": "已添加"}


@router.patch("/gold/task/{title}/reset")
async def reset_gold_task(title: str):
    """重置单个任务的执行标记，允许下次运行时重新执行"""
    decoded = urllib.parse.unquote(title)
    tasks = _read_today()
    for t in tasks:
        if t.get("title") == decoded:
            t["hasRun"] = False
            t["rewardVerified"] = None
            t["lastResult"] = None
            t["failCount"] = 0
            t["failRecords"] = []
            t["lastUpdated"] = _now_time()
            _write_today(tasks)
            return {"code": 0, "message": f"已重置：{decoded}"}
    return {"code": 1, "message": "任务不存在"}


@router.post("/gold/tasks/reset-all")
async def reset_all_gold_tasks():
    """重置今日全部任务的执行标记"""
    tasks = _read_today()
    for t in tasks:
        t["hasRun"] = False
        t["rewardVerified"] = None
        t["lastResult"] = None
        t["failCount"] = 0
        t["failRecords"] = []
        t["lastUpdated"] = _now_time()
    _write_today(tasks)
    return {"code": 0, "message": f"已重置 {len(tasks)} 个任务"}
