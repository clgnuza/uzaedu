import { test, expect } from '@playwright/test';

test.describe('Auth sayfaları', () => {
  test('Giriş sayfası açılıyor', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Öğretmen|Giriş|Pro/i);
    await expect(page.getByRole('heading', { name: /giriş|nasıl/i })).toBeVisible();
  });

  test('Şifre unuttum sayfası açılıyor', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: /şifre unuttum/i })).toBeVisible();
    await expect(page.getByPlaceholder(/ornek@posta|e-posta|email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /kod gönder/i })).toBeVisible();
  });

  test('Şifre sıfırlama sayfası token olmadan hata gösteriyor', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page.getByText(/geçersiz|eksik|talep/i)).toBeVisible({ timeout: 5000 });
  });

  test('Şifre sıfırlama geçersiz token ile hata gösteriyor', async ({ page }) => {
    await page.goto('/reset-password?token=gecersiz-token-123');
    const newPw = page.getByLabel(/yeni şifre/i).first();
    await expect(newPw).toBeVisible({ timeout: 5000 });
    await newPw.fill('yeniSifre123');
    await page.getByLabel(/tekrar/i).fill('yeniSifre123');
    await page.getByRole('button', { name: /güncelle/i }).click();
    await expect(page.getByText(/geçersiz|süresi dolmuş|başarısız/i)).toBeVisible({ timeout: 10000 });
  });

  test('Kayıt sayfası açılıyor', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /hesap|kayıt/i })).toBeVisible();
  });
});
