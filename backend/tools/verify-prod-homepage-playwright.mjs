#!/usr/bin/env node
/**
 * Canlı anasayfa — JS render sonrası yapısal doğrulama (Playwright).
 * Ortam: PROD_SITE_URL (varsayılan https://uzaedu.com)
 */
import { chromium } from 'playwright';

const site = (process.env.PROD_SITE_URL || 'https://uzaedu.com').replace(/\/$/, '');

async function assertCssLoads(pageUrl) {
  const htmlRes = await fetch(pageUrl, { signal: AbortSignal.timeout(20000) });
  if (!htmlRes.ok) throw new Error(`${pageUrl} HTTP ${htmlRes.status}`);
  const html = await htmlRes.text();
  const cssPaths = [...html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)].map((m) => m[1]);
  if (!cssPaths.length) throw new Error(`${pageUrl} CSS link yok`);
  for (const path of cssPaths) {
    const cssRes = await fetch(new URL(path, pageUrl).href, { signal: AbortSignal.timeout(20000) });
    if (!cssRes.ok) throw new Error(`${path} HTTP ${cssRes.status} (${pageUrl})`);
    const ct = cssRes.headers.get('content-type') || '';
    if (!ct.includes('text/css')) throw new Error(`${path} content-type=${ct}`);
  }
}

async function main() {
  const wwwRes = await fetch('https://www.uzaedu.com/', { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  if (![301, 302, 307, 308].includes(wwwRes.status)) {
    throw new Error(`www.uzaedu.com yonlendirme yok (HTTP ${wwwRes.status})`);
  }
  const loc = wwwRes.headers.get('location') || '';
  if (!loc.startsWith('https://uzaedu.com')) throw new Error(`www Location beklenmiyor: ${loc}`);

  await assertCssLoads(`${site}/`);

  const apiBase = process.env.PROD_API_BASE?.trim()?.replace(/\/$/, '') || 'https://api.uzaedu.com/api';
  const extrasRes = await fetch(`${apiBase}/content/web-extras`, { signal: AbortSignal.timeout(15000) });
  if (!extrasRes.ok) throw new Error(`web-extras HTTP ${extrasRes.status}`);
  const extras = await extrasRes.json();
  if (extras.maintenance_enabled) throw new Error('maintenance_enabled=true (anasayfa bakimda)');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${site}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  if (page.url().includes('/bakim')) throw new Error('Anasayfa /bakim yonlendirmesi');

  await page.waitForSelector('.landing-seal-hub', { timeout: 20000 });

  const seal = await page.locator('.landing-seal-hub').count();
  const cards = await page.locator('.landing-feature-card').count();
  const pillars = await page.locator('.landing-pillar-card').count();
  const pulse = await page.locator('.landing-hero-section .animate-pulse').count();
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.landing-page') || document.body).backgroundColor);

  if (seal < 1) throw new Error('landing-seal-hub yok');
  if (cards < 14) throw new Error(`modul karti az: ${cards}`);
  if (pillars < 3) throw new Error(`pillar karti az: ${pillars}`);
  if (pulse > 0) throw new Error('hero hala pulse placeholder');
  if (!bg || bg === 'rgb(255, 255, 255)' || bg === 'rgba(0, 0, 0, 0)') {
    throw new Error(`landing-page arka plan stillenmemis: ${bg}`);
  }

  if (errors.length) throw new Error(`sayfa JS hatasi: ${errors.slice(0, 3).join(' | ')}`);

  await browser.close();
  console.log(`[verify] Playwright anasayfa OK (${site}/)`);
}

main().catch((e) => {
  console.error(`[verify] ${e.message || e}`);
  process.exit(1);
});
