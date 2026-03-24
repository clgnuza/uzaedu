import { test, expect } from '@playwright/test';

/**
 * Destek modülü dosya yükleme testi.
 * Gereksinimler: Backend + web-admin çalışıyor, oturum açılmış olmalı (teacher/school_admin).
 * R2 yapılandırılmışsa gerçek yükleme; değilse R2_NOT_CONFIGURED hatası beklenir.
 *
 * Oturum yoksa testler skip edilir. Manuel test için:
 * 1. Giriş yapın (teacher veya school_admin)
 * 2. Destek > Yeni Talep veya /support/new
 * 3. Dosya ekle alanına PDF/resim yükleyin
 */
test.describe('Destek modülü dosya yükleme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/support/new');
    await page.waitForLoadState('networkidle');
  });

  function isAuthenticated(page: { url: () => string }) {
    const url = page.url();
    return !url.includes('/login') && !url.includes('/403');
  }

  test('Yeni talep sayfasında dosya ekle alanı görünüyor', async ({ page }) => {
    if (!isAuthenticated(page)) {
      test.skip(true, 'Oturum açılmamış – giriş yapıp tekrar çalıştırın');
    }

    await expect(page.getByRole('heading', { name: /yeni destek talebi|destek talebi/i })).toBeVisible({
      timeout: 10000,
    });

    const dosyaLabel = page.getByText(/dosya ekle/i).first();
    await expect(dosyaLabel).toBeVisible({ timeout: 5000 });
  });

  test('Dosya input mevcut ve tıklanabilir', async ({ page }) => {
    if (!isAuthenticated(page)) {
      test.skip(true, 'Oturum açılmamış');
    }

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/max.*MB|Görsel|PDF|Word|Excel/i)).toBeVisible({ timeout: 3000 });
  });

  test('Küçük PDF seçince yükleme deneniyor', async ({ page }) => {
    if (!isAuthenticated(page)) {
      test.skip(true, 'Oturum açılmamış');
    }

    await page.fill('#subject', 'E2E dosya test');
    await page.fill('#description', 'Otomatik test dosya yüklemesi.');

    const pdfContent = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n%%EOF';
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-upload.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfContent),
    });

    await page.waitForTimeout(5000);

    const dosyaKarti = page.getByText('test-upload.pdf');
    const r2Hata = page.getByText(/yapılandırılmamış|Depolama|R2|yönetici/i);
    await expect(dosyaKarti.or(r2Hata)).toBeVisible({ timeout: 8000 });
  });
});
