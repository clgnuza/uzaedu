import { test, expect } from '@playwright/test';

async function loginSchoolAdmin(page: import('@playwright/test').Page) {
  const apiBase = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:4000/api';
  const login = await page.request.post(`${apiBase}/auth/school/login`, {
    data: { email: 'school_admin@demo.local', password: 'Sa3z&yU7!wE5sA2#cF6g' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = (await login.json()) as { token: string };
  await page.addInitScript((t: string) => {
    sessionStorage.setItem('ogp_bearer', t);
  }, token);
}

async function openProgramEditor(page: import('@playwright/test').Page) {
  await page.goto('/ders-dagit/studyo/program', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Program tablosu' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('[data-entry-id]').first()).toBeVisible({ timeout: 60000 });
}

async function clickViewMode(page: import('@playwright/test').Page, mode: 'Sınıf' | 'Öğretmen') {
  const row = page.locator('span').filter({ hasText: /^Görünüm$/ }).locator('..');
  await row.getByRole('button', { name: mode }).click();
}

async function selectFirstConcreteFilter(page: import('@playwright/test').Page) {
  await page.getByRole('combobox').nth(1).selectOption({ index: 1 });
}

async function measureDragResponsiveness(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const entry = document.querySelector('[data-entry-id]') as HTMLElement | null;
    if (!entry) return { ok: false, reason: 'no-entry' };

    const start = performance.now();
    const box = entry.getBoundingClientRect();
    let worstFrame = 0;
    const frameBudget = 12;

    const fire = (x: number, y: number) => {
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' };
      entry.dispatchEvent(new PointerEvent('pointermove', opts));
      document.dispatchEvent(new PointerEvent('pointermove', opts));
    };

    entry.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: box.left + 5,
        clientY: box.top + 5,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    );

    for (let i = 0; i < frameBudget; i++) {
      const t0 = performance.now();
      fire(box.left + i * 14, box.top + i * 6);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          worstFrame = Math.max(worstFrame, performance.now() - t0);
          resolve();
        });
      });
    }

    document.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: box.left + 80,
        clientY: box.top + 40,
        pointerId: 1,
        pointerType: 'mouse',
      }),
    );

    return {
      ok: true,
      totalMs: Math.round(performance.now() - start),
      worstFrameMs: Math.round(worstFrame),
      frozen: worstFrame > 250,
    };
  });
}

test.describe.configure({ timeout: 90_000 });

test.describe('Program tablosu sürükle-bırak performans', () => {
  test.beforeEach(async ({ page }) => {
    await loginSchoolAdmin(page);
    await openProgramEditor(page);
  });

  test('Öğretmen matris (Tümü) — kare kare < 120ms', async ({ page }) => {
    await expect(page.locator('[data-timetable-view="matrix-teacher"]')).toBeVisible({ timeout: 15000 });
    const perf = await measureDragResponsiveness(page);
    expect(perf.ok, JSON.stringify(perf)).toBeTruthy();
    expect(perf.frozen, `worst frame ${perf.worstFrameMs}ms`).toBeFalsy();
    expect(perf.worstFrameMs ?? 999).toBeLessThan(250);
  });

  test('Sınıf matris — kare kare < 120ms', async ({ page }) => {
    await clickViewMode(page, 'Sınıf');
    await expect(page.locator('[data-timetable-view="matrix-class"]')).toBeVisible({ timeout: 15000 });
    const perf = await measureDragResponsiveness(page);
    expect(perf.ok, JSON.stringify(perf)).toBeTruthy();
    expect(perf.frozen, `worst frame ${perf.worstFrameMs}ms`).toBeFalsy();
  });

  test('Tek şube (haftalık tablo) — kare kare < 120ms', async ({ page }) => {
    await clickViewMode(page, 'Sınıf');
    await selectFirstConcreteFilter(page);
    await expect(page.locator('[data-timetable-view="class"]')).toBeVisible({ timeout: 15000 });
    const perf = await measureDragResponsiveness(page);
    expect(perf.ok, JSON.stringify(perf)).toBeTruthy();
    expect(perf.frozen, `worst frame ${perf.worstFrameMs}ms`).toBeFalsy();
  });

  test('Tek öğretmen (haftalık tablo) — kare kare < 120ms', async ({ page }) => {
    await clickViewMode(page, 'Öğretmen');
    await selectFirstConcreteFilter(page);
    await expect(page.locator('[data-timetable-view="teacher"]')).toBeVisible({ timeout: 15000 });
    const perf = await measureDragResponsiveness(page);
    expect(perf.ok, JSON.stringify(perf)).toBeTruthy();
    expect(perf.frozen, `worst frame ${perf.worstFrameMs}ms`).toBeFalsy();
  });
});
