import zipfile
from pathlib import Path

import pytest

from app.services.file_service import extract_zip_safely, resolve_safe


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

