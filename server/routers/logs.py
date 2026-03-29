"""
POST /api/logs           — 将 Hamibot 设备日志写入本地文件
GET  /api/logs/ocr       — 读取 OCR 日志（?date=YYYY-MM-DD）
"""
import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from core.device_logger import write_device_log_async, LOG_DIR

logger = logging.getLogger(__name__)
router = APIRouter(tags=["logs"])


class LogBody(BaseModel):
    name: str
    data: Any
    appName: str = "hamibot"
    appId: str = ""


@router.post("/logs")
async def create_log(body: LogBody):
    msg = str(body.data) if not isinstance(body.data, str) else body.data
    await write_device_log_async(body.name, msg, body.appName)
    return {"code": 0, "message": "已记录"}


@router.get("/logs/ocr")
async def get_ocr_log(date: Optional[str] = Query(None)):
    """读取指定日期的 OCR 日志，默认今天。每行一条记录。"""
    target = date or datetime.now().strftime("%Y-%m-%d")
    log_file = LOG_DIR / "ocr" / f"{target}.log"
    if not log_file.exists():
        return {"code": 0, "data": [], "date": target}
    content = log_file.read_text(encoding="utf-8").strip()
    lines = [ln for ln in content.split("\n") if ln.strip()]
    return {"code": 0, "data": lines, "date": target}
