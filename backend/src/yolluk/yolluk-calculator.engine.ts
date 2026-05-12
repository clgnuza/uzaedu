/**
 * 6245 özet: yurt içi geçici (gün dilimi) + sürekli yer değiştirme sabit/değişken.
 * H cetveli: derece / elle gündelik + YDM tam-yarım (km değişken çarpanı).
 */

import { YOLLUK_DEFAULT_DERECE_DAILY_TL } from './yolluk-rates.defaults';

export type YollukKind = 'gecici' | 'surekli';

export interface YollukRateParams {
  /** Yedek gündelik (derece yoksa) */
  default_daily_tl: number;
  /** Birleştirilmiş 1..15 iç yevmiye (TL) */
  derece_daily_tl: Record<number, number>;
  km_daily_fraction: number;
  memur_fixed_multiplier: number;
  aile_per_multiplier: number;
  aile_fixed_cap_multiplier: number;
  rules_version: string;
}

export function mergeDereceRates(
  defaultDaily: number,
  fromDb: Record<string, unknown> | null | undefined,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 1; i <= 15; i++) {
    out[i] = YOLLUK_DEFAULT_DERECE_DAILY_TL[i] ?? defaultDaily;
  }
  if (fromDb && typeof fromDb === 'object') {
    for (const [k, v] of Object.entries(fromDb)) {
      const idx = parseInt(k, 10);
      if (idx < 1 || idx > 15) continue;
      const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(String(v)) : NaN;
      if (Number.isFinite(n) && n >= 0) out[idx] = n;
    }
  }
  return out;
}

export function resolveEffectiveDaily(
  rates: YollukRateParams,
  opts: { derece?: number; gundelik_tl_override?: number },
): number {
  const o = opts.gundelik_tl_override;
  if (o != null && Number.isFinite(o) && o > 0) return o;
  const d = opts.derece;
  if (d != null && Number.isFinite(d)) {
    const deg = Math.floor(d);
    if (deg >= 1 && deg <= 15) return rates.derece_daily_tl[deg] ?? rates.default_daily_tl;
  }
  return rates.default_daily_tl;
}

export interface GeciciInputs {
  kind: 'gecici';
  mission_days: number;
  yol_masrafi_tl: number;
  konaklama_tl: number;
  diger_tl: number;
  derece?: number;
  gundelik_tl_override?: number;
  tasit_ucreti_tl: number;
  taksi_tl: number;
}

export interface SurekliInputs {
  kind: 'surekli';
  mesafe_km: number;
  aile_ferdi_sayisi: number;
  derece?: number;
  gundelik_tl_override?: number;
  /** YDM: km ile çarpılan değişken unsur tam / yarım */
  ydm_km_mode: 'tam' | 'yarim';
  tasit_ucreti_tl: number;
  eski_mahal?: string;
  yeni_mahal?: string;
}

export type YollukCalculationInputs = GeciciInputs | SurekliInputs;

export interface YollukLine {
  key: string;
  label: string;
  amount_tl: number;
}

export interface YollukComputeResult {
  kind: YollukKind;
  lines: YollukLine[];
  total_tl: number;
  /** Hesapta kullanılan gündelik (TL) */
  effective_daily_tl: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeGecici(rates: YollukRateParams, input: GeciciInputs): YollukComputeResult {
  const d = resolveEffectiveDaily(rates, {
    derece: input.derece,
    gundelik_tl_override: input.gundelik_tl_override,
  });
  const days = Math.max(0, Math.floor(input.mission_days));
  const tier1 = Math.min(days, 90);
  const tier2 = Math.min(Math.max(days - 90, 0), 90);
  const over = Math.max(days - 180, 0);
  const lines: YollukLine[] = [
    { key: 'tier1_days', label: `Gündelik (ilk 90 gün, tam) × ${tier1}`, amount_tl: round2(tier1 * d) },
    { key: 'tier2_days', label: `Gündelik (91–180, 2/3) × ${tier2}`, amount_tl: round2(tier2 * d * (2 / 3)) },
  ];
  if (over > 0) {
    lines.push({
      key: 'over_180',
      label: `180 günü aşan (${over} gün) — yevmiye ödenmez (kontrol)`,
      amount_tl: 0,
    });
  }
  const tasit = Math.max(0, input.tasit_ucreti_tl);
  const taksi = Math.max(0, input.taksi_tl);
  const yol = Math.max(0, input.yol_masrafi_tl);
  if (tasit > 0) lines.push({ key: 'tasit', label: 'Taşıt ücreti', amount_tl: round2(tasit) });
  lines.push({ key: 'yol', label: 'Yol masrafı', amount_tl: round2(yol) });
  lines.push(
    { key: 'konaklama', label: 'Konaklama (özet)', amount_tl: round2(Math.max(0, input.konaklama_tl)) },
    { key: 'diger', label: 'Diğer (özet)', amount_tl: round2(Math.max(0, input.diger_tl)) },
  );
  if (taksi > 0) lines.push({ key: 'taksi', label: 'Taksi / hamal (özet)', amount_tl: round2(taksi) });
  const total_tl = round2(lines.reduce((s, x) => s + x.amount_tl, 0));
  return { kind: 'gecici', lines, total_tl, effective_daily_tl: d };
}

export function computeSurekli(rates: YollukRateParams, input: SurekliInputs): YollukComputeResult {
  const d = resolveEffectiveDaily(rates, {
    derece: input.derece,
    gundelik_tl_override: input.gundelik_tl_override,
  });
  const km = Math.max(0, input.mesafe_km);
  const n = Math.max(0, Math.floor(input.aile_ferdi_sayisi));
  const ydmMul = input.ydm_km_mode === 'yarim' ? 0.5 : 1;
  const memurSabit = rates.memur_fixed_multiplier * d;
  const aileKatsayi = Math.min(n * rates.aile_per_multiplier, rates.aile_fixed_cap_multiplier);
  const aileSabit = aileKatsayi * d;
  const degisken = km * rates.km_daily_fraction * d * ydmMul;
  const lines: YollukLine[] = [
    { key: 'memur_sabit', label: `Yer değiştirme sabit (memur, ${rates.memur_fixed_multiplier}× gündelik)`, amount_tl: round2(memurSabit) },
    {
      key: 'aile_sabit',
      label: `Yer değiştirme sabit (aile, MIN(${n}×${rates.aile_per_multiplier}, ${rates.aile_fixed_cap_multiplier})× gündelik)`,
      amount_tl: round2(aileSabit),
    },
    {
      key: 'degisken',
      label: `Yer değiştirme değişken (${km} km × ${rates.km_daily_fraction} × gündelik × YDM ${input.ydm_km_mode === 'yarim' ? '½' : '1'})`,
      amount_tl: round2(degisken),
    },
  ];
  const tasit = Math.max(0, input.tasit_ucreti_tl);
  if (tasit > 0) lines.push({ key: 'tasit', label: 'Taşıt ücreti (özet)', amount_tl: round2(tasit) });
  const total_tl = round2(lines.reduce((s, x) => s + x.amount_tl, 0));
  return { kind: 'surekli', lines, total_tl, effective_daily_tl: d };
}

export function computeYolluk(rates: YollukRateParams, input: YollukCalculationInputs): YollukComputeResult {
  if (input.kind === 'gecici') return computeGecici(rates, input);
  return computeSurekli(rates, input);
}
