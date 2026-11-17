#!/usr/bin/env bash
# Deja listo un servidor Ubuntu con nginx: runtime propio de Node, usuario, servicio y certificado.
# Es idempotente; deploy/release.sh lo ejecuta en cada publicacion.
set -euo pipefail

SOURCE=$(dirname "$(dirname "$(readlink -f "$0")")")
ROOT=/opt/boxhacks
DOMAIN=box.hacks.win
NODE_VERSION=v26.13.1
SITE=/etc/nginx/sites-available/boxhacks

id boxhacks &>/dev/null || useradd --system --home "$ROOT" --shell /usr/sbin/nologin boxhacks
mkdir -p "$ROOT/data" "$ROOT/runtime"
chown boxhacks:boxhacks "$ROOT/data"

if [ "$("$ROOT/runtime/bin/node" --version 2>/dev/null)" != "$NODE_VERSION" ]; then
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" \
    | tar -xJ --strip-components=1 -C "$ROOT/runtime"
fi

if [ ! -f "$ROOT/env" ]; then
  sed -e "s|^BOX_DATA_DIR=.*|BOX_DATA_DIR=$ROOT/data|" \
      -e "s|^BOX_MASTER_KEY=.*|BOX_MASTER_KEY=$(openssl rand -hex 32)|" \
      "$SOURCE/.env.example" > "$ROOT/env"
  chown root:boxhacks "$ROOT/env"
  chmod 640 "$ROOT/env"
fi

install -m 644 "$SOURCE/deploy/boxhacks.service" /etc/systemd/system/boxhacks.service
systemctl daemon-reload
systemctl enable --quiet boxhacks

ln -sf "$SITE" /etc/nginx/sites-enabled/boxhacks
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  command -v certbot >/dev/null || (apt-get update -qq && apt-get install -y -qq certbot)
  sed '/^server {$/,/^}$/!d; /listen 443/,$d' "$SOURCE/deploy/nginx.conf" | sed '$d' > "$SITE"
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/html -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --deploy-hook "systemctl reload nginx"
fi

install -m 644 "$SOURCE/deploy/nginx.conf" "$SITE"
nginx -t
systemctl reload nginx
