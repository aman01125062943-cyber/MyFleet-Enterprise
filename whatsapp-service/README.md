# MyFleet WhatsApp Microservice

خدمة واتساب ميكرو-سيرفر لإدارة جلسات الواتساب وإرسال الرسائل للعملاء في MyFleet Pro.

## 🚀 المميزات

- ✅ **تخزين الجلسات في Supabase** - الجلسات تبقى persistent عبر deployments
- ✅ **Multi-tenant** - كل organization لها جلسة منفصلة
- ✅ **Auto-reconnect** - إعادة اتصال تلقائية عند انقطاع الاتصال
- ✅ **Message Queue** - طابور رسائل مع rate limiting
- ✅ **Template System** - قوالب رسائل قابلة للتخصيص
- ✅ **Audit Logs** - سجل كامل للرسائل المرسلة
- ✅ **Rate Limiting** - حماية من الاستخدام المفرط

## 📋 المتطلبات

- Node.js >= 18.0.0
- حساب Supabase مع Service Role Key
- متغيرات البيئة (انظر `.env.example`)

## 🔧 التثبيت

```bash
# نسخ ملف البيئة
cp .env.example .env

# تعديل المتغيرات
nano .env

# تثبيت الاعتماديات
npm install

# التشغيل
npm start
```

## 🗄️ البنية

```
whatsapp-service/
├── package.json              # تبعيات المشروع
├── .env.example              # نمط متغيرات البيئة
├── server.js                 # السيرفر الرئيسي (Express)
├── SessionManager.js         # مدير جلسات الواتساب
├── MessageService.js         # خدمة إرسال الرسائل
├── useSupabaseAuthState.js # تخزين auth state في Supabase
├── Dockerfile                # إعداد Docker
├── render.yaml               # إعداد Render
└── README.md                # هذا الملف
```

## 📡 API Endpoints

### Health
- `GET /health` - فحص صحة السيرفر

### Sessions
- `GET /api/sessions` - جلب كل الجلسات
- `GET /api/sessions/:sessionId/status` - حالة جلسة
- `GET /api/sessions/:sessionId/qr` - جلب QR Code
- `POST /api/sessions/init` - إنشاء جلسة جديدة
- `POST /api/sessions/:sessionId/disconnect` - فصل جلسة
- `DELETE /api/sessions/:sessionId` - حذف جلسة

### Messages
- `POST /api/messages/send` - إرسال رسالة
- `POST /api/messages/bulk` - إرسال رسائل متعددة
- `GET /api/messages` - جلب سجل الرسائل

### Templates
- `GET /api/templates` - جلب قوالب الرسائل

## 🔐 الأمان

- **JWT Authentication** - التحقق من هوية المستخدم عبر Supabase Auth
- **Role-based Access** - فقط super_admin, owner, admin يمكنهم الوصول
- **CORS** - مسبوح فقط من الـ Frontend URL
- **Rate Limiting** - 100 طلب كل 15 دقيقة، 10 رسائل كل دقيقة

## 🐳 Docker

```bash
# Build image
docker build -t myfleet-whatsapp-service .

# Run container
docker run -p 3002:3002 \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_SERVICE_KEY=your_key \
  myfleet-whatsapp-service
```

## 📦 Deployment على Render

1. أنشئ repo جديد في GitHub
2. ادفع الكود
3. أنشئ Web Service جديد في Render
4. اختر `Dockerfile` و `render.yaml`
5. اضبط متغيرات البيئة
6. Deploy!

## 📊 قاعدة البيانات

الخدمة تستخدم 5 جداول في Supabase:

1. **whatsapp_sessions** - جلسات الواتساب
2. **whatsapp_messages** - سجل الرسائل
3. **whatsapp_templates** - قوالب الرسائل
4. **notification_queue** - طابور الإشعارات
5. **whatsapp_audit_logs** - سجل التدقيق

انظر `../supabase/migrations/20260207_whatsapp_integration.sql` لتفاصيل الجداول.

## 🔄 Auto-Restore

عند تشغيل السيرفر:
1. يجلب الجلسات المتصلة من قاعدة البيانات
2. يستعيد كل جلسة
3. يبدأ health check كل 5 دقائق

## 📝 License

MIT
