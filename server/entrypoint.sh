#!/bin/sh
set -eu

echo "Waiting for PostgreSQL migrations..."
until npx prisma migrate deploy --schema server/prisma/schema.prisma; do
  sleep 3
done

if [ "${SEED_DATABASE:-false}" = "true" ]; then
  echo "Seeding SkinFox launch data..."
  npx tsx server/prisma/seed.ts
fi

exec node server/dist/index.js
