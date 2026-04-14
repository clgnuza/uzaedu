import { test, expect } from '@playwright/test';
import { DEMO_CREDENTIALS } from '../src/lib/demo-credentials';

test('Öğretmen demo hesabı ile giriş (teacher@demo.local)', async ({ page }) => {
  await page.goto('/login/ogretmen', { waitUntil: 'networkidle', timeout: 20000 });
  await page.locator('#email').fill(DEMO_CREDENTIALS.teacher.email);
  await page.locator('#password').fill(DEMO_CREDENTIALS.teacher.password);
  await page.waitForTimeout(300);
  await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 25000 });
});
