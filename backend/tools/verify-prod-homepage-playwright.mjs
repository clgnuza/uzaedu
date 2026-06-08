#!/usr/bin/env node
/**
 * Canlı anasayfa — JS render sonrası yapısal doğrulama (Playwright).
 * Ortam: PROD_SITE_URL (varsayılan https://uzaedu.com)
 */
import { chromium } from 'playwright';

const site = (process.env.PROD_SITE_URL || 'https://uzaedu.com').replace(/\/$/, '');

async function main() {
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

  if (seal < 1) throw new Error('landing-seal-hub yok');
  if (cards < 14) throw new Error(`modul karti az: ${cards}`);
  if (pillars < 3) throw new Error(`pillar karti az: ${pillars}`);
  if (pulse > 0) throw new Error('hero hala pulse placeholder');

  if (errors.length) throw new Error(`sayfa JS hatasi: ${errors.slice(0, 3).join(' | ')}`);

  await browser.close();
  console.log(`[verify] Playwright anasayfa OK (${site}/)`);
}

main().catch((e) => {
  console.error(`[verify] ${e.message || e}`);
  process.exit(1);
});
