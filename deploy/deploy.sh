#!/usr/bin/env bash
# Build both apps and publish them, with the relay, to the binmap server.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="${BLOOD_SERVER:-binmap}"
DOMAIN="${BLOOD_DOMAIN:-blood.bladen.me}"

export VITE_RELAY_URL="https://$DOMAIN/relay"

cd "$REPO"
pnpm data
pnpm art
BOTC_BASE=/ VITE_PLAYER_ORIGIN="https://$DOMAIN/player" pnpm --filter @botc/storyteller build
BOTC_PLAYER_BASE=/player/ pnpm --filter @botc/player build

ssh "$SERVER" 'mkdir -p /var/www/blood/player /opt/blood-relay'

rsync -az --delete --exclude player/ apps/storyteller/dist/ "$SERVER:/var/www/blood/"
rsync -az --delete apps/player/dist/ "$SERVER:/var/www/blood/player/"

rsync -az deploy/relay/server.mjs deploy/relay/package.json "$SERVER:/opt/blood-relay/"
rsync -az deploy/blood-relay.service "$SERVER:/etc/systemd/system/blood-relay.service"
rsync -az deploy/blood.caddy "$SERVER:/etc/caddy/Caddyfile.d/blood.caddy"

ssh "$SERVER" '
  set -e
  id bloodrelay >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin bloodrelay
  cd /opt/blood-relay && npm install --omit=dev --no-audit --no-fund --silent
  chown -R bloodrelay:bloodrelay /opt/blood-relay
  chown -R www-data:www-data /var/www/blood
  systemctl daemon-reload
  systemctl enable --now blood-relay
  systemctl restart blood-relay
  caddy validate --config /etc/caddy/Caddyfile >/dev/null
  systemctl reload caddy
'
echo "deployed to https://$DOMAIN"
