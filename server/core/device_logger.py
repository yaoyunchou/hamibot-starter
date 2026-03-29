"""
设备日志写入器 —— 将 Hamibot 设备发来的运行日志写到本地文件，
与 Python/uvicorn 服务器日志完全隔离。

目录结构：
  data/device_logs/
    {name}/
      YYYY-MM-DD.log     ← 每天一个文件，每行一条记录
"""
import asyncio
import logging
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

LOG_DIR = Path(__file__).parent.parent.parent / "logs" / "device"


def _log_path(name: str) -> Path:
    """返回 data/device_logs/{name}/YYYY-MM-DD.log 路径，自动创建目录。"""
    day = datetime.now().strftime("%Y-%m-%d")
    directory = LOG_DIR / name
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{day}.log"


def _format_line(data: str, app_name: str) -> str:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"[{ts}] [{app_name}] {data}\n"


def write_device_log(name: str, data: str, app_name: str = "hamibot") -> None:
    """同步写入一条设备日志（在线程池中调用，不阻塞事件循环）。"""
    try:
        line = _format_line(data, app_name)
        with _log_path(name).open("a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        logger.error("写入设备日志失败 [name=%s]: %s", name, e)


async def write_device_log_async(name: str, data: str, app_name: str = "hamibot") -> None:
    """异步写入设备日志，通过 run_in_executor 避免阻塞事件循环。"""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, write_device_log, name, data, app_name)
