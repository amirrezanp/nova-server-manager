from datetime import datetime, timezone

from sqlalchemy import select

from app.database import SessionLocal
from app.models import App, Deployment, UploadRecord


def reconcile_interrupted_deployments() -> None:
    """Close deployment rows left active by a panel or server restart."""
    with SessionLocal() as db:
        deployments = db.scalars(
            select(Deployment).where(Deployment.status.in_(("queued", "running")))
        ).all()
        now = datetime.now(timezone.utc)
        affected_apps: set[int] = set()
        for deployment in deployments:
            deployment.status = "failed"
            deployment.stage = "interrupted"
            deployment.output = (
                deployment.output + "\nDeployment interrupted by a panel restart."
            ).strip()
            deployment.finished_at = now
            affected_apps.add(deployment.app_id)
        for app_id in affected_apps:
            app = db.get(App, app_id)
            if app and app.status == "deploying":
                app.status = "failed"
                app.last_error = "Deployment interrupted by a panel restart."
        uploads = db.scalars(
            select(UploadRecord).where(UploadRecord.status == "processing")
        ).all()
        for upload in uploads:
            upload.status = "failed"
            upload.error = "Upload interrupted by a panel restart."
            upload.completed_at = now
        if deployments or uploads:
            db.commit()
