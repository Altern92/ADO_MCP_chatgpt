#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-}"
NGINX_CONFIG="/etc/nginx/sites-available/mcp-server"

log() {
  printf '[setup-ssl] %s\n' "$1"
}

fail() {
  printf '[setup-ssl] ERROR: %s\n' "$1" >&2
  exit 1
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

main() {
  require_root

  if [ -z "${DOMAIN}" ]; then
    fail "Usage: ./setup-ssl.sh yourdomain.com"
  fi

  if [ ! -f "${NGINX_CONFIG}" ]; then
    fail "Nginx config not found at ${NGINX_CONFIG}. Run ./deploy/setup.sh first."
  fi

  log "Updating apt package lists..."
  apt-get update

  ensure_package certbot
  ensure_package python3-certbot-nginx

  log "Updating Nginx server_name to ${DOMAIN}..."
  sed -i "0,/server_name .*/s//server_name ${DOMAIN};/" "${NGINX_CONFIG}"

  log "Testing Nginx configuration..."
  nginx -t

  log "Reloading Nginx before requesting certificates..."
  systemctl reload nginx

  log "Requesting and installing SSL certificate..."
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email "admin@${DOMAIN}"

  log "Reloading Nginx..."
  systemctl reload nginx

  log "SSL setup complete."
  log "Server should now respond at: https://${DOMAIN}/health"
}

main "$@"
