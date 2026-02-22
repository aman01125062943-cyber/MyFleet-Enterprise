/**
 * اختبار صفحة المدير - محاكاة أدوات Chrome DevTools MCP
 * يشمل: navigate_page, take_screenshot, list_console_messages + قياس الأداء
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, 'test-output');

async function runTests() {
  const results = { passed: 0, failed: 0, steps: [], performance: {} };
  let browser;

  try {
    console.log('🚀 بدء الاختبارات (محاكاة Chrome DevTools MCP)...\n');

    // للاختبار الفعلي المرئي: المتصفح يفتح بشكل ظاهر (headed)
    const headless = process.env.HEADLESS === 'true';
    browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 150,
      args: ['--start-maximized'],
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'ar-EG',
    });

    const page = await context.newPage();
    const consoleMessages = [];
    page.on('console', (msg) => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });
    });

    // ========== 1. navigate_page ==========
    try {
      const t0 = Date.now();
      const res = await page.goto(BASE_URL + '/#/login', { waitUntil: 'networkidle', timeout: 15000 });
      const loadMs = Date.now() - t0;
      results.performance.loginPageLoadMs = loadMs;
      results.steps.push({ step: 'navigate_page (login)', status: 'ok', loadMs });
      results.passed++;
    } catch (e) {
      results.steps.push({ step: 'navigate_page (login)', status: 'fail', error: e.message });
      results.failed++;
    }

    // ========== 2. take_screenshot (صفحة تسجيل الدخول) ==========
    try {
      const fs = require('fs');
      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(OUTPUT_DIR, '01-login-page.png') });
      results.steps.push({ step: 'take_screenshot (login)', status: 'ok', file: '01-login-page.png' });
      results.passed++;
    } catch (e) {
      results.steps.push({ step: 'take_screenshot', status: 'fail', error: e.message });
      results.failed++;
    }

    // ========== 3. navigate إلى صفحة المدير (قد نحتاج تسجيل دخول) ==========
    try {
      const t0 = Date.now();
      await page.goto(BASE_URL + '/#/admin', { waitUntil: 'domcontentloaded', timeout: 10000 });
      const loadMs = Date.now() - t0;
      await page.waitForTimeout(3000);
      results.performance.adminPageLoadMs = loadMs;
      results.steps.push({ step: 'navigate_page (admin)', status: 'ok', loadMs });
      results.passed++;
    } catch (e) {
      results.steps.push({ step: 'navigate_page (admin)', status: 'fail', error: e.message });
      results.failed++;
    }

    // ========== 4. take_screenshot (صفحة المدير) ==========
    try {
      await page.screenshot({ path: path.join(OUTPUT_DIR, '02-admin-page.png') });
      results.steps.push({ step: 'take_screenshot (admin)', status: 'ok', file: '02-admin-page.png' });
      results.passed++;
    } catch (e) {
      results.steps.push({ step: 'take_screenshot (admin)', status: 'fail', error: e.message });
      results.failed++;
    }

    // ========== 5. list_console_messages ==========
    const errors = consoleMessages.filter((m) => m.type === 'error');
    const hasConnectionRefused = consoleMessages.some((m) =>
      m.text.includes('ERR_CONNECTION_REFUSED') || m.text.includes('Failed to fetch')
    );
    results.steps.push({
      step: 'list_console_messages',
      status: hasConnectionRefused ? 'fail' : 'ok',
      errorsCount: errors.length,
      connectionRefused: hasConnectionRefused,
    });
    if (hasConnectionRefused) results.failed++;
    else results.passed++;

    // ========== 6. التحقق من /api/health ==========
    try {
      const healthRes = await page.request.get(BASE_URL + '/api/health');
      const ok = healthRes.ok();
      results.steps.push({ step: 'fetch /api/health', status: ok ? 'ok' : 'fail', statusCode: healthRes.status() });
      if (ok) results.passed++;
      else results.failed++;
    } catch (e) {
      results.steps.push({ step: 'fetch /api/health', status: 'fail', error: e.message });
      results.failed++;
    }

    // ========== 7. take_snapshot (فحص DOM) ==========
    try {
      const hasAdminContent = await page.locator('text=لوحة الإدارة, text=نظرة عامة, text=Super Admin').first().isVisible().catch(() => false);
      results.steps.push({ step: 'take_snapshot (DOM check)', status: hasAdminContent ? 'ok' : 'warn', hasAdminContent });
      if (hasAdminContent) results.passed++;
    } catch (e) {
      results.steps.push({ step: 'take_snapshot', status: 'warn', error: e.message });
    }

    // ========== 8. قياس الأداء (Performance API) ==========
    try {
      const perf = await page.evaluate(() => {
        const t = performance.timing;
        const nav = performance.getEntriesByType('navigation')[0];
        return {
          domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
          loadComplete: t.loadEventEnd - t.navigationStart,
          domInteractive: t.domInteractive - t.navigationStart,
          responseEnd: t.responseEnd - t.navigationStart,
          transferSize: nav ? nav.transferSize : null,
          duration: nav ? nav.duration : null,
        };
      });
      results.performance.webVitals = perf;
    } catch (e) {
      results.performance.webVitals = { error: e.message };
    }
    results.performance.timestamp = new Date().toISOString();

    await browser.close();
  } catch (e) {
    console.error('❌ خطأ:', e);
    if (browser) await browser.close();
    process.exit(1);
  }

  // ========== تقرير النتائج ==========
  console.log('\n📋 تقرير الاختبار:\n');
  results.steps.forEach((s) => {
    const icon = s.status === 'ok' ? '✅' : s.status === 'fail' ? '❌' : '⚠️';
    const perfStr = s.loadMs != null ? ` (${s.loadMs}ms)` : '';
    console.log(`  ${icon} ${s.step}: ${s.status}${perfStr}${s.file ? ` → ${s.file}` : ''}`);
  });
  console.log(`\n✅ ناجح: ${results.passed} | ❌ فشل: ${results.failed}`);

  // ========== تقرير الأداء ==========
  if (Object.keys(results.performance).length > 0) {
    console.log('\n📊 قياس الأداء:');
    if (results.performance.loginPageLoadMs != null) {
      console.log(`  • تحميل صفحة الدخول: ${results.performance.loginPageLoadMs}ms`);
    }
    if (results.performance.adminPageLoadMs != null) {
      console.log(`  • تحميل صفحة المدير: ${results.performance.adminPageLoadMs}ms`);
    }
    if (results.performance.webVitals && !results.performance.webVitals.error) {
      const v = results.performance.webVitals;
      console.log(`  • DOM Content Loaded: ${v.domContentLoaded}ms`);
      console.log(`  • Load Complete: ${v.loadComplete}ms`);
    }
  }

  // حفظ تقرير الأداء
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const perfFile = path.join(OUTPUT_DIR, 'performance-report.json');
  fs.writeFileSync(perfFile, JSON.stringify(results.performance, null, 2), 'utf8');
  console.log(`\n📁 تقرير الأداء محفوظ: ${perfFile}`);
  console.log(`📁 الصور محفوظة في: ${OUTPUT_DIR}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests();
