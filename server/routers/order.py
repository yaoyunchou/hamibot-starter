"""
GET /api/order/good     — 按 nickName + title 查询订单
GET /api/order/number   — 按 orderNumber 查询订单
POST /api/order         — 新增/更新订单（供后续对接用）
"""
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Any, Optional

from core.local_store import read_json, write_json

router = APIRouter(tags=["order"])

STORE_NAME = "orders"


@router.get("/order/good")
async def get_order_by_good(
    nickName: str = Query(...),
    title: str = Query(...),
):
    orders = read_json(STORE_NAME)
    if not isinstance(orders, list):
        orders = []
    for item in orders:
        if item.get("nickName") == nickName and item.get("title") == title:
            return {"code": 0, "data": item}
    return {"code": 0, "data": None, "message": "未找到"}


@router.get("/order/number")
async def get_order_by_number(orderNumber: str = Query(...)):
    orders = read_json(STORE_NAME)
    if not isinstance(orders, list):
        orders = []
    for item in orders:
        if item.get("orderNumber") == orderNumber:
            return {"code": 0, "data": item}
    return {"code": 0, "data": None, "message": "未找到"}


class OrderBody(BaseModel):
    model_config = {"extra": "allow"}
    orderNumber: Optional[str] = None
    nickName: Optional[str] = None
    title: Optional[str] = None


@router.post("/order")
async def upsert_order(body: OrderBody):
    orders = read_json(STORE_NAME)
    if not isinstance(orders, list):
        orders = []
    data = body.model_dump()
    updated = False
    if body.orderNumber:
        for i, item in enumerate(orders):
            if item.get("orderNumber") == body.orderNumber:
                orders[i] = {**item, **data}
                updated = True
                break
    if not updated:
        orders.append(data)
    write_json(STORE_NAME, orders)
    return {"code": 0, "message": "已保存"}
