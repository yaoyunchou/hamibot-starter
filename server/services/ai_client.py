"""
Cursor Python SDK 客户端（页面识别 / 决策等结构化 prompt）。
文档：https://cursor.com/docs/sdk/python
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Optional, Union

from cursor_sdk import Agent, AgentOptions, LocalAgentOptions, SDKImage, UserMessage

from core.config import settings

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

_JSON_SUFFIX = "\n\n请严格只输出 JSON，不要 markdown 代码块，不要其他说明文字。"


def _api_key() -> str:
    key = (settings.CURSOR_API_KEY or "").strip()
    if not key:
        raise RuntimeError("未配置 CURSOR_API_KEY，请在 server/.env 中设置（Cursor Dashboard -> API Keys）")
    return key


def _model(override: Optional[str] = None) -> str:
    return (override or settings.CURSOR_MODEL or "composer-2.5").strip()


def _workspace() -> str:
    raw = (settings.CURSOR_WORKSPACE or "").strip()
    return raw if raw else str(_PROJECT_ROOT)


def _agent_options(*, model: Optional[str] = None) -> AgentOptions:
    return AgentOptions(
        model=_model(model),
        api_key=_api_key(),
        local=LocalAgentOptions(cwd=_workspace()),
    )


def _messages_to_text(messages: list[dict[str, Any]], *, json_mode: bool) -> str:
    parts: list[str] = []
    for msg in messages:
        role = str(msg.get("role") or "user")
        content = msg.get("content")
        if isinstance(content, list):
            text_bits = [
                str(block.get("text") or "")
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            ]
            body = "\n".join(t for t in text_bits if t)
        else:
            body = str(content or "")
        if role == "system":
            parts.append(f"[系统指令]\n{body}")
        elif role == "assistant":
            parts.append(f"[助手]\n{body}")
        else:
            parts.append(f"[用户]\n{body}")
    text = "\n\n".join(parts)
    if json_mode:
        text += _JSON_SUFFIX
    return text


def _normalize_image(image_base64: str) -> tuple[str, str]:
    raw = image_base64.strip()
    mime = "image/jpeg"
    if raw.startswith("data:"):
        header, _, data = raw.partition(",")
        mime = header.split(";")[0].removeprefix("data:") or mime
        return data, mime
    return raw, mime


def _cursor_prompt(
    message: Union[str, UserMessage],
    *,
    model: Optional[str] = None,
) -> str:
    result = Agent.prompt(message, _agent_options(model=model))
    text = (result.result or "").strip()
    if not text and hasattr(result, "text"):
        text = str(getattr(result, "text") or "").strip()
    return text


async def _cursor_prompt_async(
    message: Union[str, UserMessage],
    *,
    model: Optional[str] = None,
) -> str:
    return await asyncio.to_thread(_cursor_prompt, message, model=model)


def chat(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    """文本对话，返回 assistant 文本内容。"""
    prompt = _messages_to_text(messages, json_mode=json_mode)
    return _cursor_prompt(prompt, model=model)


def chat_with_image(
    messages: list[dict[str, Any]],
    image_base64: str,
    *,
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    """视觉对话：在 prompt 中附带截图（base64 JPG/PNG）。"""
    if not image_base64:
        return chat(messages, model=model, json_mode=json_mode)
    data, mime = _normalize_image(image_base64)
    prompt = _messages_to_text(messages, json_mode=json_mode)
    message = UserMessage(
        text=prompt + "\n\n请结合下方截图分析。",
        images=[SDKImage.data_image(data, mime)],
    )
    return _cursor_prompt(message, model=model)


async def chat_async(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    prompt = _messages_to_text(messages, json_mode=json_mode)
    return await _cursor_prompt_async(prompt, model=model)


async def chat_with_image_async(
    messages: list[dict[str, Any]],
    image_base64: str,
    *,
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    if not image_base64:
        return await chat_async(messages, model=model, json_mode=json_mode)
    data, mime = _normalize_image(image_base64)
    prompt = _messages_to_text(messages, json_mode=json_mode)
    message = UserMessage(
        text=prompt + "\n\n请结合下方截图分析。",
        images=[SDKImage.data_image(data, mime)],
    )
    return await _cursor_prompt_async(message, model=model)


def parse_json_loose(text: str) -> Any:
    """从模型输出中解析 JSON（允许 markdown 代码块包裹）。"""
    t = text.strip()
    if "```" in t:
        start = t.find("```")
        if start != -1:
            rest = t[start + 3 :]
            if rest.lower().startswith("json"):
                rest = rest[4:].lstrip()
            end = rest.find("```")
            if end != -1:
                t = rest[:end].strip()
            else:
                t = rest.strip()
    return json.loads(t)
