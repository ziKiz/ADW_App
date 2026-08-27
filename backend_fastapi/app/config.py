from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


WEAK_JWT_SECRETS = {"change-this-local-secret", "change-this-long-random-secret"}


class Settings(BaseSettings):
    app_mode: str = "local"
    database_url: str = "postgresql+asyncpg://adw:adw@localhost:5432/adw"
    jwt_secret: str = "change-this-local-secret"
    jwt_expires_minutes: int = 525600
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def reject_weak_live_secrets(self) -> "Settings":
        if self.app_mode.casefold() == "live" and self.jwt_secret in WEAK_JWT_SECRETS:
            raise ValueError("JWT_SECRET must be set to a strong unique value in live mode.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
