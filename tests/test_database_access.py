import json

import pytest

from app.models import App
from app.services import database_access_service
from app.services.common import CommandResult


def database_app() -> App:
    app = App(
        id=42,
        name="remote-db",
        display_name="Remote DB",
        app_type="postgres",
        container_name="nova-remote-db",
        source_dir="/tmp/remote-db",
        host_port=15432,
        internal_port=5432,
        database_public=True,
        database_allowed_cidrs=json.dumps(["203.0.113.25", "198.51.100.0/24"]),
    )
    return app


def test_cidr_validation_rejects_global_internet():
    assert database_access_service.normalize_cidrs(["203.0.113.25"]) == ["203.0.113.25/32"]
    with pytest.raises(ValueError, match="0.0.0.0/0"):
        database_access_service.normalize_cidrs(["0.0.0.0/0"])
    with pytest.raises(ValueError, match="نامعتبر"):
        database_access_service.normalize_cidrs(["not-an-ip"])


def test_firewall_chain_allows_selected_sources_and_drops_everything_else(monkeypatch):
    commands: list[list[str]] = []

    def fake_run(command, **_kwargs):
        commands.append(command)
        if command[1:4] == ["-C", "DOCKER-USER", "-p"]:
            return CommandResult(False, "", "", 1)
        if command[1:3] == ["-L", "NOVA_DB_42"]:
            return CommandResult(False, "", "", 1)
        return CommandResult(True, "", "", 0)

    monkeypatch.setattr(database_access_service, "run_command", fake_run)
    result = database_access_service.configure_database_firewall(database_app())

    assert result.ok is True
    assert ["iptables", "-A", "NOVA_DB_42", "-s", "203.0.113.25/32", "-j", "ACCEPT"] in commands
    assert ["iptables", "-A", "NOVA_DB_42", "-s", "198.51.100.0/24", "-j", "ACCEPT"] in commands
    assert ["iptables", "-A", "NOVA_DB_42", "-j", "DROP"] in commands
    assert any(command[1:4] == ["-I", "DOCKER-USER", "1"] for command in commands)
