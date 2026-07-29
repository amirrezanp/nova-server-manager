from datetime import datetime

from app.models import App, Backup, BackupSchedule


def app_dict(app: App, include_env: bool = False) -> dict:
    import json
    data = {
        "id": app.id,
        "name": app.name,
        "display_name": app.display_name,
        "app_type": app.app_type,
        "status": app.status,
        "domain": app.domain,
        "container_name": app.container_name,
        "image": app.image,
        "internal_port": app.internal_port,
        "host_port": app.host_port,
        "start_command": app.start_command,
        "source_dir": app.source_dir,
        "last_error": app.last_error,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }
    if include_env:
        data["environment"] = json.loads(app.env_json or "{}")
    return data


def backup_dict(backup: Backup) -> dict:
    return {
        "id": backup.id,
        "app_id": backup.app_id,
        "filename": backup.filename,
        "size": backup.size,
        "destination": backup.destination,
        "status": backup.status,
        "error": backup.error,
        "created_at": backup.created_at.isoformat() if backup.created_at else None,
    }


def schedule_dict(item: BackupSchedule) -> dict:
    return {
        "id": item.id,
        "app_id": item.app_id,
        "enabled": item.enabled,
        "destination": item.destination,
        "interval_value": item.interval_value,
        "interval_unit": item.interval_unit,
        "retention": item.retention,
        "last_run": item.last_run.isoformat() if item.last_run else None,
        "next_run": item.next_run.isoformat() if item.next_run else None,
    }

