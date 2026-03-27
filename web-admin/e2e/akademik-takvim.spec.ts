import { test, expect } from '@playwright/test';

/**
 * Akademik Takvim sayfası E2E testi.
 * Giriş: teacher@demo.local veya school_admin@demo.local (Demo123!) – demo butonları.
 */
test.describe('Akademik Takvim sayfası', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle', timeout: 15000 });
    await page.locator('#email').fill('teacher@demo.local');
    await page.locator('#password').fill('Demo123!');
    // React state güncellemesi için kısa bekle; sonra form submit
    await page.waitForTimeout(300);
    await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await expect(page).toHaveURL(/\/(dashboard|akademik-takvim)/, { timeout: 20000 });
  });

  test('Akademik Takvim sayfası yükleniyor ve tüm bileşenler görünüyor', async ({ page }) => {
    await page.goto('/akademik-takvim', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 1) Page loads
    await expect(page).toHaveURL(/\/akademik-takvim/);

    // 2) Gradient header shows "Akademik Takvim" (h1)
    await expect(page.getByRole('heading', { name: 'Akademik Takvim', level: 1 })).toBeVisible({ timeout: 10000 });

    // 3) Summary cards (geçen süre, kalan süre)
    await expect(page.getByText(/geçen süre|eğitim öğretim başlangıcından/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/kalan süre|yaz tatiline kalan/i).first()).toBeVisible({ timeout: 5000 });

    // 4) Progress bar (Geçen/Kalan % metni progress bar içinde)
    await expect(page.getByText(/Geçen:.*%|Kalan:.*%/).first()).toBeVisible({ timeout: 5000 });

    // 5) "ŞU AN BU HAFTADASINIZ" section
    await expect(page.getByText('ŞU AN BU HAFTADASINIZ')).toBeVisible({ timeout: 5000 });

    // 6) Calendar section heading
    await expect(page.getByRole('heading', { name: 'Hafta ve özet görünüm', level: 2 })).toBeVisible({ timeout: 5000 });
  });
});
