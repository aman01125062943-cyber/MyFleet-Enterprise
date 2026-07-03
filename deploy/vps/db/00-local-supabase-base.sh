#!/bin/sh
set -eu

psql -v ON_ERROR_STOP=1 \
  --set db_name="$POSTGRES_DB" \
  --set db_password="$POSTGRES_PASSWORD" <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN NOINHERIT CREATEROLE REPLICATION;
  END IF;
END $$;

ALTER ROLE authenticator WITH PASSWORD :'db_password';
ALTER ROLE supabase_auth_admin WITH PASSWORD :'db_password';
ALTER ROLE supabase_storage_admin WITH PASSWORD :'db_password';
ALTER ROLE supabase_admin WITH PASSWORD :'db_password';

GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL PRIVILEGES ON DATABASE :"db_name" TO postgres;
GRANT ALL PRIVILEGES ON DATABASE :"db_name" TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON DATABASE :"db_name" TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON DATABASE :"db_name" TO supabase_admin;

CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA IF NOT EXISTS storage AUTHORIZATION supabase_storage_admin;
CREATE SCHEMA IF NOT EXISTS realtime AUTHORIZATION supabase_admin;
CREATE SCHEMA IF NOT EXISTS _realtime AUTHORIZATION supabase_admin;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, CREATE ON SCHEMA public TO supabase_auth_admin;
GRANT USAGE, CREATE ON SCHEMA public TO supabase_storage_admin;
GRANT USAGE, CREATE ON SCHEMA public TO supabase_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, supabase_auth_admin;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role, supabase_storage_admin;
GRANT USAGE ON SCHEMA realtime TO anon, authenticated, service_role, supabase_admin;
GRANT USAGE, CREATE ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, CREATE ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE, CREATE ON SCHEMA realtime TO supabase_admin;
GRANT USAGE, CREATE ON SCHEMA _realtime TO supabase_admin;

ALTER ROLE supabase_auth_admin SET search_path = auth, public;
ALTER ROLE supabase_storage_admin SET search_path = storage, public;
ALTER ROLE supabase_admin SET search_path = _realtime, public;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')::text;
$$;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.email', true), '')::text;
$$;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;

CREATE OR REPLACE FUNCTION storage.filename(name text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT reverse(split_part(reverse(name), '/', 1));
$$;

CREATE OR REPLACE FUNCTION storage.prefix_id(name text, level int)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT (storage.foldername(name))[level + 1];
$$;
SQL
