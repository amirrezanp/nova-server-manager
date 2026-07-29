from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models import ActivityLog
from app.schemas import ServerActionRequest
from app.security import get_current_user
from app.services.common import run_command
from app.services.system_service import system_metrics


router = APIRouter(prefix="/api/system", tags=["system"], dependencies=[Depends(get_current_user)])


@router.get("/metrics")
def metrics():
    data = system_metrics()
    data["max_upload_bytes"] = settings.max_upload_mb * 1024 * 1024
    return data


@router.get("/activity")
def activity(db: Session = Depends(get_db)):
    rows = db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(50)).all()
    return [{
        "id": row.id,
        "action": row.action,
        "detail": row.detail,
        "level": row.level,
        "created_at": row.created_at.isoformat(),
    } for row in rows]


@router.post("/action", status_code=202)
def server_action(
    payload: ServerActionRequest,
    tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    command = "reboot" if payload.confirmation == "RESTART" else "poweroff"
    db.add(ActivityLog(action=f"server_{command}", detail="درخواست از پنل", level="warning"))
    db.commit()
    tasks.add_task(run_command, ["systemctl", command], 30)
    return {"ok": True, "action": command}
