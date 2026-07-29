import ipaddress
import json

from sqlalchemy import select

from app.database import SessionLocal
from app.models import App
from app.services.common import CommandResult, run_command


def normalize_cidrs(values: list[str]) -> list[str]:
    normalized: list[str] = []
    for value in values:
        try:
            network = ipaddress.ip_network(value.strip(), strict=False)
        except ValueError as exc:
            raise ValueError(f"IP/CIDR نامعتبر است: {value}") from exc
        if network.version != 4:
            raise ValueError("در این نسخه فقط IPv4 برای دسترسی خارجی پشتیبانی می‌شود")
        if network.prefixlen == 0:
            raise ValueError("بازکردن دیتابیس برای تمام اینترنت (0.0.0.0/0) مجاز نیست")
        item = str(network)
        if item not in normalized:
            normalized.append(item)
    return normalized


def allowed_cidrs(app: App) -> list[str]:
    try:
        values = json.loads(app.database_allowed_cidrs or "[]")
    except (json.JSONDecodeError, TypeError):
        values = []
    return normalize_cidrs([str(item) for item in values])


def _chain(app: App) -> str:
    return f"NOVA_DB_{app.id}"


def clear_database_firewall(app: App) -> None:
    chain = _chain(app)
    jump = [
        "iptables", "-p", "tcp", "-m", "conntrack",
        "--ctorigdstport", str(app.host_port), "-j", chain,
    ]
    while run_command(["iptables", "-C", "DOCKER-USER", *jump[1:]], timeout=10).ok:
        run_command(["iptables", "-D", "DOCKER-USER", *jump[1:]], timeout=10)
    if run_command(["iptables", "-L", chain, "-n"], timeout=10).ok:
        run_command(["iptables", "-F", chain], timeout=10)
        run_command(["iptables", "-X", chain], timeout=10)


def configure_database_firewall(app: App) -> CommandResult:
    clear_database_firewall(app)
    if not app.database_public:
        return CommandResult(True, "", "", 0)
    cidrs = allowed_cidrs(app)
    if not cidrs:
        return CommandResult(False, "", "حداقل یک IP یا CIDR مجاز وارد کنید", 2)
    chain = _chain(app)
    created = run_command(["iptables", "-N", chain], timeout=10)
    if not created.ok:
        return created
    for cidr in cidrs:
        added = run_command(["iptables", "-A", chain, "-s", cidr, "-j", "ACCEPT"], timeout=10)
        if not added.ok:
            clear_database_firewall(app)
            return added
    dropped = run_command(["iptables", "-A", chain, "-j", "DROP"], timeout=10)
    if not dropped.ok:
        clear_database_firewall(app)
        return dropped
    jump = run_command([
        "iptables", "-I", "DOCKER-USER", "1", "-p", "tcp",
        "-m", "conntrack", "--ctorigdstport", str(app.host_port), "-j", chain,
    ], timeout=10)
    if not jump.ok:
        clear_database_firewall(app)
    return jump


def sync_all_database_firewalls() -> None:
    if not run_command(["iptables", "-L", "DOCKER-USER", "-n"], timeout=10).ok:
        return
    with SessionLocal() as db:
        apps = db.scalars(
            select(App).where(App.app_type.in_(("postgres", "mongodb")))
        ).all()
        for app in apps:
            configure_database_firewall(app)
