#!/usr/bin/env bash
set -Eeuo pipefail

app_dir="${SKINFOX_APP_DIR:-/opt/skinfox}"
aws_region="${AWS_REGION:-ap-south-1}"
parameter_prefix="${SKINFOX_PARAMETER_PREFIX:-/skinfox/prod}"
server_env="$app_dir/deploy/server.env"

cd "$app_dir"

echo "Updating SkinFox from origin/main..."
git fetch origin main
git merge --ff-only origin/main

if [ ! -f "$server_env" ]; then
  echo "Missing production environment file: $server_env" >&2
  exit 1
fi

sync_secret() {
  local env_key="$1"
  local parameter_name="$2"
  local parameter_value
  local next_env

  parameter_value="$(aws ssm get-parameter \
    --region "$aws_region" \
    --name "$parameter_name" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text)"

  if [ -z "$parameter_value" ] || [ "$parameter_value" = "None" ]; then
    echo "Secure parameter is empty: $parameter_name" >&2
    exit 1
  fi

  next_env="$(mktemp)"
  grep -v "^${env_key}=" "$server_env" > "$next_env" || true
  printf '%s=%s\n' "$env_key" "$parameter_value" >> "$next_env"
  install -m 600 "$next_env" "$server_env"
  rm -f "$next_env"
  unset parameter_value
  echo "Configured $env_key from Parameter Store."
}

sync_secret ANTHROPIC_API_KEY "$parameter_prefix/anthropic-api-key"
sync_secret RAZORPAY_KEY_ID "$parameter_prefix/razorpay-key-id"
sync_secret RAZORPAY_KEY_SECRET "$parameter_prefix/razorpay-key-secret"
sync_secret RAZORPAY_WEBHOOK_SECRET "$parameter_prefix/razorpay-webhook-secret"

echo "Building SkinFox services sequentially for the free-tier instance..."
# Building both images through Compose's parallel bake process can exhaust the
# small EC2 instance and leave BuildKit waiting indefinitely. Build each image
# independently so the currently running release stays available throughout.
export COMPOSE_BAKE=false
export COMPOSE_PARALLEL_LIMIT=1
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml build web

echo "Restarting SkinFox services..."
docker compose -f docker-compose.prod.yml up -d --no-build

for attempt in $(seq 1 36); do
  if curl -fsS http://127.0.0.1/api/v1/ready >/dev/null; then
    docker compose -f docker-compose.prod.yml ps
    echo "SkinFox deployment is healthy."
    exit 0
  fi
  sleep 5
done

echo "SkinFox did not become ready after deployment." >&2
docker compose -f docker-compose.prod.yml ps >&2
docker compose -f docker-compose.prod.yml logs --tail=120 api web >&2
exit 1
