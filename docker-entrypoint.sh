#!/bin/sh
set -e

# Inject environment variables into env-config.js at runtime
ENV_CONFIG="/usr/share/nginx/html/env-config.js"

echo "window._env_ = {" > "$ENV_CONFIG"
echo "    VITE_SUPABASE_URL: '${VITE_SUPABASE_URL:-}'," >> "$ENV_CONFIG"
echo "    VITE_SUPABASE_ANON_KEY: '${VITE_SUPABASE_ANON_KEY:-}'," >> "$ENV_CONFIG"
echo "    VITE_WHATSAPP_SERVER_URL: '${VITE_WHATSAPP_SERVER_URL:-}'," >> "$ENV_CONFIG"
echo "    APP_VERSION: '1.0.0'" >> "$ENV_CONFIG"
echo "};" >> "$ENV_CONFIG"

echo "✅ Environment variables injected into env-config.js"

# Start nginx
exec "$@"
