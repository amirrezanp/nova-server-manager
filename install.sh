#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "این نصب‌کننده باید با sudo اجرا شود: sudo bash install.sh"
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "سیستم عامل قابل تشخیص نیست."
  exit 1
fi
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "این نسخه برای Ubuntu 22.04/24.04 طراحی شده است."
  exit 1
fi

INSTALL_DIR="/opt/nova-server-manager"
DATA_DIR="/var/lib/nova-server-manager"
SERVICE_FILE="/etc/systemd/system/nova-server-manager.service"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}"

if [[ ! -f "${SOURCE_DIR}/requirements.txt" ]]; then
  echo "فایل‌های پروژه کنار install.sh نیستند."
  echo "ابتدا بستهٔ نوا را روی سرور Extract و سپس sudo bash install.sh اجرا کنید."
  exit 1
fi

echo "[1/7] نصب پیش‌نیازهای سیستم..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx \
  curl ca-certificates unzip rsync ufw

# Keep an existing Docker installation. Mixing Ubuntu's docker.io/containerd
# packages with Docker CE's docker-ce/containerd.io packages causes conflicts.
if command -v docker >/dev/null 2>&1; then
  echo "Docker از قبل نصب است؛ همان نسخه حفظ می‌شود."
elif apt-cache show docker-ce >/dev/null 2>&1; then
  echo "نصب Docker CE از مخزن رسمی موجود..."
  apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
else
  echo "نصب Docker از مخزن Ubuntu..."
  apt-get install -y docker.io
fi
systemctl enable --now docker nginx

echo "[2/7] انتقال فایل‌های برنامه..."
install -d -m 0755 "${INSTALL_DIR}" "${DATA_DIR}/apps" "${DATA_DIR}/backups"
rsync -a --delete \
  --exclude='.git' --exclude='.env' --exclude='.venv' --exclude='data' \
  --exclude='__pycache__' --exclude='.pytest_cache' \
  --exclude='frontend/node_modules' --exclude='frontend/.next' --exclude='frontend/out' \
  "${SOURCE_DIR}/" "${INSTALL_DIR}/"

echo "[3/7] ساخت محیط پایتون..."
python3 -m venv "${INSTALL_DIR}/.venv"
"${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip wheel
"${INSTALL_DIR}/.venv/bin/pip" install -r "${INSTALL_DIR}/requirements.txt"

echo "[4/7] ساخت تنظیمات امن..."
if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
  cat > "${INSTALL_DIR}/.env" <<EOF
NOVA_SECRET_KEY=${SECRET_KEY}
NOVA_DATA_DIR=${DATA_DIR}
NOVA_APP_DIR=${DATA_DIR}/apps
NOVA_BACKUP_DIR=${DATA_DIR}/backups
NOVA_DATABASE_URL=sqlite:////var/lib/nova-server-manager/nova.db
NOVA_PANEL_HOST=127.0.0.1
NOVA_PANEL_PORT=8787
NOVA_PANEL_DOMAIN=${NOVA_DOMAIN:-}
NOVA_COOKIE_SECURE=${NOVA_COOKIE_SECURE:-false}
EOF
  chmod 0600 "${INSTALL_DIR}/.env"
fi

echo "[5/7] ثبت سرویس systemd..."
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=Nova Server Manager
After=network-online.target docker.service nginx.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${INSTALL_DIR}/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8787 --proxy-headers --forwarded-allow-ips=127.0.0.1
Restart=always
RestartSec=4
TimeoutStopSec=30
NoNewPrivileges=false
PrivateTmp=true
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now nova-server-manager

echo "[6/7] تنظیم Nginx..."
PANEL_DOMAIN="${NOVA_DOMAIN:-_}"
cat > /etc/nginx/sites-available/nova-panel.conf <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PANEL_DOMAIN};
    client_max_body_size 1024m;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 1800s;
        proxy_send_timeout 1800s;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/nova-panel.conf /etc/nginx/sites-enabled/nova-panel.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ -n "${NOVA_DOMAIN:-}" && -n "${NOVA_EMAIL:-}" ]]; then
  echo "فعال‌سازی HTTPS برای ${NOVA_DOMAIN}..."
  certbot --nginx -d "${NOVA_DOMAIN}" --non-interactive --agree-tos \
    --redirect --email "${NOVA_EMAIL}"
  sed -i 's/NOVA_COOKIE_SECURE=false/NOVA_COOKIE_SECURE=true/' "${INSTALL_DIR}/.env"
  systemctl restart nova-server-manager
fi

echo "[7/7] بررسی سلامت..."
sleep 2
if ! curl -fsS http://127.0.0.1:8787/api/health >/dev/null; then
  echo "سرویس اجرا نشد. گزارش:"
  journalctl -u nova-server-manager -n 50 --no-pager
  exit 1
fi

SERVER_IP="$(hostname -I | awk '{print $1}')"
echo
echo "نوا سرور منیجر با موفقیت نصب شد."
if [[ -n "${NOVA_DOMAIN:-}" ]]; then
  echo "آدرس پنل: https://${NOVA_DOMAIN}"
else
  echo "آدرس پنل: http://${SERVER_IP}"
  echo "هشدار: برای محیط واقعی، دامنه و HTTPS را طبق README فعال کنید."
fi
echo "در اولین ورود، حساب مدیر را بسازید."
