import { YEVMIYE_KOD_OPTIONS } from './yolluk-gecici-options';
import { parseMahalToIlIlce } from '@/lib/turkey-addresses';

export type EkBandHydrate = 'g8000_ust' | 'g6400_8000' | 'g3600_6400' | 'alt3600';

export type YevmiyeKodStr = (typeof YEVMIYE_KOD_OPTIONS)[number]['kod'];

function payToKod(pay: number): YevmiyeKodStr {
  const o = YEVMIYE_KOD_OPTIONS.find((x) => Math.abs(x.pay - pay) < 1e-5);
  return (o?.kod ?? '3') as YevmiyeKodStr;
}

function splitYer(yer: string): { from: string; to: string } {
  const s = yer.trim();
  if (!s) return { from: '', to: '' };
  for (const sep of ['—', '–', '→', '-']) {
    const idx = s.indexOf(sep);
    if (idx >= 0) {
      const a = s.slice(0, idx).trim();
      const b = s.slice(idx + sep.length).trim();
      return { from: a, to: b };
    }
  }
  return { from: '', to: s };
}

export function mergeYer(from: string, to: string): string | undefined {
  const a = from.trim();
  const b = to.trim();
  if (!a && !b) return undefined;
  if (!a) return b || undefined;
  if (!b) return a;
  return `${a} — ${b}`;
}

/** bildirim_meta.pdf_duzenleme_tarihi → input type=date değeri (YYYY-MM-DD) */
export function bildirimMetaPdfDateToDateInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (!m) return '';
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  return `${m[3]}-${mo}-${d}`;
}

export function formatIlceLine(il: string, ilce: string): string {
  const a = il.trim();
  const b = ilce.trim();
  if (a && b) return `${a}, ${b}`;
  return a || b;
}

export type GeciciBildirimRowState = {
  id: string;
  tarih: string;
  yer_from_il: string;
  yer_from_ilce: string;
  yer_to_il: string;
  yer_to_ilce: string;
  yer_from: string;
  yer_to: string;
  gidis_saat: string;
  donus_saat: string;
  gun_sayisi: number;
  yevmiye_kod: YevmiyeKodStr;
  tasit_tip: string;
  tasit_ucret_tl: number;
  doviz_cinsi_tl: number;
};

export function mergeYerFromSelectors(r: Pick<GeciciBildirimRowState, 'yer_from_il' | 'yer_from_ilce' | 'yer_to_il' | 'yer_to_ilce' | 'yer_from' | 'yer_to'>): string | undefined {
  const from = formatIlceLine(r.yer_from_il, r.yer_from_ilce) || r.yer_from.trim();
  const to = formatIlceLine(r.yer_to_il, r.yer_to_ilce) || r.yer_to.trim();
  return mergeYer(from, to);
}

export function newBildRow(): GeciciBildirimRowState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    tarih: '',
    yer_from_il: '',
    yer_from_ilce: '',
    yer_to_il: '',
    yer_to_ilce: '',
    yer_from: '',
    yer_to: '',
    gidis_saat: '',
    donus_saat: '',
    gun_sayisi: 1,
    yevmiye_kod: '3',
    tasit_tip: 'OTO',
    tasit_ucret_tl: 0,
    doviz_cinsi_tl: 0,
  };
}

function asNum(v: unknown, d = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : d;
  }
  return d;
}

function asInt(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(String(v), 10) : NaN;
  return Number.isFinite(n) ? Math.floor(n) : d;
}

function parseEk(v: unknown): EkBandHydrate | '' {
  if (v === 'g8000_ust' || v === 'g6400_8000' || v === 'g3600_6400' || v === 'alt3600') return v;
  return '';
}

export type HydratedYollukForm = {
  tid: string;
  kind: 'gecici' | 'surekli' | 'denetim';
  fiscalYear: number | null;
  title: string;
  missionDays: number;
  yol: number;
  kon: number;
  diger: number;
  tasitG: number;
  taksiG: number;
  km: number;
  aile: number;
  derece: number | '';
  gundelikElle: number;
  ekBand: EkBandHydrate | '';
  ydm: 'tam' | 'yarim';
  tasitS: number;
  eskiIl: string;
  eskiIlce: string;
  yeniIl: string;
  yeniIlce: string;
  rayicS: number;
  surSatirliAile: boolean;
  surEs: boolean;
  surCocuk: number;
  surAtama: string;
  surPdfTarih: string;
  surAvans: string;
  surEkHucre: string;
  surEsAd: string;
  surCocukAdMetni: string;
  bildKademe: string;
  bildRows: GeciciBildirimRowState[];
  bildKapsam: 'yurtici' | 'yurtdisi';
  bildAd: string;
  bildUnvan: string;
  bildTc: string;
  bildIban: string;
  bildDaire: string;
  bildMudurUnvan: string;
  bildGorevYeri: string;
  bildKonaklamaBeyan: 'hayir' | 'evet';
  /** Geçici bildirim PDF imza tarihi (type=date, YYYY-MM-DD) */
  bildPdfDuzenleme: string;
};

export function hydrateYollukForm(
  inputs: Record<string, unknown>,
  rules_snapshot: Record<string, unknown>,
  teacherUserId: string,
  title: string | null,
): HydratedYollukForm {
  const fyRaw = rules_snapshot?.fiscal_year;
  const fiscalYear = typeof fyRaw === 'number' && Number.isFinite(fyRaw) ? fyRaw : typeof fyRaw === 'string' ? parseInt(fyRaw, 10) || null : null;

  const kindRaw = inputs.kind;
  const kind = kindRaw === 'gecici' || kindRaw === 'denetim' || kindRaw === 'surekli' ? kindRaw : 'surekli';

  const d = inputs.derece;
  const derece = d === undefined || d === null || d === '' ? '' : asInt(d, 1);
  const gundelikElle = asNum(inputs.gundelik_tl_override, 0);
  const ekBand = parseEk(inputs.ek_gosterge_band);

  let missionDays = 1;
  let yol = 0;
  let kon = 0;
  let diger = 0;
  let tasitG = 0;
  let taksiG = 0;
  let km = 0;
  let aile = 0;
  let ydm: 'tam' | 'yarim' = 'tam';
  let tasitS = 0;
  let eskiIl = '';
  let eskiIlce = '';
  let yeniIl = '';
  let yeniIlce = '';
  let rayicS = 0;
  let surSatirliAile = false;
  let surEs = false;
  let surCocuk = 0;
  let surAtama = '';
  let surPdfTarih = '';
  let surAvans = '';
  let surEkHucre = '';
  let surEsAd = '';
  let surCocukAdMetni = '';
  let bildKademe = '';
  let bildRows: GeciciBildirimRowState[] = [newBildRow()];
  let bildKapsam: 'yurtici' | 'yurtdisi' = 'yurtici';
  let bildAd = '';
  let bildUnvan = '';
  let bildTc = '';
  let bildIban = '';
  let bildDaire = '';
  let bildMudurUnvan = '';
  let bildGorevYeri = '';
  let bildKonaklamaBeyan: 'hayir' | 'evet' = 'hayir';
  let bildPdfDuzenleme = '';

  if (kind === 'surekli') {
    km = asNum(inputs.mesafe_km, 0);
    aile = asInt(inputs.aile_ferdi_sayisi, 0);
    const ym = String(inputs.ydm_km_mode ?? '').toLowerCase();
    ydm = ym === 'yarim' || ym === 'yarım' ? 'yarim' : 'tam';
    tasitS = asNum(inputs.tasit_ucreti_tl, 0);
    const esRaw = typeof inputs.eski_mahal === 'string' ? inputs.eski_mahal : '';
    const yeRaw = typeof inputs.yeni_mahal === 'string' ? inputs.yeni_mahal : '';
    const ep = parseMahalToIlIlce(esRaw);
    const yp = parseMahalToIlIlce(yeRaw);
    eskiIl = ep.il;
    eskiIlce = ep.ilce;
    yeniIl = yp.il;
    yeniIlce = yp.ilce;
    rayicS = asNum(inputs.rayic_ucreti_tl, 0);
    const hasStruct = inputs.es_dahil !== undefined || inputs.cocuk_dahil_adet !== undefined;
    surSatirliAile = hasStruct;
    surEs = inputs.es_dahil === true;
    surCocuk = hasStruct ? Math.max(0, Math.min(5, asInt(inputs.cocuk_dahil_adet, 0))) : 0;
    const bm = inputs.bildirim_meta;
    if (bm && typeof bm === 'object' && !Array.isArray(bm)) {
      const bo = bm as Record<string, unknown>;
      if (typeof bo.atama_tarihi === 'string') surAtama = bo.atama_tarihi;
      else if (typeof bo.atamaTarihi === 'string') surAtama = bo.atamaTarihi;
      if (typeof bo.pdf_duzenleme_tarihi === 'string') surPdfTarih = bildirimMetaPdfDateToDateInput(bo.pdf_duzenleme_tarihi);
      else if (typeof bo.pdfDuzenlemeTarihi === 'string') surPdfTarih = bildirimMetaPdfDateToDateInput(bo.pdfDuzenlemeTarihi);
      if (typeof bo.avans_durumu === 'string') surAvans = bo.avans_durumu;
      else if (typeof bo.avansDurumu === 'string') surAvans = bo.avansDurumu;
      if (typeof bo.ek_gosterge_hucresi === 'string') surEkHucre = bo.ek_gosterge_hucresi;
      if (typeof bo.kadro_kademesi === 'string') bildKademe = bo.kadro_kademesi;
      else if (typeof bo.kadroKademesi === 'string') bildKademe = bo.kadroKademesi;
      if (typeof bo.es_ad_soyad === 'string') surEsAd = bo.es_ad_soyad;
      if (Array.isArray(bo.cocuk_adlari)) {
        surCocukAdMetni = bo.cocuk_adlari
          .map((x) => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
          .filter(Boolean)
          .join('\n');
      }
    }
  } else {
    missionDays = asInt(inputs.mission_days, 0);
    yol = asNum(inputs.yol_masrafi_tl, 0);
    kon = asNum(inputs.konaklama_tl, 0);
    diger = asNum(inputs.diger_tl, 0);
    tasitG = asNum(inputs.tasit_ucreti_tl, 0);
    taksiG = asNum(inputs.taksi_tl, 0);
    const b = inputs.bildirim;
    if (b && typeof b === 'object' && !Array.isArray(b)) {
      const bo = b as Record<string, unknown>;
      if (bo.kapsam === 'yurtdisi') bildKapsam = 'yurtdisi';
      if (typeof bo.ad_soyad === 'string') bildAd = bo.ad_soyad;
      if (typeof bo.unvan === 'string') bildUnvan = bo.unvan;
      if (typeof bo.tc_kimlik === 'string') bildTc = bo.tc_kimlik;
      if (typeof bo.iban === 'string') {
        const ib = bo.iban.replace(/\s/g, '').toUpperCase().slice(0, 34);
        if (ib) bildIban = ib;
      }
      if (typeof bo.dairesi === 'string') bildDaire = bo.dairesi;
      if (typeof bo.birim_yetkilisi_unvan === 'string') bildMudurUnvan = bo.birim_yetkilisi_unvan;
      if (typeof bo.gorev_yeri === 'string') bildGorevYeri = bo.gorev_yeri;
      if (bo.konaklama_beyan === 'evet' || bo.konaklama_beyan === 'hayir') bildKonaklamaBeyan = bo.konaklama_beyan;
      if (typeof bo.pdf_duzenleme_tarihi === 'string') bildPdfDuzenleme = bildirimMetaPdfDateToDateInput(bo.pdf_duzenleme_tarihi);
      else if (typeof bo['pdfDuzenlemeTarihi'] === 'string') bildPdfDuzenleme = bildirimMetaPdfDateToDateInput(bo['pdfDuzenlemeTarihi'] as string);
      if (typeof bo.kadro_kademesi === 'string') bildKademe = bo.kadro_kademesi;
      else if (typeof bo['kadroKademesi'] === 'string') bildKademe = bo['kadroKademesi'] as string;
      const rowsRaw = bo.rows;
      if (Array.isArray(rowsRaw) && rowsRaw.length > 0) {
        bildRows = rowsRaw.map((row, i) => {
          const r = row as Record<string, unknown>;
          const yk = r.yevmiye_kodu;
          let yevmiye_kod: YevmiyeKodStr = '3';
          if (typeof yk === 'number' && (yk === 1 || yk === 2 || yk === 3 || yk === 4)) {
            yevmiye_kod = String(yk) as YevmiyeKodStr;
          } else {
            yevmiye_kod = payToKod(asNum(r.yevmiye_payi, 2 / 3));
          }
          const fi = typeof r.yer_from_il === 'string' ? r.yer_from_il : '';
          const fic = typeof r.yer_from_ilce === 'string' ? r.yer_from_ilce : '';
          const ti = typeof r.yer_to_il === 'string' ? r.yer_to_il : '';
          const tic = typeof r.yer_to_ilce === 'string' ? r.yer_to_ilce : '';
          let yer_from = '';
          let yer_to = '';
          if (fi || fic || ti || tic) {
            yer_from = '';
            yer_to = '';
          } else {
            const sp = splitYer(typeof r.yer === 'string' ? r.yer : '');
            yer_from = sp.from;
            yer_to = sp.to;
          }
          return {
            id: `ld-${i}-${Math.random().toString(36).slice(2, 8)}`,
            tarih: typeof r.tarih === 'string' ? r.tarih : '',
            yer_from_il: fi,
            yer_from_ilce: fic,
            yer_to_il: ti,
            yer_to_ilce: tic,
            yer_from,
            yer_to,
            gidis_saat: typeof r.gidis_saat === 'string' ? r.gidis_saat : '',
            donus_saat: typeof r.donus_saat === 'string' ? r.donus_saat : '',
            gun_sayisi: asInt(r.gun_sayisi, 0),
            yevmiye_kod,
            tasit_tip: typeof r.tasit_tip === 'string' ? r.tasit_tip : '',
            tasit_ucret_tl: asNum(r.tasit_ucret_tl, 0),
            doviz_cinsi_tl: asNum(r.doviz_cinsi_tl, 0),
          };
        });
      }
    }
  }

  return {
    tid: teacherUserId,
    kind,
    fiscalYear,
    title: title ?? '',
    missionDays,
    yol,
    kon,
    diger,
    tasitG,
    taksiG,
    km,
    aile,
    derece: derece === '' ? '' : derece >= 1 && derece <= 15 ? derece : '',
    gundelikElle,
    ekBand,
    ydm,
    tasitS,
    eskiIl,
    eskiIlce,
    yeniIl,
    yeniIlce,
    rayicS,
    surSatirliAile,
    surEs,
    surCocuk,
    surAtama,
    surPdfTarih,
    surAvans,
    surEkHucre,
    surEsAd,
    surCocukAdMetni,
    bildKademe,
    bildRows,
    bildKapsam,
    bildAd,
    bildUnvan,
    bildTc,
    bildIban,
    bildDaire,
    bildMudurUnvan,
    bildGorevYeri,
    bildKonaklamaBeyan,
    bildPdfDuzenleme,
  };
}
