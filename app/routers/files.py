from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import App
from app.schemas import FileCreateRequest, FileRenameRequest, FileSaveRequest
from app.security import get_current_user
from app.services import file_service


router = APIRouter(
    prefix="/api/apps/{app_id}/files",
    tags=["files"],
    dependencies=[Depends(get_current_user)],
)


def _root(db: Session, app_id: int) -> Path:
    app = db.get(App, app_id)
    if not app:
        raise HTTPException(404, "برنامه پیدا نشد")
    return Path(app.source_dir)


def _translate_error(exc: Exception) -> HTTPException:
    if isinstance(exc, FileNotFoundError):
        return HTTPException(404, str(exc))
    if isinstance(exc, FileExistsError):
        return HTTPException(409, str(exc))
    return HTTPException(400, str(exc))


@router.get("")
def list_files(app_id: int, path: str = Query(default=""), db: Session = Depends(get_db)):
    try:
        return file_service.list_directory(_root(db, app_id), path)
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.get("/content")
def file_content(app_id: int, path: str = Query(...), db: Session = Depends(get_db)):
    try:
        return {"path": path, "content": file_service.read_text(_root(db, app_id), path)}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.put("/content")
def save_file(app_id: int, payload: FileSaveRequest, db: Session = Depends(get_db)):
    try:
        file_service.write_text(_root(db, app_id), payload.path, payload.content)
        return {"ok": True}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.post("")
def create_file(app_id: int, payload: FileCreateRequest, db: Session = Depends(get_db)):
    try:
        file_service.create_item(_root(db, app_id), payload.path, payload.directory)
        return {"ok": True}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.patch("")
def rename_file(app_id: int, payload: FileRenameRequest, db: Session = Depends(get_db)):
    try:
        file_service.rename_item(_root(db, app_id), payload.old_path, payload.new_path)
        return {"ok": True}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.delete("")
def delete_file(app_id: int, path: str = Query(...), db: Session = Depends(get_db)):
    try:
        file_service.delete_item(_root(db, app_id), path)
        return {"ok": True}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)

