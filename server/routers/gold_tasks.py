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

# ── 默认任务列表（对应 getMainPopup.ts 中的 taskList）────────────
DEFAULT_TASKS = [
    "浏览指定频道好物",
    "搜一搜喜欢的商品",
    "去浏览全新好物",
    "浏览推荐的国补商品",
    "去蚂蚁森林逛一逛",
    "去支付宝农场领水果",
    "去淘宝签到领红包",
    "去蚂蚁庄园逛一逛",
    "去支付宝领积分",
    "浏览鱼小铺工作台",
    "搜一搜推荐商品",
    "领至高20元外卖红包",
    "看视频奖励100币",
    "看视频奖励100币",
    "看视频奖励100币",
    "看视频奖励100币",
    "发布一件新宝贝",
]


def _make_default_task(title: str, uid: str | None = None) -> dict:
    return {
        "uid": uid or title,
        "title": title,
        "hasRun": False,
        "rewardVerified": None,
        "failCount": 0,
        "lastResult": None,
        "lastUpdated": None,
        "failRecords": [],
        "custom": False,
    }


def _make_tasks_from_defaults() -> list:
    """生成默认任务列表，为重复任务名自动生成唯一 uid（title__0, title__1 …）"""
    title_counts: dict[str, int] = {}
    tasks = []
    for title in DEFAULT_TASKS:
        n = title_counts.get(title, 0)
        uid = title if n == 0 else f"{title}__{n}"
        title_counts[title] = n + 1
        tasks.append(_make_default_task(title, uid))
    return tasks


# ─────────────────────────── helpers ───────────────────────────

def _today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def _now_time() -> str:
    return datetime.now().strftime("%H:%M:%S")


def _read_all() -> dict:
    data = read_json(STORE)
    return data if isinstance(data, dict) else {}


def _read_all_raw() -> dict:
    """读取原始 JSON，不做任何初始化。"""
    data = read_json(STORE)
    return data if isinstance(data, dict) else {}


def _today_record(all_data: dict) -> dict:
    return all_data.get(_today(), {})


def _read_today() -> list:
    return _read_all().get(_today(), {}).get("tasks", [])


def _write_today(tasks: list):
    data = _read_all()
    date = _today()
    if date not in data:
        data[date] = {}
    data[date]["tasks"] = tasks
    write_json(STORE, data)


def _ensure_today_initialized() -> list:
    """
    确保今日数据已初始化。
    - 若今日 key 不存在（新的一天），用默认列表覆盖并写入，返回新列表。
    - 若今日 key 已存在（已初始化过），直接返回现有列表。
    """
    data = _read_all()
    date = _today()
    today_rec = data.get(date, {})

    if not today_rec.get("initialized"):
        # 新的一天：用默认列表重置
        tasks = _make_tasks_from_defaults()
        data[date] = {"initialized": True, "tasks": tasks}
        write_json(STORE, data)
        logger.info("gold tasks: new day %s, reset to %d default tasks", date, len(tasks))
        return tasks

    return today_rec.get("tasks", [])


# ─────────────────────────── Models ───────────────────────────

class TaskSyncItem(BaseModel):
    uid: Optional[str] = None                 # 唯一槽位 ID，重复任务靠此区分
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
    """返回今日金币任务列表及汇总统计。每天第一次访问自动重置为默认列表。"""
    tasks = _ensure_today_initialized()

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
    按 uid 匹配（兼容旧版无 uid 时 fallback 到 title）。
    同名任务（重复执行槽）按上传顺序依次匹配服务端对应槽位。
    """
    existing = _ensure_today_initialized()
    # uid_map：uid -> 服务端任务对象
    uid_map: dict = {t.get("uid", t["title"]): t for t in existing}

    # 对于同一 title 出现多次的情况，按顺序分配 uid
    # 先统计设备上传的每个 title 出现次数，以便按 __n 后缀匹配
    title_seen: dict[str, int] = {}

    for item in body.tasks:
        d = item.dict()
        d["lastUpdated"] = _now_time()

        # 计算这是同 title 的第几次
        n = title_seen.get(item.title, 0)
        title_seen[item.title] = n + 1
        uid = item.title if n == 0 else f"{item.title}__{n}"
        d["uid"] = uid

        # 合并：保留服务端的 custom 标记
        if uid in uid_map:
            d["custom"] = uid_map[uid].get("custom", False)
        uid_map[uid] = d

    _write_today(list(uid_map.values()))
    logger.info("gold task sync: %d tasks", len(uid_map))
    return {"code": 0, "message": f"已同步 {len(body.tasks)} 个任务"}


@router.post("/gold/tasks/add")
async def add_gold_task(body: AddTaskBody):
    """从 Web 端手动添加一个任务条目（custom=True）"""
    if not body.title.strip():
        return {"code": 1, "message": "任务名称不能为空"}
    tasks = _ensure_today_initialized()
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
    tasks = _ensure_today_initialized()
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
    """重置今日全部任务的执行标记（保留任务列表，仅清除状态）"""
    tasks = _ensure_today_initialized()
    for t in tasks:
        t["hasRun"] = False
        t["rewardVerified"] = None
        t["lastResult"] = None
        t["failCount"] = 0
        t["failRecords"] = []
        t["lastUpdated"] = _now_time()
    _write_today(tasks)
    return {"code": 0, "message": f"已重置 {len(tasks)} 个任务"}


@router.post("/gold/tasks/reinit")
async def reinit_gold_tasks():
    """用内置默认任务列表重新初始化今日数据（覆盖，保留自定义任务）"""
    existing = _ensure_today_initialized()
    custom = [t for t in existing if t.get("custom")]

    fresh = _make_tasks_from_defaults()
    # 追加自定义任务（去重）
    existing_titles = {t["uid"] for t in fresh}
    for ct in custom:
        if ct.get("uid", ct["title"]) not in existing_titles:
            fresh.append(ct)

    _write_today(fresh)
    logger.info("gold tasks reinit: %d tasks", len(fresh))
    return {"code": 0, "message": f"已重新初始化 {len(fresh)} 个任务"}
