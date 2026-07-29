from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import App
from app.schemas import (
    FileArchiveRequest,
    FileCopyRequest,
    FileCreateRequest,
    FileExtractRequest,
    FileRenameRequest,
    FileSaveRequest,
)
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


@router.get("/download")
def download_file(app_id: int, path: str = Query(...), db: Session = Depends(get_db)):
    try:
        target = file_service.resolve_safe(_root(db, app_id), path)
        if not target.is_file():
            raise FileNotFoundError("فایل پیدا نشد")
        return FileResponse(target, filename=target.name, media_type="application/octet-stream")
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.post("/upload")
async def upload_file(
    app_id: int,
    path: str = Query(default=""),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    root = _root(db, app_id)
    filename = Path(file.filename or "").name
    if not filename or filename in {".", ".."}:
        raise HTTPException(400, "نام فایل نامعتبر است")
    try:
        directory = file_service.resolve_safe(root, path)
        if not directory.is_dir():
            raise FileNotFoundError("پوشه مقصد پیدا نشد")
        target = file_service.resolve_safe(root, str(Path(path) / filename))
        if target.exists():
            raise FileExistsError("فایلی با این نام از قبل وجود دارد")
        temporary = target.with_name(f".{target.name}.uploading")
        size = 0
        try:
            with temporary.open("xb") as output:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > settings.max_upload_mb * 1024 * 1024:
                        raise ValueError("حجم فایل بیشتر از حد مجاز است")
                    output.write(chunk)
            temporary.replace(target)
        finally:
            temporary.unlink(missing_ok=True)
        return {"ok": True, "path": str(target.relative_to(root)).replace("\\", "/"), "size": size}
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


@router.post("/copy")
def copy_file(app_id: int, payload: FileCopyRequest, db: Session = Depends(get_db)):
    try:
        file_service.copy_item(
            _root(db, app_id), payload.source_path, payload.destination_path
        )
        return {"ok": True}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.post("/compress")
def compress_files(app_id: int, payload: FileArchiveRequest, db: Session = Depends(get_db)):
    try:
        archive = file_service.create_archive(
            _root(db, app_id), payload.paths, payload.destination_path
        )
        return {"ok": True, "path": payload.destination_path, "size": archive.stat().st_size}
    except (ValueError, OSError) as exc:
        raise _translate_error(exc)


@router.post("/extract")
def extract_file(app_id: int, payload: FileExtractRequest, db: Session = Depends(get_db)):
    try:
        file_service.extract_archive(
            _root(db, app_id), payload.archive_path, payload.destination_path
        )
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
