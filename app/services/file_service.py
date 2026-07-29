import shutil
import stat as stat_module
import zipfile
from pathlib import Path


TEXT_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".html",
    ".css", ".scss", ".yml", ".yaml", ".toml", ".ini", ".conf", ".env",
    ".sh", ".sql", ".xml", ".svg", ".vue", ".php", ".go", ".rs", ".java",
}


def resolve_safe(root: Path, relative: str = "") -> Path:
    root = root.resolve()
    target = (root / relative.lstrip("/\\")).resolve()
    if target != root and root not in target.parents:
        raise ValueError("مسیر خارج از پوشهٔ برنامه مجاز نیست")
    return target


def list_directory(root: Path, relative: str = "") -> dict:
    root = root.resolve()
    target = resolve_safe(root, relative)
    if not target.exists() or not target.is_dir():
        raise FileNotFoundError("پوشه پیدا نشد")
    items = []
    for item in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
        stat = item.stat()
        items.append({
            "name": item.name,
            "path": str(item.relative_to(root)).replace("\\", "/"),
            "directory": item.is_dir(),
            "size": stat.st_size if item.is_file() else 0,
            "modified": stat.st_mtime,
            "permissions": stat_module.filemode(stat.st_mode),
            "extension": item.suffix.lower(),
        })
    return {"path": str(target.relative_to(root)).replace("\\", "/") if target != root else "", "items": items}


def read_text(root: Path, relative: str) -> str:
    target = resolve_safe(root, relative)
    if not target.is_file():
        raise FileNotFoundError("فایل پیدا نشد")
    if target.stat().st_size > 5_000_000:
        raise ValueError("فایل برای ویرایش آنلاین بیش از حد بزرگ است")
    if target.suffix.lower() not in TEXT_EXTENSIONS and target.name not in {"Dockerfile", "Procfile"}:
        raise ValueError("این نوع فایل متنی قابل ویرایش نیست")
    return target.read_text(encoding="utf-8")


def write_text(root: Path, relative: str, content: str) -> None:
    target = resolve_safe(root, relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def create_item(root: Path, relative: str, directory: bool) -> None:
    target = resolve_safe(root, relative)
    if target.exists():
        raise FileExistsError("این نام از قبل وجود دارد")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.mkdir(parents=True) if directory else target.touch()


def delete_item(root: Path, relative: str) -> None:
    target = resolve_safe(root, relative)
    if target == root:
        raise ValueError("حذف پوشهٔ اصلی مجاز نیست")
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    else:
        raise FileNotFoundError("فایل پیدا نشد")


def rename_item(root: Path, old_relative: str, new_relative: str) -> None:
    old = resolve_safe(root, old_relative)
    new = resolve_safe(root, new_relative)
    if not old.exists():
        raise FileNotFoundError("فایل پیدا نشد")
    if new.exists():
        raise FileExistsError("نام مقصد وجود دارد")
    new.parent.mkdir(parents=True, exist_ok=True)
    old.rename(new)


def copy_item(root: Path, source_relative: str, destination_relative: str) -> None:
    source = resolve_safe(root, source_relative)
    destination = resolve_safe(root, destination_relative)
    if not source.exists():
        raise FileNotFoundError("فایل مبدأ پیدا نشد")
    if source.is_symlink():
        raise ValueError("کپی پیوند نمادین مجاز نیست")
    if destination.exists():
        raise FileExistsError("مسیر مقصد از قبل وجود دارد")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        if any(item.is_symlink() for item in source.rglob("*")):
            raise ValueError("پوشه دارای پیوند نمادین و غیرقابل کپی است")
        shutil.copytree(source, destination)
    else:
        shutil.copy2(source, destination)


def create_archive(root: Path, paths: list[str], destination_relative: str) -> Path:
    destination = resolve_safe(root, destination_relative)
    if destination.suffix.lower() != ".zip":
        raise ValueError("نام فایل فشرده باید با .zip تمام شود")
    if destination.exists():
        raise FileExistsError("فایل فشرده مقصد از قبل وجود دارد")
    destination.parent.mkdir(parents=True, exist_ok=True)
    sources = [resolve_safe(root, item) for item in paths]
    if any(not item.exists() for item in sources):
        raise FileNotFoundError("یکی از فایل‌های انتخاب‌شده پیدا نشد")
    try:
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for source in sources:
                candidates = source.rglob("*") if source.is_dir() else [source]
                for item in candidates:
                    if item.is_symlink():
                        raise ValueError("فشرده‌سازی پیوند نمادین مجاز نیست")
                    if item.is_file():
                        archive.write(item, item.relative_to(root))
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    return destination


def extract_archive(root: Path, archive_relative: str, destination_relative: str = "") -> None:
    archive = resolve_safe(root, archive_relative)
    destination = resolve_safe(root, destination_relative)
    if not archive.is_file() or archive.suffix.lower() != ".zip":
        raise ValueError("فایل ZIP معتبر انتخاب نشده است")
    destination.mkdir(parents=True, exist_ok=True)
    try:
        extract_zip_safely(archive, destination)
    except zipfile.BadZipFile as exc:
        raise ValueError("فایل ZIP خراب یا نامعتبر است") from exc


def extract_zip_safely(archive: Path, destination: Path) -> None:
    destination = destination.resolve()
    with zipfile.ZipFile(archive) as package:
        members = package.infolist()
        if len(members) > 100_000:
            raise ValueError("تعداد فایل‌های ZIP بیش از حد مجاز است")
        if any(item.flag_bits & 0x1 for item in members):
            raise ValueError("فایل ZIP رمزگذاری‌شده پشتیبانی نمی‌شود")
        total = sum(item.file_size for item in members)
        if total > 2 * 1024 * 1024 * 1024:
            raise ValueError("حجم بازشدهٔ فایل بیش از ۲ گیگابایت است")
        free_space = shutil.disk_usage(destination.parent).free
        if total + 512 * 1024 * 1024 > free_space:
            raise ValueError("فضای آزاد سرور برای استخراج این فایل کافی نیست")
        for item in members:
            target = (destination / item.filename).resolve()
            if target != destination and destination not in target.parents:
                raise ValueError("ساختار ZIP ناامن است")
        package.extractall(destination)


def directory_stats(root: Path) -> tuple[int, int]:
    files = 0
    size = 0
    if not root.exists():
        return files, size
    for item in root.rglob("*"):
        if item.is_file():
            files += 1
            try:
                size += item.stat().st_size
            except OSError:
                pass
    return files, size
