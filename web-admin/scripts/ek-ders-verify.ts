#!/usr/bin/env npx tsx
/**
 * EK_DERS_DOGRULAMA.md senaryoları ile Uzaedu Öğretmen hesaplama sonuçlarını doğrular.
 * Çalıştırma: cd web-admin && npx tsx scripts/ek-ders-verify.ts
 */

import {
  computeResult,
  getTaxRateFromMatrah,
  type Params,
  type EducationLevel,
  type TaxBracket,
} from '../src/lib/extra-lesson-calc';

const TAX_BRACKETS: TaxBracket[] = [
  { max_matrah: 190000, rate_percent: 15 },
  { max_matrah: 400000, rate_percent: 20 },
  { max_matrah: 1500000, rate_percent: 27 },
  { max_matrah: 5300000, rate_percent: 35 },
  { max_matrah: Number.MAX_SAFE_INTEGER, rate_percent: 40 },
];

const DEFAULT_PARAMS: Params = {
  id: 'test',
  semester_code: '2026-1',
  title: '2026 Ocak-Haziran',
  monthly_coefficient: '1.387871',
  gv_exemption_max: '4211.33',
  dv_exemption_max: '33030',
  stamp_duty_rate: '7.59',
  central_exam_roles: [
    { key: 'bina_sinav_sorumlusu', label: 'Bina Sınav Sorumlusu', indicator: 2000 },
    { key: 'komisyon_baskani', label: 'Komisyon Başkanı', indicator: 1900 },
    { key: 'gozetmen', label: 'Gözetmen', indicator: 1600 },
    { key: 'yedek_gozetmen', label: 'Yedek Gözetmen', indicator: 1200 },
    { key: 'salon_baskani_esinav', label: 'E-Sınav Salon Başk.', indicator: 1300 },
    { key: 'gozetmen_esinav', label: 'E-Sınav Gözetmen', indicator: 1200 },
  ],
  line_items: [
    { key: 'gunduz', label: 'Gündüz', type: 'hourly', unit_price: 194.3, sort_order: 1 },
    { key: 'gece', label: 'Gece', type: 'hourly', unit_price: 208.18, sort_order: 2 },
  ],
  tax_brackets: TAX_BRACKETS,
};

const LISANS: EducationLevel = {
  key: 'lisans',
  label: 'Lisans',
  unit_day: 194.3,
  unit_night: 208.18,
};

function assertApprox(actual: number, expected: number, tol: number, msg: string): boolean {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) {
    console.error(`  ❌ ${msg}: beklenen ${expected.toFixed(2)}, bulunan ${actual.toFixed(2)}`);
  }
  return ok;
}

let passed = 0;
let failed = 0;

function runScenario(name: string, fn: () => boolean) {
  process.stdout.write(`\n${name} ... `);
  if (fn()) {
    console.log('✓ OK');
    passed++;
  } else {
    console.log('✗ BAŞARISIZ');
    failed++;
  }
}

console.log('=== Ek Ders Hesaplama Doğrulaması ===');

runScenario('Senaryo A: Sadece Gündüz 10 saat (Lisans, sıfır istisna)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    { gunduz: 10 },
    [],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 0 }
  );
  return (
    assertApprox(r.totalBrut, 1943, 0.02, 'Brüt') &&
    assertApprox(r.gvKesinti, 0, 0.01, 'GV') &&
    assertApprox(r.dvKesinti, 0, 0.01, 'DV') &&
    assertApprox(r.net, 1943, 0.02, 'Net')
  );
});

runScenario('Senaryo B: GV İstisna (gvUsed=3000, brüt 3886)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    { gunduz: 20 },
    [],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 3000, dvUsed: 0 }
  );
  return (
    assertApprox(r.totalBrut, 3886, 0.02, 'Brüt') &&
    assertApprox(r.gvKesinti, 0, 0.01, 'GV (kalan istisna yeterli)') &&
    assertApprox(r.dvKesinti, 0, 0.01, 'DV') &&
    assertApprox(r.net, 3886, 0.02, 'Net')
  );
});

runScenario('Senaryo B2: GV İstisna (gvUsed=4000, brüt 3886 → GV kesilir)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    { gunduz: 20 },
    [],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 4000, dvUsed: 0 }
  );
  const expectedGv = 3886 * 0.15 - (4211.33 - 4000);
  return (
    assertApprox(r.totalBrut, 3886, 0.02, 'Brüt') &&
    assertApprox(r.gvKesinti, 371.57, 0.02, 'GV') &&
    assertApprox(r.dvKesinti, 0, 0.01, 'DV')
  );
});

runScenario('Senaryo C: DV İstisna (brüt ~15k, dvUsed 20k → DV kesintisi ~14,94 TL)', () => {
  const hours = { gunduz: 15000 / 194.3 };
  const r = computeResult(
    DEFAULT_PARAMS,
    hours,
    [],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 20000 }
  );
  return (
    assertApprox(r.totalBrut, 15000, 5, 'Brüt') &&
    assertApprox(r.dvKesinti, 14.94, 0.5, 'DV kesintisi')
  );
});

runScenario('Senaryo D: Vergi dilimi (geçen aylar 185k + brüt 20k → %20)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    { gunduz: 20000 / 194.3 },
    [],
    LISANS,
    { taxRate: 15, taxMatrah: 185000, taxBrackets: TAX_BRACKETS, gvUsed: 5000, dvUsed: 0 }
  );
  return (
    assertApprox(r.totalBrut, 20000, 10, 'Brüt') &&
    assertApprox(r.gvKesinti, 4000, 5, 'GV (%20 dilimi, gvUsed=5k ile istisna tükendi)')
  );
});

runScenario('Senaryo E0: Bina Sınav Sorumlusu (gösterge 2000 → 2775,74 TL)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    {},
    ['bina_sinav_sorumlusu'],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 0 }
  );
  return assertApprox(r.totalBrut, 2775.74, 0.02, 'Brüt (1,387871×2000)');
});

runScenario('Senaryo E: Merkezi sınav Komisyon Başkanı (gösterge 1900)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    {},
    ['komisyon_baskani'],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 0 }
  );
  return assertApprox(r.totalBrut, 2636.95, 2, 'Brüt (1,387871×1900≈2637)');
});

runScenario('Senaryo E2: Merkezi sınav Gözetmen (gösterge 1600)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    {},
    ['gozetmen'],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 0 }
  );
  return assertApprox(r.totalBrut, 2220.59, 0.02, 'Brüt (1,387871×1600)');
});

runScenario('Senaryo E3: E-Sınav Salon Başkanı (gösterge 1300)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    {},
    ['salon_baskani_esinav'],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 0 }
  );
  return assertApprox(r.totalBrut, 1804.23, 0.5, 'Brüt (1,387871×1300)');
});

runScenario('Senaryo E4: E-Sınav Gözetmen (gösterge 1200)', () => {
  const r = computeResult(
    DEFAULT_PARAMS,
    {},
    ['gozetmen_esinav'],
    LISANS,
    { taxRate: 15, taxMatrah: 0, taxBrackets: TAX_BRACKETS, gvUsed: 0, dvUsed: 0 }
  );
  return assertApprox(r.totalBrut, 1665.45, 0.02, 'Brüt (1,387871×1200)');
});

runScenario('getTaxRateFromMatrah: 205000 → %20', () => {
  const rate = getTaxRateFromMatrah(205000, TAX_BRACKETS);
  return rate === 20;
});

runScenario('getTaxRateFromMatrah: 185000 → %15', () => {
  const rate = getTaxRateFromMatrah(185000, TAX_BRACKETS);
  return rate === 15;
});

console.log('\n=== Özet ===');
console.log(`Geçen: ${passed} | Başarısız: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

