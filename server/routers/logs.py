"""
POST /api/logs           — 将 Hamibot 设备日志写入本地文件
"""
import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from core.device_logger import write_device_log_async

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
