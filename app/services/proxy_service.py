import re
from pathlib import Path

from app.models import App
from app.services.common import CommandResult, run_command


NGINX_AVAILABLE = Path("/etc/nginx/sites-available")
NGINX_ENABLED = Path("/etc/nginx/sites-enabled")


def validate_domain(domain: str) -> str:
    domain = domain.lower().strip().rstrip(".")
    if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", domain):
        raise ValueError("دامنه نامعتبر است")
    return domain


def configure_domain(app: App, domain: str, enable_ssl: bool) -> CommandResult:
    domain = validate_domain(domain)
    if not NGINX_AVAILABLE.exists():
        return CommandResult(False, "", "Nginx نصب نیست", 127)
    config = f"""server {{
    listen 80;
    listen [::]:80;
    server_name {domain};
    client_max_body_size 1024m;

    location / {{
        proxy_pass http://127.0.0.1:{app.host_port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }}
}}
"""
    config_path = NGINX_AVAILABLE / f"nova-{app.name}.conf"
    config_path.write_text(config, encoding="utf-8")
    enabled_path = NGINX_ENABLED / config_path.name
    if not enabled_path.exists():
        enabled_path.symlink_to(config_path)
    check = run_command(["nginx", "-t"], timeout=30)
    if not check.ok:
        enabled_path.unlink(missing_ok=True)
        return check
    reload_result = run_command(["systemctl", "reload", "nginx"], timeout=60)
    if not reload_result.ok or not enable_ssl:
        return reload_result
    return run_command([
        "certbot", "--nginx", "-d", domain,
        "--non-interactive", "--agree-tos", "--redirect",
        "--register-unsafely-without-email",
    ], timeout=300)


def remove_domain(app: App) -> None:
    filename = f"nova-{app.name}.conf"
    (NGINX_ENABLED / filename).unlink(missing_ok=True)
    (NGINX_AVAILABLE / filename).unlink(missing_ok=True)
    run_command(["systemctl", "reload", "nginx"], timeout=60)

