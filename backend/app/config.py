from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./credit.db"
    jwt_secret: str = "dev-secret-change-me"
    jwt_ttl_minutes: int = 720
    mock_gateway_url: str = "http://localhost:8081"
    integration_timeout_s: float = 3.0
    integration_retries: int = 2
    # Пауза между шагами конвейера, чтобы клиент видел движение статусов вживую
    pipeline_step_delay_s: float = 1.5
    worker_poll_interval_s: float = 1.0
    # Синхронный прогон конвейера внутри API (для тестов и запуска без воркера)
    inline_pipeline: bool = False
    seed_on_start: bool = True
    llm_enabled: bool = False
    llm_url: str = "http://ollama:11434"
    llm_model: str = "qwen2.5:1.5b"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    max_upload_mb: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
