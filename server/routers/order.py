"""
GET /api/order/good    → nestHost /api/v1/order/fs/order/good
GET /api/order/number  → nestHost /api/v1/order/fs/order/orderNumber
"""
from fastapi import APIRouter, Query

from core.proxy import nest_request

router = APIRouter(tags=["order"])


@router.get("/order/good")
async def get_order_by_good(
    nikeName: str = Query(...),
    title: str = Query(...),
):
    return await nest_request(
        "GET",
        "/api/v1/order/fs/order/good",
        params={"nikeName": nikeName, "title": title},
    )


@router.get("/order/number")
async def get_order_by_number(orderNumber: str = Query(...)):
    return await nest_request(
        "GET",
        "/api/v1/order/fs/order/orderNumber",
        params={"orderNumber": orderNumber},
    )
