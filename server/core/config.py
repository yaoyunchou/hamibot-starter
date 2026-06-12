from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = 3000

    # AI（Cursor Python SDK，文档：https://cursor.com/docs/sdk/python）
    CURSOR_API_KEY: str = ""
    CURSOR_MODEL: str = "composer-2.5"
    # 本地 Agent 工作目录，默认项目根目录
    CURSOR_WORKSPACE: str = ""
    OCR_WEAK_THRESHOLD: int = 3
    DEFAULT_TASK: str = "浏览当前页面，观察内容并汇报当前状态"


settings = Settings()
