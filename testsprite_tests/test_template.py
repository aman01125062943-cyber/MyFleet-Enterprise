"""
قالب اختبار عام لـ TestSprite - مدير الأسطول Enterprise SaaS

هذا القالب يحتوي على دوال مساعدة لإجراءات الاختبار الشائعة
يمكنك استخدامه كنقطة بداية لجميع الاختبارات
"""

import asyncio
from playwright import async_api
from playwright.async_api import expect

# ============================================
# بيانات الاختبار (يمكنك تعديلها لكل اختبار)
# ============================================

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

# ============================================
# دوال مساعدة للاختبار
# ============================================

async def setup_browser(headless=False):
    """إعداد المتصفح والعودة بالكائنات اللازمة"""
    pw = await async_api.async_playwright().start()
    browser = await pw.chromium.launch(
        headless=headless,
        args=[
            "--window-size=1280,720",
            "--disable-dev-shm-usage",
            "--ipc=host",
        ],
    )
    context = await browser.new_context()
    context.set_default_timeout(10000)
    page = await context.new_page()
    return pw, browser, context, page

async def navigate_to_app(page, path=''):
    """التنقل إلى التطبيق"""
    url = f"http://localhost:5174/{path}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await asyncio.sleep(1)

async def take_screenshot(page, filename):
    """أخذ لقطة شاشة"""
    await page.screenshot(path=filename)
    print(f"Screenshot saved: {filename}")

async def click_button(page, text, timeout=10000):
    """النقر على زر"""
    await page.wait_for_selector(f'button:has-text("{text}")', timeout=timeout)
    await page.click(f'button:has-text("{text}")')
    print(f"Clicked button: {text}")

async def fill_input(page, placeholder, value):
    """ملء حقل إدخال"""
    await page.fill(f'input[placeholder="{placeholder}"]', value)
    print(f"Filled input [{placeholder}]: {value}")

async def fill_input_by_type(page, input_type, value):
    """ملء حقل إدخال بالنوع"""
    await page.fill(f'input[type="{input_type}"]', value)
    print(f"Filled input [{input_type}]: {'*' * len(value)}")

async def wait_and_check(page, locator_text, timeout=5000):
    """الانتظار والتحقق من وجود نص"""
    try:
        locator = page.locator(f'text="{locator_text}"')
        await expect(locator).to_be_visible(timeout=timeout)
        print(f"Found text: {locator_text}")
        return True
    except:
        print(f"Text not found: {locator_text}")
        return False

async def check_url(page, expected_path):
    """التحقق من الرابط الحالي"""
    current_url = page.url
    if expected_path in current_url:
        print(f"URL check passed: {current_url}")
        return True
    else:
        print(f"URL check failed: Expected {expected_path}, got {current_url}")
        return False

# ============================================
# قالب الاختبار الرئيسي
# ============================================

async def run_test_template():
    """
    قالب اختبار رئيسي - عدّل هذا الدالة لإنشاء اختبارك الخاص
    
    الخطوات:
    1. إعداد المتصفح
    2. التنقل إلى التطبيق
    3. إجراءات المستخدم (النقر، الملء، الإرسال)
    4. التحقق من النتائج
    5. تنظيف الموارد
    """
    
    pw = None
    browser = None
    context = None
    
    try:
        # ========================================
        # الخطوة 1: إعداد المتصفح
        # ========================================
        pw, browser, context, page = await setup_browser(headless=False)
        print("=" * 50)
        print("TEST STARTED")
        print("=" * 50)
        
        # ========================================
        # الخطوة 2: التنقل إلى التطبيق
        # ========================================
        await navigate_to_app(page)
        await take_screenshot(page, "step1_initial_page.png")
        
        # ========================================
        # الخطوة 3: إجراءات المستخدم
        # ========================================
        print("\n--- Executing User Actions ---\n")
        
        # مثال: النقر على زر
        # await click_button(page, "تسجيل دخول")
        
        # مثال: ملء نموذج
        # await fill_input(page, "البريد الإلكتروني", TEST_DATA['user']['email'])
        # await fill_input_by_type(page, "password", TEST_DATA['user']['password'])
        
        # مثال: إرسال نموذج
        # await click_button(page, "دخول")
        
        # ========================================
        # الخطوة 4: الانتظار للنتيجة
        # ========================================
        print("\n--- Waiting for Result ---\n")
        await asyncio.sleep(3)
        await take_screenshot(page, "step2_after_action.png")
        
        # ========================================
        # الخطوة 5: التحقق من النتائج
        # ========================================
        print("\n--- Verifying Results ---\n")
        
        # مثال: التحقق من الرابط
        # success = await check_url(page, '/dashboard')
        
        # مثال: التحقق من رسالة
        # success = await wait_and_check(page, "تم تسجيل الدخول بنجاح")
        
        if success:
            print("\n" + "=" * 50)
            print("TEST PASSED")
            print("=" * 50 + "\n")
        else:
            print("\n" + "=" * 50)
            print("TEST FAILED")
            print("=" * 50 + "\n")
            raise AssertionError("Test failed: Expected result not found")
        
        await asyncio.sleep(2)
    
    except Exception as e:
        print("\n" + "=" * 50)
        print(f"TEST ERROR: {e}")
        print("=" * 50 + "\n")
        raise
    
    finally:
        # ========================================
        # الخطوة 6: تنظيف الموارد
        # ========================================
        print("\n--- Cleaning Up ---\n")
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
        print("Browser closed successfully\n")

# ============================================
# أمثلة على كيفية استخدام القالب
# ============================================

"""
مثال 1: اختبار تسجيل الدخول

async def run_test():
    pw, browser, context, page = await setup_browser(headless=False)
    
    try:
        await navigate_to_app(page)
        await click_button(page, "تسجيل دخول")
        await fill_input(page, "البريد الإلكتروني", TEST_DATA['user']['email'])
        await fill_input_by_type(page, "password", TEST_DATA['user']['password'])
        await click_button(page, "دخول")
        
        success = await check_url(page, '/dashboard')
        assert success, "Login failed"
        
    finally:
        await context.close()
        await browser.close()
        await pw.stop()

مثال 2: اختبار إضافة مركبة

async def run_test():
    pw, browser, context, page = await setup_browser(headless=False)
    
    try:
        await navigate_to_app(page, '/login')
        # تسجيل الدخول أولاً...
        
        await navigate_to_app(page, '/inventory')
        await click_button(page, "إضافة مركبة")
        await fill_input(page, "الشركة", TEST_DATA['vehicle']['make'])
        await fill_input(page, "الموديل", TEST_DATA['vehicle']['model'])
        await click_button(page, "حفظ")
        
        success = await wait_and_check(page, "تمت إضافة المركبة")
        assert success, "Vehicle addition failed"
        
    finally:
        await context.close()
        await browser.close()
        await pw.stop()
"""

# ============================================
# تشغيل القالب (للاختبار فقط)
# ============================================

if __name__ == "__main__":
    # لتشغيل القالب كاختبار
    asyncio.run(run_test_template())
