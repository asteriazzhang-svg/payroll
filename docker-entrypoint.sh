#!/bin/sh
set -e

# Always apply pending migrations (idempotent — no-op if up to date).
echo "[entrypoint] Running prisma migrate deploy..."
npx prisma migrate deploy

# Seed only on first boot (when the .seeded marker is absent).
if [ ! -f /app/data/.seeded ]; then
  echo "[entrypoint] First boot — seeding database..."
  npx tsx prisma/seed.ts && touch /app/data/.seeded
  echo "[entrypoint] Seed complete."
else
  echo "[entrypoint] Already seeded, skipping."
fi

echo "[entrypoint] Starting server..."
exec node server.js
