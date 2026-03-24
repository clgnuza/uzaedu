import { test, expect } from '@playwright/test';

test.describe('Okul Değerlendirmeleri (public)', () => {
  test('Public okul değerlendirme sayfası açılıyor', async ({ page }) => {
    await page.goto('/okul-degerlendirmeleri');
    await expect(page.getByRole('heading', { name: /okul değerlendirme/i })).toBeVisible({ timeout: 10000 });
  });

  test('Ana sayfa linki görünüyor', async ({ page }) => {
    await page.goto('/okul-degerlendirmeleri');
    await expect(page.getByRole('link', { name: /ana sayfa/i })).toBeVisible({ timeout: 10000 });
  });
});
