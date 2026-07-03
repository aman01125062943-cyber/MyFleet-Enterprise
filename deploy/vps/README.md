# MyFleet Enterprise Isolated VPS Deploy

هذا النشر مخصص لـ Hostinger VPS ويعمل بمعزل كامل عن أي تطبيق آخر على نفس السيرفر.

## العزل

- المسار: `/opt/myfleet-enterprise`
- Docker Compose project: `myfleet_enterprise`
- حاويات MyFleet فقط تستخدم prefix: `myfleet_enterprise_`
- الشبكة: `myfleet_enterprise_private`
- Volumes:
  - `myfleet_enterprise_postgres_data`
  - `myfleet_enterprise_storage_data`
  - `myfleet_enterprise_whatsapp_sessions`
- لا يتم لمس `/opt/togar-alkhotot`
- لا يتم لمس بورتات `80/443`
- لا يتم تعديل Caddy أو أي reverse proxy عام

## المنافذ المؤقتة

- التطبيق: `http://VPS_IP:3012`
- Supabase المحلي: `http://VPS_IP:3013`

## ملف البيئة على السيرفر

أنشئ الملف الحقيقي على الـ VPS فقط:

```bash
cd /opt/myfleet-enterprise
cp deploy/vps/.env.example deploy/vps/.env
nano deploy/vps/.env
```

يجب تغيير القيم التالية على الأقل:

- `VPS_PUBLIC_HOST`
- `FRONTEND_URL`
- `VITE_SUPABASE_URL`
- `JWT_SECRET`
- `ANON_KEY`
- `SERVICE_ROLE_KEY`
- `SECRET_KEY_BASE`
- `REALTIME_DB_ENC_KEY`
- `POSTGRES_PASSWORD`

`ANON_KEY` و `SERVICE_ROLE_KEY` يجب أن يكونا JWT موقّعين بنفس `JWT_SECRET`.

## التشغيل اليدوي

```bash
cd /opt/myfleet-enterprise
docker compose -p myfleet_enterprise --env-file deploy/vps/.env -f deploy/vps/docker-compose.yml up -d --build --remove-orphans
docker compose -p myfleet_enterprise -f deploy/vps/docker-compose.yml ps
```

## الفحص

```bash
curl -I http://127.0.0.1:3012/
curl -I http://127.0.0.1:3013/rest/v1/
docker compose -p myfleet_enterprise -f deploy/vps/docker-compose.yml logs --tail=100
```

## النشر التلقائي من GitHub

أضف GitHub repository secrets:

- `MYFLEET_VPS_HOST`
- `MYFLEET_VPS_USER`
- `MYFLEET_VPS_PORT` اختياري، الافتراضي `22`
- `MYFLEET_VPS_SSH_KEY`
- `MYFLEET_VPS_PATH` اختياري، الافتراضي `/opt/myfleet-enterprise`

بعد أي push على `main`:

- يتم رفع ملفات MyFleet إلى `/opt/myfleet-enterprise`
- يتم تشغيل project `myfleet_enterprise` فقط
- لا يوجد `docker system prune`
- لا يتم إيقاف أو حذف حاويات أي تطبيق آخر
- إذا كان `deploy/vps/.env` غير موجود على الـ VPS سيفشل النشر برسالة واضحة

## ملاحظات قاعدة البيانات

هذا التجهيز يشغل Supabase self-hosted محلياً على نفس الـ VPS، وليس Supabase السحابي. جداول MyFleet الأساسية تُنشأ عبر `deploy/vps/db/10-myfleet-core.sql`، ثم تُطبق migrations الموجودة في `supabase/migrations`.

نقل بيانات Supabase السحابي القديم إلى القاعدة المحلية مرحلة منفصلة بعد التأكد أن النشر المحلي يعمل.
