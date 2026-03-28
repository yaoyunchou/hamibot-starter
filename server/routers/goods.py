"""
GET  /api/goods       — 按 nickName + title 查询商品
POST /api/goods       — 新增/更新商品（供后续对接用）
"""
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from core.local_store import read_json, write_json

router = APIRouter(tags=["goods"])

STORE_NAME = "goods"


@router.get("/goods")
async def get_goods_info(
    nickName: str = Query(...),
    title: str = Query(...),
):
    goods = read_json(STORE_NAME)
    if not isinstance(goods, list):
        goods = []
    for item in goods:
        if item.get("nickName") == nickName and item.get("title") == title:
            return {"code": 0, "data": item}
    return {"code": 0, "data": None, "message": "未找到"}


class GoodsBody(BaseModel):
    model_config = {"extra": "allow"}
    nickName: Optional[str] = None
    title: Optional[str] = None


@router.post("/goods")
async def upsert_goods(body: GoodsBody):
    goods = read_json(STORE_NAME)
    if not isinstance(goods, list):
        goods = []
    data = body.model_dump()
    updated = False
    for i, item in enumerate(goods):
        if item.get("nickName") == body.nickName and item.get("title") == body.title:
            goods[i] = {**item, **data}
            updated = True
            break
    if not updated:
        goods.append(data)
    write_json(STORE_NAME, goods)
    return {"code": 0, "message": "已保存"}
