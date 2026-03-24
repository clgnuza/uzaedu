/**
 * Excel parse debug – örnek dosyanın ham yapısını gösterir.
 * Çalıştır: npx ts-node -r tsconfig-paths/register scripts/debug-excel-parse.ts
 */
import * as XLSX from 'xlsx';
import * as path from 'path';

const excelPath = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  'OneDrive',
  'Desktop',
  'COĞRAFYA DERSİ YILLIK PLANLARI',
  'SOSYAL BİLİMLER LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI',
  'SOSYAL BİLİMLER LİSESİ COĞRAFYA DERSİ TASLAK YILLIK PLANLARI.xlsx'
);

function main() {
  try {
    const wb = XLSX.readFile(excelPath, { cellDates: false });
    const sheetName = wb.SheetNames?.find((n) => /9\.?\s*sinif/i.test(n.replace(/ı/g, 'i'))) || wb.SheetNames?.[0];
    const sheet = wb.Sheets[sheetName!];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    for (const r of [0, 1, 2]) {
      const row = json[r] as Record<number, unknown>;
      console.log(`\nRow ${r}:`);
      for (let i = 0; i < 20; i++) {
        const v = String(row[i] ?? '');
        if (!v && i > 14) continue;
        if (v) console.log(`  [${i}]: "${v.replace(/\r?\n/g, ' ').slice(0, 55)}"`);
      }
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
