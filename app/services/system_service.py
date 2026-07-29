import os
import platform
import shutil
import time

import psutil

from app.services.common import run_command


def system_metrics() -> dict:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    boot = datetime_from_timestamp(psutil.boot_time())
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.15),
        "cpu_count": psutil.cpu_count(),
        "memory_percent": memory.percent,
        "memory_used": memory.used,
        "memory_total": memory.total,
        "disk_percent": disk.percent,
        "disk_used": disk.used,
        "disk_total": disk.total,
        "disk_free": disk.free,
        "load": list(os.getloadavg()) if hasattr(os, "getloadavg") else [0, 0, 0],
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "boot_time": boot,
        "hostname": platform.node(),
        "os": f"{platform.system()} {platform.release()}",
        "docker": shutil.which("docker") is not None and run_command(["docker", "info"], timeout=10).ok,
        "nginx": shutil.which("nginx") is not None,
    }


def datetime_from_timestamp(value: float) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(value, timezone.utc).isoformat()
