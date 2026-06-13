"""
页面采集合存储 — logs/device/闲鱼/pages/

每个 page_path 对应一个子目录，根目录 index.json 串联所有页面。
"""
from __future__ import annotations

import base64
import json
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from core.device_logger import LOG_DIR
from services.tree_analyzer import compute_fingerprint

logger = logging.getLogger(__name__)

PAGES_ROOT = LOG_DIR / "闲鱼" / "pages"
CAPTURE_LOG = PAGES_ROOT / "capture.log"
INDEX_FILE = "index.json"
META_FILE = "meta.json"
TREE_FILE = "tree.json"
SCREENSHOT_FILE = "screenshot.jpg"

_INVALID_CHARS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _append_capture_log(line: str) -> None:
    try:
        PAGES_ROOT.mkdir(parents=True, exist_ok=True)
        with CAPTURE_LOG.open("a", encoding="utf-8") as f:
            f.write(f"[{_now()}] {line}\n")
    except Exception as e:
        logger.warning("写入 capture.log 失败: %s", e)


def slugify_page_path(page_path: str) -> str:
    """page_path → 目录名：/ 替换为 __，去除非法字符。"""
    s = (page_path or "").strip()
    if not s:
        raise ValueError("page_path 不能为空")
    s = s.replace("/", "__")
    s = _INVALID_CHARS.sub("_", s)
    s = s.strip(". ")
    if not s:
        raise ValueError("page_path 无效")
    return s


def _count_nodes(tree: Any) -> int:
    if not tree or not isinstance(tree, dict):
        return 0
    n = 1
    for child in tree.get("children") or []:
        n += _count_nodes(child)
    return n


def _read_index() -> dict[str, Any]:
    path = PAGES_ROOT / INDEX_FILE
    if not path.is_file():
        return {"updated_at": _now(), "total": 0, "pages": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("pages"), list):
            return data
    except Exception as e:
        logger.warning("读取 index.json 失败: %s", e)
    return {"updated_at": _now(), "total": 0, "pages": []}


def _write_index(index: dict[str, Any]) -> None:
    PAGES_ROOT.mkdir(parents=True, exist_ok=True)
    pages = index.get("pages") or []
    index["pages"] = pages
    index["total"] = len(pages)
    index["updated_at"] = _now()
    (PAGES_ROOT / INDEX_FILE).write_text(
        json.dumps(index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def list_pages() -> dict[str, Any]:
    return _read_index()


def get_page_detail(dir_name: str) -> dict[str, Any] | None:
    page_dir = PAGES_ROOT / dir_name
    meta_path = page_dir / META_FILE
    if not meta_path.is_file():
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    meta["has_tree"] = (page_dir / TREE_FILE).is_file()
    meta["has_screenshot"] = (page_dir / SCREENSHOT_FILE).is_file()
    return meta


def save_page_capture(
    page_path: str,
    package: str,
    activity: str,
    tree: dict[str, Any],
    screenshot_base64: str | None,
    max_depth: int = 30,
    screenshot_error: str | None = None,
) -> dict[str, Any]:
    dir_name = slugify_page_path(page_path)
    page_dir = PAGES_ROOT / dir_name
    page_dir.mkdir(parents=True, exist_ok=True)

    captured_at = _now()
    fingerprint = compute_fingerprint(tree)
    node_count = _count_nodes(tree)

    (page_dir / TREE_FILE).write_text(
        json.dumps(tree, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    has_screenshot = False
    if screenshot_base64:
        raw = screenshot_base64
        if "," in raw and raw.startswith("data:"):
            raw = raw.split(",", 1)[1]
        try:
            img_bytes = base64.b64decode(raw)
            (page_dir / SCREENSHOT_FILE).write_bytes(img_bytes)
            has_screenshot = True
        except Exception as e:
            logger.warning("截图解码失败 [%s]: %s", dir_name, e)
            screenshot_error = screenshot_error or str(e)

    meta = {
        "page_path": page_path.strip(),
        "dir": dir_name,
        "activity": activity or "",
        "package": package or "",
        "fingerprint": fingerprint,
        "max_depth": max_depth,
        "node_count": node_count,
        "captured_at": captured_at,
        "source": "dashboard_capture",
        "has_screenshot": has_screenshot,
        "screenshot_error": screenshot_error,
    }
    (page_dir / META_FILE).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    index_entry = {
        "page_path": page_path.strip(),
        "dir": dir_name,
        "activity": activity or "",
        "package": package or "",
        "fingerprint": fingerprint,
        "node_count": node_count,
        "captured_at": captured_at,
        "tree_file": TREE_FILE,
        "screenshot_file": SCREENSHOT_FILE if has_screenshot else None,
        "has_screenshot": has_screenshot,
        "screenshot_error": screenshot_error,
    }

    index = _read_index()
    pages: list[dict[str, Any]] = index.get("pages") or []
    replaced = False
    for i, p in enumerate(pages):
        if p.get("dir") == dir_name:
            pages[i] = index_entry
            replaced = True
            break
    if not replaced:
        pages.append(index_entry)
    pages.sort(key=lambda x: x.get("captured_at") or "", reverse=True)
    index["pages"] = pages
    _write_index(index)

    logger.info("页面采集已保存: %s -> %s", page_path, page_dir)
    log_line = (
        f"SAVE page_path={page_path} dir={dir_name} nodes={node_count} "
        f"screenshot={has_screenshot}"
    )
    if screenshot_error:
        log_line += f" screenshot_error={screenshot_error}"
    _append_capture_log(log_line)
    root = LOG_DIR.parent.parent
    try:
        rel = str(page_dir.relative_to(root))
    except ValueError:
        rel = f"logs/device/闲鱼/pages/{dir_name}"
    return {**meta, "storage_path": rel}


def get_tree_path(dir_name: str) -> Path | None:
    p = PAGES_ROOT / dir_name / TREE_FILE
    return p if p.is_file() else None


def get_screenshot_path(dir_name: str) -> Path | None:
    p = PAGES_ROOT / dir_name / SCREENSHOT_FILE
    return p if p.is_file() else None
