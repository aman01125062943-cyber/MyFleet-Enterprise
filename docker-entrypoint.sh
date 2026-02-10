#!/bin/sh
set -e

# 1. تحديث منفذ Nginx ليتوافق مع Render (الافتراضي 80 إذا لم يوجد PORT)
NGINX_CONF="/etc/nginx/conf.d/default.conf"
PORT="${PORT:-80}"
sed -i "s/listen 80;/listen ${PORT};/g" "$NGINX_CONF"
echo "🌐 Nginx configured to listen on port ${PORT}"

# 2. حقن متغيرات البيئة في env-config.js ليستخدمها التطبيق (الفرونت إند)
ENV_CONFIG="/usr/share/nginx/html/env-config.js"

if [ -z "$VITE_SUPABASE_URL" ]; then
    echo "⚠️ WARNING: VITE_SUPABASE_URL is not set!"
else
    echo "✅ VITE_SUPABASE_URL is detected"
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "⚠️ WARNING: VITE_SUPABASE_ANON_KEY is not set!"
else
    echo "✅ VITE_SUPABASE_ANON_KEY is detected"
fi

echo "window._env_ = {" > "$ENV_CONFIG"
echo "    VITE_SUPABASE_URL: '${VITE_SUPABASE_URL:-}'," >> "$ENV_CONFIG"
echo "    VITE_SUPABASE_ANON_KEY: '${VITE_SUPABASE_ANON_KEY:-}'," >> "$ENV_CONFIG"
echo "    VITE_WHATSAPP_SERVER_URL: '${VITE_WHATSAPP_SERVER_URL:-}'," >> "$ENV_CONFIG"
echo "    APP_VERSION: '1.0.0'" >> "$ENV_CONFIG"
echo "};" >> "$ENV_CONFIG"

echo "✅ Environment variables injected into env-config.js"

# 3. تشغيل Nginx
exec "$@"
