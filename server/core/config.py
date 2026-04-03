from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = 3000

    # AI（OpenAI 兼容接口）
    AI_BASE_URL: str = "https://api.openai.com/v1"
    AI_API_KEY: str = ""
    AI_MODEL: str = "gpt-4o-mini"
    AI_VISION_MODEL: str = ""
    AI_RESPONSE_FORMAT: bool = False
    OCR_WEAK_THRESHOLD: int = 3
    DEFAULT_TASK: str = "浏览当前页面，观察内容并汇报当前状态"


settings = Settings()
