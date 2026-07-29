import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import TelegramSettings
from app.security import get_current_user
from app.services.settings_service import get_setting, set_setting


router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


@router.get("/telegram")
def telegram_status(db: Session = Depends(get_db)):
    token = get_setting(db, "telegram_bot_token")
    chat_id = get_setting(db, "telegram_chat_id")
    return {
        "configured": bool(token and chat_id),
        "chat_id": chat_id,
        "token_hint": f"...{token[-6:]}" if token else "",
    }


@router.put("/telegram")
def save_telegram(payload: TelegramSettings, db: Session = Depends(get_db)):
    try:
        response = httpx.get(
            f"https://api.telegram.org/bot{payload.bot_token}/getMe",
            timeout=20,
        )
        data = response.json()
    except Exception as exc:
        raise HTTPException(502, f"ارتباط با تلگرام برقرار نشد: {exc}")
    if not data.get("ok"):
        raise HTTPException(400, data.get("description", "توکن ربات نامعتبر است"))
    set_setting(db, "telegram_bot_token", payload.bot_token, encrypted=True)
    set_setting(db, "telegram_chat_id", payload.admin_chat_id, encrypted=True)
    return {
        "ok": True,
        "bot": data["result"].get("username"),
        "message": "تنظیمات ذخیره شد؛ ابتدا یک پیام به ربات بفرستید.",
    }


@router.post("/telegram/test")
def test_telegram(db: Session = Depends(get_db)):
    token = get_setting(db, "telegram_bot_token")
    chat_id = get_setting(db, "telegram_chat_id")
    if not token or not chat_id:
        raise HTTPException(400, "تنظیمات تلگرام تکمیل نشده است")
    try:
        response = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data={"chat_id": chat_id, "text": "✅ اتصال نوا سرور منیجر با موفقیت برقرار شد."},
            timeout=20,
        )
        data = response.json()
    except Exception as exc:
        raise HTTPException(502, f"ارتباط با تلگرام برقرار نشد: {exc}")
    if not data.get("ok"):
        raise HTTPException(400, data.get("description", "ارسال پیام ناموفق بود"))
    return {"ok": True}

