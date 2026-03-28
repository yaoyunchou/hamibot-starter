"""
GET  /api/book       — 按 title 搜索书籍
POST /api/book/view  — 更新书籍曝光/浏览/想要数据
GET  /api/spread     — 获取推广书籍列表
POST /api/fsbook     — 新增/更新樊登书籍
GET  /api/fsbooks    — 获取樊登书籍列表
"""
from typing import Any, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from core.local_store import read_json, write_json

router = APIRouter(tags=["book"])

BOOK_STORE = "books"
FS_BOOK_STORE = "fs_books"
SPREAD_STORE = "spread"


@router.get("/book")
async def get_book_by_title(search: str = Query(...)):
    books = read_json(BOOK_STORE)
    if not isinstance(books, list):
        books = []
    for item in books:
        if item.get("title") and search in item["title"]:
            return {"code": "200", "data": item}
    return {"code": "200", "data": None, "message": "未找到"}


class BookViewBody(BaseModel):
    title: str
    shopName: str
    exposure: Any = 0
    views: Any = 0
    wants: Any = 0
    product_id: Optional[str] = None


@router.post("/book/view")
async def update_book_view(body: BookViewBody):
    books = read_json(BOOK_STORE)
    if not isinstance(books, list):
        books = []
    data = body.model_dump()
    updated = False
    for i, item in enumerate(books):
        if item.get("title") == body.title and item.get("shopName") == body.shopName:
            books[i] = {**item, **data}
            updated = True
            break
    if not updated:
        books.append(data)
    write_json(BOOK_STORE, books)
    return {"code": 0, "message": "更新成功"}


@router.get("/spread")
async def get_spread_book_info():
    data = read_json(SPREAD_STORE)
    return {"code": 0, "data": data}


@router.post("/fsbook")
async def post_fs_book(body: dict):
    fs_books = read_json(FS_BOOK_STORE)
    if not isinstance(fs_books, list):
        fs_books = []
    title = body.get("title", "")
    updated = False
    for i, item in enumerate(fs_books):
        if item.get("title") == title:
            fs_books[i] = {**item, **body}
            updated = True
            break
    if not updated:
        fs_books.append(body)
    write_json(FS_BOOK_STORE, fs_books)
    return {"code": 0, "message": "保存成功"}


@router.get("/fsbooks")
async def get_fs_books(
    omit: Optional[str] = Query(None),
    pageSize: Optional[int] = Query(None),
):
    fs_books = read_json(FS_BOOK_STORE)
    if not isinstance(fs_books, list):
        fs_books = []

    if omit:
        omit_fields = set(omit.split(","))
        fs_books = [
            {k: v for k, v in item.items() if k not in omit_fields}
            for item in fs_books
        ]

    total = len(fs_books)
    if pageSize is not None:
        fs_books = fs_books[:pageSize]

    return {"code": 0, "data": {"list": fs_books, "total": total}}
