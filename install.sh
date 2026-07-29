#!/usr/bin/env bash
set -Eeuo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

INSTALL_DIR="/opt/nova-server-manager"
DATA_DIR="/var/lib/nova-server-manager"
SERVICE_FILE="/etc/systemd/system/nova-server-manager.service"
NGINX_FILE="/etc/nginx/sites-available/nova-panel.conf"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}"
NOVA_VERSION="$(tr -d '[:space:]' <"${SOURCE_DIR}/VERSION" 2>/dev/null || printf 'unknown')"
UI_LOG_FILE="/var/log/nova-server-manager-install.log"

if [[ ! -f "${SOURCE_DIR}/scripts/terminal-ui.sh" ]]; then
  echo "ERROR: Installer UI library is missing." >&2
  exit 1
fi
# shellcheck source=scripts/terminal-ui.sh
source "${SOURCE_DIR}/scripts/terminal-ui.sh"
ui_banner "INSTALL" "${NOVA_VERSION}"
if [[ "${EUID}" -ne 0 ]]; then
  ui_fail "Root privileges are required."
  ui_info "Run: sudo bash install.sh"
  exit 1
fi
ui_prepare_log

install_failed() {
  local exit_code=$?
  local line="${1:-unknown}"
  trap - ERR
  printf '\n'
  ui_fail "Installation failed near line ${line}."
  ui_info "Full log: ${UI_LOG_FILE}"
  ui_show_log_tail 40
  exit "${exit_code}"
}
trap 'install_failed "${LINENO}"' ERR

require_root_and_platform() {
  if [[ ! -f /etc/os-release ]]; then
    ui_fail "Unable to identify the operating system."
    exit 1
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID:-}" != "ubuntu" ]]; then
    ui_fail "This installer supports Ubuntu Server only."
    exit 1
  fi
  case "${VERSION_ID:-}" in
    22.04|24.04|26.04) ;;
    *) ui_warn "Ubuntu ${VERSION_ID:-unknown} is not in the tested release list." ;;
  esac
  if [[ "$(dpkg --print-architecture)" != "amd64" && "$(dpkg --print-architecture)" != "arm64" ]]; then
    ui_fail "Only amd64 and arm64 architectures are supported."
    exit 1
  fi
  if [[ ! -f "${SOURCE_DIR}/requirements.txt" || ! -f "${SOURCE_DIR}/app/static/index.html" ]]; then
    ui_fail "The release package is incomplete. requirements.txt or the compiled UI is missing."
    exit 1
  fi
}

install_docker_engine() {
  if command -v docker >/dev/null 2>&1; then
    systemctl enable --now docker >/dev/null 2>&1 || true
    if docker info >/dev/null 2>&1; then
      return 0
    fi
  fi

  local conflicts=()
  local package
  for package in docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc; do
    if dpkg-query -W -f='${db:Status-Abbrev}' "${package}" 2>/dev/null | grep -q '^ii'; then
      conflicts+=("${package}")
    fi
  done
  if ((${#conflicts[@]})); then
    apt-get remove -y "${conflicts[@]}"
  fi

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  source /etc/os-release
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  docker info >/dev/null
}

configure_firewall() {
  if ufw status | grep -q '^Status: active'; then
    ufw allow OpenSSH
    ufw allow 80/tcp
    ufw allow 443/tcp
  fi
}

write_environment() {
  if [[ ! -f "${INSTALL_DIR}/.env" ]]; then
    local secret_key
    secret_key="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
    cat >"${INSTALL_DIR}/.env" <<EOF
NOVA_SECRET_KEY=${secret_key}
NOVA_DATA_DIR=${DATA_DIR}
NOVA_APP_DIR=${DATA_DIR}/apps
NOVA_BACKUP_DIR=${DATA_DIR}/backups
NOVA_DATABASE_URL=sqlite:////var/lib/nova-server-manager/nova.db
NOVA_PANEL_HOST=127.0.0.1
NOVA_PANEL_PORT=8787
NOVA_PANEL_DOMAIN=${NOVA_DOMAIN:-}
NOVA_COOKIE_SECURE=${NOVA_COOKIE_SECURE:-false}
EOF
  fi
  chmod 0600 "${INSTALL_DIR}/.env"
}

sync_application() {
  install -d -m 0755 "${INSTALL_DIR}" "${DATA_DIR}/apps" "${DATA_DIR}/backups"
  install -d -m 0700 "${DATA_DIR}/docker-config"
  rsync -a --delete \
    --exclude='.git' --exclude='.env' --exclude='.venv' --exclude='data' \
    --exclude='__pycache__' --exclude='.pytest_cache' \
    --exclude='frontend/node_modules' --exclude='frontend/.next' --exclude='frontend/out' \
    "${SOURCE_DIR}/" "${INSTALL_DIR}/"
}

create_python_environment() {
  python3 -m venv "${INSTALL_DIR}/.venv"
  "${INSTALL_DIR}/.venv/bin/pip" install --disable-pip-version-check --upgrade pip wheel
  "${INSTALL_DIR}/.venv/bin/pip" install --disable-pip-version-check -r "${INSTALL_DIR}/requirements.txt"
  "${INSTALL_DIR}/.venv/bin/pip" check
  "${INSTALL_DIR}/.venv/bin/python" -m compileall -q "${INSTALL_DIR}/app"
}

register_service() {
  install -m 0644 "${INSTALL_DIR}/nova-server-manager.service" "${SERVICE_FILE}"
  systemctl daemon-reload
  systemctl enable nova-server-manager
}

configure_nginx() {
  local panel_domain="${NOVA_DOMAIN:-_}"
  cat >"${NGINX_FILE}" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${panel_domain};
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
  ln -sfn "${NGINX_FILE}" /etc/nginx/sites-enabled/nova-panel.conf
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

enable_https() {
  certbot --nginx -d "${NOVA_DOMAIN}" --non-interactive --agree-tos \
    --redirect --email "${NOVA_EMAIL}"
  sed -i 's/^NOVA_COOKIE_SECURE=.*/NOVA_COOKIE_SECURE=true/' "${INSTALL_DIR}/.env"
}

ui_step 1 8 "Preflight checks"
require_root_and_platform
ui_ok "Ubuntu $(. /etc/os-release && printf '%s' "${VERSION_ID}") · $(dpkg --print-architecture)"
available_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
if ((available_kb < 5 * 1024 * 1024)); then
  ui_warn "Less than 5 GB of free disk space is available."
fi

ui_step 2 8 "System dependencies"
export DEBIAN_FRONTEND=noninteractive
ui_task "Refresh Ubuntu package index" apt-get update -y
ui_task "Install Python, Nginx and utilities" \
  apt-get install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx \
  curl ca-certificates unzip rsync ufw

ui_step 3 8 "Docker Engine"
ui_task "Install or verify Docker Engine" install_docker_engine
ui_ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)"

ui_step 4 8 "Application files"
ui_task "Copy Nova release files" sync_application
ui_task "Create secure environment" write_environment

ui_step 5 8 "Python runtime"
ui_task "Build isolated Python environment" create_python_environment

ui_step 6 8 "System services"
ui_task "Register Nova systemd service" register_service
ui_task "Configure Nginx reverse proxy" configure_nginx
ui_task "Apply firewall rules when UFW is active" configure_firewall

ui_step 7 8 "TLS and startup"
if [[ -n "${NOVA_DOMAIN:-}" && -n "${NOVA_EMAIL:-}" ]]; then
  ui_task "Issue Let's Encrypt certificate" enable_https
elif [[ -n "${NOVA_DOMAIN:-}" ]]; then
  ui_warn "NOVA_EMAIL is empty; HTTPS setup was skipped."
else
  ui_info "No domain supplied; the panel will start on the server IP over HTTP."
fi
ui_task "Start Nova Server Manager" systemctl restart nova-server-manager

ui_step 8 8 "Final verification"
if ! ui_wait_for_health "http://127.0.0.1:8787/api/health" 45; then
  journalctl -u nova-server-manager -n 80 --no-pager >>"${UI_LOG_FILE}" 2>&1 || true
  false
fi
ui_task "Validate Nginx configuration" nginx -t
ui_task "Verify Docker daemon" docker info

trap - ERR
server_ip="$(hostname -I | awk '{print $1}')"
if [[ -n "${NOVA_DOMAIN:-}" && -n "${NOVA_EMAIL:-}" ]]; then
  panel_url="https://${NOVA_DOMAIN}"
else
  panel_url="http://${server_ip}"
fi
ui_complete "Nova Server Manager ${NOVA_VERSION} is ready"
printf '  Panel URL     %s%s%s\n' "${C_BOLD}" "${panel_url}" "${C_RESET}"
printf '  Service       %snova-server-manager%s\n' "${C_BOLD}" "${C_RESET}"
printf '  Data path     %s%s%s\n' "${C_BOLD}" "${DATA_DIR}" "${C_RESET}"
printf '  Install log   %s%s%s\n\n' "${C_BOLD}" "${UI_LOG_FILE}" "${C_RESET}"
ui_info "Open the panel and create the first administrator account."
