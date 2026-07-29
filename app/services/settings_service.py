import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Setting


def _fernet() -> Fernet:
    key = hashlib.sha256(settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def set_setting(db: Session, key: str, value: str, encrypted: bool = False) -> None:
    stored = _fernet().encrypt(value.encode()).decode() if encrypted else value
    item = db.get(Setting, key)
    if item:
        item.value = stored
        item.encrypted = encrypted
    else:
        db.add(Setting(key=key, value=stored, encrypted=encrypted))
    db.commit()


def get_setting(db: Session, key: str, default: str = "") -> str:
    item = db.get(Setting, key)
    if not item:
        return default
    if not item.encrypted:
        return item.value
    try:
        return _fernet().decrypt(item.value.encode()).decode()
    except InvalidToken:
        return default

