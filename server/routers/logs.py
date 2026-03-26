"""
POST /api/logs

行为：
1. 立即写入本地设备日志 data/device_logs/{name}/YYYY-MM-DD.log
2. 异步（fire-and-forget）转发到 nestHost，不阻塞响应
"""
import asyncio
import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from core.device_logger import write_device_log_async
from core.proxy import nest_request

logger = logging.getLogger(__name__)
router = APIRouter(tags=["logs"])


class LogBody(BaseModel):
    name: str
    data: Any
    appName: str = "hamibot"
    appId: str = "b9836988643cc4d200be43d71e97c57"


@router.post("/logs")
async def create_log(body: LogBody):
    msg = str(body.data) if not isinstance(body.data, str) else body.data

    # 1. 本地写设备日志（等待写完，确保不丢失）
    await write_device_log_async(body.name, msg, body.appName)

    # 2. 异步转发到 nest，不阻塞当前响应
    asyncio.create_task(_forward_to_nest(body.name, msg, body.appName, body.appId))

    return {"code": 0, "message": "已记录"}


async def _forward_to_nest(name: str, msg: str, app_name: str, app_id: str):
    try:
        await nest_request(
            "POST",
            "/api/v1/logs",
            json={"msg": msg, "name": name, "appName": app_name, "appId": app_id},
        )
    except Exception as e:
        logger.warning("转发日志到 nest 失败 [name=%s]: %s", name, e)
