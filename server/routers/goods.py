"""
GET /api/goods  → xfyHost /api/goodsInfo
"""
from fastapi import APIRouter, Query

from core.proxy import xfy_request

router = APIRouter(tags=["goods"])


@router.get("/goods")
async def get_goods_info(
    nickName: str = Query(...),
    title: str = Query(...),
):
    return await xfy_request(
        "GET",
        "/api/goodsInfo",
        params={"nickName": nickName, "title": title},
    )
