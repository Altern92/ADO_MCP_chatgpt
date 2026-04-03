#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/mcp-server"
NGINX_CONFIG="/etc/nginx/sites-available/mcp-server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_USER="${SUDO_USER:-root}"
APP_HOME="$(getent passwd "${APP_USER}" | cut -d: -f6)"
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"

log() {
  printf '[setup] %s\n' "$1"
}

fail() {
  printf '[setup] ERROR: %s\n' "$1" >&2
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

ensure_package() {
  local package_name="$1"
  if dpkg -s "${package_name}" >/dev/null 2>&1; then
    log "${package_name} is already installed."
    return
  fi

  log "Installing ${package_name}..."
  apt-get install -y "${package_name}"
}

install_nodejs_20() {
  local node_major=""
  if command -v node >/dev/null 2>&1; then
    node_major="$(node -v | sed 's/^v//' | cut -d. -f1)"
  fi

  if [ "${node_major}" = "20" ]; then
    log "Node.js 20 is already installed."
    return
  fi

  log "Installing Node.js 20 via NodeSource..."
  apt-get install -y ca-certificates curl gnupg
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  chmod 644 /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
}

install_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    log "pm2 is already installed."
    return
  fi

  log "Installing pm2 globally..."
  npm install -g pm2
}

copy_project() {
  log "Copying project files to ${APP_DIR}..."
  mkdir -p "${APP_DIR}"
  rsync -a --delete \
    --exclude '.env' \
    --exclude 'node_modules' \
    --exclude 'dist' \
    "${PROJECT_ROOT}/" "${APP_DIR}/"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
}

prepare_env_file() {
  if [ -f "${APP_DIR}/.env" ]; then
    log "Existing .env found, leaving it in place."
    return
  fi

  log "Creating ${APP_DIR}/.env from .env.example..."
  cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"
  if [ -n "${SERVER_IP}" ]; then
    sed -i "s/^ALLOWED_HOSTS=.*/ALLOWED_HOSTS=${SERVER_IP}/" "${APP_DIR}/.env"
  fi
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
}

create_nginx_config() {
  if [ -f "${NGINX_CONFIG}" ]; then
    log "Existing Nginx config found at ${NGINX_CONFIG}, preserving it."
    return
  fi

  log "Creating Nginx config at ${NGINX_CONFIG}..."
  cat > "${NGINX_CONFIG}" <<'EOF'
server {
    listen 80;
    server_name _;

    location /mcp {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        chunked_transfer_encoding on;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
    }
}
EOF
}

configure_nginx() {
  create_nginx_config

  log "Enabling Nginx site..."
  ln -sf "${NGINX_CONFIG}" /etc/nginx/sites-enabled/mcp-server
  rm -f /etc/nginx/sites-enabled/default
  rm -f /etc/nginx/sites-available/default

  log "Ensuring nginx service is enabled..."
  systemctl enable --now nginx

  log "Testing Nginx configuration..."
  nginx -t

  log "Reloading Nginx..."
  systemctl reload nginx
}

install_dependencies_and_build() {
  log "Installing Node.js dependencies..."
  run_as_app_user "cd '${APP_DIR}' && npm install"

  log "Building application..."
  run_as_app_user "cd '${APP_DIR}' && npm run build"
}

start_pm2_app() {
  if run_as_app_user "pm2 describe mcp-server >/dev/null 2>&1"; then
    log "Restarting existing pm2 app..."
    run_as_app_user "pm2 restart mcp-server --update-env"
  else
    log "Starting app with pm2..."
    run_as_app_user "pm2 start '${APP_DIR}/dist/index.js' --name mcp-server"
  fi

  log "Saving pm2 process list..."
  run_as_app_user "pm2 save"

  log "Configuring pm2 startup..."
  env PATH="${PATH}" pm2 startup systemd -u "${APP_USER}" --hp "${APP_HOME}" >/dev/null
}

print_final_status() {
  log "pm2 status:"
  run_as_app_user "pm2 status mcp-server"

  log "Deployment complete."
  log "Application directory: ${APP_DIR}"
  log "Environment file: ${APP_DIR}/.env"
  if [ -n "${SERVER_IP}" ]; then
    log "Health endpoint should now respond at: http://${SERVER_IP}/health"
  else
    log "Health endpoint should now respond at: http://SERVER-IP/health"
  fi
  log "Edit ${APP_DIR}/.env to set AZDO_ORG, then restart with: pm2 restart mcp-server"
}

main() {
  require_root

  log "Updating apt package lists..."
  apt-get update

  ensure_package rsync
  ensure_package nginx
  install_nodejs_20
  install_pm2
  copy_project
  install_dependencies_and_build
  prepare_env_file
  configure_nginx
  start_pm2_app
  print_final_status
}

main "$@"
