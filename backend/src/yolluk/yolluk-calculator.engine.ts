/**
 * 6245 özet: yurt içi geçici, sürekli yer değiştirme, denetim (görev yolluğu özeti).
 * H cetveli: ek gösterge bantı / kadro derecesi / elle gündelik; YDM tam-yarım (km).
 */

import { YOLLUK_DEFAULT_DERECE_DAILY_TL } from './yolluk-rates.defaults';

export type YollukKind = 'gecici' | 'surekli' | 'denetim';

/** Ek gösterge bant anahtarları (iç sözlük) */
export type EkGostergeBand = 'g8000_ust' | 'g6400_8000' | 'g3600_6400' | 'alt3600';

export const EK_GOSTERGE_BAND_KEYS: readonly EkGostergeBand[] = [
  'g8000_ust',
  'g6400_8000',
  'g3600_6400',
  'alt3600',
] as const;

export interface YollukRateParams {
  default_daily_tl: number;
  derece_daily_tl: Record<number, number>;
  /** Bant başına iç yevmiye (TL); süperadmin H cetveli / tebliğe göre doldurur */
  ek_gosterge_daily_tl: Partial<Record<EkGostergeBand, number>>;
  /** Denetimde gündelik matrahına esas gün üst sınırı */
  denetim_mission_day_cap: number;
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

export function mergeEkGostergeRates(
  fromDb: Record<string, unknown> | null | undefined,
): Partial<Record<EkGostergeBand, number>> {
  const out: Partial<Record<EkGostergeBand, number>> = {};
  if (!fromDb || typeof fromDb !== 'object') return out;
  for (const k of EK_GOSTERGE_BAND_KEYS) {
    const v = fromDb[k];
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(String(v)) : NaN;
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return out;
}

export function resolveEffectiveDaily(
  rates: YollukRateParams,
  opts: { derece?: number; gundelik_tl_override?: number; ek_gosterge_band?: EkGostergeBand },
): number {
  const o = opts.gundelik_tl_override;
  if (o != null && Number.isFinite(o) && o > 0) return o;
  const band = opts.ek_gosterge_band;
  if (band) {
    const b = rates.ek_gosterge_daily_tl[band];
    if (b != null && Number.isFinite(b) && b > 0) return b;
  }
  const d = opts.derece;
  if (d != null && Number.isFinite(d)) {
    const deg = Math.floor(d);
    if (deg >= 1 && deg <= 15) return rates.derece_daily_tl[deg] ?? rates.default_daily_tl;
  }
  return rates.default_daily_tl;
}

/** Geçici görev «bildirim» tablosu satırı (PDF ile uyumlu) */
export interface GeciciBildirimRowInput {
  tarih?: string;
  yer?: string;
  gidis_saat?: string;
  donus_saat?: string;
  gun_sayisi: number;
  /** Excel/yolluk2026: 1=tam, 2=½, 3=⅔, 4=⅓; gönderilirse yevmiye_payi yerine kullanılır */
  yevmiye_kodu?: 1 | 2 | 3 | 4;
  /** İç yevmiye oranı (kod yoksa zorunlu) */
  yevmiye_payi?: number;
  tasit_tip?: string;
  /** Taşıt ve zorunlu giderler — tutar (TL) */
  tasit_ucret_tl?: number;
  /** Dövizin cinsi / ek yol — tutar (TL); şablonda ayrı sütun */
  doviz_cinsi_tl?: number;
  yer_from_il?: string;
  yer_from_ilce?: string;
  yer_to_il?: string;
  yer_to_ilce?: string;
}

export interface GeciciBildirimMeta {
  kapsam: 'yurtici' | 'yurtdisi';
  ad_soyad?: string;
  unvan?: string;
  tc_kimlik?: string;
  /** Ödeme için (PDF tablo altı; resmî ızgaraya dahil değil) */
  iban?: string;
  dairesi?: string;
  birim_yetkilisi_unvan?: string;
  /** Görev mahalli / birim (şablon «Görev yeri») */
  gorev_yeri?: string;
  /** Konaklama faturası beyanı (bilgi; özet konaklama TL ayrı) */
  konaklama_beyan?: 'hayir' | 'evet';
  /** PDF / bildirim üst bilgisi; hesaplamayı değiştirmez */
  kadro_kademesi?: string;
  /** İmza tarihi satırları (GG.AA.YYYY gösterim); YYYY-MM-DD veya GG.AA.YYYY */
  pdf_duzenleme_tarihi?: string;
  rows: GeciciBildirimRowInput[];
}

export interface GeciciInputs {
  kind: 'gecici';
  mission_days: number;
  yol_masrafi_tl: number;
  konaklama_tl: number;
  diger_tl: number;
  derece?: number;
  gundelik_tl_override?: number;
  ek_gosterge_band?: EkGostergeBand;
  tasit_ucreti_tl: number;
  taksi_tl: number;
  /** Doluysa toplam bu satırlardan + yol/konaklama/diğer/taksi üstüne kurulur (görev günü kademeli modeli kullanılmaz). */
  bildirim?: GeciciBildirimMeta;
}

export interface DenetimInputs {
  kind: 'denetim';
  mission_days: number;
  yol_masrafi_tl: number;
  konaklama_tl: number;
  diger_tl: number;
  derece?: number;
  gundelik_tl_override?: number;
  ek_gosterge_band?: EkGostergeBand;
  tasit_ucreti_tl: number;
  taksi_tl: number;
}

/** Sürekli yolluk resmî bildirim / Excel (yolluk2026) üst bilgisi — hesaplamayı değiştirmez */
export interface SurekliBildirimMeta {
  atama_tarihi?: string;
  avans_durumu?: string;
  es_ad_soyad?: string;
  cocuk_adlari?: string[];
  /** Excel «Aylık Kadro Derecesi ve Ek Göstergesi» sağ hücre özeti */
  ek_gosterge_hucresi?: string;
  /** Aynı hücrede gösterim (PDF); hesaplamayı değiştirmez */
  kadro_kademesi?: string;
  /** PDF dip «tarih» (YYYY-MM-DD veya GG.AA.YYYY); boşsa kayıt tarihi */
  pdf_duzenleme_tarihi?: string;
}

export interface SurekliInputs {
  kind: 'surekli';
  mesafe_km: number;
  /** Eski model: toplam aile ferdi sayısı (kendisi hariç). `es_dahil` / `cocuk_dahil_adet` doluysa bunlar önceliklidir. */
  aile_ferdi_sayisi: number;
  derece?: number;
  gundelik_tl_override?: number;
  ek_gosterge_band?: EkGostergeBand;
  ydm_km_mode: 'tam' | 'yarim';
  tasit_ucreti_tl: number;
  eski_mahal?: string;
  yeni_mahal?: string;
  /** Kişi başı taşıt rayıç (TL); doluysa taşıt = rayıç × (1 + eş + çocuk) — yolluk2026 */
  rayic_ucreti_tl?: number;
  es_dahil?: boolean;
  cocuk_dahil_adet?: number;
  bildirim_meta?: SurekliBildirimMeta;
}

export type YollukCalculationInputs = GeciciInputs | SurekliInputs | DenetimInputs;

export interface YollukLine {
  key: string;
  label: string;
  amount_tl: number;
}

export interface GeciciBildirimRowComputed {
  tarih?: string;
  yer?: string;
  gidis_saat?: string;
  donus_saat?: string;
  gun_sayisi: number;
  yevmiye_payi: number;
  yevmiye_metin: string;
  bir_gunluk_tl: number;
  gundelik_tutar_tl: number;
  tasit_tip?: string;
  tasit_ucret_tl: number;
  doviz_cinsi_tl: number;
  satir_toplam_tl: number;
}

export interface GeciciBildirimComputed {
  kapsam: 'yurtici' | 'yurtdisi';
  ad_soyad?: string;
  unvan?: string;
  tc_kimlik?: string;
  iban?: string;
  dairesi?: string;
  birim_yetkilisi_unvan?: string;
  gorev_yeri?: string;
  konaklama_beyan?: 'hayir' | 'evet';
  rows: GeciciBildirimRowComputed[];
  toplam_gundelik_tl: number;
  /** Taşıt + döviz (şablondaki ulaşım sütunları) */
  toplam_tasit_tl: number;
  /** Bildirim üst alanı; PDF */
  kadro_kademesi?: string;
  /** Dip imza tarihi (PDF); boşsa çizgi boş kalır */
  pdf_duzenleme_tarihi?: string;
}

/** Excel sürekli tablosu satırı (PDF) */
export interface SurekliPdfRow {
  key: string;
  label: string;
  gun_sayisi: number;
  yevmiye_payi: number;
  tutar_tl: number;
  rayic_tl: number;
  sabit_tl: number;
  mesafe_km: number;
  degisken_tl: number;
  satir_toplam_tl: number;
}

export interface YollukComputeResult {
  kind: YollukKind;
  lines: YollukLine[];
  total_tl: number;
  effective_daily_tl: number;
  gecici_bildirim?: GeciciBildirimComputed;
  surekli_pdf?: { rows: SurekliPdfRow[] };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** PDF / tablo satırında yevmiye payı metni */
export function yevmiyePayiDisplayText(p: number): string {
  const tol = 1e-6;
  if (Math.abs(p - 1) < tol) return '1';
  if (Math.abs(p - 2 / 3) < tol) return '2/3';
  if (Math.abs(p - 1 / 2) < tol) return '1/2';
  if (Math.abs(p - 1 / 3) < tol) return '1/3';
  if (Math.abs(p - 1 / 4) < tol) return '1/4';
  return String(round2(p));
}

function clampYevmiyePayi(p: number): number {
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.min(1, p);
}

function yevmiyePayFromKod(k: unknown): number | null {
  if (k === undefined || k === null || k === '') return null;
  const n = typeof k === 'number' ? k : typeof k === 'string' ? parseInt(String(k), 10) : NaN;
  if (n === 1) return 1;
  if (n === 2) return 1 / 2;
  if (n === 3) return 2 / 3;
  if (n === 4) return 1 / 3;
  return null;
}

/** Web `formatIlceLine` + `mergeYer` ile aynı; `yer` boşken il/ilçe seçicilerinden güzergâh. */
function formatIlceLineBackend(il?: string, ilce?: string): string {
  const a = (il ?? '').trim();
  const b = (ilce ?? '').trim();
  if (a && b) return `${a}, ${b}`;
  return a || b;
}

function mergeYerBackend(from: string, to: string): string | undefined {
  const a = from.trim();
  const b = to.trim();
  if (!a && !b) return undefined;
  if (!a) return b || undefined;
  if (!b) return a;
  return `${a} — ${b}`;
}

/** Kayıttaki `rules_snapshot` → hesap parametreleri (PDF yeniden hesap için) */
export function yollukRatesFromSnapshot(snap: Record<string, unknown>): YollukRateParams {
  const ddr = snap.default_daily_tl;
  const defaultDaily =
    typeof ddr === 'number' && Number.isFinite(ddr) ? ddr : parseFloat(String(ddr ?? '850')) || 850;
  const derece_daily_tl = mergeDereceRates(defaultDaily, snap.derece_daily_tl as Record<string, unknown>);
  const ek_gosterge_daily_tl = mergeEkGostergeRates(snap.ek_gosterge_daily_tl as Record<string, unknown>);
  const kmf = snap.km_daily_fraction;
  const km_daily_fraction =
    typeof kmf === 'number' && Number.isFinite(kmf) ? kmf : parseFloat(String(kmf ?? '0.05')) || 0.05;
  const dcap = snap.denetim_mission_day_cap;
  return {
    default_daily_tl: defaultDaily,
    derece_daily_tl,
    ek_gosterge_daily_tl,
    denetim_mission_day_cap:
      typeof dcap === 'number' && Number.isFinite(dcap) ? Math.floor(dcap) : 30,
    km_daily_fraction,
    memur_fixed_multiplier:
      typeof snap.memur_fixed_multiplier === 'number' && Number.isFinite(snap.memur_fixed_multiplier)
        ? snap.memur_fixed_multiplier
        : 20,
    aile_per_multiplier:
      typeof snap.aile_per_multiplier === 'number' && Number.isFinite(snap.aile_per_multiplier)
        ? snap.aile_per_multiplier
        : 10,
    aile_fixed_cap_multiplier:
      typeof snap.aile_fixed_cap_multiplier === 'number' && Number.isFinite(snap.aile_fixed_cap_multiplier)
        ? snap.aile_fixed_cap_multiplier
        : 40,
    rules_version: String(snap.rules_version ?? ''),
  };
}

function surekliAileCount(input: SurekliInputs): {
  structured: boolean;
  es: boolean;
  cocuk: number;
  nAile: number;
} {
  if (input.es_dahil !== undefined || input.cocuk_dahil_adet !== undefined) {
    const es = input.es_dahil === true;
    const cocuk = Math.max(0, Math.min(5, Math.floor(input.cocuk_dahil_adet ?? 0)));
    return { structured: true, es, cocuk, nAile: (es ? 1 : 0) + cocuk };
  }
  const nAile = Math.max(0, Math.floor(input.aile_ferdi_sayisi));
  return { structured: false, es: false, cocuk: 0, nAile };
}

/** Eş + çocuklar için aile birimleri (her biri en fazla `per`); toplam `cap` ile sınırlı — yolluk2026 */
function distributeAileUnitMults(es: boolean, cocuk: number, per: number, cap: number): number[] {
  const parts: number[] = [];
  let rem = Math.min((es ? per : 0) + per * cocuk, cap);
  if (es) {
    const u = Math.min(per, rem);
    parts.push(u);
    rem -= u;
  }
  for (let i = 0; i < cocuk; i++) {
    const u = Math.min(per, rem);
    parts.push(u > 0 ? u : 0);
    rem -= u > 0 ? u : 0;
  }
  return parts;
}

export function buildSurekliPdfRows(rates: YollukRateParams, input: SurekliInputs): SurekliPdfRow[] {
  const d = resolveEffectiveDaily(rates, {
    derece: input.derece,
    gundelik_tl_override: input.gundelik_tl_override,
    ek_gosterge_band: input.ek_gosterge_band,
  });
  const km = Math.max(0, input.mesafe_km);
  const ydmMul = input.ydm_km_mode === 'yarim' ? 0.5 : 1;
  const memurSabit = rates.memur_fixed_multiplier * d;
  const degisken = round2(km * rates.km_daily_fraction * d * ydmMul);
  const ac = surekliAileCount(input);
  const aileKatsayi = Math.min(ac.nAile * rates.aile_per_multiplier, rates.aile_fixed_cap_multiplier);
  const aileSabitAgg = aileKatsayi * d;
  const peopleRayic = ac.structured ? 1 + (ac.es ? 1 : 0) + ac.cocuk : 1 + Math.max(0, ac.nAile);
  const rayNum =
    typeof input.rayic_ucreti_tl === 'number' && Number.isFinite(input.rayic_ucreti_tl) && input.rayic_ucreti_tl > 0
      ? input.rayic_ucreti_tl
      : null;
  const tasitTop = rayNum != null ? round2(rayNum * peopleRayic) : Math.max(0, input.tasit_ucreti_tl);
  const rayShow = rayNum != null ? round2(rayNum) : peopleRayic > 0 ? round2(tasitTop / peopleRayic) : 0;

  const rows: SurekliPdfRow[] = [];
  rows.push({
    key: 'kendisi',
    label: 'Kendisi',
    gun_sayisi: 1,
    yevmiye_payi: 1,
    tutar_tl: round2(d),
    rayic_tl: rayShow,
    sabit_tl: round2(memurSabit),
    mesafe_km: km,
    degisken_tl: round2(degisken),
    satir_toplam_tl: round2(d + rayShow + memurSabit + degisken),
  });

  if (ac.structured) {
    const mults = distributeAileUnitMults(ac.es, ac.cocuk, rates.aile_per_multiplier, rates.aile_fixed_cap_multiplier);
    let pi = 0;
    const esMult = ac.es ? mults[pi++]! : 0;
    const esInc = ac.es;
    const esTot = round2((esInc ? d + rayShow : 0) + esMult * d);
    rows.push({
      key: 'es',
      label: 'Eş',
      gun_sayisi: esMult,
      yevmiye_payi: esInc ? 1 : 0,
      tutar_tl: esInc ? round2(d) : 0,
      rayic_tl: esInc ? rayShow : 0,
      sabit_tl: round2(esMult * d),
      mesafe_km: 0,
      degisken_tl: 0,
      satir_toplam_tl: esTot,
    });
    for (let ci = 1; ci <= 5; ci++) {
      const inc = ci <= ac.cocuk;
      const m = inc ? (mults[pi++] ?? 0) : 0;
      rows.push({
        key: `cocuk_${ci}`,
        label: `Çocuk ${ci}`,
        gun_sayisi: m,
        yevmiye_payi: inc ? 1 : 0,
        tutar_tl: inc ? round2(d) : 0,
        rayic_tl: inc ? rayShow : 0,
        sabit_tl: round2(m * d),
        mesafe_km: 0,
        degisken_tl: 0,
        satir_toplam_tl: round2((inc ? d + rayShow : 0) + m * d),
      });
    }
  } else if (ac.nAile > 0) {
    rows.push({
      key: 'aile_ozet',
      label: `Aile ferdi (${ac.nAile})`,
      gun_sayisi: ac.nAile,
      yevmiye_payi: 1,
      tutar_tl: round2(ac.nAile * d),
      rayic_tl: round2(ac.nAile * rayShow),
      sabit_tl: round2(aileSabitAgg),
      mesafe_km: 0,
      degisken_tl: 0,
      satir_toplam_tl: round2(ac.nAile * d + ac.nAile * rayShow + aileSabitAgg),
    });
  }

  return rows;
}

export function bildirimYerDisplay(r: Pick<GeciciBildirimRowInput, 'yer' | 'yer_from_il' | 'yer_from_ilce' | 'yer_to_il' | 'yer_to_ilce'>): string | undefined {
  const y = (r.yer ?? '').trim();
  if (y) return y;
  const from = formatIlceLineBackend(r.yer_from_il, r.yer_from_ilce);
  const to = formatIlceLineBackend(r.yer_to_il, r.yer_to_ilce);
  return mergeYerBackend(from, to);
}

function computeGeciciFromBildirim(
  d: number,
  input: GeciciInputs,
  meta: GeciciBildirimMeta,
): YollukComputeResult {
  const lines: YollukLine[] = [];
  const rowsOut: GeciciBildirimRowComputed[] = [];
  let toplamG = 0;
  let toplamT = 0;
  let i = 0;
  for (const r of meta.rows) {
    const guns = Math.max(0, Math.floor(r.gun_sayisi));
    const fromKod = yevmiyePayFromKod(r.yevmiye_kodu);
    const payi = clampYevmiyePayi(fromKod != null ? fromKod : (r.yevmiye_payi ?? 0));
    const birGun = payi > 0 ? round2(d * payi) : 0;
    const gPart = round2(d * payi * guns);
    const tPart = Math.max(0, r.tasit_ucret_tl ?? 0);
    const dPart = Math.max(0, r.doviz_cinsi_tl ?? 0);
    toplamG += gPart;
    toplamT += tPart + dPart;
    const yerOut = bildirimYerDisplay(r) ?? r.yer;
    rowsOut.push({
      tarih: r.tarih,
      yer: yerOut,
      gidis_saat: r.gidis_saat,
      donus_saat: r.donus_saat,
      gun_sayisi: guns,
      yevmiye_payi: payi,
      yevmiye_metin: yevmiyePayiDisplayText(payi),
      bir_gunluk_tl: birGun,
      gundelik_tutar_tl: gPart,
      tasit_tip: r.tasit_tip,
      tasit_ucret_tl: tPart,
      doviz_cinsi_tl: dPart,
      satir_toplam_tl: round2(gPart + tPart + dPart),
    });
    i += 1;
    const label = [r.tarih, yerOut].filter(Boolean).join(' · ') || `Satır ${i}`;
    lines.push({ key: `b_row_${i}_g`, label: `Gündelik — ${label}`, amount_tl: gPart });
    if (tPart > 0) lines.push({ key: `b_row_${i}_tz`, label: `Taşıt/zorunlu — ${label}`, amount_tl: round2(tPart) });
    if (dPart > 0) lines.push({ key: `b_row_${i}_dv`, label: `Döviz / ek yol — ${label}`, amount_tl: round2(dPart) });
  }
  const tasit = Math.max(0, input.tasit_ucreti_tl);
  const taksi = Math.max(0, input.taksi_tl);
  const yol = Math.max(0, input.yol_masrafi_tl);
  if (tasit > 0) lines.push({ key: 'tasit_ozet', label: 'Taşıt ücreti (özet, tablo dışı)', amount_tl: round2(tasit) });
  lines.push({ key: 'yol', label: 'Yol masrafı', amount_tl: round2(yol) });
  lines.push(
    { key: 'konaklama', label: 'Konaklama (özet)', amount_tl: round2(Math.max(0, input.konaklama_tl)) },
    { key: 'diger', label: 'Diğer (özet)', amount_tl: round2(Math.max(0, input.diger_tl)) },
  );
  if (taksi > 0) lines.push({ key: 'taksi', label: 'Taksi / hamal (özet)', amount_tl: round2(taksi) });
  const total_tl = round2(lines.reduce((s, x) => s + x.amount_tl, 0));
  return {
    kind: 'gecici',
    lines,
    total_tl,
    effective_daily_tl: d,
    gecici_bildirim: {
      kapsam: meta.kapsam,
      ad_soyad: meta.ad_soyad,
      unvan: meta.unvan,
      tc_kimlik: meta.tc_kimlik,
      ...(meta.iban ? { iban: meta.iban } : {}),
      ...(meta.kadro_kademesi ? { kadro_kademesi: meta.kadro_kademesi } : {}),
      ...(meta.pdf_duzenleme_tarihi ? { pdf_duzenleme_tarihi: meta.pdf_duzenleme_tarihi } : {}),
      dairesi: meta.dairesi,
      birim_yetkilisi_unvan: meta.birim_yetkilisi_unvan,
      gorev_yeri: meta.gorev_yeri,
      konaklama_beyan: meta.konaklama_beyan,
      rows: rowsOut,
      toplam_gundelik_tl: round2(toplamG),
      toplam_tasit_tl: round2(toplamT),
    },
  };
}

function missionAllowanceLines(
  d: number,
  missionDaysRaw: number,
  opts: { missionDayCap: number | null; prefix: string },
): YollukLine[] {
  const raw = Math.max(0, Math.floor(missionDaysRaw));
  const cap = opts.missionDayCap;
  const days = cap != null ? Math.min(raw, cap) : raw;
  const tier1 = Math.min(days, 90);
  const tier2 = Math.min(Math.max(days - 90, 0), 90);
  const over = Math.max(days - 180, 0);
  const p = opts.prefix;
  const lines: YollukLine[] = [
    { key: 'tier1_days', label: `${p}Gündelik (ilk 90 gün, tam) × ${tier1}`, amount_tl: round2(tier1 * d) },
    { key: 'tier2_days', label: `${p}Gündelik (91–180, 2/3) × ${tier2}`, amount_tl: round2(tier2 * d * (2 / 3)) },
  ];
  if (over > 0) {
    lines.push({
      key: 'over_180',
      label: `${p}180 günü aşan (${over} gün) — yevmiye ödenmez (kontrol)`,
      amount_tl: 0,
    });
  }
  if (cap != null && raw > cap) {
    lines.push({
      key: 'mission_cap',
      label: `${p}Girilen ${raw} gün; denetim özeti için gündelik matrahı en fazla ${cap} gün`,
      amount_tl: 0,
    });
  }
  return lines;
}

export function computeGecici(rates: YollukRateParams, input: GeciciInputs): YollukComputeResult {
  const d = resolveEffectiveDaily(rates, {
    derece: input.derece,
    gundelik_tl_override: input.gundelik_tl_override,
    ek_gosterge_band: input.ek_gosterge_band,
  });
  if (input.bildirim) {
    const rows = Array.isArray(input.bildirim.rows) ? input.bildirim.rows : [];
    return computeGeciciFromBildirim(d, input, { ...input.bildirim, rows });
  }
  const lines = missionAllowanceLines(d, input.mission_days, { missionDayCap: null, prefix: '' });
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

export function computeDenetim(rates: YollukRateParams, input: DenetimInputs): YollukComputeResult {
  const cap = Math.max(1, Math.min(366, Math.floor(rates.denetim_mission_day_cap || 30)));
  const d = resolveEffectiveDaily(rates, {
    derece: input.derece,
    gundelik_tl_override: input.gundelik_tl_override,
    ek_gosterge_band: input.ek_gosterge_band,
  });
  const lines = missionAllowanceLines(d, input.mission_days, {
    missionDayCap: cap,
    prefix: 'Denetim — ',
  });
  const tasit = Math.max(0, input.tasit_ucreti_tl);
  const taksi = Math.max(0, input.taksi_tl);
  const yol = Math.max(0, input.yol_masrafi_tl);
  if (tasit > 0) lines.push({ key: 'tasit', label: 'Denetim — taşıt ücreti', amount_tl: round2(tasit) });
  lines.push({ key: 'yol', label: 'Denetim — yol masrafı', amount_tl: round2(yol) });
  lines.push(
    { key: 'konaklama', label: 'Denetim — konaklama (özet)', amount_tl: round2(Math.max(0, input.konaklama_tl)) },
    { key: 'diger', label: 'Denetim — diğer (özet)', amount_tl: round2(Math.max(0, input.diger_tl)) },
  );
  if (taksi > 0) lines.push({ key: 'taksi', label: 'Denetim — taksi / hamal (özet)', amount_tl: round2(taksi) });
  const total_tl = round2(lines.reduce((s, x) => s + x.amount_tl, 0));
  return { kind: 'denetim', lines, total_tl, effective_daily_tl: d };
}

export function computeSurekli(rates: YollukRateParams, input: SurekliInputs): YollukComputeResult {
  const d = resolveEffectiveDaily(rates, {
    derece: input.derece,
    gundelik_tl_override: input.gundelik_tl_override,
    ek_gosterge_band: input.ek_gosterge_band,
  });
  const km = Math.max(0, input.mesafe_km);
  const ac = surekliAileCount(input);
  const ydmMul = input.ydm_km_mode === 'yarim' ? 0.5 : 1;
  const degisken = round2(km * rates.km_daily_fraction * d * ydmMul);
  const peopleRayic = ac.structured ? 1 + (ac.es ? 1 : 0) + ac.cocuk : 1 + Math.max(0, ac.nAile);
  const rayNum =
    typeof input.rayic_ucreti_tl === 'number' && Number.isFinite(input.rayic_ucreti_tl) && input.rayic_ucreti_tl > 0
      ? input.rayic_ucreti_tl
      : null;

  const surekli_pdf = { rows: buildSurekliPdfRows(rates, input) };
  const rows = surekli_pdf.rows;
  const sumTut = round2(rows.reduce((s, r) => s + r.tutar_tl, 0));
  const sumRay = round2(rows.reduce((s, r) => s + r.rayic_tl, 0));
  const sumSab = round2(rows.reduce((s, r) => s + r.sabit_tl, 0));
  const sumDeg = round2(rows.reduce((s, r) => s + r.degisken_tl, 0));
  const total_tl = round2(rows.reduce((s, r) => s + r.satir_toplam_tl, 0));

  const lines: YollukLine[] = [
    { key: 'gundelik', label: 'Gündelik (tablo tutarı toplamı)', amount_tl: sumTut },
    {
      key: 'tasit_ray',
      label:
        rayNum != null
          ? `Taşıt rayıç (tablo toplamı; ${round2(rayNum)} TL × ${peopleRayic} kişi)`
          : 'Taşıt rayıç / taşıt (tablo toplamı)',
      amount_tl: sumRay,
    },
    {
      key: 'yer_sabit',
      label: `Yer değiştirme sabit (tablo toplamı; memur ${rates.memur_fixed_multiplier}× + aile MIN(${ac.nAile}×${rates.aile_per_multiplier}, ${rates.aile_fixed_cap_multiplier})×)`,
      amount_tl: sumSab,
    },
    {
      key: 'degisken',
      label: `Yer değiştirme değişken (${km} km × ${rates.km_daily_fraction} × gündelik × YDM ${input.ydm_km_mode === 'yarim' ? '½' : '1'})`,
      amount_tl: sumDeg,
    },
  ];
  return { kind: 'surekli', lines, total_tl, effective_daily_tl: d, surekli_pdf };
}

export function computeYolluk(rates: YollukRateParams, input: YollukCalculationInputs): YollukComputeResult {
  if (input.kind === 'gecici') return computeGecici(rates, input);
  if (input.kind === 'denetim') return computeDenetim(rates, input);
  return computeSurekli(rates, input);
}
