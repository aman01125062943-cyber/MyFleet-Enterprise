import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=False,  # Set to False to see browser for debugging
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
            ],
        )
        
        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(10000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5174", wait_until="domcontentloaded", timeout=30000)
        
        # Wait for the main page to reach DOMContentLoaded state
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except async_api.Error:
            pass
        
        # Take a screenshot before starting
        await page.screenshot(path="TC001_step1_initial_page.png")
        
        # Step 1: Click on "تسجيل وكالة جديدة" button to switch to signup mode
        try:
            await page.wait_for_selector('button:has-text("تسجيل وكالة جديدة")', timeout=10000)
            await page.click('button:has-text("تسجيل وكالة جديدة")')
            print("Clicked on signup button")
            await asyncio.sleep(2)  # Wait for form to appear
        except Exception as e:
            print(f"Failed to click signup button: {e}")
            raise
        
        # Take a screenshot after clicking signup
        await page.screenshot(path="TC001_step2_signup_form.png")
        
        # Step 2: Fill in the signup form
        try:
            # Fill in company name
            await page.fill('input[placeholder="شركة الأفق للسيارات"]', 'Test Company Fleet')
            print("Filled company name")
            
            # Fill in owner name
            await page.fill('input[placeholder="الاسم الكامل"]', 'Test Owner Name')
            print("Filled owner name")
            
            # Fill in email
            await page.fill('input[placeholder="name@company.com"]', 'testfleet@example.com')
            print("Filled email")
            
            # Fill in password
            await page.fill('input[type="password"]', 'TestPassword123!')
            print("Filled password")
            
            await asyncio.sleep(1)  # Small delay before submitting
        except Exception as e:
            print(f"Failed to fill form: {e}")
            raise
        
        # Take a screenshot before submitting
        await page.screenshot(path="TC001_step3_form_filled.png")
        
        # Step 3: Submit the signup form
        try:
            await page.click('button:has-text("إنشاء وكالة جديدة")')
            print("Clicked submit button")
        except Exception as e:
            print(f"Failed to click submit button: {e}")
            raise
        
        # Wait for the result
        await asyncio.sleep(5)
        
        # Take a screenshot after submitting
        await page.screenshot(path="TC001_step4_after_submit.png")
        
        # Step 4: Verify the result
        # Check if we were redirected to dashboard or see a success message
        current_url = page.url
        print(f"Current URL after signup: {current_url}")
        
        # Check for success indicators
        try:
            # Option 1: Check if redirected to dashboard
            if '/dashboard' in current_url or '/login' in current_url:
                print("Redirected to expected page after signup")
                
                # Option 2: Check for success message
                try:
                    # Look for Arabic success message
                    success_message = page.locator('text=تم إنشاء الحساب بنجاح')
                    if await success_message.is_visible(timeout=3000):
                        print("Success message is visible")
                except:
                    print("No explicit success message found, but redirect occurred")
                
                print("Test case passed: Signup process completed successfully")
            else:
                print(f"Unexpected URL: {current_url}")
                raise AssertionError('Test case failed: User was not redirected to expected page after signup')
                
        except AssertionError:
            # Check for error messages
            try:
                error_message = page.locator('text=البريد الإلكتروني مستخدم بالفعل')
                if await error_message.is_visible(timeout=2000):
                    print("Email already exists - this is expected behavior for duplicate signup")
                    print("Try using a different email address")
                    raise AssertionError('Email already exists. Use a different email for testing.')
            except:
                # Check for other errors
                try:
                    error_element = page.locator('.text-red-300')
                    if await error_element.is_visible(timeout=2000):
                        error_text = await error_element.text_content()
                        print(f"Error message: {error_text}")
                        raise AssertionError(f'Signup failed with error: {error_text}')
                except:
                    raise AssertionError('Test case failed: Signup process did not complete as expected')
        
        await asyncio.sleep(3)
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
