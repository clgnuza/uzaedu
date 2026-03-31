/**
 * Ek ders hesaplama mantığı. Tüm parametreler superadmin ayarlarından gelir.
 * Test edilebilir, sayfa bu modülden import eder.
 */

import { AYLIK_KATSAYI_2026_OCAK_HAZIRAN } from './resmi-katsayilar';

export type LineItem = {
  key: string;
  label: string;
  type: 'hourly' | 'fixed';
  /** Şablondan; brüt = ROUND(saat×katsayı×gösterge×ölçek,2) — ara ROUND(katsayı×gösterge) yok. */
  gosterge_day?: number;
  gosterge_night?: number;
  unit_price_day?: number;
  unit_price_night?: number;
  unit_price?: number;
  fixed_amount?: number;
  multiplier?: number;
  sort_order?: number;
};

export type EducationLevel = {
  key: string;
  label: string;
  unit_day: number;
  unit_night: number;
};

export type TaxBracket = {
  max_matrah: number;
  rate_percent: number;
};

export type CentralExamRole = {
  key: string;
  label: string;
  fixed_amount?: number;
  indicator?: number;
};

export type Params = {
  id: string;
  semester_code: string;
  title: string;
  monthly_coefficient?: string | null;
  line_items: LineItem[];
  tax_brackets: TaxBracket[];
  gv_exemption_max: string;
  dv_exemption_max: string;
  stamp_duty_rate: string;
  central_exam_roles: CentralExamRole[] | null;
  education_levels?: EducationLevel[] | null;
  /** Sözleşmeli/Ücretli: SGK+İşsizlik işçi payı (%, 5510). Kadrolu: kesinti yok. */
  sgk_employee_rate?: string | null;
  /** Ücretli birim ücret oranı (kadroluya göre). Örn: 0.725. */
  ucretli_unit_scale?: string | null;
};

export type ComputeOptions = {
  taxRate: number;
  taxMatrah: number;
  taxBrackets: TaxBracket[];
  gvUsed: number;
  dvUsed: number;
  /** Ünvan: meb_ucretli için birim ücretler ~%72.5 oranında düşük (resmi fark) */
  unvan?: 'meb_kadrolu' | 'meb_sozlesmeli' | 'meb_ucretli';
};

export type ComputeResult = {
  totalBrut: number;
  breakdown: { label: string; brut: number }[];
  gvKesinti: number;
  dvKesinti: number;
  /** Sözleşmeli/ücretli: SGK+İşsizlik primi (işçi payı %14). Kadrolu: 0. */
  sgkKesinti: number;
  net: number;
  /** Hesaplanan gelir vergisi (istisna öncesi) */
  taxOnBrut: number;
  /** GV istisnası faydalanılan (bu hesaplamada kullanılan) */
  gvExemptionUsed: number;
  /** GV istisnası kalan (istisna limitinden sonra) */
  gvExemptionRemaining: number;
  /** DV istisna matrahı faydalanılan (bu hesaplamada kullanılan) */
  dvExemptionMatrahUsed: number;
  /** DV istisna matrahı kalan */
  dvExemptionMatrahRemaining: number;
  /** GV + DV + SGK (özet) */
  totalKesinti: number;
};

export function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '.'));
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

/** 2 ondalık (kuruş) — en yakın değere yuvarlama (EDUHEP / yaygın hesap uyumu). */
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** GVK ücret geliri (2026 Seri 332) — backend RESMI_2026.tax_brackets ile aynı üst sınırlar. */
const DEFAULT_UCRET_TAX_BRACKETS: TaxBracket[] = [
  { max_matrah: 190000, rate_percent: 15 },
  { max_matrah: 400000, rate_percent: 20 },
  { max_matrah: 1500000, rate_percent: 27 },
  { max_matrah: 5300000, rate_percent: 35 },
  { max_matrah: Number.MAX_SAFE_INTEGER, rate_percent: 40 },
];

export function getTaxRateFromMatrah(matrah: number, taxBrackets: TaxBracket[]): number {
  for (const b of taxBrackets) {
    if (matrah <= b.max_matrah) return b.rate_percent;
  }
  return 40;
}

/**
 * Ücret geliri tarifesi (GVK dilimleri): her dilimde o aralığa düşen matrah × marjinal oran.
 * `tax_brackets` üst sınır + oran sıralı (ör. 2026 Seri 332 ücret satırı).
 */
export function cumulativeTaxFromProgressiveBrackets(matrah: number, brackets: TaxBracket[]): number {
  if (!brackets.length) return 0;
  const sorted = [...brackets].sort((a, b) => a.max_matrah - b.max_matrah);
  let prev = 0;
  let tax = 0;
  const x = Math.max(0, matrah);
  for (const b of sorted) {
    if (x <= prev) break;
    const top = Math.min(x, b.max_matrah);
    tax += (top - prev) * (b.rate_percent / 100);
    prev = top;
  }
  return round2(tax);
}

/** Bu ek ders brütü için dilimli tarifede artımlı gelir vergisi (önceki yıl matrahı + bu brüt). */
export function incrementalWageTaxFromBrackets(
  matrahBeforeEkDers: number,
  ekDersBrut: number,
  brackets: TaxBracket[]
): number {
  if (ekDersBrut <= 0) return 0;
  const a = cumulativeTaxFromProgressiveBrackets(matrahBeforeEkDers, brackets);
  const b = cumulativeTaxFromProgressiveBrackets(matrahBeforeEkDers + ekDersBrut, brackets);
  return round2(b - a);
}

/** gosterge yokken (eski DB): şablondaki gösterge — EDUHEP uyumu için katsayı×gösterge tek yuvarlamada. */
const DEFAULT_GOSTERGE: Record<string, { d: number; n?: number }> = {
  gunduz: { d: 140, n: 150 },
  gece: { d: 150 },
  nobet: { d: 140 },
  belleticilik: { d: 140 },
  sinav_gorevi: { d: 140 },
  egzersiz: { d: 140 },
  hizmet_ici: { d: 140 },
  ozel_egitim_25_gunduz: { d: 175, n: 187.5 },
  ozel_egitim_25_gece: { d: 187.5 },
  ozel_egitim_25_nobet: { d: 187.5 },
  ozel_egitim_25_belleticilik: { d: 175 },
  destek_odasi_25: { d: 175 },
  evde_egitim_25: { d: 175 },
  cezaevi_gunduz: { d: 175, n: 187.5 },
  cezaevi_gece: { d: 187.5 },
  iyep_gunduz: { d: 140 },
  iyep_gece: { d: 150 },
};

function hourlyUnitPrice(
  params: Params,
  coeff: number,
  li: LineItem,
  educationLevel: EducationLevel,
  unvan: 'meb_kadrolu' | 'meb_sozlesmeli' | 'meb_ucretli',
  useNight: boolean
): number {
  const ucretliScale = parseNum(params.ucretli_unit_scale || '1') || 1;
  const isUcretli = unvan === 'meb_ucretli';
  const lisansRef =
    params.education_levels?.find((e) => e.key === 'lisans') ??
    (params.education_levels?.[0] ?? { unit_day: 194.3, unit_night: 208.18 });
  const refDay = parseNum(String(lisansRef.unit_day ?? '')) || 194.3;
  const refNight = parseNum(String(lisansRef.unit_night ?? '')) || 208.18;
  const baseDay = isUcretli ? refDay * ucretliScale : educationLevel.unit_day;
  const baseNight = isUcretli ? refNight * ucretliScale : educationLevel.unit_night;
  const isDyk = (key: string) => key === 'takviye_gunduz' || key === 'takviye_gece';

  if (isDyk(li.key)) {
    if (isUcretli) {
      return round2((li.key === 'takviye_gece' || useNight ? baseNight : baseDay) * 2);
    }
    if (li.key === 'takviye_gece' || useNight) {
      return round2(refNight + baseNight);
    }
    return round2(refDay + baseDay);
  }

  const scaleDay = refDay > 0 ? baseDay / refDay : 1;
  const scaleNight = refNight > 0 ? baseNight / refNight : 1;

  if (li.gosterge_day != null) {
    const g = useNight ? (li.gosterge_night ?? li.gosterge_day) : li.gosterge_day;
    const scale = useNight ? scaleNight : scaleDay;
    return coeff * g * scale;
  }

  const fb = DEFAULT_GOSTERGE[li.key];
  if (fb != null) {
    const g = useNight ? (fb.n ?? fb.d) : fb.d;
    const scale = useNight ? scaleNight : scaleDay;
    const paramDay = li.unit_price_day ?? li.unit_price ?? null;
    const paramNight = li.unit_price_night ?? li.unit_price ?? null;
    const param = useNight ? (paramNight ?? paramDay) : paramDay;
    const expectedRounded = round2(coeff * g);
    if (param == null || Math.abs(param - expectedRounded) <= 0.02) {
      return coeff * g * scale;
    }
  }

  const mult = li.multiplier ?? 1;
  const paramDay = li.unit_price_day ?? li.unit_price ?? null;
  const paramNight = li.unit_price_night ?? li.unit_price ?? null;
  if (useNight) return paramNight != null ? paramNight * scaleNight : baseNight * mult;
  return paramDay != null ? paramDay * scaleDay : baseDay * mult;
}

/** Tek bir saatlik kalem için brüt önizleme (saat × birim ücret). */
export function getLineItemBrutPreview(
  params: Params,
  li: LineItem,
  hours: number,
  educationLevel: EducationLevel,
  unvan: 'meb_kadrolu' | 'meb_sozlesmeli' | 'meb_ucretli'
): number {
  if (hours <= 0) return 0;
  const coeff = parseFloat(params.monthly_coefficient || AYLIK_KATSAYI_2026_OCAK_HAZIRAN);
  const useNight = li.key === 'gece' || li.key.endsWith('_gece');
  const up = hourlyUnitPrice(params, coeff, li, educationLevel, unvan, useNight);
  return round2(hours * up);
}

export function computeResult(
  params: Params,
  hours: Record<string, number>,
  centralExam: string[],
  educationLevel: EducationLevel,
  options: ComputeOptions
): ComputeResult {
  let totalBrut = 0;
  const breakdown: { label: string; brut: number }[] = [];
  const isUcretli = options.unvan === 'meb_ucretli';

  /** Ücretli öğretmen sadece bu 4 kalemi alabilir (MEB bordro). */
  const ucretliAllowedKeys = ['gunduz', 'gece', 'takviye_gunduz', 'takviye_gece'];

  const coeff = parseFloat(params.monthly_coefficient || AYLIK_KATSAYI_2026_OCAK_HAZIRAN);

  for (const li of params.line_items) {
    if (li.type !== 'hourly') continue;
    if (isUcretli && !ucretliAllowedKeys.includes(li.key)) continue;
    const h = hours[li.key] ?? 0;
    if (h <= 0) continue;
    const useNight = li.key === 'gece' || li.key.endsWith('_gece');
    const up = hourlyUnitPrice(params, coeff, li, educationLevel, options.unvan ?? 'meb_kadrolu', useNight);
    const brut = round2(h * up);
    totalBrut += brut;
    breakdown.push({ label: li.label, brut });
  }
  totalBrut = round2(totalBrut);
  for (const roleKey of centralExam) {
    if (!roleKey) continue;
    const role = params.central_exam_roles?.find((r) => r.key === roleKey);
    if (role) {
      const amount =
        role.indicator != null
          ? round2(coeff * role.indicator)
          : round2(role.fixed_amount ?? 0);
      totalBrut = round2(totalBrut + amount);
      breakdown.push({ label: role.label, brut: amount });
    }
  }

  const taxMatrah = options.taxMatrah;
  const taxBrackets = options.taxBrackets;
  const effectiveBrackets = taxBrackets.length > 0 ? taxBrackets : DEFAULT_UCRET_TAX_BRACKETS;

  const stampRate = parseNum(params.stamp_duty_rate) / 1000;
  /** Matrah girilmişse ücret tarifesi dilim dilim: T(matrah+brüt)−T(matrah). Yoksa seçilen tek oran × brüt (kabaca). */
  const taxOnBrut =
    taxMatrah > 0
      ? incrementalWageTaxFromBrackets(taxMatrah, totalBrut, effectiveBrackets)
      : round2(totalBrut * (options.taxRate / 100));

  const gvMax = parseNum(params.gv_exemption_max);
  const remainingGvExempt = round2(Math.max(0, gvMax - options.gvUsed));
  const gvExemptionUsed = round2(Math.min(taxOnBrut, remainingGvExempt));
  const gvKesinti = round2(Math.max(0, taxOnBrut - remainingGvExempt));
  const gvExemptionRemaining = round2(Math.max(0, remainingGvExempt - gvExemptionUsed));

  const dvMax = parseNum(params.dv_exemption_max);
  const remainingDvExempt = round2(Math.max(0, dvMax - options.dvUsed));
  const dvExemptionMatrahUsed = round2(Math.min(totalBrut, remainingDvExempt));
  const dvExemptionMatrahRemaining = round2(Math.max(0, remainingDvExempt - dvExemptionMatrahUsed));
  const dvMatrah = round2(Math.max(0, totalBrut - remainingDvExempt));
  const dvKesinti = round2(dvMatrah * stampRate);
  /** Sözleşmeli ve ücretli: SGK+İşsizlik işçi payı (5510 sayılı Kanun). Kesintiler yukarı yuvarlanır. */
  const sgkRate = parseNum(params.sgk_employee_rate || '14') / 100;
  const sgkKesinti =
    options.unvan === 'meb_sozlesmeli' || options.unvan === 'meb_ucretli'
      ? round2(totalBrut * sgkRate)
      : 0;
  const net = round2(totalBrut - gvKesinti - dvKesinti - sgkKesinti);
  const totalKesinti = round2(gvKesinti + dvKesinti + sgkKesinti);

  return {
    totalBrut,
    breakdown,
    gvKesinti,
    dvKesinti,
    sgkKesinti,
    net,
    taxOnBrut,
    gvExemptionUsed,
    gvExemptionRemaining,
    dvExemptionMatrahUsed,
    dvExemptionMatrahRemaining,
    totalKesinti,
  };
}
