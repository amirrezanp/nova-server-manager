import io
import os
import tempfile
import zipfile
from pathlib import Path


TEST_ROOT = Path(tempfile.mkdtemp(prefix="nova-tests-"))
os.environ["NOVA_DATA_DIR"] = str(TEST_ROOT)
os.environ["NOVA_APP_DIR"] = str(TEST_ROOT / "apps")
os.environ["NOVA_BACKUP_DIR"] = str(TEST_ROOT / "backups")
os.environ["NOVA_DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test.db').as_posix()}"
os.environ["NOVA_SECRET_KEY"] = "test-key-that-is-long-enough-for-automated-tests"

from fastapi.testclient import TestClient

from app.main import app


def make_zip(files: dict[str, str]) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return output.getvalue()


def test_auth_app_files_and_backup_flow():
    with TestClient(app) as client:
        status = client.get("/api/auth/status")
        assert status.status_code == 200
        assert status.json()["setup_required"] is True

        unauthorized = client.get("/api/apps")
        assert unauthorized.status_code == 401

        setup = client.post("/api/auth/setup", json={
            "username": "admin",
            "password": "a-strong-test-password",
        })
        assert setup.status_code == 200
        assert "nova_session" in client.cookies

        created = client.post("/api/apps", json={
            "name": "demo-static",
            "display_name": "دموی استاتیک",
            "app_type": "static",
            "internal_port": 80,
            "environment": {},
        })
        assert created.status_code == 201, created.text
        app_id = created.json()["id"]

        package = make_zip({"site/index.html": "<h1>Nova</h1>", "site/app.js": "console.log('nova')"})
        upload = client.post(
            f"/api/apps/{app_id}/upload",
            files={"file": ("site.zip", package, "application/zip")},
        )
        assert upload.status_code == 200, upload.text

        listing = client.get(f"/api/apps/{app_id}/files")
        assert listing.status_code == 200
        assert {item["name"] for item in listing.json()["items"]} == {"index.html", "app.js"}

        content = client.get(f"/api/apps/{app_id}/files/content", params={"path": "index.html"})
        assert content.json()["content"] == "<h1>Nova</h1>"
        saved = client.put(f"/api/apps/{app_id}/files/content", json={
            "path": "index.html",
            "content": "<h1>Nova Server Manager</h1>",
        })
        assert saved.status_code == 200

        traversal = client.get(f"/api/apps/{app_id}/files/content", params={"path": "../test.db"})
        assert traversal.status_code == 400

        backup = client.post(f"/api/backups/apps/{app_id}", json={"destination": "local"})
        assert backup.status_code == 202
        backups = client.get(f"/api/backups?app_id={app_id}").json()
        assert len(backups) == 1
        assert backups[0]["status"] == "completed"
        download = client.get(f"/api/backups/items/{backups[0]['id']}/download")
        assert download.status_code == 200
        assert download.headers["content-type"] == "application/gzip"
        assert download.headers["x-content-type-options"] == "nosniff"

        scheduled = client.post("/api/backups/schedules", json={
            "app_id": app_id,
            "enabled": True,
            "destination": "local",
            "interval_value": 12,
            "interval_unit": "hours",
            "retention": 5,
        })
        assert scheduled.status_code == 201, scheduled.text
        schedules = client.get("/api/backups/schedules/all")
        assert schedules.status_code == 200
        assert schedules.json()[0]["app_id"] == app_id


def test_setup_cannot_run_twice():
    with TestClient(app) as client:
        response = client.post("/api/auth/setup", json={
            "username": "other-admin",
            "password": "another-strong-password",
        })
        assert response.status_code == 409
