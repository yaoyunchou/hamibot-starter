"""
页面采集合 API — Dashboard 触发采集、查询已保存页面

POST /api/pages/capture   — 下发 page_capture 指令并等待落盘
GET  /api/pages           — 列表（index.json）
GET  /api/pages/{dir}     — 单页 meta
GET  /api/pages/{dir}/screenshot
GET  /api/pages/{dir}/tree
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from routers import debug as debug_router
from services import page_corpus_store

logger = logging.getLogger(__name__)
router = APIRouter(tags=["pages"])

CAPTURE_TIMEOUT_SEC = 180
CAPTURE_POLL_INTERVAL = 2.0
DEFAULT_MAX_DEPTH = 30


class CaptureBody(BaseModel):
    page_path: str
    max_depth: int = DEFAULT_MAX_DEPTH


def _ok(data: Any = None, message: str = "ok") -> dict:
    return {"code": 0, "message": message, "data": data}


def _err(message: str, code: int = 1) -> dict:
    return {"code": code, "message": message, "data": None}


async def _wait_for_command(cmd_id: str, timeout_sec: float) -> dict:
    deadline = time.monotonic() + timeout_sec
    last_log = 0.0
    while time.monotonic() < deadline:
        cmd = debug_router.get_command_by_id(cmd_id)
        if not cmd:
            raise ValueError("指令不存在")
        status = cmd.get("status")
        elapsed = int(time.monotonic() - (deadline - timeout_sec))
        if time.monotonic() - last_log >= 10:
            logger.info(
                "等待采集指令 cmd_id=%s status=%s elapsed=%ds",
                cmd_id[:8],
                status,
                elapsed,
            )
            last_log = time.monotonic()
        if status == "completed":
            logger.info("采集指令完成 cmd_id=%s elapsed=%ds", cmd_id[:8], elapsed)
            return cmd
        if status == "error":
            err = cmd.get("error") or "客户端执行失败"
            logger.warning("采集指令失败 cmd_id=%s error=%s", cmd_id[:8], err)
            raise ValueError(err)
        await asyncio.sleep(CAPTURE_POLL_INTERVAL)
    cmd = debug_router.get_command_by_id(cmd_id)
    st = cmd.get("status") if cmd else "missing"
    raise ValueError(f"采集超时({int(timeout_sec)}s)，指令仍停留在 {st}，请查看 logs/device/trace 中 [capture] 日志")


@router.post("/pages/capture")
async def capture_page(body: CaptureBody):
    page_path = (body.page_path or "").strip()
    if not page_path:
        return _err("page_path 不能为空")

    max_depth = body.max_depth if body.max_depth > 0 else DEFAULT_MAX_DEPTH
    logger.info("页面采集开始 page_path=%s max_depth=%s", page_path, max_depth)
    try:
        cmd = debug_router.create_command_internal(
            "page_capture",
            {"maxDepth": max_depth, "quality": 70},
        )
        cmd_id = cmd["id"]
        logger.info("页面采集指令已创建 cmd_id=%s", cmd_id)
        completed = await _wait_for_command(cmd_id, CAPTURE_TIMEOUT_SEC)
        result = completed.get("result") or {}
        tree = result.get("tree")
        if not tree:
            logger.warning("页面采集失败 page_path=%s: 无布局树 cmd_id=%s", page_path, cmd_id)
            return _err("客户端未返回布局树")

        saved = page_corpus_store.save_page_capture(
            page_path=page_path,
            package=result.get("package") or "",
            activity=result.get("activity") or "",
            tree=tree,
            screenshot_base64=result.get("screenshot_base64"),
            max_depth=int(result.get("max_depth") or max_depth),
            screenshot_error=result.get("screenshot_error"),
        )
        dir_name = saved["dir"]
        screenshot_error = result.get("screenshot_error")
        msg = f"已保存至 {saved.get('storage_path', dir_name)}"
        if screenshot_error:
            msg += f"（截图失败: {screenshot_error}，仅保存布局树）"
            logger.warning(
                "页面采集部分成功 page_path=%s dir=%s screenshot_error=%s",
                page_path,
                dir_name,
                screenshot_error,
            )
        else:
            logger.info("页面采集成功 page_path=%s dir=%s nodes=%s", page_path, dir_name, saved.get("node_count"))
        return _ok(
            {
                **saved,
                "screenshot_error": screenshot_error,
                "screenshot_url": f"/api/pages/{dir_name}/screenshot" if not screenshot_error else None,
                "tree_url": f"/api/pages/{dir_name}/tree",
            },
            message=msg,
        )
    except ValueError as e:
        logger.warning("页面采集失败 page_path=%s: %s", page_path, e)
        return _err(str(e))
    except Exception as e:
        logger.exception("capture_page page_path=%s", page_path)
        return _err(str(e))


@router.get("/pages")
async def list_pages():
    index = page_corpus_store.list_pages()
    return _ok(index)


@router.get("/pages/{dir_name}")
async def get_page(dir_name: str):
    meta = page_corpus_store.get_page_detail(dir_name)
    if not meta:
        raise HTTPException(status_code=404, detail="页面不存在")
    meta["screenshot_url"] = f"/api/pages/{dir_name}/screenshot"
    meta["tree_url"] = f"/api/pages/{dir_name}/tree"
    return _ok(meta)


@router.get("/pages/{dir_name}/screenshot")
async def get_screenshot(dir_name: str):
    path = page_corpus_store.get_screenshot_path(dir_name)
    if not path:
        raise HTTPException(status_code=404, detail="截图不存在")
    return FileResponse(str(path), media_type="image/jpeg")


@router.get("/pages/{dir_name}/tree")
async def get_tree(dir_name: str):
    path = page_corpus_store.get_tree_path(dir_name)
    if not path:
        raise HTTPException(status_code=404, detail="布局树不存在")
    return JSONResponse(content=json.loads(path.read_text(encoding="utf-8")))
