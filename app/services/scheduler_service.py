from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.database import SessionLocal
from app.models import App, BackupSchedule
from app.services.backup_service import create_backup, enforce_retention


scheduler = BackgroundScheduler(timezone="UTC")


def _run_schedule(schedule_id: int) -> None:
    with SessionLocal() as db:
        schedule = db.get(BackupSchedule, schedule_id)
        if not schedule or not schedule.enabled:
            return
        app = db.get(App, schedule.app_id)
        if not app:
            return
        create_backup(db, app, schedule.destination)
        schedule.last_run = datetime.now(timezone.utc)
        job = scheduler.get_job(f"backup-{schedule.id}")
        schedule.next_run = job.next_run_time if job else None
        db.commit()
        enforce_retention(db, schedule)


def sync_schedule(schedule: BackupSchedule) -> None:
    job_id = f"backup-{schedule.id}"
    if not schedule.enabled:
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
        schedule.next_run = None
        return
    kwargs = {schedule.interval_unit: schedule.interval_value}
    job = scheduler.add_job(
        _run_schedule,
        trigger=IntervalTrigger(**kwargs),
        args=[schedule.id],
        id=job_id,
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    schedule.next_run = job.next_run_time


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
    with SessionLocal() as db:
        schedules = db.scalars(select(BackupSchedule)).all()
        for schedule in schedules:
            sync_schedule(schedule)
        db.commit()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)

