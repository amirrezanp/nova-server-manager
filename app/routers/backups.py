from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import SessionLocal, get_db
from app.models import App, Backup, BackupSchedule
from app.routers.helpers import backup_dict, schedule_dict
from app.schemas import BackupCreateRequest, ScheduleCreate
from app.security import get_current_user
from app.services.backup_service import create_backup, restore_backup
from app.services.docker_service import deploy
from app.services.scheduler_service import scheduler, sync_schedule


router = APIRouter(prefix="/api/backups", tags=["backups"], dependencies=[Depends(get_current_user)])


def _create_background(app_id: int, destination: str) -> None:
    with SessionLocal() as db:
        app = db.get(App, app_id)
        if app:
            create_backup(db, app, destination)


def _restore_background(app_id: int, backup_id: int) -> None:
    with SessionLocal() as db:
        app = db.get(App, app_id)
        backup = db.get(Backup, backup_id)
        if app and backup and backup.app_id == app.id:
            try:
                restore_backup(app, backup)
                result = deploy(app)
                app.status = "running" if result.ok else "failed"
                app.last_error = "" if result.ok else result.stderr
            except Exception as exc:
                app.status = "failed"
                app.last_error = f"Restore: {exc}"
            db.commit()


@router.get("")
def list_backups(app_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Backup).order_by(Backup.created_at.desc())
    if app_id is not None:
        query = query.where(Backup.app_id == app_id)
    return [backup_dict(item) for item in db.scalars(query).all()]


@router.post("/apps/{app_id}", status_code=202)
def backup_app(
    app_id: int,
    payload: BackupCreateRequest,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not db.get(App, app_id):
        raise HTTPException(404, "برنامه پیدا نشد")
    tasks.add_task(_create_background, app_id, payload.destination)
    return {"ok": True, "status": "creating"}


@router.get("/items/{backup_id}/download")
def download_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = db.get(Backup, backup_id)
    if not backup:
        raise HTTPException(404, "بکاپ پیدا نشد")
    path = Path(backup.path)
    if not path.is_file():
        raise HTTPException(404, "فایل بکاپ روی سرور موجود نیست")
    return FileResponse(path, filename=backup.filename, media_type="application/gzip")


@router.post("/items/{backup_id}/restore", status_code=202)
def restore(
    backup_id: int,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    backup = db.get(Backup, backup_id)
    if not backup:
        raise HTTPException(404, "بکاپ پیدا نشد")
    app = db.get(App, backup.app_id)
    if not app:
        raise HTTPException(404, "برنامهٔ مرتبط پیدا نشد")
    app.status = "restoring"
    db.commit()
    tasks.add_task(_restore_background, app.id, backup.id)
    return {"ok": True, "status": "restoring"}


@router.delete("/items/{backup_id}")
def delete_backup(backup_id: int, db: Session = Depends(get_db)):
    backup = db.get(Backup, backup_id)
    if not backup:
        raise HTTPException(404, "بکاپ پیدا نشد")
    Path(backup.path).unlink(missing_ok=True)
    db.delete(backup)
    db.commit()
    return {"ok": True}


@router.get("/schedules/all")
def list_schedules(db: Session = Depends(get_db)):
    return [schedule_dict(item) for item in db.scalars(select(BackupSchedule)).all()]


@router.post("/schedules", status_code=201)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db)):
    if not db.get(App, payload.app_id):
        raise HTTPException(404, "برنامه پیدا نشد")
    schedule = BackupSchedule(**payload.model_dump())
    db.add(schedule)
    db.flush()
    sync_schedule(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule_dict(schedule)


@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: int, payload: ScheduleCreate, db: Session = Depends(get_db)):
    schedule = db.get(BackupSchedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "زمان‌بندی پیدا نشد")
    for key, value in payload.model_dump().items():
        setattr(schedule, key, value)
    sync_schedule(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule_dict(schedule)


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    schedule = db.get(BackupSchedule, schedule_id)
    if not schedule:
        raise HTTPException(404, "زمان‌بندی پیدا نشد")
    job = scheduler.get_job(f"backup-{schedule.id}")
    if job:
        scheduler.remove_job(job.id)
    db.delete(schedule)
    db.commit()
    return {"ok": True}
