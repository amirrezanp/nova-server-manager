#!/usr/bin/env bash
set -Eeuo pipefail
if [[ "${EUID}" -ne 0 ]]; then
  echo "با sudo اجرا کنید."
  exit 1
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "${SCRIPT_DIR}/requirements.txt" ]]; then
  echo "این فایل باید از داخل نسخهٔ جدید پروژه اجرا شود."
  exit 1
fi
systemctl stop nova-server-manager
rsync -a --delete --exclude='.env' --exclude='.venv' --exclude='data' \
  --exclude='__pycache__' --exclude='.pytest_cache' \
  "${SCRIPT_DIR}/" /opt/nova-server-manager/
/opt/nova-server-manager/.venv/bin/pip install -r /opt/nova-server-manager/requirements.txt
systemctl start nova-server-manager
curl -fsS http://127.0.0.1:8787/api/health
echo
echo "به‌روزرسانی با موفقیت انجام شد."
