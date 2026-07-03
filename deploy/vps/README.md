# MyFleet Enterprise VPS Deploy

هذا التجهيز معزول عن أي تطبيق آخر على نفس الـ VPS.

الأسماء المستخدمة عمدا:
- المسار: `/opt/myfleet-enterprise`
- Docker compose project: `myfleet_enterprise`
- حاوية التطبيق: `myfleet_enterprise_app`
- حاوية قاعدة البيانات: `myfleet_enterprise_postgres`
- الشبكة: `myfleet_enterprise_private`
- Volumes: `myfleet_enterprise_postgres_data`, `myfleet_enterprise_whatsapp_sessions`
- منفذ التطبيق المحلي على السيرفر: `127.0.0.1:3012`

## مهم

التطبيق الحالي ما زال يستخدم Supabase في الواجهة والخدمة الخلفية لتسجيل الدخول والصلاحيات والبيانات. لذلك ملف النشر يجهز قاعدة PostgreSQL محلية منفصلة على الـ VPS، لكن تشغيل النظام بالكامل على قاعدة محلية فقط يحتاج مرحلة نقل من Supabase أو تشغيل Supabase self-hosted كامل.

بهذا الشكل لا يتم لمس تطبيقات أخرى، ولا يتم استخدام قاعدة بيانات أي تطبيق آخر.

## أول تشغيل على الـ VPS

1. أنشئ المسار:

```bash
mkdir -p /opt/myfleet-enterprise
```

2. ارفع المشروع أو اترك GitHub Actions يرفعه.

3. أنشئ ملف البيئة من المثال:

```bash
cp /opt/myfleet-enterprise/deploy/vps/.env.example /opt/myfleet-enterprise/deploy/vps/.env
nano /opt/myfleet-enterprise/deploy/vps/.env
```

4. ضع القيم الحقيقية في `.env` على السيرفر فقط.

5. شغل الحزمة:

```bash
cd /opt/myfleet-enterprise
docker compose -p myfleet_enterprise --env-file deploy/vps/.env -f deploy/vps/docker-compose.yml up -d --build --remove-orphans
```

6. افحص الحالة:

```bash
docker compose -p myfleet_enterprise -f deploy/vps/docker-compose.yml ps
curl -I http://127.0.0.1:3012/
```

## ربط الدومين

لا تعدل إعدادات أي تطبيق آخر. اربط الدومين أو الـ subdomain الخاص بـ MyFleet فقط إلى `http://127.0.0.1:3012`.

لو عندك Caddy عام على السيرفر، أضف بلوك منفصل فقط:

```caddyfile
myfleet.example.com {
  reverse_proxy 127.0.0.1:3012
}
```

## GitHub Secrets المطلوبة

ضع هذه القيم في GitHub repository secrets:

- `MYFLEET_VPS_HOST`
- `MYFLEET_VPS_USER`
- `MYFLEET_VPS_PORT`
- `MYFLEET_VPS_SSH_KEY`
- `MYFLEET_VPS_PATH`

القيمة المقترحة لـ `MYFLEET_VPS_PATH`:

```text
/opt/myfleet-enterprise
```

بعدها أي Push على `main` يشغل النشر التلقائي.
