"""
GET  /api/book          → nestHost /api/v1/xyBook/book/getByOtherData
POST /api/book/view     → nestHost /api/v1/book/view
GET  /api/spread        → xfyHost  /api/spreadBookInfo
POST /api/fsbook        → xfyHost  /api/fsBook
GET  /api/fsbooks       → xfyHost  /api/fsBooks
"""
from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from core.proxy import nest_request, xfy_request

router = APIRouter(tags=["book"])


@router.get("/book")
async def get_book_by_title(search: str = Query(...)):
    return await nest_request(
        "GET",
        "/api/v1/xyBook/book/getByOtherData",
        params={"search": search},
    )


class BookViewBody(BaseModel):
    title: str
    shopName: str
    exposure: Any = 0
    views: Any = 0
    wants: Any = 0
    product_id: Optional[str] = None


@router.post("/book/view")
async def update_book_view(body: BookViewBody):
    return await nest_request("POST", "/api/v1/book/view", json=body.model_dump())


@router.get("/spread")
async def get_spread_book_info():
    return await xfy_request("GET", "/api/spreadBookInfo")


class FsBookBody(BaseModel):
    model_config = {"extra": "allow"}


@router.post("/fsbook")
async def post_fs_book(body: dict):
    return await xfy_request("POST", "/api/fsBook", json=body)


@router.get("/fsbooks")
async def get_fs_books(
    omit: Optional[str] = Query(None),
    pageSize: Optional[int] = Query(None),
):
    params = {}
    if omit:
        params["omit"] = omit
    if pageSize is not None:
        params["pageSize"] = pageSize
    return await xfy_request("GET", "/api/fsBooks", params=params or None)
