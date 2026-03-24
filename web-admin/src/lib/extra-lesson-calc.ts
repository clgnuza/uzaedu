/**
 * Ek ders hesaplama mantığı. Tüm parametreler superadmin ayarlarından gelir.
 * Test edilebilir, sayfa bu modülden import eder.
 */

export type LineItem = {
  key: string;
  label: string;
  type: 'hourly' | 'fixed';
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
};

export function parseNum(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, '.'));
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

/**
 * 2 ondalık (kuruş) aşağı yuvarlama – brüt, gelir kalemleri için.
 */
function round2(x: number): number {
  return Math.floor(x * 100) / 100;
}

/** MEB merkezi sınav: ROUND(katsayı × gösterge, 2) – standart yuvarlama. */
function round2Std(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Kesintiler (GV, DV, SGK) – resmi hesaplamada yukarı yuvarlanır: 29,1452 → 29,15 */
function round2Up(x: number): number {
  return Math.ceil(x * 100) / 100;
}

export function getTaxRateFromMatrah(matrah: number, taxBrackets: TaxBracket[]): number {
  for (const b of taxBrackets) {
    if (matrah <= b.max_matrah) return b.rate_percent;
  }
  return 40;
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
  const useNight = li.key === 'gece' || li.key.endsWith('_gece');
  const mult = li.multiplier ?? 1;
  const paramDay = li.unit_price_day ?? li.unit_price ?? null;
  const paramNight = li.unit_price_night ?? li.unit_price ?? null;
  let up: number;
  if (isDyk(li.key)) {
    if (isUcretli) up = round2((li.key === 'takviye_gece' || useNight ? baseNight : baseDay) * 2);
    else if (li.key === 'takviye_gece' || useNight) up = round2(refNight + baseNight);
    else up = round2(refDay + baseDay);
  } else {
    const scaleDay = refDay > 0 ? baseDay / refDay : 1;
    const scaleNight = refNight > 0 ? baseNight / refNight : 1;
    up = useNight
      ? paramNight != null ? paramNight * scaleNight : baseNight * mult
      : paramDay != null ? paramDay * scaleDay : baseDay * mult;
  }
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
  /**
   * Ücretli öğretmen: Varsayılan brüt = kadrolu ile aynı (194,30).
   * ucretli_unit_scale=1 (varsayılan) → tam tarife; 0.725 → MEB %72,5 tarifesi.
   */
  const ucretliScale = parseNum(params.ucretli_unit_scale || '1') || 1;
  const isUcretli = options.unvan === 'meb_ucretli';

  /** Ölçek referansı: Lisans birim ücretleri (params.education_levels veya varsayılan) */
  const lisansRef =
    params.education_levels?.find((e) => e.key === 'lisans') ??
    (params.education_levels?.[0] ?? { unit_day: 194.3, unit_night: 208.18 });
  const refDay = parseNum(String(lisansRef.unit_day ?? '')) || 194.3;
  const refNight = parseNum(String(lisansRef.unit_night ?? '')) || 208.18;

  /**
   * Ücretli: Tarife kadrolu ile aynı brüt; öğrenim farkı yok (hep Lisans).
   * ucretliScale ile ölçeklenebilir (superadmin: 1=full, 0.725=MEB %72,5).
   * Kadrolu/Sözleşmeli: öğrenim farkı var; DYK additif formül.
   */
  const baseDay = isUcretli ? refDay * ucretliScale : educationLevel.unit_day;
  const baseNight = isUcretli ? refNight * ucretliScale : educationLevel.unit_night;

  const isDyk = (key: string) => key === 'takviye_gunduz' || key === 'takviye_gece';

  /** Ücretli öğretmen sadece bu 4 kalemi alabilir (MEB bordro). */
  const ucretliAllowedKeys = ['gunduz', 'gece', 'takviye_gunduz', 'takviye_gece'];

  const getUnitPrice = (li: LineItem, useNight: boolean): number => {
    const mult = li.multiplier ?? 1;
    const paramDay = li.unit_price_day ?? li.unit_price ?? null;
    const paramNight = li.unit_price_night ?? li.unit_price ?? null;

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
    if (useNight) return paramNight != null ? paramNight * scaleNight : baseNight * mult;
    return paramDay != null ? paramDay * scaleDay : baseDay * mult;
  };

  for (const li of params.line_items) {
    if (li.type !== 'hourly') continue;
    if (isUcretli && !ucretliAllowedKeys.includes(li.key)) continue;
    const h = hours[li.key] ?? 0;
    if (h <= 0) continue;
    const useNight = li.key === 'gece' || li.key.endsWith('_gece');
    const up = getUnitPrice(li, useNight);
    const brut = round2(h * up);
    totalBrut += brut;
    breakdown.push({ label: li.label, brut });
  }
  totalBrut = round2(totalBrut);

  const coeff = parseFloat(params.monthly_coefficient || '1.387871');
  for (const roleKey of centralExam) {
    if (!roleKey) continue;
    const role = params.central_exam_roles?.find((r) => r.key === roleKey);
    if (role) {
      const amount =
        role.indicator != null
          ? round2Std(coeff * role.indicator)
          : round2(role.fixed_amount ?? 0);
      totalBrut = round2Std(totalBrut + amount);
      breakdown.push({ label: role.label, brut: amount });
    }
  }

  const taxMatrah = options.taxMatrah;
  const taxBrackets = options.taxBrackets;
  const taxRate =
    taxMatrah > 0 && taxBrackets.length > 0
      ? getTaxRateFromMatrah(taxMatrah + totalBrut, taxBrackets)
      : options.taxRate;

  const stampRate = parseNum(params.stamp_duty_rate) / 1000;
  const taxOnBrut = round2(totalBrut * (taxRate / 100));

  const gvMax = parseNum(params.gv_exemption_max);
  const remainingGvExempt = round2(Math.max(0, gvMax - options.gvUsed));
  const gvExemptionUsed = round2(Math.min(taxOnBrut, remainingGvExempt));
  const gvKesinti = round2Up(Math.max(0, taxOnBrut - remainingGvExempt));
  const gvExemptionRemaining = round2(Math.max(0, remainingGvExempt - gvExemptionUsed));

  const dvMax = parseNum(params.dv_exemption_max);
  const remainingDvExempt = round2(Math.max(0, dvMax - options.dvUsed));
  const dvExemptionMatrahUsed = round2(Math.min(totalBrut, remainingDvExempt));
  const dvExemptionMatrahRemaining = round2(Math.max(0, remainingDvExempt - dvExemptionMatrahUsed));
  const dvMatrah = round2(Math.max(0, totalBrut - remainingDvExempt));
  const dvKesinti = round2Up(dvMatrah * stampRate);
  /** Sözleşmeli ve ücretli: SGK+İşsizlik işçi payı (5510 sayılı Kanun). Kesintiler yukarı yuvarlanır. */
  const sgkRate = parseNum(params.sgk_employee_rate || '14') / 100;
  const sgkKesinti =
    options.unvan === 'meb_sozlesmeli' || options.unvan === 'meb_ucretli'
      ? round2Up(totalBrut * sgkRate)
      : 0;
  const net = round2(totalBrut - gvKesinti - dvKesinti - sgkKesinti);

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
  };
}
