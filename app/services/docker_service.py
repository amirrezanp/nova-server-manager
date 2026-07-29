import json
import os
import secrets
import socket
from pathlib import Path

from app.models import App
from app.services.common import CommandResult, run_command


DEFAULT_PORTS = {
    "nextjs": 3000,
    "nodejs": 3000,
    "django": 8000,
    "fastapi": 8000,
    "flask": 8000,
    "php": 80,
    "static": 80,
    "postgres": 5432,
    "mongodb": 27017,
    "docker": 3000,
}

DEFAULT_IMAGES = {
    "postgres": "postgres:16-alpine",
    "mongodb": "mongo:7",
    "static": "nginx:alpine",
    "php": "php:8.3-apache",
}
NETWORK_NAME = "nova-network"


def docker_available() -> bool:
    return run_command(["docker", "info"], timeout=20).ok


def ensure_network() -> None:
    exists = run_command(["docker", "network", "inspect", NETWORK_NAME], timeout=30)
    if not exists.ok:
        run_command(["docker", "network", "create", NETWORK_NAME], timeout=60)


def allocate_port(start: int = 10000, end: int = 20000) -> int:
    for _ in range(300):
        port = secrets.randbelow(end - start) + start
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("پورت آزاد پیدا نشد")


def write_dockerignore(source: Path) -> None:
    path = source / ".dockerignore"
    if not path.exists():
        path.write_text(
            ".git\n.env\nnode_modules\n.next\n__pycache__\n.venv\nvenv\n*.pyc\n",
            encoding="utf-8",
        )


def generate_dockerfile(app: App) -> None:
    source = Path(app.source_dir)
    dockerfile = source / "Dockerfile.nova"
    if dockerfile.exists() or (source / "Dockerfile").exists():
        return
    command = app.start_command.strip()
    def cmd(value: str) -> str:
        return f"CMD {json.dumps(['sh', '-c', value])}\n"
    templates = {
        "nextjs": (
            "FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\n"
            "RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi\n"
            "COPY . .\nRUN npm run build\n"
            f"EXPOSE {app.internal_port}\n{cmd(command or 'npm start')}"
        ),
        "nodejs": (
            "FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\n"
            "RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi\n"
            "COPY . .\n"
            f"EXPOSE {app.internal_port}\n{cmd(command or 'npm start')}"
        ),
        "django": (
            "FROM python:3.12-slim\nWORKDIR /app\n"
            "ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1\n"
            "COPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt gunicorn\n"
            "COPY . .\n"
            f"EXPOSE {app.internal_port}\n{cmd(command or 'gunicorn config.wsgi:application --bind 0.0.0.0:8000')}"
        ),
        "fastapi": (
            "FROM python:3.12-slim\nWORKDIR /app\n"
            "ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1\n"
            "COPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\n"
            "COPY . .\n"
            f"EXPOSE {app.internal_port}\n{cmd(command or 'uvicorn main:app --host 0.0.0.0 --port 8000')}"
        ),
        "flask": (
            "FROM python:3.12-slim\nWORKDIR /app\n"
            "ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1\n"
            "COPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt gunicorn\n"
            "COPY . .\n"
            f"EXPOSE {app.internal_port}\n{cmd(command or 'gunicorn --bind 0.0.0.0:8000 app:app')}"
        ),
    }
    if app.app_type in templates:
        dockerfile.write_text(templates[app.app_type], encoding="utf-8")
        write_dockerignore(source)


def _env_args(app: App) -> list[str]:
    result: list[str] = []
    env = json.loads(app.env_json or "{}")
    for key, value in env.items():
        if key.replace("_", "").isalnum() and not key[0].isdigit():
            result.extend(["-e", f"{key}={value}"])
    return result


def deploy(app: App) -> CommandResult:
    source = Path(app.source_dir)
    source.mkdir(parents=True, exist_ok=True)
    remove(app)
    ensure_network()
    if app.app_type in {"postgres", "mongodb"}:
        image = app.image or DEFAULT_IMAGES[app.app_type]
        volume = app.volume_name
        mount = "/var/lib/postgresql/data" if app.app_type == "postgres" else "/data/db"
        args = [
            "docker", "run", "-d", "--name", app.container_name,
            "--restart", "unless-stopped",
            "--network", NETWORK_NAME,
            "-p", f"127.0.0.1:{app.host_port}:{app.internal_port}",
            "-v", f"{volume}:{mount}",
            *_env_args(app), image,
        ]
        return run_command(args, timeout=300)

    if app.app_type in {"static", "php"}:
        image = app.image or DEFAULT_IMAGES[app.app_type]
        mount = "/usr/share/nginx/html:ro" if app.app_type == "static" else "/var/www/html"
        return run_command([
            "docker", "run", "-d", "--name", app.container_name,
            "--restart", "unless-stopped",
            "--network", NETWORK_NAME,
            "-p", f"127.0.0.1:{app.host_port}:{app.internal_port}",
            "-v", f"{source.resolve()}:{mount}",
            *_env_args(app), image,
        ], timeout=300)

    if app.app_type == "docker" and app.image:
        return run_command([
            "docker", "run", "-d", "--name", app.container_name,
            "--restart", "unless-stopped",
            "--network", NETWORK_NAME,
            "-p", f"127.0.0.1:{app.host_port}:{app.internal_port}",
            *_env_args(app), app.image,
        ], timeout=300)

    generate_dockerfile(app)
    dockerfile = "Dockerfile" if (source / "Dockerfile").exists() else "Dockerfile.nova"
    image = f"nova/{app.name}:latest"
    built = run_command(
        ["docker", "build", "-f", dockerfile, "-t", image, "."],
        timeout=1800,
        cwd=source,
    )
    if not built.ok:
        return built
    app.image = image
    return run_command([
        "docker", "run", "-d", "--name", app.container_name,
        "--restart", "unless-stopped",
        "--network", NETWORK_NAME,
        "-p", f"127.0.0.1:{app.host_port}:{app.internal_port}",
        *_env_args(app), image,
    ], timeout=300)


def action(app: App, operation: str) -> CommandResult:
    if operation not in {"start", "stop", "restart"}:
        return CommandResult(False, "", "عملیات نامعتبر", 2)
    return run_command(["docker", operation, app.container_name], timeout=120)


def remove(app: App) -> CommandResult:
    return run_command(["docker", "rm", "-f", app.container_name], timeout=120)


def inspect_status(app: App) -> str:
    result = run_command(
        ["docker", "inspect", "-f", "{{.State.Status}}", app.container_name],
        timeout=20,
    )
    return result.stdout.strip() if result.ok else "stopped"


def logs(app: App, tail: int = 300) -> str:
    tail = max(10, min(tail, 2000))
    result = run_command(["docker", "logs", "--tail", str(tail), app.container_name], timeout=30)
    return (result.stdout + result.stderr)[-100000:]


def execute(app: App, command: str) -> CommandResult:
    return run_command(
        ["docker", "exec", app.container_name, "sh", "-lc", command],
        timeout=120,
    )


def stats(app: App) -> dict:
    result = run_command(
        ["docker", "stats", "--no-stream", "--format", "{{json .}}", app.container_name],
        timeout=30,
    )
    if not result.ok or not result.stdout.strip():
        return {"cpu": "0%", "memory": "0 B", "network": "0 B", "block": "0 B"}
    try:
        raw = json.loads(result.stdout.strip().splitlines()[0])
        return {
            "cpu": raw.get("CPUPerc", "0%"),
            "memory": raw.get("MemUsage", "0 B"),
            "network": raw.get("NetIO", "0 B"),
            "block": raw.get("BlockIO", "0 B"),
        }
    except json.JSONDecodeError:
        return {"cpu": "0%", "memory": "0 B", "network": "0 B", "block": "0 B"}
