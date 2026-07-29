import json
import secrets
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.models import ActivityLog, App, Deployment, UploadRecord, User
from app.routers.helpers import app_dict, deployment_dict, upload_dict
from app.schemas import AppCreate, AppUpdate, ContainerExecRequest, DomainRequest
from app.security import get_current_user
from app.services import docker_service, proxy_service
from app.services.file_service import directory_stats, extract_zip_safely


router = APIRouter(prefix="/api/apps", tags=["apps"], dependencies=[Depends(get_current_user)])


def _get_app(db: Session, app_id: int) -> App:
    app = db.get(App, app_id)
    if not app:
        raise HTTPException(404, "برنامه پیدا نشد")
    return app


def _deploy_background(app_id: int, deployment_id: int) -> None:
    with SessionLocal() as db:
        app = db.get(App, app_id)
        deployment = db.get(Deployment, deployment_id)
        if not app or not deployment:
            return
        app.status = "deploying"
        app.last_error = ""
        deployment.status = "running"
        deployment.stage = "preparing"
        deployment.progress = 5
        deployment.started_at = datetime.now(timezone.utc)
        db.commit()

        def update_progress(stage: str, progress: int) -> None:
            deployment.stage = stage
            deployment.progress = progress
            db.commit()

        try:
            result = docker_service.deploy(app, update_progress)
        except Exception as exc:
            from app.services.common import CommandResult
            db.rollback()
            app = db.get(App, app_id)
            deployment = db.get(Deployment, deployment_id)
            if not app or not deployment:
                return
            result = CommandResult(
                False,
                "",
                f"Unexpected deployment error: {type(exc).__name__}: {exc}",
                1,
            )
        app.status = "running" if result.ok else "failed"
        app.last_error = "" if result.ok else (result.stderr or result.stdout)[-5000:]
        if result.ok:
            app.last_deployed_at = datetime.now(timezone.utc)
        deployment.status = "completed" if result.ok else "failed"
        deployment.stage = "completed" if result.ok else "failed"
        deployment.progress = 100
        deployment.output = (result.stdout + result.stderr)[-50000:]
        deployment.image = app.image
        deployment.finished_at = datetime.now(timezone.utc)
        db.add(ActivityLog(
            action="deploy",
            detail=f"{app.name}: {'موفق' if result.ok else 'ناموفق'}",
            level="info" if result.ok else "error",
        ))
        db.commit()


@router.get("")
def list_apps(db: Session = Depends(get_db)):
    apps = db.scalars(select(App).order_by(App.created_at.desc())).all()
    for app in apps:
        current = docker_service.inspect_status(app)
        mapped = "running" if current == "running" else ("deploying" if app.status == "deploying" else current)
        if mapped != app.status and app.status != "failed":
            app.status = mapped
    db.commit()
    return [app_dict(app) for app in apps]


@router.post("", status_code=201)
def create_app(payload: AppCreate, db: Session = Depends(get_db)):
    if db.scalar(select(App).where(App.name == payload.name)):
        raise HTTPException(409, "این نام قبلاً استفاده شده است")
    source = settings.app_dir / payload.name
    source.mkdir(parents=True, exist_ok=False)
    environment = dict(payload.environment)
    internal_port = payload.internal_port
    if payload.app_type in docker_service.DEFAULT_PORTS and payload.internal_port == 3000:
        internal_port = docker_service.DEFAULT_PORTS[payload.app_type]
    if payload.app_type == "postgres":
        environment.setdefault("POSTGRES_USER", "nova")
        environment.setdefault("POSTGRES_PASSWORD", secrets.token_urlsafe(20))
        environment.setdefault("POSTGRES_DB", payload.name.replace("-", "_"))
    elif payload.app_type == "mongodb":
        environment.setdefault("MONGO_INITDB_ROOT_USERNAME", "nova")
        environment.setdefault("MONGO_INITDB_ROOT_PASSWORD", secrets.token_urlsafe(20))
    app = App(
        name=payload.name,
        display_name=payload.display_name or payload.name,
        app_type=payload.app_type,
        container_name=f"nova-{payload.name}",
        image=payload.image,
        internal_port=internal_port,
        host_port=docker_service.allocate_port(),
        start_command=payload.start_command,
        env_json=json.dumps(environment),
        source_dir=str(source),
        volume_name=f"nova-{payload.name}-data" if payload.app_type in {"postgres", "mongodb"} else "",
    )
    db.add(app)
    db.add(ActivityLog(action="app_create", detail=f"برنامه {payload.name} ساخته شد"))
    db.commit()
    db.refresh(app)
    return app_dict(app, include_env=True)


@router.get("/{app_id}")
def get_app(app_id: int, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    current = docker_service.inspect_status(app)
    if current == "running":
        app.status = "running"
    elif app.status not in {"failed", "deploying"}:
        app.status = current
    db.commit()
    return app_dict(app, include_env=True)


@router.patch("/{app_id}")
def update_app(app_id: int, payload: AppUpdate, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    values = payload.model_dump(exclude_unset=True)
    if "environment" in values:
        app.env_json = json.dumps(values.pop("environment"))
    for key, value in values.items():
        setattr(app, key, value)
    db.commit()
    db.refresh(app)
    return app_dict(app, include_env=True)


@router.post("/{app_id}/upload")
async def upload_source(
    app_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    app = _get_app(db, app_id)
    filename = (file.filename or "").lower()
    if not filename.endswith(".zip"):
        raise HTTPException(400, "فقط فایل ZIP پذیرفته می‌شود")
    active_upload = db.scalar(
        select(UploadRecord).where(
            UploadRecord.app_id == app.id,
            UploadRecord.status == "processing",
        )
    )
    if active_upload:
        raise HTTPException(409, "یک فایل دیگر برای این برنامه در حال پردازش است")
    token = secrets.token_hex(6)
    temp = settings.data_dir / f"upload-{app.id}-{token}.zip"
    source = Path(app.source_dir)
    staging = source.parent / f".{app.name}-staging-{token}"
    old = source.parent / f".{app.name}-old-{token}"
    size = 0
    record = UploadRecord(
        app_id=app.id,
        filename=(file.filename or "source.zip")[:255],
        status="processing",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    try:
        with temp.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > settings.max_upload_mb * 1024 * 1024:
                    raise HTTPException(413, "حجم فایل بیشتر از حد مجاز است")
                output.write(chunk)
        staging.mkdir(parents=True)
        extract_zip_safely(temp, staging)
        # Flatten ZIPs containing one top-level directory.
        entries = list(staging.iterdir())
        if len(entries) == 1 and entries[0].is_dir():
            nested = entries[0]
            for child in list(nested.iterdir()):
                child.rename(staging / child.name)
            nested.rmdir()
        file_count, extracted_size = directory_stats(staging)
        if not file_count:
            raise ValueError("فایل ZIP هیچ فایل قابل استفاده‌ای ندارد")
        if source.exists():
            source.rename(old)
        staging.rename(source)
        if old.exists():
            shutil.rmtree(old)
        now = datetime.now(timezone.utc)
        app.last_upload_name = record.filename
        app.last_upload_size = size
        app.last_upload_at = now
        app.source_files = file_count
        app.source_size = extracted_size
        record.size = size
        record.files_extracted = file_count
        record.extracted_size = extracted_size
        record.status = "completed"
        record.completed_at = now
        db.add(ActivityLog(action="source_upload", detail=f"{app.name}: {size} bytes"))
        db.commit()
        return {
            "ok": True,
            "size": size,
            "upload": upload_dict(record),
            "source": {"files": file_count, "size": extracted_size},
        }
    except HTTPException as exc:
        record.size = size
        record.status = "failed"
        record.error = str(exc.detail)[:2000]
        record.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise
    except Exception as exc:
        record.size = size
        record.status = "failed"
        record.error = str(exc)[:2000]
        record.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(400, str(exc))
    finally:
        temp.unlink(missing_ok=True)
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)
        if old.exists() and not source.exists():
            old.rename(source)
        elif old.exists():
            shutil.rmtree(old, ignore_errors=True)


@router.post("/{app_id}/deploy", status_code=202)
def deploy_app(app_id: int, tasks: BackgroundTasks, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    if not docker_service.docker_available():
        raise HTTPException(503, "Docker در دسترس نیست")
    active = db.scalar(
        select(Deployment).where(
            Deployment.app_id == app.id,
            Deployment.status.in_(("queued", "running")),
        )
    )
    if active:
        raise HTTPException(409, "یک دیپلوی برای این برنامه در حال اجرا است")
    app.status = "deploying"
    app.last_error = ""
    deployment = Deployment(app_id=app.id, status="queued", stage="queued", progress=0)
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    tasks.add_task(_deploy_background, app.id, deployment.id)
    return {
        "ok": True,
        "status": "deploying",
        "deployment": deployment_dict(deployment),
    }


@router.get("/{app_id}/uploads")
def app_uploads(app_id: int, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    rows = db.scalars(
        select(UploadRecord)
        .where(UploadRecord.app_id == app_id)
        .order_by(UploadRecord.created_at.desc())
        .limit(20)
    ).all()
    return [upload_dict(item) for item in rows]


@router.get("/{app_id}/deployments")
def app_deployments(app_id: int, db: Session = Depends(get_db)):
    _get_app(db, app_id)
    rows = db.scalars(
        select(Deployment)
        .where(Deployment.app_id == app_id)
        .order_by(Deployment.created_at.desc())
        .limit(30)
    ).all()
    return [deployment_dict(item) for item in rows]


@router.post("/{app_id}/actions/{operation}")
def app_action(app_id: int, operation: str, db: Session = Depends(get_db)):
    if operation not in {"start", "stop", "restart"}:
        raise HTTPException(404, "عملیات نامعتبر")
    app = _get_app(db, app_id)
    exists = docker_service.container_exists(app)
    if not exists and operation == "stop":
        app.status = "stopped"
        db.commit()
        return {"ok": True, "status": "stopped"}
    if not exists:
        raise HTTPException(
            409,
            "کانتینر هنوز ساخته نشده است؛ ابتدا برنامه را دیپلوی کنید",
        )
    result = docker_service.action(app, operation)
    if not result.ok:
        message = (result.stderr or result.stdout or "عملیات Docker ناموفق بود").strip()
        app.last_error = message[-5000:]
        db.add(ActivityLog(
            action=f"app_{operation}",
            detail=f"{app.name}: {message[-500:]}",
            level="error",
        ))
        db.commit()
        raise HTTPException(409, message)
    app.status = "stopped" if operation == "stop" else "running"
    db.add(ActivityLog(action=f"app_{operation}", detail=app.name))
    db.commit()
    return {"ok": True, "status": app.status}


@router.get("/{app_id}/logs")
def app_logs(app_id: int, tail: int = Query(default=300, ge=10, le=2000), db: Session = Depends(get_db)):
    return {"logs": docker_service.logs(_get_app(db, app_id), tail)}


@router.post("/{app_id}/exec")
def app_exec(app_id: int, payload: ContainerExecRequest, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    if docker_service.inspect_status(app) != "running":
        raise HTTPException(409, "کانتینر در حال اجرا نیست")
    result = docker_service.execute(app, payload.command)
    return {
        "ok": result.ok,
        "output": (result.stdout + result.stderr)[-100000:],
        "exit_code": result.returncode,
    }


@router.get("/{app_id}/stats")
def app_stats(app_id: int, db: Session = Depends(get_db)):
    return docker_service.stats(_get_app(db, app_id))


@router.post("/{app_id}/domain")
def set_domain(app_id: int, payload: DomainRequest, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    if app.app_type in {"postgres", "mongodb"}:
        raise HTTPException(400, "دامنه HTTP به سرویس دیتابیس متصل نمی‌شود")
    existing = db.scalar(select(App).where(App.domain == payload.domain, App.id != app.id))
    if existing:
        raise HTTPException(409, "این دامنه به برنامهٔ دیگری متصل است")
    result = proxy_service.configure_domain(app, payload.domain, payload.enable_ssl)
    if not result.ok:
        raise HTTPException(500, result.stderr or result.stdout)
    app.domain = payload.domain.lower()
    db.add(ActivityLog(action="domain_set", detail=f"{app.name}: {app.domain}"))
    db.commit()
    return {"ok": True, "domain": app.domain}


@router.delete("/{app_id}")
def delete_app(app_id: int, delete_data: bool = False, db: Session = Depends(get_db)):
    app = _get_app(db, app_id)
    docker_service.remove(app)
    proxy_service.remove_domain(app)
    name = app.name
    source = Path(app.source_dir)
    volume = app.volume_name
    db.delete(app)
    db.commit()
    if delete_data:
        if source.resolve().parent == settings.app_dir.resolve():
            shutil.rmtree(source, ignore_errors=True)
        if volume:
            from app.services.common import run_command
            run_command(["docker", "volume", "rm", volume], timeout=120)
    return {"ok": True, "name": name, "data_deleted": delete_data}
