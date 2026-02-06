import asyncio
from playwright import async_api

async def run_test():
    pw = await async_api.async_playwright().start()
    browser = await pw.chromium.launch(
        headless=True,
        args=[
            "--window-size=1280,720",
            "--disable-dev-shm-usage",
            "--ipc=host",
        ],
    )
    context = await browser.new_context()
    context.set_default_timeout(15000)
    page = await context.new_page()
    await page.goto("http://localhost:5174/#/admin", wait_until="domcontentloaded", timeout=30000)
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=3000)
    except async_api.Error:
        pass
    await asyncio.sleep(3)
    title = await page.title()
    print("Title:", title)
    print("URL:", page.url)
    await page.screenshot(path="admin_route.png")
    await context.close()
    await browser.close()
    await pw.stop()

asyncio.run(run_test())
