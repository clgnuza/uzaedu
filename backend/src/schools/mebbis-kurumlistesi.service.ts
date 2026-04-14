import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { Page } from 'playwright';
import { MebbisFetchDto, MebbisIlceQueryDto } from './dto/mebbis-fetch.dto';
import { MEBBIS_IL_OPTIONS } from './mebbis-il-options.constants';
import { mebbisWorkbookBufferToSchools } from './mebbis-excel-to-schools.util';
import { ReconcileSourceSchoolDto } from './dto/reconcile-schools.dto';

const MEBBIS_URL = 'https://mebbis.meb.gov.tr/kurumlistesi.aspx';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const OWNER_TEXT: Record<'1' | '2' | '3', string> = {
  '1': 'Resmi Kurumlar',
  '2': 'Özel Kurumlar',
  '3': 'MEB Dışı Kurumlar',
};

@Injectable()
export class MebbisKurumlistesiService {
  private async loadPlaywright(): Promise<typeof import('playwright')> {
    try {
      return await import('playwright');
    } catch {
      throw new ServiceUnavailableException({
        code: 'PLAYWRIGHT_MISSING',
        message:
          'Playwright kurulu değil. backend klasöründe: npm install playwright && npx playwright install chromium — ardından backend’i yeniden başlatın.',
      });
    }
  }

  getIlOptions() {
    return { items: MEBBIS_IL_OPTIONS.filter((x) => x.value !== '999') };
  }

  async getIlceOptions(dto: MebbisIlceQueryDto): Promise<{ items: { label: string }[] }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });

    const pw = await this.loadPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(90000);
      await page.goto(MEBBIS_URL, { waitUntil: 'domcontentloaded' });
      await this.selectKurumOwner(page, '1');
      await this.selectIlByLabel(page, il.label);
      await sleep(3500);
      await page.locator('#cmbilce_B-1').click();
      await sleep(800);
      const labels = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('#cmbilce_DDD_L_LBT td.dxeListBoxItem_DevEx'));
        return cells
          .map((td) => (td.textContent || '').trim())
          .filter((t) => t && t !== 'Seçiniz' && t.length > 0);
      });
      await page.keyboard.press('Escape').catch(() => undefined);
      const uniq = [...new Set(labels)];
      return { items: uniq.map((label) => ({ label })) };
    } finally {
      await browser.close();
    }
  }

  async fetchSchools(dto: MebbisFetchDto): Promise<{
    schools: ReconcileSourceSchoolDto[];
    meta: { row_count: number; sheet: string };
  }> {
    const il = MEBBIS_IL_OPTIONS.find((x) => x.value === dto.il_kodu);
    if (!il) throw new BadRequestException({ code: 'INVALID_IL', message: 'Geçersiz il kodu.' });

    const pw = await this.loadPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(120000);
      await page.goto(MEBBIS_URL, { waitUntil: 'domcontentloaded' });

      await this.selectKurumOwner(page, dto.owner);
      await this.selectIlByLabel(page, il.label);
      await sleep(3500);

      await this.selectIlce(page, dto.ilce_label);

      if (dto.kurum_turu_contains?.trim()) {
        await page.locator('#cmbAnaTur_B-1').click().catch(() => undefined);
        await sleep(600);
        const q = dto.kurum_turu_contains.trim();
        const turCell = page.locator('#cmbAnaTur_DDD_L_LBT td.dxeListBoxItem_DevEx').filter({
          hasText: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        });
        if ((await turCell.count()) > 0) {
          await turCell.first().click();
          await sleep(2500);
        } else {
          await page.keyboard.press('Escape').catch(() => undefined);
        }
      }

      await page.locator('input[name="btnKurumListelex"]').click();
      await sleep(2000);
      await page
        .waitForFunction(
          () => {
            const el = document.getElementById('lblSayi');
            return el != null && (el.textContent || '').trim().length > 0;
          },
          { timeout: 120000 },
        )
        .catch(() => undefined);

      const downloadPromise = page.waitForEvent('download', { timeout: 120000 });
      await page.locator('input[name="btnExcelx"]').click();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      if (!stream) {
        throw new BadRequestException({
          code: 'MEBBIS_EXCEL_EMPTY',
          message: 'Excel indirilemedi (MEBBİS yanıtı boş).',
        });
      }
      const chunks: Buffer[] = [];
      for await (const ch of stream) {
        chunks.push(Buffer.isBuffer(ch) ? ch : Buffer.from(ch));
      }
      const buf = Buffer.concat(chunks);
      const schools = mebbisWorkbookBufferToSchools(buf, dto.owner);
      return {
        schools,
        meta: { row_count: schools.length, sheet: 'mebbis' },
      };
    } finally {
      await browser.close();
    }
  }

  private async selectIlce(page: Page, ilceLabel: string) {
    await page.locator('#cmbilce_B-1').click();
    await sleep(600);
    const esc = ilceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cells = page.locator('#cmbilce_DDD_L_LBT td.dxeListBoxItem_DevEx');
    let pick = cells.filter({ hasText: new RegExp(`^${esc}$`, 'i') });
    if ((await pick.count()) === 0) {
      pick = cells.filter({ hasText: ilceLabel });
    }
    if ((await pick.count()) === 0) {
      throw new BadRequestException({
        code: 'ILCE_NOT_FOUND',
        message: `İlçe listede bulunamadı: ${ilceLabel}`,
      });
    }
    await pick.first().click();
    await sleep(4000);
  }

  private async selectKurumOwner(page: Page, owner: '1' | '2' | '3') {
    const text = OWNER_TEXT[owner];
    await page.locator('#cmbKurumTuru_B-1').click();
    await sleep(400);
    await page.locator('.dxeListBoxItem_DevEx', { hasText: text }).first().click();
    await sleep(3000);
  }

  private async selectIlByLabel(page: Page, ilLabel: string) {
    await page.locator('#cmbil_B-1').click();
    await sleep(500);
    const escaped = ilLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cell = page.locator('.dxeListBoxItem_DevEx').filter({ hasText: new RegExp(`^${escaped}$`, 'i') }).first();
    await cell.click();
    await sleep(3000);
  }
}
