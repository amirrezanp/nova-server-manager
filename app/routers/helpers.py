from datetime import datetime

from app.models import App, Backup, BackupSchedule, Deployment, UploadRecord


def app_dict(app: App, include_env: bool = False) -> dict:
    import json
    from urllib.parse import quote
    try:
        domains = json.loads(app.domains_json or "[]")
    except (json.JSONDecodeError, TypeError):
        domains = []
    if app.domain and app.domain not in domains:
        domains.insert(0, app.domain)
    data = {
        "id": app.id,
        "name": app.name,
        "display_name": app.display_name,
        "app_type": app.app_type,
        "status": app.status,
        "domain": app.domain,
        "domains": domains,
        "container_name": app.container_name,
        "image": app.image,
        "internal_port": app.internal_port,
        "host_port": app.host_port,
        "start_command": app.start_command,
        "source_dir": app.source_dir,
        "volume_name": app.volume_name,
        "database_admin_port": app.database_admin_port,
        "last_error": app.last_error,
        "last_upload_name": app.last_upload_name,
        "last_upload_size": app.last_upload_size,
        "last_upload_at": app.last_upload_at.isoformat() if app.last_upload_at else None,
        "source_size": app.source_size,
        "source_files": app.source_files,
        "last_deployed_at": app.last_deployed_at.isoformat() if app.last_deployed_at else None,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "updated_at": app.updated_at.isoformat() if app.updated_at else None,
    }
    if include_env:
        environment = json.loads(app.env_json or "{}")
        data["environment"] = environment
        if app.app_type == "postgres":
            username = environment.get("POSTGRES_USER", "nova")
            password = environment.get("POSTGRES_PASSWORD", "")
            database = environment.get("POSTGRES_DB", app.name.replace("-", "_"))
            data["database"] = {
                "engine": "PostgreSQL",
                "host": "127.0.0.1",
                "port": app.host_port,
                "internal_host": app.container_name,
                "internal_port": app.internal_port,
                "database": database,
                "username": username,
                "password": password,
                "uri": f"postgresql://{quote(username, safe='')}:{quote(password, safe='')}@127.0.0.1:{app.host_port}/{quote(database, safe='')}",
                "internal_uri": f"postgresql://{quote(username, safe='')}:{quote(password, safe='')}@{app.container_name}:{app.internal_port}/{quote(database, safe='')}",
                "volume": app.volume_name,
                "admin_enabled": bool(app.database_admin_port),
                "admin_url": f"/api/apps/{app.id}/database-admin/ui/" if app.database_admin_port else "",
            }
        elif app.app_type == "mongodb":
            username = environment.get("MONGO_INITDB_ROOT_USERNAME", "nova")
            password = environment.get("MONGO_INITDB_ROOT_PASSWORD", "")
            database = environment.get("MONGO_INITDB_DATABASE", app.name.replace("-", "_"))
            data["database"] = {
                "engine": "MongoDB",
                "host": "127.0.0.1",
                "port": app.host_port,
                "internal_host": app.container_name,
                "internal_port": app.internal_port,
                "database": database,
                "username": username,
                "password": password,
                "uri": f"mongodb://{quote(username, safe='')}:{quote(password, safe='')}@127.0.0.1:{app.host_port}/{quote(database, safe='')}?authSource=admin",
                "internal_uri": f"mongodb://{quote(username, safe='')}:{quote(password, safe='')}@{app.container_name}:{app.internal_port}/{quote(database, safe='')}?authSource=admin",
                "volume": app.volume_name,
                "admin_enabled": bool(app.database_admin_port),
                "admin_url": f"/api/apps/{app.id}/database-admin/ui/" if app.database_admin_port else "",
            }
    return data


def upload_dict(item: UploadRecord) -> dict:
    return {
        "id": item.id,
        "app_id": item.app_id,
        "filename": item.filename,
        "size": item.size,
        "status": item.status,
        "files_extracted": item.files_extracted,
        "extracted_size": item.extracted_size,
        "error": item.error,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
    }


def deployment_dict(item: Deployment) -> dict:
    duration = None
    if item.started_at and item.finished_at:
        duration = max(0, int((item.finished_at - item.started_at).total_seconds()))
    return {
        "id": item.id,
        "app_id": item.app_id,
        "status": item.status,
        "stage": item.stage,
        "progress": item.progress,
        "output": item.output,
        "image": item.image,
        "trigger": item.trigger,
        "duration_seconds": duration,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "started_at": item.started_at.isoformat() if item.started_at else None,
        "finished_at": item.finished_at.isoformat() if item.finished_at else None,
    }


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
