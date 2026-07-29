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

restore_service_on_error() {
  local exit_code=$?
  echo "به‌روزرسانی کامل نشد؛ تلاش برای برگرداندن سرویس..."
  systemctl start nova-server-manager >/dev/null 2>&1 || true
  exit "${exit_code}"
}
trap restore_service_on_error ERR

if [[ -f /var/lib/nova-server-manager/nova.db ]]; then
  install -d -m 0755 /var/lib/nova-server-manager/update-snapshots
  cp -a /var/lib/nova-server-manager/nova.db \
    "/var/lib/nova-server-manager/update-snapshots/nova-$(date +%Y%m%d-%H%M%S).db"
fi

systemctl stop nova-server-manager
rsync -a --delete --exclude='.git' --exclude='.env' --exclude='.venv' --exclude='data' \
  --exclude='__pycache__' --exclude='.pytest_cache' \
  --exclude='frontend/node_modules' --exclude='frontend/.next' --exclude='frontend/out' \
  "${SCRIPT_DIR}/" /opt/nova-server-manager/
/opt/nova-server-manager/.venv/bin/pip install -r /opt/nova-server-manager/requirements.txt
systemctl start nova-server-manager

HEALTHY=false
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
    HEALTHY=true
    break
  fi
  sleep 1
done

if [[ "${HEALTHY}" != "true" ]]; then
  echo "سرویس پس از ۳۰ ثانیه آماده نشد. آخرین گزارش:"
  journalctl -u nova-server-manager -n 80 --no-pager
  exit 1
fi

curl -fsS http://127.0.0.1:8787/api/health
trap - ERR
echo
echo "به‌روزرسانی با موفقیت انجام شد."
