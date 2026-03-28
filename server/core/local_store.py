"""
本地 JSON 文件存储工具。
所有数据保存在 data/ 目录下，按业务分文件。
"""
import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def _path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def read_json(name: str) -> list | dict:
    path = _path(name)
    try:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("读取 %s 失败: %s", path, e)
    return []


def write_json(name: str, data: Any) -> None:
    try:
        _path(name).write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as e:
        logger.error("写入 %s 失败: %s", _path(name), e)
