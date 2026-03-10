import asyncio
from playwright import async_api

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Navigate to your target URL and wait until the network request is committed
        await page.goto("http://localhost:5174", wait_until="commit", timeout=10000)

        # Wait for the main page to reach DOMContentLoaded state (optional for stability)
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except async_api.Error:
            pass

        # Iterate through all iframes and wait for them to load as well
        for frame in page.frames:
            try:
                await frame.wait_for_load_state("domcontentloaded", timeout=3000)
            except async_api.Error:
                pass

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:5174
        await page.goto("http://localhost:5174", wait_until="commit", timeout=10000)
        
        # -> Reload the site using a direct static URL (index.html) to attempt to load the app assets, then wait and re-inspect the DOM for the contact/booking form or navigation elements.
        await page.goto("http://localhost:5174/index.html", wait_until="commit", timeout=10000)
        
        # -> Collect DOM/runtime info from the current page, then try navigating to a likely route for the contact form (hash route '#/contact') and re-inspect the DOM.
        await page.goto("http://localhost:5174/#/contact", wait_until="commit", timeout=10000)
        
        # -> Try to fetch the app's main JavaScript module to diagnose why the SPA didn't render (check /src/main.jsx or similar).
        await page.goto("http://localhost:5174/src/main.jsx", wait_until="commit", timeout=10000)
        
        # -> Navigate to http://localhost:5174/@vite/client to inspect Vite client output for errors and diagnose why the SPA did not initialize.
        await page.goto("http://localhost:5174/@vite/client", wait_until="commit", timeout=10000)
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        try:
            await expect(frame.locator('text=Message sent successfully').first).to_be_visible(timeout=3000)
        except AssertionError:
            raise AssertionError("Test case failed: The contact/booking form did not display the expected success notification 'Message sent successfully' after submission — the submission may not have been saved to Supabase and the admin notification (simulated webhook/log) may not have been generated.")
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    
