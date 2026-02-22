# خطة حل مشاكل صفحة المدير + دليل الاختبار بـ Chrome DevTools MCP

**المصدر:** [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)  
**آخر تحديث:** 22 فبراير 2026

---

## 1. إعداد Chrome DevTools MCP في Cursor

### التثبيت
1. افتح **Cursor Settings** → **MCP** → **New MCP Server**
2. أضف التكوين التالي:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

### التحقق من عمل MCP
استخدم الأمر التالي في Cursor للتأكد أن الـ MCP يعمل:
```
Check the performance of https://developers.chrome.com
```

إذا فُتح Chrome وسُجّل trace للأداء، فالتكوين صحيح.

---

## 2. ترتيب التنفيذ والاختبار

يُنفَّذ كل إصلاح على حدة، ثم يُختبر فوراً باستخدام أدوات Chrome DevTools MCP قبل الانتقال للتعديل التالي.

---

## التعديل 1: توحيد متغيرات بيئة الواتساب

### المشكلة
- `healthMonitor.ts` يستخدم `VITE_WHATSAPP_SERVER_URL`
- `WhatsAppSection.tsx` و `whatsappNotificationService.ts` يستخدمان `VITE_WHATSAPP_SERVICE_URL`

### الحل
في `lib/healthMonitor.ts` استبدل:
```ts
const WHATSAPP_SERVER_URL = import.meta.env.VITE_WHATSAPP_SERVER_URL || '';
```
بـ:
```ts
const WHATSAPP_SERVER_URL = import.meta.env.VITE_WHATSAPP_SERVICE_URL || import.meta.env.VITE_WHATSAPP_SERVER_URL || '';
```

في `.env` و `public/env-config.js` استخدم متغيراً واحداً:
- `VITE_WHATSAPP_SERVICE_URL` للجميع

### الاختبار بـ Chrome DevTools MCP
1. **navigate_page** → `http://localhost:5173/#/admin` (أو رابط التطبيق)
2. تسجيل الدخول يدوياً إذا لزم الأمر
3. **click** على تبويب "مراقبة النظام"
4. **list_console_messages** → التحقق من عدم وجود أخطاء fetch جديدة
5. **list_network_requests** → التحقق من أن طلبات الواتساب تذهب للـ URL الصحيح
6. **take_screenshot** → توثيق الحالة بعد التعديل

---

## التعديل 2: إزالة console.log من الإنتاج

### المشكلة
وجود `console.log` في `SuperAdminDashboard.tsx` سطر 7.

### الحل
حذف أو تعليق السطر:
```ts
console.log("🚀 Admin Dashboard v8 - Mobile Cards Added - Loaded Successfully! (Check 2026-02-07 00:30)");
```

### الاختبار بـ Chrome DevTools MCP
1. **navigate_page** → صفحة المدير
2. **list_console_messages** → التأكد من اختفاء الرسالة من Console

---

## التعديل 3: إصلاح عرض الأرقام العربية (Anti-Ban)

### المشكلة
في صفحة واتساب، قسم Anti-Ban، القيم 5 و 15 تظهر كـ "Ù¥" و "Ù¡Ù¥".

### الحل
1. التحقق من أن حقول الإدخال تستخدم `dir="ltr"` للأرقام أو `inputMode="numeric"`
2. إضافة `lang="ar"` و `dir="rtl"` للـ container الأب
3. استخدام `value` و `onChange` بدلاً من الاعتماد على عرض المتصفح الافتراضي

### الاختبار بـ Chrome DevTools MCP
1. **navigate_page** → `/#/admin`
2. **click** على تبويب "واتساب"
3. **click** على قسم "إعدادات الحماية (Anti-Ban)"
4. **fill** القيم في حقول الإدخال (مثلاً 5 و 15)
5. **take_screenshot** → التأكد من ظهور الأرقام بشكل صحيح
6. **take_snapshot** → فحص DOM للتأكد من القيم المخزنة

---

## التعديل 4: توحيد منطق الصلاحيات (AdminRoute + SuperAdminDashboard)

### المشكلة
- `AdminRoute` يقبل `super_admin` أو `admin` فقط
- `SuperAdminDashboard` يقبل أيضاً `owner`

### الحل (اختر أحد الخيارين)

**الخيار أ:** السماح لـ `owner` بدخول لوحة المدير  
في `ProtectedRoute.tsx` داخل `AdminRoute`:
```ts
const hasRequiredRole = 
  profile.role === requiredRole || 
  profile.role === 'super_admin' || 
  profile.role === 'owner';
```

**الخيار ب:** إزالة `owner` من `SuperAdminDashboard`  
في `SuperAdminDashboard.tsx` سطر 110:
```ts
if (user.role !== 'super_admin' && user.role !== 'admin') {
```

### الاختبار بـ Chrome DevTools MCP
1. تسجيل الدخول كمستخدم `admin` → **navigate_page** → `/#/admin` → التأكد من الدخول
2. تسجيل الدخول كمستخدم `owner` (إن وُجد) → إما أن يُسمح له بالدخول أو يُحوَّل للـ dashboard حسب الخيار المختار
3. **take_screenshot** بعد كل حالة

---

## التعديل 5: خدمة الواتساب (بيئة الإنتاج/التطوير)

### المشكلة
خدمة WhatsApp على `localhost:3002` غير متصلة.

### الحل (يعتمد على البيئة)

**تطوير محلي:**
```bash
cd whatsapp-service
npm install
node server.js
```

**إنتاج (مثل Render):**
- التأكد من وجود خدمة WhatsApp منفصلة أو منشأة على المنصة
- تعيين `VITE_WHATSAPP_SERVICE_URL` في متغيرات البيئة للإنتاج
- التأكد من أن المسار يشمل `/api/health` إذا كان مطلوباً

### الاختبار بـ Chrome DevTools MCP
1. تشغيل التطبيق وخدمة الواتساب محلياً
2. **navigate_page** → `/#/admin` → تبويب "مراقبة النظام"
3. **wait_for** بضع ثوانٍ
4. **list_console_messages** → التأكد من عدم ظهور `ERR_CONNECTION_REFUSED`
5. **list_network_requests** → التأكد من نجاح طلبات `/health` (status 200)

---

## 3. سيناريو اختبار شامل بعد كل التعديلات

### الخطوات باستخدام Chrome DevTools MCP

| الخطوة | الأداة | الإجراء |
|--------|--------|---------|
| 1 | `navigate_page` | فتح `http://localhost:5173/#/login` |
| 2 | `fill` + `click` | تسجيل الدخول بحساب super_admin |
| 3 | `navigate_page` | الانتقال لـ `/#/admin` |
| 4 | `take_screenshot` | التقاط لوحة نظرة عامة |
| 5 | `click` | فتح تبويب "المنظمات" |
| 6 | `take_screenshot` | التأكد من عرض المنظمات |
| 7 | `click` | فتح تبويب "واتساب" |
| 8 | `take_screenshot` | التأكد من واجهة الواتساب |
| 9 | `click` | فتح تبويب "مراقبة النظام" |
| 10 | `list_console_messages` | فحص أخطاء Console |
| 11 | `list_network_requests` | فحص طلبات الشبكة الفاشلة |
| 12 | `take_screenshot` | توثيق حالة مراقبة النظام |

---

## 4. أدوات Chrome DevTools MCP المستخدمة

| الأداة | الغرض |
|--------|-------|
| `navigate_page` | الانتقال لصفحة معينة |
| `click` | النقر على عناصر الواجهة |
| `fill` | تعبئة حقول الإدخال |
| `take_screenshot` | التقاط صورة للواجهة |
| `take_snapshot` | الحصول على DOM وaccessibility tree |
| `list_console_messages` | عرض رسائل Console |
| `list_network_requests` | عرض طلبات الشبكة |
| `wait_for` | انتظار تحميل العناصر |

**المرجع الكامل للأدوات:**  
[https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)

---

## 5. ملخص ترتيب التنفيذ

| # | التعديل | الملف | الأولوية | الحالة |
|---|---------|-------|----------|--------|
| 1 | توحيد متغيرات الواتساب | `lib/healthMonitor.ts` | عالية | ✅ منفذ |
| 2 | إزالة console.log | `components/SuperAdminDashboard.tsx` | منخفضة | ✅ منفذ |
| 3 | إصلاح الأرقام العربية | `WhatsAppCampaignManager.tsx` (Anti-Ban) | متوسطة | ✅ منفذ |
| 4 | توحيد منطق الصلاحيات | `ProtectedRoute.tsx` | متوسطة | ✅ منفذ |
| 5 | تشغيل خدمة الواتساب | بيئة التشغيل (تشغيل / إعدادات) | حرجة | يدوي |

---

## 6. مراجع

- [Chrome DevTools MCP - GitHub](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [أدوات MCP (Tool Reference)](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- [Troubleshooting](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/troubleshooting.md)
