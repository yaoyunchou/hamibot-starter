"""
OpenAI 兼容 API 客户端（text / vision）。
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from openai import OpenAI

from core.config import settings

logger = logging.getLogger(__name__)


def _client() -> OpenAI:
    if not settings.AI_API_KEY:
        raise RuntimeError("未配置 AI_API_KEY，请在 server/.env 中设置")
    return OpenAI(
        api_key=settings.AI_API_KEY,
        base_url=settings.AI_BASE_URL.rstrip("/"),
    )


def _text_model() -> str:
    return settings.AI_MODEL or "gpt-4o-mini"


def _vision_model() -> str:
    return settings.AI_VISION_MODEL or _text_model()


def chat(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    """文本对话，返回 assistant 文本内容。"""
    kw: dict[str, Any] = {
        "model": model or _text_model(),
        "messages": messages,
    }
    if json_mode and settings.AI_RESPONSE_FORMAT:
        kw["response_format"] = {"type": "json_object"}
    resp = _client().chat.completions.create(**kw)
    return (resp.choices[0].message.content or "").strip()


def chat_with_image(
    messages: list[dict[str, Any]],
    image_base64: str,
    *,
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    """
    视觉对话：在 user 最后一条消息中拼接一张图片（image_url data URI）。
    messages 应为不含图片的纯文本消息；本函数会追加一条 user 多模态消息。
    """
    if not image_base64:
        return chat(messages, model=model or _vision_model(), json_mode=json_mode)
    url = image_base64 if image_base64.startswith("data:") else f"data:image/jpeg;base64,{image_base64}"
    vision_msgs = list(messages)
    vision_msgs.append(
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "请结合下方截图与上文分析。"},
                {"type": "image_url", "image_url": {"url": url}},
            ],
        }
    )
    kw: dict[str, Any] = {
        "model": model or _vision_model(),
        "messages": vision_msgs,
    }
    if json_mode and settings.AI_RESPONSE_FORMAT:
        kw["response_format"] = {"type": "json_object"}
    resp = _client().chat.completions.create(**kw)
    return (resp.choices[0].message.content or "").strip()


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
