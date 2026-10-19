#!/bin/sh
# Applies any pending migrations, then starts the API.
#
# `migrate deploy` only runs migrations that are already committed — it never
# generates or resets anything, so it is safe to run on every boot. Set
# SKIP_MIGRATIONS=1 if you'd rather run them as a separate release step.
set -e

if [ "$SKIP_MIGRATIONS" != "1" ]; then
  # Migrations need a session-mode connection: `migrate deploy` issues
  # `SET session_replication_role = 'replica'` and takes a session-level
  # advisory lock, neither of which a transaction-mode pooler supports.
  # prisma.config.ts prefers DIRECT_URL for exactly this reason.
  #
  # Catch the misconfiguration here rather than letting the migration hang:
  # Supabase's port 6543 is transaction mode only (session mode on 6543 was
  # removed in Feb 2025); its session-mode endpoint is port 5432.
  if [ -z "$DIRECT_URL" ]; then
    case "$DATABASE_URL" in
      *:6543/* | *:6543 | *pgbouncer=true*)
        echo "ERROR: DATABASE_URL points at a transaction-mode pooler" >&2
        echo "       (port 6543 / pgbouncer), which cannot run migrations." >&2
        echo "" >&2
        echo "  Set DIRECT_URL to the same database on its session-mode port." >&2
        echo "  For Supabase, that is the same host on port 5432:" >&2
        echo "    DIRECT_URL=postgresql://USER:PASS@HOST:5432/postgres" >&2
        echo "" >&2
        echo "  Leave DATABASE_URL on 6543 — the app itself is fine there." >&2
        echo "  Or set SKIP_MIGRATIONS=1 to run migrations separately." >&2
        exit 1
        ;;
    esac
  fi

  echo "Applying database migrations..."
  npx prisma migrate deploy
fi

echo "Starting TremorSense API..."
exec node dist/index.js
