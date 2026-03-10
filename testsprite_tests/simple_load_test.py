import asyncio
from playwright import async_api

async def run_test():
    pw = None
    browser = None
    context = None
    
    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()
        
        # Launch a Chromium browser in headless mode
        browser = await pw.chromium.launch(
            headless=False,  # Set to False to see the browser
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
            ],
        )
        
        # Create a new browser context
        context = await browser.new_context()
        context.set_default_timeout(10000)
        
        # Open a new page in the browser context
        page = await context.new_page()
        
        # Navigate to your target URL
        await page.goto("http://localhost:5174", wait_until="domcontentloaded", timeout=30000)
        
        # Wait a bit to see what's on the page
        await asyncio.sleep(5)
        
        # Get page title
        title = await page.title()
        print(f"Page title: {title}")
        
        # Get page URL after navigation
        url = page.url
        print(f"Current URL: {url}")
        
        # Take a screenshot
        await page.screenshot(path="test_screenshot.png")
        print("Screenshot saved as test_screenshot.png")
        
        print("Application loaded successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        raise
    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()
            
asyncio.run(run_test())
