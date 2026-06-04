#!/usr/bin/env node
/**
 * KBS sayfa yapısı (giriş öncesi/sonrası) — Playwright.
 * Kullanım: node tools/diagnose-kbs-bordro.cjs [url]
 * Girişli test: KBS_USER=tc KBS_PASS=şifre node tools/diagnose-kbs-bordro.cjs
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '../../../backend/node_modules/playwright'));

const url =
  process.argv[2] ||
  process.env.UZA_KBS_URL ||
  'https://www.kbs.gov.tr/maasRapor/maasRapor.htm';

async function probe(page) {
  return page.evaluate(() => {
    const tables = document.querySelectorAll('table').length;
    const ag = document.querySelectorAll('.ag-root-wrapper').length;
    const kgrid = document.querySelectorAll('.k-grid').length;
    const dx = document.querySelectorAll('.dx-datagrid').length;
    const roleGrid = document.querySelectorAll('[role=grid]').length;
    const iframes = document.querySelectorAll('iframe').length;
    return { title: document.title, href: location.href, tables, ag, kgrid, dx, roleGrid, iframes };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: !process.env.KBS_HEADED });
  const page = await browser.newPage();
  const user = process.env.KBS_USER;
  const pass = process.env.KBS_PASS;
  if (user && pass) {
    await page.goto('https://www.kbs.gov.tr/gen/login.htm', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.fill('input[type=text], input[name*="kimlik" i], #username', user).catch(() => {});
    await page.fill('input[type=password]', pass).catch(() => {});
    await page.click('button[type=submit], input[type=submit]').catch(() => {});
    await page.waitForTimeout(5000);
  }
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('status', res?.status());
  console.log(JSON.stringify(await probe(page), null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
