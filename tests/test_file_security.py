import zipfile
from pathlib import Path

import pytest

from app.services.file_service import (
    copy_item,
    create_archive,
    extract_archive,
    extract_zip_safely,
    list_directory,
    resolve_safe,
)


def test_resolve_safe_blocks_parent(tmp_path: Path):
    with pytest.raises(ValueError):
        resolve_safe(tmp_path, "../../etc/passwd")


def test_zip_slip_is_blocked(tmp_path: Path):
    archive = tmp_path / "unsafe.zip"
    destination = tmp_path / "destination"
    destination.mkdir()
    with zipfile.ZipFile(archive, "w") as package:
        package.writestr("../../outside.txt", "bad")
    with pytest.raises(ValueError):
        extract_zip_safely(archive, destination)
    assert not (tmp_path.parent / "outside.txt").exists()


def test_copy_compress_extract_and_file_metadata(tmp_path: Path):
    source = tmp_path / "src"
    source.mkdir()
    (source / "app.py").write_text("print('nova')\n", encoding="utf-8")

    copy_item(tmp_path, "src/app.py", "src/app-copy.py")
    assert (source / "app-copy.py").read_text(encoding="utf-8") == "print('nova')\n"

    archive = create_archive(tmp_path, ["src/app.py"], "bundle.zip")
    assert archive.is_file()
    destination = tmp_path / "restored"
    extract_archive(tmp_path, "bundle.zip", "restored")
    assert (destination / "src" / "app.py").is_file()

    listing = list_directory(tmp_path, "src")
    item = next(entry for entry in listing["items"] if entry["name"] == "app.py")
    assert item["permissions"].startswith("-")
    assert item["extension"] == ".py"
