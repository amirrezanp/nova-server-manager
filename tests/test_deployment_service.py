from pathlib import Path
from types import SimpleNamespace

from app.services import docker_service


def make_app(source: Path, app_type: str = "nextjs", **overrides):
    values = {
        "source_dir": str(source),
        "app_type": app_type,
        "image": "",
        "internal_port": 3000,
        "start_command": "",
        "container_name": "nova-test-app",
        "name": "test-app",
        "host_port": 12000,
        "env_json": "{}",
        "volume_name": "",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_source_validation_reports_missing_framework_file(tmp_path: Path):
    (tmp_path / "index.js").write_text("console.log('test')", encoding="utf-8")
    result = docker_service.validate_source(make_app(tmp_path), tmp_path)

    assert result is not None
    assert result.ok is False
    assert "package.json" in result.stderr


def test_custom_dockerfile_bypasses_framework_layout_check(tmp_path: Path):
    (tmp_path / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")

    assert docker_service.validate_source(make_app(tmp_path), tmp_path) is None


def test_generated_dockerfile_uses_configured_internal_port(tmp_path: Path):
    (tmp_path / "requirements.txt").write_text("fastapi\nuvicorn\n", encoding="utf-8")
    app = make_app(tmp_path, app_type="fastapi", internal_port=9100)

    docker_service.generate_dockerfile(app)
    generated = (tmp_path / "Dockerfile.nova").read_text(encoding="utf-8")

    assert "EXPOSE 9100" in generated
    assert "--port 9100" in generated


def test_docker_application_requires_an_image(tmp_path: Path):
    result = docker_service.validate_source(make_app(tmp_path, app_type="docker"), tmp_path)

    assert result is not None
    assert result.ok is False
    assert "Docker image" in result.stderr
