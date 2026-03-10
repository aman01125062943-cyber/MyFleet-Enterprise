import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    """
    اختبار تسجيل الدخول ببيانات صحيحة
    
    الخطوات:
    1. التنقل إلى صفحة تسجيل الدخول
    2. ملء بيانات الدخول (البريد الإلكتروني وكلمة المرور)
    3. النقر على زر الدخول
    4. التحقق من التحويل إلى لوحة القيادة
    """
    
    pw = None
    browser = None
    context = None
    
    try:
        # ========================================
        # الخطوة 1: إعداد المتصفح
        # ========================================
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=False,  # Set to False to see browser for debugging
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
            ],
        )
        context = await browser.new_context()
        context.set_default_timeout(10000)
        page = await context.new_page()
        
        print("=" * 50)
        print("TEST STARTED: User Login with Correct Credentials")
        print("=" * 50)
        
        # ========================================
        # الخطوة 2: التنقل إلى صفحة تسجيل الدخول
        # ========================================
        url = "http://localhost:5174/#/login"
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        print(f"Navigated to: {url}")
        await asyncio.sleep(2)
        await page.screenshot(path="TC002_step1_login_page.png")
        
        # ========================================
        # الخطوة 3: ملء بيانات الدخول
        # ========================================
        print("\n--- Filling Login Form ---\n")
        
        # ملء البريد الإلكتروني
        await page.wait_for_selector('input[placeholder="name@company.com"]', timeout=10000)
        await page.fill('input[placeholder="name@company.com"]', 'test@example.com')
        print("Filled email: test@example.com")
        
        # ملء كلمة المرور
        await page.wait_for_selector('input[type="password"]', timeout=5000)
        await page.fill('input[type="password"]', 'TestPassword123!')
        print("Filled password: ********")
        
        await asyncio.sleep(1)
        await page.screenshot(path="TC002_step2_form_filled.png")
        
        # ========================================
        # الخطوة 4: إرسال نموذج الدخول
        # ========================================
        print("\n--- Submitting Login Form ---\n")
        await page.click('button:has-text("دخول")')
        print("Clicked login button")
        
        # ========================================
        # الخطوة 5: الانتظار للنتيجة
        # ========================================
        print("\n--- Waiting for Result ---\n")
        await asyncio.sleep(5)
        await page.screenshot(path="TC002_step3_after_login.png")
        
        # ========================================
        # الخطوة 6: التحقق من النتيجة
        # ========================================
        print("\n--- Verifying Result ---\n")
        
        current_url = page.url
        print(f"Current URL: {current_url}")
        
        # التحقق من التحويل إلى لوحة القيادة
        if '/dashboard' in current_url:
            print("Successfully redirected to dashboard")
            
            # التحقق من وجود عناصر لوحة القيادة
            try:
                # البحث عن عنوان لوحة القيادة
                dashboard_title = page.locator('text=لوحة القيادة')
                if await dashboard_title.is_visible(timeout=3000):
                    print("Dashboard title is visible")
            except:
                print("No explicit dashboard title found, but redirect occurred")
            
            print("\n" + "=" * 50)
            print("TEST PASSED: Login successful")
            print("=" * 50 + "\n")
        else:
            print(f"Failed to redirect to dashboard. Current URL: {current_url}")
            
            # التحقق من رسائل الخطأ
            try:
                error_message = page.locator('text=معلومات الدخول غير صحيحة')
                if await error_message.is_visible(timeout=2000):
                    print("Error message found: Invalid credentials")
            except:
                try:
                    error_message = page.locator('text=Invalid login credentials')
                    if await error_message.is_visible(timeout=2000):
                        print("Error message found: Invalid login credentials (English)")
                except:
                    print("No error message found")
            
            print("\n" + "=" * 50)
            print("TEST FAILED: Login did not redirect to dashboard")
            print("=" * 50 + "\n")
            raise AssertionError('Test case failed: User login was not successful and user was not redirected to dashboard as expected.')
        
        await asyncio.sleep(2)
    
    except Exception as e:
        print("\n" + "=" * 50)
        print(f"TEST ERROR: {e}")
        print("=" * 50 + "\n")
        raise
    
    finally:
        # ========================================
        # الخطوة 7: تنظيف الموارد
        # ========================================
        print("\n--- Cleaning Up ---\n")
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
        print("Browser closed successfully\n")

asyncio.run(run_test())
