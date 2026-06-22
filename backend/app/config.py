from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    project_root: Path = Path(__file__).resolve().parents[2]
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        extra="ignore",
    )

    @property
    def data_dir(self) -> Path:
        return self.project_root / "data"

    @property
    def prompt_dir(self) -> Path:
        return self.project_root / "backend" / "prompts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
