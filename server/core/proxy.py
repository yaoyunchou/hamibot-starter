"""
统一代理层：
- 自动注入 token header
- 遇到 401 时触发重新登录，并重试一次
- 将外部响应原样透传给调用方
"""
import logging
from typing import Any, Callable, Coroutine, Literal

import httpx
from fastapi import HTTPException

from core.token_store import token_store

logger = logging.getLogger(__name__)

Method = Literal["GET", "POST", "PUT", "DELETE", "PATCH"]


async def _do_request(
    method: Method,
    url: str,
    header_fn: Callable[[], dict],
    *,
    params: dict | None = None,
    json: Any = None,
) -> dict | list:
    headers = header_fn()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.request(method, url, headers=headers, params=params, json=json)
    return resp


async def _proxy(
    method: Method,
    url: str,
    ensure_fn: Coroutine,
    header_fn: Callable[[], dict],
    *,
    params: dict | None = None,
    json: Any = None,
) -> dict | list:
    """
    通用代理执行器：
    1. 确保 token 有效
    2. 发起请求
    3. 如果 401，重新登录后重试一次
    """
    await ensure_fn

    resp = await _do_request(method, url, header_fn, params=params, json=json)

    if resp.status_code == 401:
        logger.warning("收到 401，正在刷新 token 后重试: %s", url)
        # 强制重新登录（将 token 置空触发刷新）
        if header_fn == token_store.get_xfy_header:
            token_store._xfy_token = ""
            await token_store.ensure_xfy()
        else:
            token_store._nest_token = ""
            await token_store.ensure_nest()

        resp = await _do_request(method, url, header_fn, params=params, json=json)

    if resp.status_code >= 500:
        raise HTTPException(status_code=502, detail=f"上游服务器错误: {resp.status_code}")

    try:
        return resp.json()
    except Exception:
        return {"raw": resp.text}


async def xfy_request(
    method: Method,
    path: str,
    *,
    params: dict | None = None,
    json: Any = None,
) -> dict | list:
    """代理到 xfyapi（host）。"""
    from core.config import settings

    url = f"{settings.XFY_HOST}{path}"
    return await _proxy(
        method,
        url,
        token_store.ensure_xfy(),
        token_store.get_xfy_header,
        params=params,
        json=json,
    )


async def nest_request(
    method: Method,
    path: str,
    *,
    params: dict | None = None,
    json: Any = None,
) -> dict | list:
    """代理到 nestapi/admin（nestHost）。"""
    from core.config import settings

    url = f"{settings.NEST_HOST}{path}"
    return await _proxy(
        method,
        url,
        token_store.ensure_nest(),
        token_store.get_nest_header,
        params=params,
        json=json,
    )


async def nest_xcx_request(
    method: Method,
    path: str,
    *,
    params: dict | None = None,
    json: Any = None,
) -> dict | list:
    """代理到 nestapi/xcx（nestHostXcx）。"""
    from core.config import settings

    url = f"{settings.NEST_HOST_XCX}{path}"
    return await _proxy(
        method,
        url,
        token_store.ensure_nest(),
        token_store.get_nest_header,
        params=params,
        json=json,
    )
