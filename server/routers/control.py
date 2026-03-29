"""
控制面板 — 任务队列 & 预警管理

任务 API:
  GET  /api/control/tasks              — 查询任务列表（?status=pending|running|completed|timeout|error）
  POST /api/control/task               — 新增任务（控制台/外部触发）
  PUT  /api/control/task/{task_id}     — 更新任务状态（客户端上报）
  DELETE /api/control/task/{task_id}   — 删除单个任务

预警 API:
  GET  /api/control/alerts             — 获取预警列表（?acknowledged=false）
  POST /api/control/alert              — 客户端上报预警
  PUT  /api/control/alert/{alert_id}   — 确认/消除预警
"""
import uuid
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.local_store import read_json, write_json

logger = logging.getLogger(__name__)
router = APIRouter(tags=["control"])

TASK_STORE = "tasks"
ALERT_STORE = "alerts"
MAX_TASK_DURATION_MINUTES = 60


# ─────────────────────────── helpers ───────────────────────────

def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _read_tasks() -> list:
    data = read_json(TASK_STORE)
    return data if isinstance(data, list) else []


def _write_tasks(tasks: list):
    write_json(TASK_STORE, tasks)


def _read_alerts() -> list:
    data = read_json(ALERT_STORE)
    return data if isinstance(data, list) else []


def _write_alerts(alerts: list):
    write_json(ALERT_STORE, alerts)


def _check_timeouts():
    """检测超时任务并生成预警（每次查询时触发）"""
    tasks = _read_tasks()
    alerts = _read_alerts()
    changed = False

    for task in tasks:
        if task.get("status") != "running":
            continue
        started = task.get("started_at")
        if not started:
            continue
        try:
            start_dt = datetime.strptime(started, "%Y-%m-%d %H:%M:%S")
            elapsed = (datetime.now() - start_dt).total_seconds() / 60
            if elapsed >= MAX_TASK_DURATION_MINUTES and not task.get("timeout_alerted"):
                task["timeout_alerted"] = True
                task["status"] = "timeout"
                changed = True
                alerts.append({
                    "id": str(uuid.uuid4()),
                    "level": "warn",
                    "message": f"任务「{task.get('type')}」已运行 {int(elapsed)} 分钟，超过最大时限，请检查客户端状态",
                    "timestamp": _now(),
                    "task_id": task.get("id"),
                    "acknowledged": False,
                })
                logger.warning("任务超时: %s", task.get("id"))
        except Exception:
            pass

    if changed:
        _write_tasks(tasks)
        _write_alerts(alerts)


# ─────────────────────────── Task Models ───────────────────────────

class TaskBody(BaseModel):
    type: str                          # goldCoin | comment | product | ...
    max_duration_minutes: int = MAX_TASK_DURATION_MINUTES
    extra: Optional[Any] = None        # 预留扩展参数


class TaskUpdateBody(BaseModel):
    status: Optional[str] = None       # pending | running | completed | error | timeout
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    message: Optional[str] = None


# ─────────────────────────── Task Routes ───────────────────────────

@router.get("/control/tasks")
async def get_tasks(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
):
    _check_timeouts()
    tasks = _read_tasks()
    if status:
        statuses = status.split(",")
        tasks = [t for t in tasks if t.get("status") in statuses]
    tasks = sorted(tasks, key=lambda t: t.get("created_at", ""), reverse=True)
    return {"code": 0, "data": tasks[:limit], "total": len(tasks)}


class TaskQueryBody(BaseModel):
    status: Optional[str] = None
    limit: int = 50


@router.post("/control/tasks/poll")
async def poll_tasks(body: TaskQueryBody):
    """客户端轮询专用 POST 接口，绕过 Hamibot GET 请求兼容性问题"""
    _check_timeouts()
    tasks = _read_tasks()
    if body.status:
        statuses = body.status.split(",")
        tasks = [t for t in tasks if t.get("status") in statuses]
    tasks = sorted(tasks, key=lambda t: t.get("created_at", ""), reverse=True)
    return {"code": 0, "data": tasks[:body.limit], "total": len(tasks)}


@router.post("/control/task")
async def create_task(body: TaskBody):
    tasks = _read_tasks()

    # 同类型任务若已有 pending/running 则不重复添加
    running_same = any(
        t.get("type") == body.type and t.get("status") in ("pending", "running")
        for t in tasks
    )
    if running_same:
        return {"code": 1, "message": f"任务「{body.type}」已在队列中，请等待完成后再添加"}

    task = {
        "id": str(uuid.uuid4()),
        "type": body.type,
        "status": "pending",
        "created_at": _now(),
        "started_at": None,
        "completed_at": None,
        "max_duration_minutes": body.max_duration_minutes,
        "timeout_alerted": False,
        "message": None,
        "extra": body.extra,
    }
    tasks.append(task)
    _write_tasks(tasks)
    logger.info("新增任务: %s (%s)", task["id"], task["type"])
    return {"code": 0, "message": "任务已加入队列", "data": task}


@router.put("/control/task/{task_id}")
async def update_task(task_id: str, body: TaskUpdateBody):
    tasks = _read_tasks()
    for task in tasks:
        if task.get("id") == task_id:
            if body.status:
                task["status"] = body.status
            if body.started_at:
                task["started_at"] = body.started_at
            if body.completed_at:
                task["completed_at"] = body.completed_at
            if body.message is not None:
                task["message"] = body.message
            _write_tasks(tasks)
            return {"code": 0, "message": "已更新", "data": task}
    raise HTTPException(status_code=404, detail="任务不存在")


@router.delete("/control/task/{task_id}")
async def delete_task(task_id: str):
    tasks = _read_tasks()
    new_tasks = [t for t in tasks if t.get("id") != task_id]
    if len(new_tasks) == len(tasks):
        raise HTTPException(status_code=404, detail="任务不存在")
    _write_tasks(new_tasks)
    return {"code": 0, "message": "已删除"}


# ─────────────────────────── Alert Models ───────────────────────────

class AlertBody(BaseModel):
    level: str = "warn"               # info | warn | error
    message: str
    task_id: Optional[str] = None
    extra: Optional[Any] = None


class AlertUpdateBody(BaseModel):
    acknowledged: bool = True


# ─────────────────────────── Alert Routes ───────────────────────────

@router.get("/control/alerts")
async def get_alerts(
    acknowledged: Optional[bool] = Query(None),
    limit: int = Query(50),
):
    alerts = _read_alerts()
    if acknowledged is not None:
        alerts = [a for a in alerts if a.get("acknowledged") == acknowledged]
    alerts = sorted(alerts, key=lambda a: a.get("timestamp", ""), reverse=True)
    return {"code": 0, "data": alerts[:limit], "total": len(alerts)}


@router.post("/control/alert")
async def create_alert(body: AlertBody):
    alerts = _read_alerts()
    alert = {
        "id": str(uuid.uuid4()),
        "level": body.level,
        "message": body.message,
        "timestamp": _now(),
        "task_id": body.task_id,
        "acknowledged": False,
        "extra": body.extra,
    }
    alerts.append(alert)
    _write_alerts(alerts)
    logger.warning("新预警 [%s]: %s", body.level, body.message)
    return {"code": 0, "message": "预警已记录", "data": alert}


@router.put("/control/alert/{alert_id}")
async def update_alert(alert_id: str, body: AlertUpdateBody):
    alerts = _read_alerts()
    for alert in alerts:
        if alert.get("id") == alert_id:
            alert["acknowledged"] = body.acknowledged
            _write_alerts(alerts)
            return {"code": 0, "message": "已更新"}
    raise HTTPException(status_code=404, detail="预警不存在")


@router.delete("/control/alerts/acknowledged")
async def clear_acknowledged_alerts():
    """批量清除已确认的预警"""
    alerts = _read_alerts()
    new_alerts = [a for a in alerts if not a.get("acknowledged")]
    _write_alerts(new_alerts)
    return {"code": 0, "message": f"已清除 {len(alerts) - len(new_alerts)} 条预警"}
