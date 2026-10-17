#!/bin/sh
# Applies any pending migrations, then starts the API.
#
# `migrate deploy` only runs migrations that are already committed — it never
# generates or resets anything, so it is safe to run on every boot. Set
# SKIP_MIGRATIONS=1 if you'd rather run them as a separate release step.
set -e

if [ "$SKIP_MIGRATIONS" != "1" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy
fi

echo "Starting TremorSense API..."
exec node dist/index.js
