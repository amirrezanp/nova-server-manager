import re
from pathlib import Path

from app.models import App
from app.services.common import CommandResult, run_command


NGINX_AVAILABLE = Path("/etc/nginx/sites-available")
NGINX_ENABLED = Path("/etc/nginx/sites-enabled")
LETSENCRYPT_LIVE = Path("/etc/letsencrypt/live")


def validate_domain(domain: str) -> str:
    domain = domain.lower().strip().rstrip(".")
    if not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", domain):
        raise ValueError("دامنه نامعتبر است")
    return domain


def _slug(domain: str) -> str:
    return domain.replace(".", "-")


def _config_name(app: App, domain: str) -> str:
    return f"nova-{app.name}--{domain}.conf"


def _certificate_name(app: App, domain: str) -> str:
    return f"nova-{app.name}-{_slug(domain)}"[:63]


def _config(app: App, domain: str) -> str:
    return f"""# Managed by Nova Server Manager
# Domain: {domain}
server {{
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


def configure_domains(app: App, domains: list[str], enable_ssl: bool) -> CommandResult:
    domains = list(dict.fromkeys(validate_domain(domain) for domain in domains))
    if not NGINX_AVAILABLE.exists() or not NGINX_ENABLED.exists():
        return CommandResult(False, "", "Nginx نصب نیست", 127)

    desired = {_config_name(app, domain): domain for domain in domains}
    prefix = f"nova-{app.name}--"
    legacy = NGINX_AVAILABLE / f"nova-{app.name}.conf"
    legacy_enabled = NGINX_ENABLED / legacy.name
    legacy_content = legacy.read_text(encoding="utf-8") if legacy.exists() else None
    legacy_enabled.unlink(missing_ok=True)
    legacy.unlink(missing_ok=True)

    created: list[tuple[Path, Path, str]] = []
    for filename, domain in desired.items():
        config_path = NGINX_AVAILABLE / filename
        enabled_path = NGINX_ENABLED / filename
        if config_path.exists():
            continue
        temporary = config_path.with_suffix(".conf.tmp")
        temporary.write_text(_config(app, domain), encoding="utf-8")
        temporary.replace(config_path)
        if not enabled_path.exists():
            enabled_path.symlink_to(config_path)
        created.append((config_path, enabled_path, domain))

    for config_path in NGINX_AVAILABLE.glob(f"{prefix}*.conf"):
        if config_path.name not in desired:
            (NGINX_ENABLED / config_path.name).unlink(missing_ok=True)
            config_path.unlink(missing_ok=True)

    check = run_command(["nginx", "-t"], timeout=30)
    if not check.ok:
        for config_path, enabled_path, _domain in created:
            enabled_path.unlink(missing_ok=True)
            config_path.unlink(missing_ok=True)
        if legacy_content is not None:
            legacy.write_text(legacy_content, encoding="utf-8")
            if not legacy_enabled.exists():
                legacy_enabled.symlink_to(legacy)
        return check

    reload_result = run_command(["systemctl", "reload", "nginx"], timeout=60)
    if not reload_result.ok or not enable_ssl:
        return reload_result

    output = []
    new_domains = {domain for _config_path, _enabled_path, domain in created}
    certificate_domains = [
        domain
        for domain in domains
        if domain in new_domains
        or not (LETSENCRYPT_LIVE / _certificate_name(app, domain) / "fullchain.pem").exists()
    ]
    for domain in certificate_domains:
        certificate = run_command([
            "certbot", "--nginx",
            "--cert-name", _certificate_name(app, domain),
            "-d", domain,
            "--non-interactive", "--agree-tos", "--redirect",
            "--register-unsafely-without-email",
        ], timeout=300)
        output.append(certificate.stdout + certificate.stderr)
        if not certificate.ok:
            return CommandResult(
                True,
                "\n".join(output),
                f"HTTPS activation failed for {domain}. HTTP routing is active.",
                0,
            )
    return CommandResult(True, "\n".join(output), "", 0)


def configure_domain(app: App, domain: str, enable_ssl: bool) -> CommandResult:
    """Backward-compatible single-domain entry point."""
    return configure_domains(app, [domain], enable_ssl)


def remove_domain(app: App) -> None:
    legacy = f"nova-{app.name}.conf"
    (NGINX_ENABLED / legacy).unlink(missing_ok=True)
    (NGINX_AVAILABLE / legacy).unlink(missing_ok=True)
    for config_path in NGINX_AVAILABLE.glob(f"nova-{app.name}--*.conf"):
        (NGINX_ENABLED / config_path.name).unlink(missing_ok=True)
        config_path.unlink(missing_ok=True)
    run_command(["systemctl", "reload", "nginx"], timeout=60)
