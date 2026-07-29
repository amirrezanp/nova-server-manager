#!/usr/bin/env bash

# Shared, dependency-free terminal interface for Nova installation scripts.

UI_LOG_FILE="${UI_LOG_FILE:-/var/log/nova-server-manager-installer.log}"
UI_TTY=false
if [[ -t 1 && "${TERM:-dumb}" != "dumb" ]]; then
  UI_TTY=true
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_ORANGE=$'\033[38;5;208m'
  C_BLUE=$'\033[38;5;75m'
  C_GREEN=$'\033[38;5;78m'
  C_RED=$'\033[38;5;203m'
  C_YELLOW=$'\033[38;5;220m'
else
  C_RESET=""
  C_BOLD=""
  C_DIM=""
  C_ORANGE=""
  C_BLUE=""
  C_GREEN=""
  C_RED=""
  C_YELLOW=""
fi

ui_prepare_log() {
  install -d -m 0755 "$(dirname -- "${UI_LOG_FILE}")"
  touch "${UI_LOG_FILE}"
  chmod 0600 "${UI_LOG_FILE}"
}

ui_banner() {
  local mode="${1:-INSTALL}"
  local version="${2:-unknown}"
  printf '\n'
  printf '%s%s' "${C_ORANGE}" "${C_BOLD}"
  printf '  ███╗   ██╗ ██████╗ ██╗   ██╗ █████╗ \n'
  printf '  ████╗  ██║██╔═══██╗██║   ██║██╔══██╗\n'
  printf '  ██╔██╗ ██║██║   ██║██║   ██║███████║\n'
  printf '  ██║╚██╗██║██║   ██║╚██╗ ██╔╝██╔══██║\n'
  printf '  ██║ ╚████║╚██████╔╝ ╚████╔╝ ██║  ██║\n'
  printf '  ╚═╝  ╚═══╝ ╚═════╝   ╚═══╝  ╚═╝  ╚═╝\n'
  printf '%s' "${C_RESET}"
  printf '  %sNova Server Manager%s  %s%s%s\n' "${C_BOLD}" "${C_RESET}" "${C_DIM}" "v${version}" "${C_RESET}"
  printf '  %s%s MODE%s\n\n' "${C_BLUE}" "${mode}" "${C_RESET}"
}

ui_rule() {
  printf '  %s────────────────────────────────────────────────────────%s\n' "${C_DIM}" "${C_RESET}"
}

ui_step() {
  local current="$1"
  local total="$2"
  local title="$3"
  local width=24
  local filled=$((current * width / total))
  local empty=$((width - filled))
  local bar=""
  local i
  for ((i = 0; i < filled; i++)); do bar+="━"; done
  for ((i = 0; i < empty; i++)); do bar+="─"; done
  printf '\n  %sSTEP %02d/%02d%s  %s%s%s\n' \
    "${C_ORANGE}${C_BOLD}" "${current}" "${total}" "${C_RESET}" \
    "${C_BOLD}" "${title}" "${C_RESET}"
  printf '  %s%s%s\n' "${C_ORANGE}" "${bar}" "${C_RESET}"
}

ui_info() {
  printf '  %s›%s %s\n' "${C_BLUE}" "${C_RESET}" "$*"
}

ui_ok() {
  printf '  %s✓%s %s\n' "${C_GREEN}" "${C_RESET}" "$*"
}

ui_warn() {
  printf '  %s!%s %s\n' "${C_YELLOW}" "${C_RESET}" "$*"
}

ui_fail() {
  printf '  %s✗%s %s\n' "${C_RED}" "${C_RESET}" "$*" >&2
}

ui_task() {
  local label="$1"
  shift
  printf '  %s›%s %-44s ' "${C_BLUE}" "${C_RESET}" "${label}"
  "$@" >>"${UI_LOG_FILE}" 2>&1 &
  local pid=$!
  local frames=('◐' '◓' '◑' '◒')
  local frame=0
  if [[ "${UI_TTY}" == "true" ]]; then
    while kill -0 "${pid}" 2>/dev/null; do
      printf '\r  %s%s%s %-44s %s%s%s' \
        "${C_ORANGE}" "${frames[frame]}" "${C_RESET}" "${label}" \
        "${C_DIM}" "working" "${C_RESET}"
      frame=$(((frame + 1) % 4))
      sleep 0.15
    done
  fi
  if wait "${pid}"; then
    printf '\r  %s✓%s %-44s %s%s%s\n' \
      "${C_GREEN}" "${C_RESET}" "${label}" "${C_DIM}" "done" "${C_RESET}"
    return 0
  else
    local exit_code=$?
    printf '\r  %s✗%s %-44s %sfailed (%d)%s\n' \
      "${C_RED}" "${C_RESET}" "${label}" "${C_RED}" "${exit_code}" "${C_RESET}" >&2
    return "${exit_code}"
  fi
}

ui_wait_for_health() {
  local url="$1"
  local timeout="${2:-45}"
  local elapsed=0
  printf '  %s›%s %-44s ' "${C_BLUE}" "${C_RESET}" "Waiting for the control panel"
  while ((elapsed < timeout)); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      printf '\r  %s✓%s %-44s %sready in %ds%s\n' \
        "${C_GREEN}" "${C_RESET}" "Waiting for the control panel" \
        "${C_DIM}" "${elapsed}" "${C_RESET}"
      return 0
    fi
    if [[ "${UI_TTY}" == "true" ]]; then
      printf '\r  %s◌%s %-44s %s%02ds / %02ds%s' \
        "${C_ORANGE}" "${C_RESET}" "Waiting for the control panel" \
        "${C_DIM}" "${elapsed}" "${timeout}" "${C_RESET}"
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  printf '\n'
  ui_fail "The control panel did not become healthy within ${timeout} seconds."
  return 1
}

ui_show_log_tail() {
  local lines="${1:-30}"
  if [[ -s "${UI_LOG_FILE}" ]]; then
    ui_rule
    printf '  %sLast installer log entries:%s\n' "${C_BOLD}" "${C_RESET}"
    tail -n "${lines}" "${UI_LOG_FILE}" | sed 's/^/    /'
  fi
}

ui_complete() {
  local title="$1"
  ui_rule
  printf '\n  %s%s✓ %s%s\n' "${C_GREEN}" "${C_BOLD}" "${title}" "${C_RESET}"
}
