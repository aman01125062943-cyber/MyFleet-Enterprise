#!/bin/sh
set -eu

run_sql() {
  file="$1"
  echo "Applying $file"
  psql -v ON_ERROR_STOP=1 -f "$file"
}

psql -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

tries=0
until [ "$(psql -At -c "SELECT to_regclass('auth.users') IS NOT NULL")" = "t" ]; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then
    echo "Timed out waiting for Supabase Auth to create auth.users"
    exit 1
  fi
  echo "Waiting for Supabase Auth migrations..."
  sleep 2
done

run_once() {
  file="$1"
  name="$(basename "$file")"
  already="$(psql -At -c "SELECT 1 FROM public.schema_migrations WHERE filename = '$name' LIMIT 1")"
  if [ "$already" = "1" ]; then
    echo "Skipping $name"
    return
  fi
  run_sql "$file"
  psql -v ON_ERROR_STOP=1 -c "INSERT INTO public.schema_migrations(filename) VALUES ('$name') ON CONFLICT DO NOTHING"
}

run_once /deploy-db/10-myfleet-core.sql

for file in /maintenance-scripts/subscription_system_migration.sql /archive-scripts/assets_migration.sql /archive-scripts/create_audit_logs.sql /archive-scripts/session_management.sql; do
  if [ -f "$file" ]; then
    run_once "$file"
  fi
done

for file in /app-migrations/*.sql; do
  [ -f "$file" ] || continue
  run_once "$file"
done

psql -v ON_ERROR_STOP=1 -c "NOTIFY pgrst, 'reload schema';"
