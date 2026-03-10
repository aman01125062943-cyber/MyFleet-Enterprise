import asyncio
from playwright.async_api import async_playwright, expect

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_playwright().start()
        
        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )
        
        # Create a new browser context
        context = await browser.new_context()
        context.set_default_timeout(5000)
        
        # Open a new page
        page = await context.new_page()
        
        # Navigate to Super Admin Dashboard route (assuming /#/admin)
        await page.goto("http://localhost:5174/#/admin", wait_until="commit", timeout=10000)
        
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except:
            pass
        
        # Verify it redirects to Login (Arabic text)
        await expect(page.locator('text=تسجيل الدخول').or_(page.locator('text=اسم المستخدم'))).to_be_visible(timeout=5000)
        
        print("TC013: Passed - Super Admin Dashboard is protected and redirects to login.")
    
    except Exception as e:
        print(f"TC013: Failed - {e}")
        raise e
    
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
    
