import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=256)


class SetupRequest(LoginRequest):
    pass


class AppCreate(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9-]{1,39}$")
    display_name: str = Field(default="", max_length=120)
    app_type: Literal[
        "nextjs", "nodejs", "django", "fastapi", "flask",
        "php", "static", "postgres", "mongodb", "docker"
    ]
    internal_port: int = Field(default=3000, ge=1, le=65535)
    start_command: str = Field(default="", max_length=500)
    image: str = Field(default="", max_length=255)
    environment: dict[str, str] = Field(default_factory=dict)

    @field_validator("environment")
    @classmethod
    def validate_env(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 100:
            raise ValueError("حداکثر ۱۰۰ متغیر محیطی مجاز است")
        for key in value:
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
                raise ValueError(f"نام متغیر محیطی نامعتبر است: {key!r}")
        if any(len(item) > 10_000 for item in value.values()):
            raise ValueError("مقدار متغیر محیطی بیش از حد طولانی است")
        return value

    @model_validator(mode="after")
    def validate_deployment_type(self):
        if self.app_type == "docker" and not self.image.strip():
            raise ValueError("برای نوع Docker Image واردکردن نام Image الزامی است")
        return self


class AppUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    internal_port: int | None = Field(default=None, ge=1, le=65535)
    start_command: str | None = Field(default=None, max_length=500)
    environment: dict[str, str] | None = None

    @field_validator("environment")
    @classmethod
    def validate_env(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        if value is None:
            return value
        return AppCreate.validate_env(value)


class DomainRequest(BaseModel):
    domain: str = Field(pattern=r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$")
    enable_ssl: bool = True


class FileSaveRequest(BaseModel):
    path: str = Field(max_length=500)
    content: str = Field(max_length=5_000_000)


class FileCreateRequest(BaseModel):
    path: str = Field(max_length=500)
    directory: bool = False


class FileRenameRequest(BaseModel):
    old_path: str = Field(max_length=500)
    new_path: str = Field(max_length=500)


class TelegramSettings(BaseModel):
    bot_token: str = Field(min_length=20, max_length=200)
    admin_chat_id: str = Field(pattern=r"^-?\d{5,20}$")


class BackupCreateRequest(BaseModel):
    destination: Literal["local", "telegram"] = "local"


class ScheduleCreate(BaseModel):
    app_id: int
    enabled: bool = True
    destination: Literal["local", "telegram"] = "local"
    interval_value: int = Field(default=24, ge=1, le=365)
    interval_unit: Literal["minutes", "hours", "days"] = "hours"
    retention: int = Field(default=7, ge=1, le=100)


class ServerActionRequest(BaseModel):
    confirmation: Literal["RESTART", "SHUTDOWN"]


class ContainerExecRequest(BaseModel):
    command: str = Field(min_length=1, max_length=1000)
