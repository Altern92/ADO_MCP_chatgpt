#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/mcp-server"
APP_USER="${SUDO_USER:-root}"

log() {
  printf '[update] %s\n' "$1"
}

fail() {
  printf '[update] ERROR: %s\n' "$1" >&2
  exit 1
}

run_as_app_user() {
  local command="$1"
  if [ "${APP_USER}" = "root" ]; then
    bash -lc "${command}"
  else
    sudo -u "${APP_USER}" -H bash -lc "${command}"
  fi
}

require_root() {
  if [ "${EUID}" -ne 0 ]; then
    fail "Run this script as root or with sudo."
  fi
}

main() {
  require_root

  if [ ! -d "${APP_DIR}/.git" ]; then
    fail "${APP_DIR} is not a git working copy. Run ./deploy/setup.sh first."
  fi

  log "Pulling latest code..."
  run_as_app_user "cd '${APP_DIR}' && git pull --ff-only"

  log "Installing dependencies..."
  run_as_app_user "cd '${APP_DIR}' && npm install"

  log "Building application..."
  run_as_app_user "cd '${APP_DIR}' && npm run build"

  log "Restarting pm2 app..."
  run_as_app_user "pm2 restart mcp-server --update-env"

  log "Current pm2 status:"
  run_as_app_user "pm2 status mcp-server"

  log "Update complete."
}

main "$@"
