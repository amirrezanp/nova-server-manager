import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass
class CommandResult:
    ok: bool
    stdout: str
    stderr: str
    returncode: int


def run_command(args: list[str], timeout: int = 600, cwd: Path | None = None) -> CommandResult:
    try:
        proc = subprocess.run(
            args,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            env=None,
        )
        return CommandResult(proc.returncode == 0, proc.stdout[-20000:], proc.stderr[-20000:], proc.returncode)
    except FileNotFoundError as exc:
        return CommandResult(False, "", str(exc), 127)
    except subprocess.TimeoutExpired as exc:
        return CommandResult(False, exc.stdout or "", f"زمان اجرای عملیات تمام شد: {exc}", 124)


def run_command_to_file(args: list[str], output: Path, timeout: int = 3600) -> CommandResult:
    try:
        with output.open("wb") as file_obj:
            proc = subprocess.run(
                args,
                stdout=file_obj,
                stderr=subprocess.PIPE,
                timeout=timeout,
                check=False,
            )
        stderr = proc.stderr.decode(errors="replace")[-20000:]
        return CommandResult(proc.returncode == 0, "", stderr, proc.returncode)
    except FileNotFoundError as exc:
        return CommandResult(False, "", str(exc), 127)
    except subprocess.TimeoutExpired as exc:
        return CommandResult(False, "", f"زمان اجرای عملیات تمام شد: {exc}", 124)


def safe_name(value: str) -> str:
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,39}", value):
        raise ValueError("نام نامعتبر است")
    return value
