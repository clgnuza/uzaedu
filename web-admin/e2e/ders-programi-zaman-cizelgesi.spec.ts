import { test, expect } from '@playwright/test';

/**
 * Ders Programı Ayarlar – Zaman Çizelgesi tab ve Nöbet Yerler link testi.
 * Giriş: login sayfasındaki "Okul Admin" demo butonu (school_admin@demo.local).
 */
test.describe('Ders Programı Ayarlar – Zaman Çizelgesi', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await expect(page.getByRole('button', { name: /okul admin/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /okul admin/i }).click();
    await expect(page).toHaveURL(/\/(dashboard|ders-programi)/, { timeout: 20000 });
  });

  test('Zaman Çizelgesi formu sayfada görünüyor', async ({ page }) => {
    await page.goto('/ders-programi/ayarlar');
    await expect(page.getByRole('heading', { name: 'Ders Programı Ayarları' })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/günlük ders saatleri|zaman çizelgesi|okul başlangıç|okul bitiş/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /kaydet|save/i })).toBeVisible({ timeout: 3000 });
  });

  test('Nöbet Yerler sayfasında bilgi uyarısı ve Zaman Çizelgesi linki görünüyor', async ({ page }) => {
    await page.goto('/duty/yerler');
    await expect(page.getByRole('heading', { name: /nöbet ayarları/i })).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('Günlük Ders Saatleri ve Zaman Çizelgesi')).toBeVisible({ timeout: 5000 });
    const zamanLink = page.getByRole('link', { name: /zaman çizelgesine git/i });
    await expect(zamanLink).toBeVisible();
  });

  test('Nöbet Yerler Zaman Çizelgesi linki doğru sayfaya gidiyor', async ({ page }) => {
    await page.goto('/duty/yerler');
    await expect(page.getByText('Günlük Ders Saatleri ve Zaman Çizelgesi')).toBeVisible({ timeout: 5000 });

    await page.getByRole('link', { name: /zaman çizelgesine git/i }).click();
    await expect(page).toHaveURL(/\/ders-programi\/ayarlar/);
    await expect(page.getByText(/günlük ders saatleri|okul başlangıç|zaman çizelgesi/i).first()).toBeVisible({ timeout: 5000 });
  });
});
