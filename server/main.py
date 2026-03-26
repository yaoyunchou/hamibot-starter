import logging
import logging.config
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import book, cache, goods, logs, order

# ------------------------------------------------------------------ #
# 日志配置
#   - 服务器日志（uvicorn + 应用）→ data/server.log + 控制台
#   - 设备日志（Hamibot 发来的）  → data/device_logs/{name}/YYYY-MM-DD.log
# ------------------------------------------------------------------ #
_LOG_DIR = Path(__file__).parent / "data"
_LOG_DIR.mkdir(exist_ok=True)

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "[%(asctime)s] %(levelname)-8s %(name)s — %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "stream": "ext://sys.stdout",
        },
        "server_file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "formatter": "default",
            "filename": str(_LOG_DIR / "server.log"),
            "when": "midnight",
            "backupCount": 14,
            "encoding": "utf-8",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console", "server_file"],
    },
    "loggers": {
        "uvicorn": {"handlers": ["console", "server_file"], "level": "INFO", "propagate": False},
        "uvicorn.error": {"handlers": ["console", "server_file"], "level": "INFO", "propagate": False},
        "uvicorn.access": {"handlers": ["console", "server_file"], "level": "INFO", "propagate": False},
    },
}

logging.config.dictConfig(LOGGING_CONFIG)

app = FastAPI(title="Hamibot 本地代理服务器")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(logs.router, prefix="/api")
app.include_router(order.router, prefix="/api")
app.include_router(cache.router, prefix="/api")
app.include_router(book.router, prefix="/api")
app.include_router(goods.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_config=LOGGING_CONFIG,
    )
