#!/usr/bin/env bash
set -Eeuo pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

INSTALL_DIR="/opt/nova-server-manager"
DATA_DIR="/var/lib/nova-server-manager"
SERVICE_FILE="/etc/systemd/system/nova-server-manager.service"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NOVA_VERSION="$(tr -d '[:space:]' <"${SCRIPT_DIR}/VERSION" 2>/dev/null || printf 'unknown')"
UI_LOG_FILE="/var/log/nova-server-manager-update.log"
timestamp="$(date +%Y%m%d-%H%M%S)"
ROLLBACK_DIR="${DATA_DIR}/update-rollback-${timestamp}"
DB_SNAPSHOT="${DATA_DIR}/update-snapshots/nova-${timestamp}.db"
UPDATE_STARTED=false

if [[ ! -f "${SCRIPT_DIR}/scripts/terminal-ui.sh" ]]; then
  echo "ERROR: Installer UI library is missing." >&2
  exit 1
fi
# shellcheck source=scripts/terminal-ui.sh
source "${SCRIPT_DIR}/scripts/terminal-ui.sh"
ui_banner "UPDATE" "${NOVA_VERSION}"
if [[ "${EUID}" -ne 0 ]]; then
  ui_fail "Root privileges are required."
  ui_info "Run: sudo bash update.sh"
  exit 1
fi
ui_prepare_log

rollback_update() {
  local exit_code=$?
  local line="${1:-unknown}"
  trap - ERR
  printf '\n'
  ui_fail "Update failed near line ${line}."
  if [[ "${UPDATE_STARTED}" == "true" && -d "${ROLLBACK_DIR}" ]]; then
    ui_warn "Rolling back application files and database..."
    systemctl stop nova-server-manager >/dev/null 2>&1 || true
    rsync -a --delete \
      --exclude='.env' --exclude='.venv' \
      "${ROLLBACK_DIR}/" "${INSTALL_DIR}/" >>"${UI_LOG_FILE}" 2>&1 || true
    if [[ -f "${DB_SNAPSHOT}" ]]; then
      cp -a "${DB_SNAPSHOT}" "${DATA_DIR}/nova.db" >>"${UI_LOG_FILE}" 2>&1 || true
    fi
    if [[ -f "${INSTALL_DIR}/nova-server-manager.service" ]]; then
      install -m 0644 "${INSTALL_DIR}/nova-server-manager.service" "${SERVICE_FILE}" \
        >>"${UI_LOG_FILE}" 2>&1 || true
    fi
    systemctl daemon-reload >>"${UI_LOG_FILE}" 2>&1 || true
    systemctl start nova-server-manager >>"${UI_LOG_FILE}" 2>&1 || true
    ui_ok "Rollback attempt completed."
  fi
  ui_info "Full log: ${UI_LOG_FILE}"
  ui_show_log_tail 50
  exit "${exit_code}"
}
trap 'rollback_update "${LINENO}"' ERR

preflight_update() {
  if [[ ! -d "${INSTALL_DIR}" || ! -x "${INSTALL_DIR}/.venv/bin/python" ]]; then
    ui_fail "No existing Nova installation was found in ${INSTALL_DIR}."
    ui_info "Use install.sh for the first installation."
    exit 1
  fi
  if [[ ! -f "${SCRIPT_DIR}/requirements.txt" || ! -f "${SCRIPT_DIR}/app/static/index.html" ]]; then
    ui_fail "The update package is incomplete."
    exit 1
  fi
  docker info >/dev/null
}

create_rollback_snapshot() {
  install -d -m 0755 "${ROLLBACK_DIR}" "${DATA_DIR}/update-snapshots"
  rsync -a \
    --exclude='.env' --exclude='.venv' --exclude='__pycache__' \
    "${INSTALL_DIR}/" "${ROLLBACK_DIR}/"
  if [[ -f "${DATA_DIR}/nova.db" ]]; then
    cp -a "${DATA_DIR}/nova.db" "${DB_SNAPSHOT}"
  fi
}

sync_new_release() {
  rsync -a --delete \
    --exclude='.git' --exclude='.env' --exclude='.venv' --exclude='data' \
    --exclude='__pycache__' --exclude='.pytest_cache' \
    --exclude='frontend/node_modules' --exclude='frontend/.next' --exclude='frontend/out' \
    "${SCRIPT_DIR}/" "${INSTALL_DIR}/"
}

validate_new_release() {
  "${INSTALL_DIR}/.venv/bin/pip" install --disable-pip-version-check \
    -r "${INSTALL_DIR}/requirements.txt"
  "${INSTALL_DIR}/.venv/bin/pip" check
  "${INSTALL_DIR}/.venv/bin/python" -m compileall -q "${INSTALL_DIR}/app"
  test -s "${INSTALL_DIR}/app/static/index.html"
}

ui_step 1 6 "Preflight checks"
preflight_update
ui_ok "Existing installation and Docker daemon are healthy."

ui_step 2 6 "Recovery snapshot"
ui_task "Back up current code and database" create_rollback_snapshot
UPDATE_STARTED=true

ui_step 3 6 "Deploy release files"
ui_task "Stop the control panel" systemctl stop nova-server-manager
ui_task "Synchronize Nova ${NOVA_VERSION}" sync_new_release
ui_task "Prepare Docker runtime configuration" install -d -m 0700 "${DATA_DIR}/docker-config"

ui_step 4 6 "Validate runtime"
ui_task "Install and verify Python dependencies" validate_new_release
ui_task "Refresh the systemd service" \
  install -m 0644 "${INSTALL_DIR}/nova-server-manager.service" "${SERVICE_FILE}"
ui_task "Reload systemd configuration" systemctl daemon-reload

ui_step 5 6 "Start and migrate"
ui_task "Start Nova Server Manager" systemctl start nova-server-manager
if ! ui_wait_for_health "http://127.0.0.1:8787/api/health" 45; then
  journalctl -u nova-server-manager -n 100 --no-pager >>"${UI_LOG_FILE}" 2>&1 || true
  false
fi

ui_step 6 6 "Final verification"
ui_task "Verify Docker daemon" docker info
ui_task "Verify systemd service" systemctl is-active --quiet nova-server-manager
ui_task "Verify Nginx configuration" nginx -t

trap - ERR
case "${ROLLBACK_DIR}" in
  "${DATA_DIR}"/update-rollback-*) rm -rf -- "${ROLLBACK_DIR}" ;;
esac
UPDATE_STARTED=false
health_payload="$(curl -fsS http://127.0.0.1:8787/api/health)"
ui_complete "Nova Server Manager was updated successfully"
printf '  Version        %s%s%s\n' "${C_BOLD}" "${NOVA_VERSION}" "${C_RESET}"
printf '  Health         %s%s%s\n' "${C_BOLD}" "${health_payload}" "${C_RESET}"
printf '  DB snapshot    %s%s%s\n' "${C_BOLD}" "${DB_SNAPSHOT}" "${C_RESET}"
printf '  Update log     %s%s%s\n\n' "${C_BOLD}" "${UI_LOG_FILE}" "${C_RESET}"
