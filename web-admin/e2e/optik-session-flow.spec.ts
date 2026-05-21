import { test, expect } from '@playwright/test';

/**
 * Tam akış: OPTIK_E2E_EMAIL + OPTIK_E2E_PASSWORD ile çalışır.
 * Yoksa atlanır (CI/local smoke opsiyonel).
 */
const email = process.env.OPTIK_E2E_EMAIL;
const password = process.env.OPTIK_E2E_PASSWORD;

test.describe('Optik sınav oturumu', () => {
  test.skip(!email || !password, 'OPTIK_E2E_EMAIL ve OPTIK_E2E_PASSWORD gerekli');

  test('oturum listesi ve rehber görünür', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-?posta|email/i).fill(email!);
    await page.getByLabel(/şifre|password/i).fill(password!);
    await page.getByRole('button', { name: /giriş|login/i }).click();
    await page.waitForURL(/dashboard|optik/, { timeout: 30_000 });

    await page.goto('/optik-oturumlar');
    await expect(page.getByRole('heading', { name: /sınav oturumları/i })).toBeVisible();
    await expect(page.getByText(/Sınav için sıra/i)).toBeVisible();
  });
});
