import os
import platform
import shutil
import socket
import time

import psutil

from app.services.common import run_command


def primary_ipv4() -> str:
    addresses: list[str] = []
    try:
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = item[4][0]
            if not address.startswith("127.") and address not in addresses:
                addresses.append(address)
    except OSError:
        pass
    return addresses[0] if addresses else ""


def system_metrics() -> dict:
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    network = psutil.net_io_counters()
    boot = datetime_from_timestamp(psutil.boot_time())
    addresses = []
    try:
        for item in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = item[4][0]
            if not address.startswith("127.") and address not in addresses:
                addresses.append(address)
    except OSError:
        pass
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
        "network_sent": network.bytes_sent,
        "network_received": network.bytes_recv,
        "network_total": network.bytes_sent + network.bytes_recv,
        "load": list(os.getloadavg()) if hasattr(os, "getloadavg") else [0, 0, 0],
        "uptime_seconds": int(time.time() - psutil.boot_time()),
        "boot_time": boot,
        "hostname": platform.node(),
        "ip_addresses": addresses,
        "primary_ip": primary_ipv4(),
        "os": f"{platform.system()} {platform.release()}",
        "docker": shutil.which("docker") is not None and run_command(["docker", "info"], timeout=10).ok,
        "nginx": shutil.which("nginx") is not None,
    }


def datetime_from_timestamp(value: float) -> str:
    from datetime import datetime, timezone
    return datetime.fromtimestamp(value, timezone.utc).isoformat()
