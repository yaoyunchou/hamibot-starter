"""
GET /api/cache/element  → 读本地 data/element_cache.json
PUT /api/cache/element  → 写本地 data/element_cache.json

完全不访问外部服务器，速度从 ~500ms 降至 <1ms。
数据格式与原 nestHostXcx dictionary 接口保持兼容：
  [{key: string, value: any}, ...]
"""
import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["cache"])

CACHE_FILE = Path(__file__).parent.parent / "data" / "element_cache.json"


def _read_cache() -> list:
    try:
        if CACHE_FILE.exists():
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("读取 element_cache 失败: %s", e)
    return []


def _write_cache(data: list):
    try:
        CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.error("写入 element_cache 失败: %s", e)


class CacheItem(BaseModel):
    key: str
    value: Any


@router.get("/cache/element")
async def get_element_cache():
    """
    返回格式与原接口兼容：
    { "code": 0, "data": { "value": "[{key,value},...]" } }
    """
    items = _read_cache()
    return {
        "code": 0,
        "data": {
            "value": json.dumps(items, ensure_ascii=False)
        },
    }


@router.put("/cache/element")
async def save_element_cache(items: list[CacheItem]):
    data = [{"key": item.key, "value": item.value} for item in items]
    _write_cache(data)
    return {"code": 0, "message": "保存成功", "count": len(data)}
