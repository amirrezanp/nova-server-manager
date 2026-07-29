from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "نوا سرور منیجر"
    secret_key: str = "dev-only-change-me"
    data_dir: Path = Path("./data")
    app_dir: Path = Path("./data/apps")
    backup_dir: Path = Path("./data/backups")
    database_url: str = "sqlite:///./data/nova.db"
    panel_host: str = "0.0.0.0"
    panel_port: int = 8787
    panel_domain: str = ""
    cookie_secure: bool = False
    access_token_minutes: int = 720
    max_upload_mb: int = 1024

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="NOVA_",
        case_sensitive=False,
        extra="ignore",
    )

    def ensure_directories(self) -> None:
        for path in (self.data_dir, self.app_dir, self.backup_dir):
            path.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

