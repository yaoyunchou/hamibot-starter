import logging
import logging.config
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from core.config import settings
from routers import ai, book, cache, control, debug, goods, logs, order

_SERVER_DIR = Path(__file__).parent
_LOG_DIR = _SERVER_DIR.parent / "logs"
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

app = FastAPI(title="Hamibot 本地服务器")

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
app.include_router(control.router, prefix="/api")
app.include_router(debug.router, prefix="/api")
app.include_router(ai.router, prefix="/api")

# 静态文件（控制面板 HTML/CSS/JS）
_STATIC_DIR = _SERVER_DIR / "static"
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/dashboard", include_in_schema=False)
async def dashboard():
    return FileResponse(str(_STATIC_DIR / "dashboard.html"))


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        reload_dirs=[str(_SERVER_DIR)],
        reload_excludes=["venv/**", "data/**", "__pycache__/**"],
        log_config=LOGGING_CONFIG,
    )
