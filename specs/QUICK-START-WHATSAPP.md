# ⚡ Quick Start - WhatsApp Integration

## 🎯 الهدف
دمج نظام الواتساب مع MyFleet Pro لإرسال إشعارات تلقائية للعملاء.

---

## 📦 ما تم إنشاؤه

### 1. الوثائق
- ✅ [`whatsapp-integration-architecture.md`](./whatsapp-integration-architecture.md) - الهيكل المعماري الكامل
- ✅ [`whatsapp-architecture-diagram.md`](./whatsapp-architecture-diagram.md) - المخططات البصرية
- ✅ [`whatsapp-implementation-guide.md`](./whatsapp-implementation-guide.md) - دليل التنفيذ خطوة بخطوة
- ✅ [`README-WHATSAPP-INTEGRATION.md`](./README-WHATSAPP-INTEGRATION.md) - دليل شامل

### 2. Database Migration
- ✅ [`20260207_whatsapp_integration.sql`](../supabase/migrations/20260207_whatsapp_integration.sql)
  - 5 جداول جديدة
  - RLS policies
  - Helper functions
  - 4 قوالب افتراضية

---

## 🚀 خطوات التنفيذ السريعة

### Step 1: تطبيق Database Migration (5 دقائق)

```bash
# في Supabase Dashboard → SQL Editor
# نسخ ولصق محتوى: supabase/migrations/20260207_whatsapp_integration.sql
# تشغيل الـ script
```

**التحقق:**
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'whatsapp%';
-- يجب أن يظهر: whatsapp_sessions, whatsapp_messages, whatsapp_templates, whatsapp_audit_logs
```

---

### Step 2: إنشاء WhatsApp Microservice (30 دقيقة)

```bash
# 1. إنشاء مجلد جديد
mkdir whatsapp-service
cd whatsapp-service

# 2. تهيئة المشروع
npm init -y

# 3. تثبيت المكتبات
npm install express @whiskeysockets/baileys @supabase/supabase-js cors dotenv helmet express-rate-limit
npm install -D typescript @types/node @types/express @types/cors nodemon ts-node

# 4. إنشاء tsconfig.json
# (نسخ من whatsapp-implementation-guide.md - Step 2.2)

# 5. إنشاء الملفات
mkdir src src/lib src/routes src/middleware

# 6. نسخ الكود من whatsapp-implementation-guide.md:
# - src/lib/useSupabaseAuthState.ts (Step 2.4)
# - src/lib/sessionManager.ts (Step 2.5)
# - src/routes/sessions.ts (Step 2.6)
# - src/routes/messages.ts (Step 2.7)
# - src/middleware/auth.ts (Step 2.9)
# - src/server.ts (Step 2.8)

# 7. إنشاء .env
# (نسخ من whatsapp-implementation-guide.md - Step 2.3)

# 8. تحديث package.json scripts
# (نسخ من whatsapp-implementation-guide.md - Step 2.10)

# 9. تشغيل
npm run dev
```

**التحقق:**
```bash
curl http://localhost:3001/api/health
# يجب أن يرجع: {"success": true, "status": "healthy"}
```

---

### Step 3: نشر Edge Functions (15 دقيقة)

```bash
# 1. إنشاء Edge Function
supabase functions new process-whatsapp-queue

# 2. نسخ الكود
# من whatsapp-implementation-guide.md - Step 3.1
# إلى: supabase/functions/process-whatsapp-queue/index.ts

# 3. نشر
supabase functions deploy process-whatsapp-queue

# 4. إعداد المتغيرات
supabase secrets set WHATSAPP_SERVICE_URL=http://localhost:3001

# 5. إنشاء Cron Job
# تشغيل SQL من whatsapp-implementation-guide.md - Step 3.3
```

---

### Step 4: تكامل Frontend (20 دقيقة)

```bash
# 1. إضافة environment variable
# في .env
VITE_WHATSAPP_SERVICE_URL=http://localhost:3001

# 2. إضافة Types
# في types.ts - نسخ من whatsapp-implementation-guide.md - Step 4.2

# 3. إنشاء Component
# إنشاء: components/WhatsAppSettings.tsx
# نسخ من whatsapp-implementation-guide.md - Step 4.3

# 4. إضافة إلى Settings page
# في components/Settings.tsx
import { WhatsAppSettings } from './WhatsAppSettings';

// داخل الـ component
<WhatsAppSettings />
```

---

### Step 5: اختبار (10 دقائق)

```bash
# 1. تشغيل WhatsApp Service
cd whatsapp-service
npm run dev

# 2. تشغيل Frontend
cd ..
npm run dev

# 3. فتح المتصفح
# http://localhost:5173
# تسجيل الدخول → Settings → WhatsApp Integration

# 4. اختبار الاتصال
# - اضغط "ربط الواتساب"
# - امسح QR code بالموبايل
# - تحقق من الاتصال
```

---

## 📊 الجداول المُنشأة

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|-------|------------------|
| `whatsapp_sessions` | جلسات الواتساب | org_id, status, auth_state, qr_code |
| `whatsapp_messages` | سجل الرسائل | recipient_phone, message_body, status |
| `whatsapp_templates` | قوالب الرسائل | name, category, message_template |
| `notification_queue` | طابور الإشعارات | template_id, scheduled_for, status |
| `whatsapp_audit_logs` | سجل التدقيق | event_type, event_data |

---

## 🔌 API Endpoints

| Method | Endpoint | الوصف |
|--------|----------|-------|
| POST | `/api/sessions/init` | إنشاء جلسة جديدة |
| GET | `/api/sessions/:orgId/qr` | الحصول على QR code |
| GET | `/api/sessions/:orgId/status` | حالة الجلسة |
| POST | `/api/sessions/:orgId/logout` | قطع الاتصال |
| POST | `/api/messages/send` | إرسال رسالة |
| POST | `/api/messages/send-template` | إرسال رسالة من قالب |

---

## 🎯 Use Cases

### 1. رسالة ترحيب للمستخدمين الجدد

```typescript
// عند التسجيل
await supabase.rpc('queue_whatsapp_notification', {
  p_org_id: orgId,
  p_recipient_phone: '+201234567890',
  p_template_id: 'trial_welcome_template_id',
  p_message_data: {
    customer_name: 'أحمد',
    trial_days: 14,
    app_url: 'https://myfleet.app'
  }
});
```

### 2. تنبيه انتهاء الاشتراك

```sql
-- Cron job يومي
INSERT INTO notification_queue (...)
SELECT ... FROM organizations
WHERE subscription_end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days';
```

### 3. إرسال رسالة يدوية

```typescript
// من لوحة التحكم
await fetch(`${WHATSAPP_SERVICE_URL}/api/messages/send`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Org-Id': orgId
  },
  body: JSON.stringify({
    recipient: '+201234567890',
    message: 'رسالة مخصصة'
  })
});
```

---

## 🔐 الأمان

### Authentication
- ✅ JWT token من Supabase
- ✅ التحقق من org_id
- ✅ صلاحيات owner/admin فقط

### CORS
- ✅ Whitelist للـ origins
- ✅ Credentials enabled

### Rate Limiting
- ✅ 100 requests / 15 min (API)
- ✅ 10 messages / min (Messages)

### RLS
- ✅ كل org ترى بياناتها فقط
- ✅ Super admins يرون كل شيء

---

## 🚀 النشر

### WhatsApp Service → Render

```bash
# 1. Push to GitHub
git add .
git commit -m "Add WhatsApp integration"
git push

# 2. Render Dashboard
# - New Web Service
# - Connect repo: whatsapp-service
# - Build: npm install && npm run build
# - Start: npm start
# - Add env vars

# 3. Note URL
# https://myfleet-whatsapp.onrender.com
```

### Frontend

```bash
# Update .env
VITE_WHATSAPP_SERVICE_URL=https://myfleet-whatsapp.onrender.com

# Build & Deploy
npm run build
```

---

## 🔍 Troubleshooting

### ❌ QR Code لا يظهر

```bash
# تحقق من:
1. WhatsApp Service يعمل (curl http://localhost:3001/api/health)
2. Supabase connection صحيح
3. لا توجد جلسة متصلة بالفعل

# الحل:
# حذف الجلسة القديمة
DELETE FROM whatsapp_sessions WHERE org_id = 'YOUR_ORG_ID';
```

### ❌ الرسائل لا ترسل

```sql
-- تحقق من حالة الجلسة
SELECT status FROM whatsapp_sessions WHERE org_id = 'YOUR_ORG_ID';
-- يجب أن تكون: 'connected'

-- تحقق من الرسائل الفاشلة
SELECT * FROM whatsapp_messages WHERE status = 'failed' ORDER BY created_at DESC;
```

### ❌ Queue لا يعمل

```bash
# تحقق من:
1. Edge Function deployed
2. Cron job scheduled
3. WHATSAPP_SERVICE_URL صحيح

# اختبار يدوي:
curl https://your-project.supabase.co/functions/v1/process-whatsapp-queue \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 📚 الوثائق الكاملة

للتفاصيل الكاملة، راجع:

1. **Architecture**: [`whatsapp-integration-architecture.md`](./whatsapp-integration-architecture.md)
2. **Diagrams**: [`whatsapp-architecture-diagram.md`](./whatsapp-architecture-diagram.md)
3. **Implementation**: [`whatsapp-implementation-guide.md`](./whatsapp-implementation-guide.md)
4. **README**: [`README-WHATSAPP-INTEGRATION.md`](./README-WHATSAPP-INTEGRATION.md)

---

## ⏱️ الوقت المتوقع

| المرحلة | الوقت |
|---------|-------|
| Database Setup | 5 دقائق |
| WhatsApp Service | 30 دقيقة |
| Edge Functions | 15 دقيقة |
| Frontend Integration | 20 دقيقة |
| Testing | 10 دقيقة |
| **المجموع** | **~1.5 ساعة** |

---

## ✅ Checklist

- [ ] تطبيق Database Migration
- [ ] إنشاء WhatsApp Microservice
- [ ] نشر Edge Functions
- [ ] تكامل Frontend
- [ ] اختبار الاتصال
- [ ] اختبار إرسال رسالة
- [ ] اختبار Queue
- [ ] النشر على Production

---

**تاريخ الإنشاء**: 2026-02-07  
**الإصدار**: 1.0  
**الحالة**: Ready to Implement ✅
