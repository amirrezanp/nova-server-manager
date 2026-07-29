import json
import shutil
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import App, Backup, BackupSchedule
from app.services.common import run_command, run_command_to_file
from app.services.settings_service import get_setting


def _database_dump(app: App, temp_dir: Path) -> Path | None:
    if app.app_type == "postgres":
        output = temp_dir / "database.sql"
        result = run_command_to_file([
            "docker", "exec", app.container_name,
            "pg_dumpall", "-U", json.loads(app.env_json or "{}").get("POSTGRES_USER", "postgres"),
        ], output, timeout=3600)
        if result.ok:
            return output
    if app.app_type == "mongodb":
        result = run_command([
            "docker", "exec", app.container_name,
            "mongodump", "--archive=/tmp/nova.archive", "--gzip",
        ], timeout=600)
        if result.ok:
            output = temp_dir / "database.archive.gz"
            copied = run_command([
                "docker", "cp", f"{app.container_name}:/tmp/nova.archive", str(output)
            ], timeout=300)
            run_command(["docker", "exec", app.container_name, "rm", "-f", "/tmp/nova.archive"])
            if copied.ok:
                return output
    return None


def send_telegram(path: Path, token: str, chat_id: str, caption: str) -> None:
    if path.stat().st_size > 49 * 1024 * 1024:
        raise ValueError("حجم بکاپ برای ارسال مستقیم تلگرام بیشتر از ۴۹ مگابایت است")
    url = f"https://api.telegram.org/bot{token}/sendDocument"
    with path.open("rb") as file_obj:
        response = httpx.post(
            url,
            data={"chat_id": chat_id, "caption": caption[:1024]},
            files={"document": (path.name, file_obj, "application/gzip")},
            timeout=180,
        )
    if response.status_code >= 400 or not response.json().get("ok"):
        description = response.json().get("description", response.text[:300])
        raise RuntimeError(f"خطای تلگرام: {description}")


def create_backup(db: Session, app: App, destination: str = "local") -> Backup:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    app_backup_dir = settings.backup_dir / app.name
    app_backup_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{app.name}-{timestamp}.tar.gz"
    output = app_backup_dir / filename
    record = Backup(
        app_id=app.id, filename=filename, path=str(output),
        destination=destination, status="creating",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    try:
        with tempfile.TemporaryDirectory(prefix="nova-backup-") as temp:
            temp_dir = Path(temp)
            dump = _database_dump(app, temp_dir)
            manifest = temp_dir / "manifest.json"
            manifest.write_text(json.dumps({
                "app": app.name,
                "type": app.app_type,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "environment_keys": list(json.loads(app.env_json or "{}").keys()),
            }, ensure_ascii=False, indent=2), encoding="utf-8")
            with tarfile.open(output, "w:gz") as archive:
                source = Path(app.source_dir)
                if source.exists() and any(source.iterdir()):
                    archive.add(source, arcname="source", recursive=True)
                archive.add(manifest, arcname="manifest.json")
                if dump:
                    archive.add(dump, arcname=dump.name)
        record.size = output.stat().st_size
        if destination == "telegram":
            token = get_setting(db, "telegram_bot_token")
            chat_id = get_setting(db, "telegram_chat_id")
            if not token or not chat_id:
                raise ValueError("تنظیمات تلگرام تکمیل نشده است")
            send_telegram(output, token, chat_id, f"بکاپ {app.display_name or app.name} - {timestamp}")
        record.status = "completed"
    except Exception as exc:
        record.status = "failed"
        record.error = str(exc)[:2000]
    db.commit()
    db.refresh(record)
    return record


def _safe_extract(archive: tarfile.TarFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in archive.getmembers():
        member_path = (destination / member.name).resolve()
        if member_path != destination and destination not in member_path.parents:
            raise ValueError("فایل بکاپ ناامن است")
        if member.issym() or member.islnk():
            raise ValueError("لینک داخل بکاپ مجاز نیست")
    archive.extractall(destination, filter="data")


def restore_backup(app: App, backup: Backup) -> None:
    backup_path = Path(backup.path)
    if not backup_path.exists():
        raise FileNotFoundError("فایل بکاپ روی سرور موجود نیست")
    source = Path(app.source_dir)
    with tempfile.TemporaryDirectory(prefix="nova-restore-") as temp:
        temp_dir = Path(temp)
        with tarfile.open(backup_path, "r:gz") as archive:
            _safe_extract(archive, temp_dir)
        restored_source = temp_dir / "source"
        if restored_source.exists():
            source.mkdir(parents=True, exist_ok=True)
            for child in source.iterdir():
                if child.is_dir():
                    shutil.rmtree(child)
                else:
                    child.unlink()
            shutil.copytree(restored_source, source, dirs_exist_ok=True)
        sql_dump = temp_dir / "database.sql"
        mongo_dump = temp_dir / "database.archive.gz"
        if app.app_type == "postgres" and sql_dump.exists():
            user = json.loads(app.env_json or "{}").get("POSTGRES_USER", "postgres")
            copied = run_command(["docker", "cp", str(sql_dump), f"{app.container_name}:/tmp/nova.sql"])
            if not copied.ok:
                raise RuntimeError(copied.stderr)
            restored = run_command([
                "docker", "exec", app.container_name, "psql", "-U", user,
                "-f", "/tmp/nova.sql",
            ], timeout=3600)
            run_command(["docker", "exec", app.container_name, "rm", "-f", "/tmp/nova.sql"])
            if not restored.ok:
                raise RuntimeError(restored.stderr)
        if app.app_type == "mongodb" and mongo_dump.exists():
            run_command(["docker", "cp", str(mongo_dump), f"{app.container_name}:/tmp/nova.archive"])
            restored = run_command([
                "docker", "exec", app.container_name, "mongorestore",
                "--archive=/tmp/nova.archive", "--gzip", "--drop",
            ], timeout=1200)
            run_command(["docker", "exec", app.container_name, "rm", "-f", "/tmp/nova.archive"])
            if not restored.ok:
                raise RuntimeError(restored.stderr)


def enforce_retention(db: Session, schedule: BackupSchedule) -> None:
    records = db.scalars(
        select(Backup)
        .where(Backup.app_id == schedule.app_id, Backup.status == "completed")
        .order_by(Backup.created_at.desc())
    ).all()
    for old in records[schedule.retention:]:
        Path(old.path).unlink(missing_ok=True)
        db.delete(old)
    db.commit()
