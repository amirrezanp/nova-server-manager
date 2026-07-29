from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Deployment
from app.routers.helpers import deployment_dict
from app.security import get_current_user


router = APIRouter(
    prefix="/api/deployments",
    tags=["deployments"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_deployments(limit: int = 50, db: Session = Depends(get_db)):
    limit = max(1, min(limit, 200))
    rows = db.scalars(
        select(Deployment).order_by(Deployment.created_at.desc()).limit(limit)
    ).all()
    return [deployment_dict(item) for item in rows]
