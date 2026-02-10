# WhatsApp Service Troubleshooting Guide

## المشكلة: الرسائل لا تصل رغم أن الجلسة تظهر "متصلة"

### الخطوة 1: تشغيل أداة التشخيص الشاملة

```bash
cd whatsapp-service
node debug_connection_test.cjs
```

هذه الأداة ستفحص:
- ✅ حالة الخدمة (هل هي تعمل؟)
- ✅ حالة الجلسات في قاعدة البيانات
- ✅ ملفات الجلسة المحفوظة (auth_sessions)
- ✅ محاولة إرسال رسالة اختبار فعلية

### الخطوة 2: اختبار تنسيق رقم الهاتف

```bash
cd whatsapp-service
node test_phone_format.js
```

هذا سيختبر دالة `formatPhoneNumber` مع صيغ مختلفة من الأرقام المصرية.

### الخطوة 3: إعادة ضبط الجلسة (إذا لزم الأمر)

إذا وجدت أن:
- الجلسة تظهر "متصلة" لكن الرسائل لا تصل
- تحصل على أخطاء 410 أو 401
- الاتصال غير مستقر

قم بتشغيل:

```bash
cd whatsapp-service
node reset_session.js
```

ثم:
1. أعد تشغيل الخدمة: `npm start`
2. امسح كود QR جديد
3. جرّب الإرسال مرة أخرى

---

## المشاكل الشائعة والحلول

### 1. رسالة "تم الإرسال" لكن الرسالة لا تصل

**السبب المحتمل:** الجلسة غير متصلة فعلياً (مقطوعة من واتساب)

**الحل:**
```bash
# تشغيل التشخيص
node debug_connection_test.cjs

# إذا كانت الجلسة معطلة
node reset_session.js
```

### 2. رقم الهاتف "غير صحيح"

**السبب المحتمل:** تنسيق الرقم خاطئ

**الحل:**
```bash
# اختبار تنسيق الأرقام
node test_phone_format.js

# الصيغ المدعومة للأرقام المصرية:
# 01xxxxxxxxx  -> 201xxxxxxxxx
# +20xxxxxxxxx -> 20xxxxxxxxx
# 0020xxxxxxxx -> 20xxxxxxxxx
# 10xxxxxxxx   -> 2010xxxxxxxx
```

### 3. خطأ 410 (Session Gone)

**الحل:**
```bash
node reset_session.js
# ثم إعادة مسح كود QR
```

### 4. الخدمة لا تعمل على المنفذ 3002

**الحل:**
```bash
cd whatsapp-service
npm start
```

---

## هيكل الملفات الجديدة

```
whatsapp-service/
├── debug_connection_test.cjs  # أداة التشخيص الشاملة
├── test_phone_format.js       # اختبار تنسيق رقم الهاتف
├── reset_session.js           # إعادة ضبط الجلسة
└── MessageService.js          # محسَّن - دالة formatPhoneNumber محسّنة
```

---

## نقطة النهاية الجديدة للاختبار

أضفنا نقطة نهاية `/test-send-internal` للاختبار المباشر بدون مصادقة:

```bash
# اختبار الإرسال المباشر
curl -X POST http://localhost:3002/test-send-internal \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"01125062943","message":"Test message"}'
```

**تنبيه:** هذه النقطة مخصصة للاختبار فقط في بيئة التطوير!

---

## دالة formatPhoneNumber المحسّنة

الدالة الجديدة تتعامل مع:
- ✅ الأرقام المحلية المصرية (01xxxxxxxxx)
- ✅ الصيغة الدولية (+20xxxxxxxxx)
- ✅ الصيغة مع 00 (0020xxxxxxxxx)
- ✅ ازدواجية كود الدولة (20010... → 2010...)
- ✅ الأرقام 10 خانات (10xxxxxxxx → 2010xxxxxxxx)
- ✅ المسافات والشرطات (011-123-45678)
- ✅ JID كامل (2010...@s.whatsapp.net)

---

## استكشاف الأخطاء المتقدم

إذا استمرت المشكلة بعد كل الخطوات:

1. **تحقق من سجلات الخدمة:**
   ```bash
   cd whatsapp-service
   npm start
   # راقب السجلات في الطرفية
   ```

2. **تحقق من حالة الاتصال في Baileys:**
   - ابحث عن سطر: `Connection update for ...`
   - تحقق من `connection=close` أو `connection=open`

3. **مسح جميع ملفات الجلسة يدوياً:**
   ```bash
   rm -rf whatsapp-service/auth_sessions/*
   ```

4. **إعادة تشغيل الخدمة ومسح كود QR جديد.**
