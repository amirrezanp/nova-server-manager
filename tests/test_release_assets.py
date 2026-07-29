from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_systemd_keeps_home_protection_and_uses_writable_docker_config():
    service = (ROOT / "nova-server-manager.service").read_text(encoding="utf-8")

    assert "ProtectHome=true" in service
    assert (
        "Environment=DOCKER_CONFIG=/var/lib/nova-server-manager/docker-config"
        in service
    )


def test_install_and_update_prepare_docker_config_directory():
    installer = (ROOT / "install.sh").read_text(encoding="utf-8")
    updater = (ROOT / "update.sh").read_text(encoding="utf-8")

    expected = 'install -d -m 0700 "${DATA_DIR}/docker-config"'
    assert expected in installer
    assert expected in updater
