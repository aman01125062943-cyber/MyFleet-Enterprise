# 📱 WhatsApp Integration for MyFleet Pro

## 🎯 نظرة عامة

هذا المشروع يوفر تكامل كامل لنظام الواتساب مع MyFleet Pro، مما يتيح إرسال إشعارات تلقائية للعملاء عبر WhatsApp باستخدام مكتبة Baileys.

## 📚 الوثائق المتوفرة

### 1. [`whatsapp-integration-architecture.md`](./whatsapp-integration-architecture.md)
**الهيكل المعماري الكامل**

يحتوي على:
- 🏗️ الهيكل المعماري المقترح (Frontend + Supabase + WhatsApp Microservice)
- 📊 تصميم جداول Supabase (5 جداول رئيسية)
- 🔌 API Endpoints (9 endpoints)
- 🔄 تدفق البيانات (3 سيناريوهات مفصلة)
- 🔐 الأمان و CORS
- 🔧 تطبيق useSupabaseAuthState
- 🚀 استراتيجية النشر
- 📱 تكامل Frontend
- 📊 Monitoring & Logging
- 🎯 قوالب الرسائل الافتراضية

### 2. [`whatsapp-architecture-diagram.md`](./whatsapp-architecture-diagram.md)
**المخططات البصرية**

يحتوي على:
- 🏗️ System Architecture Overview (Mermaid diagram)
- 🔄 Session Initialization Flow
- 📨 Message Sending Flow
- 🗄️ Database Schema (ERD)
- 🔐 Security Architecture
- 📊 Data Flow - Trial User Welcome
- 🔄 Multi-Tenant Session Management
- 🚀 Deployment Architecture
- 📈 Scaling Strategy
- 🔧 useSupabaseAuthState Implementation
- 📱 Frontend Component Structure

### 3. [`whatsapp-implementation-guide.md`](./whatsapp-implementation-guide.md)
**دليل التنفيذ خطوة بخطوة**

يحتوي على:
- ✅ Prerequisites
- 📦 Phase 1: Database Setup
- 🔧 Phase 2: WhatsApp Microservice (كود كامل)
- ⚡ Phase 3: Supabase Edge Functions
- 🎨 Phase 4: Frontend Integration
- 🧪 Phase 5: Testing
- 🚀 Phase 6: Deployment
- 🔍 Troubleshooting

### 4. [`20260207_whatsapp_integration.sql`](../supabase/migrations/20260207_whatsapp_integration.sql)
**SQL Migration Script**

يحتوي على:
- جداول Supabase الكاملة مع RLS policies
- Indexes للأداء
- Triggers للـ updated_at
- Helper functions
- Default templates
- Grants

---

## 🚀 البدء السريع

### 1. تطبيق Database Migration

```bash
# في Supabase SQL Editor
# نسخ ولصق محتوى supabase/migrations/20260207_whatsapp_integration.sql
# ثم تشغيل الـ script
```

### 2. إنشاء WhatsApp Microservice

```bash
# إنشاء مجلد جديد
mkdir whatsapp-service
cd whatsapp-service

# تهيئة المشروع
npm init -y

# تثبيت المكتبات
npm install express @whiskeysockets/baileys @supabase/supabase-js cors dotenv helmet express-rate-limit

# تثبيت dev dependencies
npm install -D typescript @types/node @types/express @types/cors nodemon ts-node

# نسخ الكود من whatsapp-implementation-guide.md
# Phase 2: WhatsApp Microservice
```

### 3. إعداد Environment Variables

```bash
# .env في WhatsApp Service
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=http://localhost:5173,https://myfleet.app

# .env في Frontend
VITE_WHATSAPP_SERVICE_URL=http://localhost:3001
```

### 4. تشغيل الخدمة

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. نشر Edge Functions

```bash
# في مجلد المشروع الرئيسي
supabase functions deploy process-whatsapp-queue

# إعداد المتغيرات
supabase secrets set WHATSAPP_SERVICE_URL=https://your-service.onrender.com
```

---

## 📊 الجداول المُنشأة

### 1. `whatsapp_sessions`
تخزين جلسات الواتساب لكل organization

**الأعمدة الرئيسية:**
- `org_id` - معرف المؤسسة
- `status` - حالة الاتصال (disconnected, connecting, qr_pending, connected, error)
- `auth_state` - حالة المصادقة (Baileys format)
- `qr_code` - رمز QR للاتصال الأولي
- `phone_number` - رقم الواتساب المتصل

### 2. `whatsapp_messages`
سجل جميع الرسائل المرسلة

**الأعمدة الرئيسية:**
- `recipient_phone` - رقم المستلم
- `message_body` - محتوى الرسالة
- `status` - حالة الرسالة (pending, sent, delivered, read, failed)
- `trigger_type` - نوع المحفز (manual, trial_welcome, subscription_expiring, etc.)

### 3. `whatsapp_templates`
قوالب الرسائل

**القوالب الافتراضية:**
- `trial_welcome` - رسالة ترحيب للمستخدمين الجدد
- `subscription_expiring` - تنبيه انتهاء الاشتراك
- `subscription_activated` - تأكيد تفعيل الاشتراك
- `payment_reminder` - تذكير بالدفع

### 4. `notification_queue`
طابور الإشعارات للمعالجة

**الأعمدة الرئيسية:**
- `notification_type` - نوع الإشعار (whatsapp, email, sms)
- `template_id` - معرف القالب
- `message_data` - بيانات القالب (variables)
- `priority` - الأولوية (1-10)
- `scheduled_for` - موعد الإرسال

### 5. `whatsapp_audit_logs`
سجل التدقيق للأحداث

---

## 🔌 API Endpoints

### Sessions Management

```http
POST   /api/sessions/init          # Initialize new session
GET    /api/sessions/:orgId/qr     # Get QR code
GET    /api/sessions/:orgId/status # Get session status
POST   /api/sessions/:orgId/logout # Logout session
```

### Messages

```http
POST   /api/messages/send          # Send single message
POST   /api/messages/send-template # Send template message
POST   /api/messages/send-bulk     # Send bulk messages
```

### Health Check

```http
GET    /api/health                 # Service health check
```

---

## 🔄 تدفق العمل

### 1. إعداد جلسة واتساب جديدة

```
User → Frontend → Edge Function → WhatsApp Service
                                        ↓
                                  Generate QR
                                        ↓
                                  Save to DB
                                        ↓
User scans QR → WhatsApp → Baileys → Save auth_state
                                        ↓
                                  Status: connected
```

### 2. إرسال رسالة تلقائية

```
Trigger (e.g., new signup) → INSERT notification_queue
                                        ↓
                            Edge Function (cron)
                                        ↓
                            Process queue
                                        ↓
                            WhatsApp Service
                                        ↓
                            Send via Baileys
                                        ↓
                            Update status
```

---

## 🔐 الأمان

### Authentication
- جميع الطلبات تحتاج JWT token من Supabase
- التحقق من انتماء المستخدم للـ organization
- التحقق من الصلاحيات (owner/admin فقط)

### CORS
- Whitelist محدد للـ origins المسموحة
- Credentials enabled
- Headers محددة

### Rate Limiting
- API: 100 requests / 15 minutes
- Messages: 10 messages / minute per org

### RLS Policies
- كل organization ترى بياناتها فقط
- Super admins يرون كل شيء
- System templates محمية من التعديل

---

## 📈 Scaling

### Current (Phase 1)
- Single WhatsApp Service instance
- Handles ~100 organizations

### Growth (Phase 2)
- Load balancer
- 2-3 service instances
- Handles ~500 organizations

### Scale (Phase 3)
- Load balancer + Redis
- Multiple instances with org sharding
- Handles 1000+ organizations

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Test session initialization
curl -X POST http://localhost:3001/api/sessions/init \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Org-Id: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{"org_id": "YOUR_ORG_ID"}'

# 2. Get QR code
curl http://localhost:3001/api/sessions/YOUR_ORG_ID/qr \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Org-Id: YOUR_ORG_ID"

# 3. Send message
curl -X POST http://localhost:3001/api/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Org-Id: YOUR_ORG_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "YOUR_ORG_ID",
    "recipient": "+201234567890",
    "message": "مرحباً من MyFleet Pro!"
  }'
```

### Database Testing

```sql
-- Check session status
SELECT org_id, status, phone_number, last_connected_at 
FROM whatsapp_sessions;

-- Check messages
SELECT recipient_phone, message_body, status, sent_at 
FROM whatsapp_messages 
ORDER BY created_at DESC 
LIMIT 10;

-- Check queue
SELECT notification_type, status, scheduled_for 
FROM notification_queue 
WHERE status = 'pending';
```

---

## 🚀 Deployment

### WhatsApp Service (Render)

1. Push code to GitHub
2. Create new Web Service on Render
3. Connect repository
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy

### Edge Functions (Supabase)

```bash
supabase functions deploy process-whatsapp-queue
supabase secrets set WHATSAPP_SERVICE_URL=https://your-service.onrender.com
```

### Frontend

```bash
# Update .env
VITE_WHATSAPP_SERVICE_URL=https://your-service.onrender.com

# Build and deploy
npm run build
```

---

## 🔍 Troubleshooting

### QR Code Not Generating

**الأسباب المحتملة:**
- Supabase connection failed
- Auth state not saving properly
- Session already connected

**الحل:**
```bash
# Check logs
# Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# Delete existing session and try again
```

### Messages Not Sending

**الأسباب المحتملة:**
- Session not connected
- Invalid phone number format
- Rate limit exceeded

**الحل:**
```sql
-- Check session status
SELECT status FROM whatsapp_sessions WHERE org_id = 'YOUR_ORG_ID';

-- Should be 'connected'
```

### Queue Not Processing

**الأسباب المحتملة:**
- Edge function not deployed
- Cron job not scheduled
- WhatsApp service URL incorrect

**الحل:**
```bash
# Redeploy edge function
supabase functions deploy process-whatsapp-queue

# Check secrets
supabase secrets list

# Test manually
curl https://your-project.supabase.co/functions/v1/process-whatsapp-queue \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 📝 Use Cases

### 1. Welcome Message for Trial Users

```typescript
// Triggered on user signup
await supabase.rpc('queue_whatsapp_notification', {
  p_org_id: orgId,
  p_recipient_phone: user.phone,
  p_template_id: 'trial_welcome_template_id',
  p_message_data: {
    customer_name: user.full_name,
    trial_days: 14,
    app_url: 'https://myfleet.app'
  },
  p_priority: 5
});
```

### 2. Subscription Expiring Alert

```sql
-- Cron job runs daily
INSERT INTO notification_queue (
  org_id,
  notification_type,
  recipient_phone,
  template_id,
  message_data,
  priority
)
SELECT 
  o.id,
  'whatsapp',
  o.owner_phone,
  (SELECT id FROM whatsapp_templates WHERE name = 'subscription_expiring'),
  jsonb_build_object(
    'customer_name', o.name,
    'plan_name', s.plan_name,
    'expiry_date', s.end_date::text,
    'days_remaining', (s.end_date - CURRENT_DATE)::text
  ),
  3
FROM organizations o
JOIN subscriptions s ON s.org_id = o.id
WHERE s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
AND s.status = 'active';
```

### 3. Manual Message from Dashboard

```typescript
// From frontend
const sendMessage = async () => {
  const response = await fetch(`${WHATSAPP_SERVICE_URL}/api/messages/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Org-Id': orgId
    },
    body: JSON.stringify({
      org_id: orgId,
      recipient: '+201234567890',
      message: 'رسالة مخصصة من لوحة التحكم'
    })
  });
  
  const result = await response.json();
  console.log('Message sent:', result);
};
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **Session Health**
   - Active sessions count
   - Connection uptime
   - Reconnection attempts

2. **Message Delivery**
   - Messages sent per day
   - Delivery rate
   - Failed messages

3. **Queue Performance**
   - Queue size
   - Processing time
   - Retry rate

### Monitoring Queries

```sql
-- Active sessions
SELECT COUNT(*) FROM whatsapp_sessions WHERE status = 'connected';

-- Messages today
SELECT 
  status,
  COUNT(*) 
FROM whatsapp_messages 
WHERE created_at >= CURRENT_DATE 
GROUP BY status;

-- Queue backlog
SELECT COUNT(*) FROM notification_queue WHERE status = 'pending';

-- Average delivery time
SELECT 
  AVG(EXTRACT(EPOCH FROM (sent_at - created_at))) as avg_seconds
FROM whatsapp_messages 
WHERE sent_at IS NOT NULL;
```

---

## 🎯 Roadmap

### Phase 1 (Current) ✅
- [x] Basic session management
- [x] Text message sending
- [x] Template system
- [x] Notification queue
- [x] Trial welcome messages
- [x] Subscription alerts

### Phase 2 (Next)
- [ ] Media messages (images, documents)
- [ ] Message scheduling
- [ ] Bulk messaging UI
- [ ] Message analytics dashboard
- [ ] Delivery reports

### Phase 3 (Future)
- [ ] Two-way messaging (receive messages)
- [ ] Chatbot integration
- [ ] WhatsApp Business API support
- [ ] Multi-language templates
- [ ] A/B testing for messages

---

## 📞 Support

للمساعدة أو الاستفسارات:
- 📧 Email: support@myfleet.app
- 📱 WhatsApp: +20 XXX XXX XXXX
- 📚 Documentation: [Link to docs]

---

## 📄 License

MIT License - MyFleet Pro © 2026

---

**تاريخ الإنشاء**: 2026-02-07  
**الإصدار**: 1.0.0  
**الحالة**: Ready for Implementation ✅
