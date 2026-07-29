from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import ActivityLog, User
from app.schemas import LoginRequest, SetupRequest
from app.security import COOKIE_NAME, create_token, get_current_user, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        max_age=settings.access_token_minutes * 60,
        path="/",
    )


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    count = db.scalar(select(func.count()).select_from(User)) or 0
    return {"setup_required": count == 0}


@router.post("/setup")
def setup(payload: SetupRequest, response: Response, db: Session = Depends(get_db)):
    count = db.scalar(select(func.count()).select_from(User)) or 0
    if count:
        raise HTTPException(409, "راه‌اندازی اولیه قبلاً انجام شده است")
    user = User(username=payload.username, password_hash=hash_password(payload.password), is_admin=True)
    db.add(user)
    db.flush()
    db.add(ActivityLog(action="initial_setup", detail=f"مدیر {user.username} ساخته شد"))
    db.commit()
    db.refresh(user)
    _set_cookie(response, create_token(user.id))
    return {"ok": True, "user": {"id": user.id, "username": user.username}}


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "نام کاربری یا رمز عبور نادرست است")
    _set_cookie(response, create_token(user.id))
    return {"ok": True, "user": {"id": user.id, "username": user.username}}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}

