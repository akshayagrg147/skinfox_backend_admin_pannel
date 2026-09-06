#!/usr/bin/env bash
set -Eeuo pipefail

exec > >(tee -a /var/log/skinfox-bootstrap.log | logger -t skinfox-bootstrap) 2>&1

APP_DIR=/opt/skinfox
REPO_URL=https://github.com/akshayagrg147/skinfox_backend_admin_pannel.git

if [ -z "${SKINFOX_ADMIN_EMAIL:-}" ] || [ -z "${SKINFOX_ADMIN_PASSWORD:-}" ]; then
  echo "SKINFOX_ADMIN_EMAIL and SKINFOX_ADMIN_PASSWORD must be provided in EC2 user data." >&2
  exit 1
fi

dnf install -y docker git openssl curl
systemctl enable --now docker

# A 2 GiB swap file keeps the one-GiB free-tier instance from running out of
# memory while npm builds the web and API images.
if ! swapon --show | grep -q /swapfile; then
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

arch="$(uname -m)"
case "$arch" in
  x86_64) compose_arch=x86_64 ;;
  aarch64) compose_arch=aarch64 ;;
  *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
esac
mkdir -p /usr/local/lib/docker/cli-plugins
if ! docker compose version >/dev/null 2>&1; then
  curl -fsSL "https://github.com/docker/compose/releases/download/v2.39.1/docker-compose-linux-${compose_arch}" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

rm -rf "$APP_DIR"
git clone --depth 1 "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

public_ip="$(curl -fsS --max-time 5 http://169.254.169.254/latest/meta-data/public-ipv4 || true)"
if [ -z "$public_ip" ]; then public_ip=localhost; fi

postgres_password="$(openssl rand -hex 24)"
cookie_secret="$(openssl rand -hex 32)"
cat > .env <<EOF
POSTGRES_PASSWORD=$postgres_password
SEED_DATABASE=true
EOF
chmod 600 .env

mkdir -p deploy
cat > deploy/server.env <<EOF
STOREFRONT_ORIGIN=http://$public_ip
ADMIN_ORIGIN=http://$public_ip:8080
COOKIE_SECRET=$cookie_secret
SESSION_TTL_DAYS=7
SEED_ADMIN_EMAIL=$SKINFOX_ADMIN_EMAIL
SEED_ADMIN_PASSWORD=$SKINFOX_ADMIN_PASSWORD
SEED_ADMIN_NAME=SkinFox Admin
EOF
chmod 600 deploy/server.env

docker compose -f docker-compose.prod.yml up -d --build

# Seeding is intentionally a first-boot operation only. Leaving it enabled
# would reset launch content every time the API container restarts.
sed -i 's/^SEED_DATABASE=true$/SEED_DATABASE=false/' .env
docker compose -f docker-compose.prod.yml up -d

for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1/api/v1/health >/dev/null; then
    echo "SkinFox is ready: http://$public_ip/ (storefront), http://$public_ip:8080/ (admin)"
    exit 0
  fi
  sleep 5
done

echo "SkinFox did not become healthy. Inspect: docker compose -f docker-compose.prod.yml logs" >&2
exit 1
