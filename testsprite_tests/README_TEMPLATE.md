# دليل استخدام قالب الاختبار العام

## 📄 نظرة عامة

[`test_template.py`](test_template.py) هو قالب عام يحتوي على دوال مساعدة لإنشاء اختبارات TestSprite بسرعة وسهولة.

---

## 🚀 البدء السريع

### 1. نسخ القالب
```bash
cp test_template.py TC002_User_login_with_correct_credentials.py
```

### 2. تعديل دالة `run_test()`
استبدل محتوى الدالة `run_test_template()` بإجراءات الاختبار الخاصة بك.

---

## 📚 الدوال المساعدة المتاحة

### إعداد المتصفح

```python
pw, browser, context, page = await setup_browser(headless=False)
```

**المعاملات:**
- `headless`: `False` لرؤية المتصفح، `True` للتشغيل في الخلفية

---

### التنقل إلى التطبيق

```python
await navigate_to_app(page, path='')
```

**المعاملات:**
- `path`: المسار الإضافي (مثال: `'/login'`، `'/inventory'`)

---

### أخذ لقطة شاشة

```python
await take_screenshot(page, 'filename.png')
```

**الاستخدام:**
- أخذ لقطة شاشة لكل خطوة
- يساعد في تصحيح الأخطاء

---

### النقر على زر

```python
await click_button(page, 'زر النص', timeout=10000)
```

**المعاملات:**
- `text`: نص الزر (بالعربية)
- `timeout`: زمن الانتظار بالميلي ثانية

**الأمثلة:**
```python
await click_button(page, 'تسجيل دخول')
await click_button(page, 'إضافة مركبة')
await click_button(page, 'حفظ')
```

---

### ملء حقل إدخال

```python
await fill_input(page, 'النص الموجود في placeholder', 'القيمة')
```

**المعاملات:**
- `placeholder`: النص الموجود في حقل الإدخال
- `value`: القيمة المراد إدخالها

**الأمثلة:**
```python
await fill_input(page, 'البريد الإلكتروني', 'test@example.com')
await fill_input(page, 'الاسم الكامل', 'Test User')
await fill_input(page, 'شركة الأفق للسيارات', 'Test Company')
```

---

### ملء حقل بالنوع

```python
await fill_input_by_type(page, 'input_type', 'القيمة')
```

**المعاملات:**
- `input_type`: نوع الحقل (`email`، `password`، `text`، `number`)
- `value`: القيمة المراد إدخالها

**الأمثلة:**
```python
await fill_input_by_type(page, 'email', 'test@example.com')
await fill_input_by_type(page, 'password', 'TestPassword123!')
await fill_input_by_type(page, 'number', '123')
```

---

### التحقق من وجود نص

```python
success = await wait_and_check(page, 'النص المتوقع', timeout=5000)
```

**المعاملات:**
- `locator_text`: النص المتوقع
- `timeout`: زمن الانتظار بالميلي ثانية

**القيمة المرجعة:**
- `True`: إذا وجد النص
- `False`: إذا لم يجد النص

**الأمثلة:**
```python
success = await wait_and_check(page, 'تم تسجيل الدخول بنجاح')
success = await wait_and_check(page, 'تمت إضافة المركبة')
```

---

### التحقق من الرابط

```python
success = await check_url(page, '/dashboard')
```

**المعاملات:**
- `expected_path`: المسار المتوقع في الرابط

**الأمثلة:**
```python
success = await check_url(page, '/dashboard')
success = await check_url(page, '/inventory')
success = await check_url(page, '/login')
```

---

## 📊 بيانات الاختبار

القالب يحتوي على قاموس `TEST_DATA` ببيانات اختبار جاهزة:

```python
TEST_DATA = {
    'user': {
        'email': 'test@example.com',
        'password': 'TestPassword123!',
        'company': 'Test Company',
        'owner': 'Test Owner'
    },
    'vehicle': {
        'make': 'Toyota',
        'model': 'Camry',
        'year': '2024',
        'status': 'متاحة'
    },
    'team_member': {
        'name': 'Test Member',
        'email': 'member@example.com',
        'role': 'driver'
    }
}
```

يمكنك استخدام هذه البيانات مباشرة:

```python
await fill_input(page, 'البريد الإلكتروني', TEST_DATA['user']['email'])
await fill_input_by_type(page, 'password', TEST_DATA['user']['password'])
```

---

## 📝 أمثلة كاملة

### مثال 1: اختبار تسجيل الدخول

```python
async def run_test():
    pw, browser, context, page = await setup_browser(headless=False)
    
    try:
        await navigate_to_app(page, '/login')
        await fill_input(page, 'البريد الإلكتروني', TEST_DATA['user']['email'])
        await fill_input_by_type(page, 'password', TEST_DATA['user']['password'])
        await click_button(page, 'دخول')
        
        success = await check_url(page, '/dashboard')
        assert success, "Login failed"
        
    finally:
        await context.close()
        await browser.close()
        await pw.stop()
```

### مثال 2: اختبار إضافة مركبة

```python
async def run_test():
    pw, browser, context, page = await setup_browser(headless=False)
    
    try:
        # تسجيل الدخول أولاً
        await navigate_to_app(page, '/login')
        await fill_input(page, 'البريد الإلكتروني', TEST_DATA['user']['email'])
        await fill_input_by_type(page, 'password', TEST_DATA['user']['password'])
        await click_button(page, 'دخول')
        
        # الانتقال إلى صفحة المخزون
        await navigate_to_app(page, '/inventory')
        await click_button(page, 'إضافة مركبة')
        await fill_input(page, 'الشركة', TEST_DATA['vehicle']['make'])
        await fill_input(page, 'الموديل', TEST_DATA['vehicle']['model'])
        await click_button(page, 'حفظ')
        
        success = await wait_and_check(page, 'تمت إضافة المركبة')
        assert success, "Vehicle addition failed"
        
    finally:
        await context.close()
        await browser.close()
        await pw.stop()
```

### مثال 3: اختبار إضافة عضو فريق

```python
async def run_test():
    pw, browser, context, page = await setup_browser(headless=False)
    
    try:
        # تسجيل الدخول أولاً
        await navigate_to_app(page, '/login')
        await fill_input(page, 'البريد الإلكتروني', TEST_DATA['user']['email'])
        await fill_input_by_type(page, 'password', TEST_DATA['user']['password'])
        await click_button(page, 'دخول')
        
        # الانتقال إلى صفحة الفريق
        await navigate_to_app(page, '/team')
        await click_button(page, 'إضافة عضو')
        await fill_input(page, 'الاسم الكامل', TEST_DATA['team_member']['name'])
        await fill_input(page, 'البريد الإلكتروني', TEST_DATA['team_member']['email'])
        await click_button(page, 'حفظ')
        
        success = await wait_and_check(page, 'تمت إضافة العضو')
        assert success, "Team member addition failed"
        
    finally:
        await context.close()
        await browser.close()
        await pw.stop()
```

---

## 🎯 نصائح للاختبار الفعال

### 1. استخدام headless=False في البداية
```python
pw, browser, context, page = await setup_browser(headless=False)
```
هذا يتيح لك رؤية ما يحدث في المتصفح.

### 2. أخذ لقطات شاشة متكررة
```python
await take_screenshot(page, 'step1_before.png')
# ... إجراءات ...
await take_screenshot(page, 'step2_after.png')
```
يساعدك في فهم المشاكل.

### 3. استخدام الانتظار المناسب
```python
await asyncio.sleep(2)  # انتظار قصير
await asyncio.sleep(5)  # انتظار طويل
```

استخدم انتظار قصير بعد الإجراءات، وطويل بعد الإرسال.

### 4. التحقق من النتائج بطرق متعددة
```python
# الطريقة 1: التحقق من الرابط
success = await check_url(page, '/dashboard')

# الطريقة 2: التحقق من النص
success = await wait_and_check(page, 'تم تسجيل الدخول بنجاح')

# الطريقة 3: الجمع بينهما
url_ok = await check_url(page, '/dashboard')
text_ok = await wait_and_check(page, 'تم تسجيل الدخول بنجاح')
success = url_ok or text_ok
```

---

## 📋 قائمة الاختبارات التي تحتاج إلى تحديث

### الأولوية عالية:
1. TC002 - تسجيل الدخول
2. TC003 - تسجيل الدخول ببيانات خاطئة
3. TC004 - عرض إحصائيات لوحة القيادة
4. TC005 - إضافة مركبة جديدة
5. TC006 - تحديث حالة مركبة
6. TC007 - تسجيل إيرادات
7. TC008 - إدخال مصروفات خاطئة
8. TC009 - إضافة عضو فريق
9. TC010 - التحقق من الصلاحيات

### الأولوية متوسطة:
10. TC011 - حساب تكلفة الرحلة
11. TC012 - التعامل مع الحالات الحدية
12. TC013 - لوحة الإدارة العامة
13. TC014 - التحقق من عزل البيانات

### الأولوية منخفضة:
14. TC015 - التحقق من أمان APIs
15. TC016 - تحديث الإعدادات
16. TC017 - التكامل مع Supabase
17. TC018 - حفظ البيانات
18. TC019 - منع التكرار

---

## ✅ الخلاصة

استخدم [`test_template.py`](test_template.py) كنقطة بداية لإنشاء جميع الاختبارات بسرعة وسهولة!

**الخطوات:**
1. انسخ القالب
2. عدّل دالة `run_test()`
3. استخدم الدوال المساعدة
4. اختبر الاختبار
5. انقل للاختبار التالي

**النتيجة:** ستحصل على اختبارات كاملة ومتسقة في وقت قصير!
