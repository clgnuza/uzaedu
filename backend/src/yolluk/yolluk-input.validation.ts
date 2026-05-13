import { BadRequestException } from '@nestjs/common';
import type {
  DenetimInputs,
  EkGostergeBand,
  GeciciBildirimMeta,
  GeciciBildirimRowInput,
  GeciciInputs,
  SurekliBildirimMeta,
  SurekliInputs,
} from './yolluk-calculator.engine';

export function parseCalcInput(raw: unknown): GeciciInputs | SurekliInputs | DenetimInputs {
  if (!raw || typeof raw !== 'object') {
    throw new BadRequestException({ code: 'INVALID_INPUT', message: 'input gerekli.' });
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === 'gecici') {
    const bildirim = parseBildirim(o.bildirim);
    const mission_days =
      bildirim?.rows?.length && bildirim.rows.length > 0
        ? o.mission_days === undefined || o.mission_days === null || o.mission_days === ''
          ? 0
          : num(o.mission_days, 'mission_days', 0, 1e6)
        : num(o.mission_days, 'mission_days', 0, 1e6);
    return {
      kind: 'gecici',
      mission_days,
      yol_masrafi_tl: num(o.yol_masrafi_tl, 'yol_masrafi_tl', 0, 1e9),
      konaklama_tl: num(o.konaklama_tl, 'konaklama_tl', 0, 1e9),
      diger_tl: num(o.diger_tl, 'diger_tl', 0, 1e9),
      ...optGeciciLike(o),
      ...(bildirim ? { bildirim } : {}),
    };
  }
  if (kind === 'denetim') {
    return {
      kind: 'denetim',
      mission_days: num(o.mission_days, 'mission_days', 0, 1e6),
      yol_masrafi_tl: num(o.yol_masrafi_tl, 'yol_masrafi_tl', 0, 1e9),
      konaklama_tl: num(o.konaklama_tl, 'konaklama_tl', 0, 1e9),
      diger_tl: num(o.diger_tl, 'diger_tl', 0, 1e9),
      ...optGeciciLike(o),
    };
  }
  if (kind === 'surekli') {
    const opt = optSurekli(o);
    const aileRaw = o.aile_ferdi_sayisi;
    let aile_ferdi_sayisi =
      aileRaw == null || aileRaw === '' ? 0 : int(aileRaw, 'aile_ferdi_sayisi', 0, 50);
    if (opt.es_dahil !== undefined || opt.cocuk_dahil_adet !== undefined) {
      aile_ferdi_sayisi =
        (opt.es_dahil === true ? 1 : 0) + Math.max(0, Math.min(5, Math.floor(opt.cocuk_dahil_adet ?? 0)));
    }
    const mesafeRaw = o.mesafe_km;
    const tasitRaw = o.tasit_ucreti_tl;
    return {
      kind: 'surekli',
      mesafe_km: mesafeRaw == null || mesafeRaw === '' ? 0 : num(mesafeRaw, 'mesafe_km', 0, 2e4),
      aile_ferdi_sayisi,
      ydm_km_mode: parseYdm(o.ydm_km_mode),
      tasit_ucreti_tl: tasitRaw == null || tasitRaw === '' ? 0 : num(tasitRaw, 'tasit_ucreti_tl', 0, 1e9),
      ...opt,
    };
  }
  throw new BadRequestException({
    code: 'INVALID_KIND',
    message: 'kind: gecici, surekli veya denetim olmalı.',
  });
}

function optGeciciLike(
  o: Record<string, unknown>,
): Pick<GeciciInputs, 'derece' | 'gundelik_tl_override' | 'tasit_ucreti_tl' | 'taksi_tl' | 'ek_gosterge_band'> {
  const out: Pick<GeciciInputs, 'derece' | 'gundelik_tl_override' | 'tasit_ucreti_tl' | 'taksi_tl' | 'ek_gosterge_band'> = {
    tasit_ucreti_tl:
      o.tasit_ucreti_tl == null || o.tasit_ucreti_tl === '' ? 0 : num(o.tasit_ucreti_tl, 'tasit_ucreti_tl', 0, 1e9),
    taksi_tl: o.taksi_tl == null || o.taksi_tl === '' ? 0 : num(o.taksi_tl, 'taksi_tl', 0, 1e9),
  };
  if (o.derece !== undefined && o.derece !== null && o.derece !== '') {
    out.derece = int(o.derece, 'derece', 1, 15);
  }
  if (o.gundelik_tl_override !== undefined && o.gundelik_tl_override !== null && o.gundelik_tl_override !== '') {
    out.gundelik_tl_override = num(o.gundelik_tl_override, 'gundelik_tl_override', 0, 1e6);
  }
  const ek = optEkBand(o.ek_gosterge_band);
  if (ek) out.ek_gosterge_band = ek;
  return out;
}

function parseSurekliBildirimMeta(v: unknown): SurekliBildirimMeta | undefined {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const out: SurekliBildirimMeta = {};
  const at = optStr(o.atama_tarihi, 48) || optStr(o['atamaTarihi'], 48);
  const av = optStr(o.avans_durumu, 400) || optStr(o['avansDurumu'], 400);
  const ea = optStr(o.es_ad_soyad, 200) || optStr(o['esAdSoyad'], 200);
  const eg = optStr(o.ek_gosterge_hucresi, 120) || optStr(o['ekGostergeHucresi'], 120);
  const kk = optStr(o.kadro_kademesi, 80) || optStr(o['kadroKademesi'], 80);
  const pdfDt = optStr(o.pdf_duzenleme_tarihi, 24) || optStr(o['pdfDuzenlemeTarihi'], 24);
  if (at) out.atama_tarihi = at;
  if (av) out.avans_durumu = av;
  if (ea) out.es_ad_soyad = ea;
  if (eg) out.ek_gosterge_hucresi = eg;
  if (kk) out.kadro_kademesi = kk;
  if (pdfDt) out.pdf_duzenleme_tarihi = pdfDt;
  const ca = o.cocuk_adlari;
  if (Array.isArray(ca)) {
    const names = ca.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 5);
    if (names.length) out.cocuk_adlari = names;
  }
  return Object.keys(out).length ? out : undefined;
}

function optBool(v: unknown, key: string): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'evet') return true;
  if (s === 'false' || s === '0' || s === 'hayir' || s === 'hayır') return false;
  throw new BadRequestException({ code: 'INVALID_FIELD', message: `${key}: boolean veya evet/hayir.` });
}

function optSurekli(
  o: Record<string, unknown>,
): Pick<
  SurekliInputs,
  | 'derece'
  | 'gundelik_tl_override'
  | 'eski_mahal'
  | 'yeni_mahal'
  | 'ek_gosterge_band'
  | 'rayic_ucreti_tl'
  | 'es_dahil'
  | 'cocuk_dahil_adet'
  | 'bildirim_meta'
> {
  const out: Pick<
    SurekliInputs,
    | 'derece'
    | 'gundelik_tl_override'
    | 'eski_mahal'
    | 'yeni_mahal'
    | 'ek_gosterge_band'
    | 'rayic_ucreti_tl'
    | 'es_dahil'
    | 'cocuk_dahil_adet'
    | 'bildirim_meta'
  > = {};
  if (o.derece !== undefined && o.derece !== null && o.derece !== '') {
    out.derece = int(o.derece, 'derece', 1, 15);
  }
  if (o.gundelik_tl_override !== undefined && o.gundelik_tl_override !== null && o.gundelik_tl_override !== '') {
    out.gundelik_tl_override = num(o.gundelik_tl_override, 'gundelik_tl_override', 0, 1e6);
  }
  const ek = optEkBand(o.ek_gosterge_band);
  if (ek) out.ek_gosterge_band = ek;
  const em = optStr(o.eski_mahal, 256);
  const ym = optStr(o.yeni_mahal, 256);
  if (em) out.eski_mahal = em;
  if (ym) out.yeni_mahal = ym;
  if (o.rayic_ucreti_tl !== undefined && o.rayic_ucreti_tl !== null && o.rayic_ucreti_tl !== '') {
    out.rayic_ucreti_tl = num(o.rayic_ucreti_tl, 'rayic_ucreti_tl', 0, 1e6);
  }
  const esb = optBool(o.es_dahil, 'es_dahil');
  if (esb !== undefined) out.es_dahil = esb;
  if (o.cocuk_dahil_adet !== undefined && o.cocuk_dahil_adet !== null && o.cocuk_dahil_adet !== '') {
    out.cocuk_dahil_adet = int(o.cocuk_dahil_adet, 'cocuk_dahil_adet', 0, 5);
  }
  const bm = parseSurekliBildirimMeta(o.bildirim_meta);
  if (bm) out.bildirim_meta = bm;
  return out;
}

function parseYevmiyeKodu(v: unknown, key: string): 1 | 2 | 3 | 4 | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n =
    typeof v === 'number' && Number.isFinite(v)
      ? Math.floor(v)
      : typeof v === 'string' && String(v).trim() !== ''
        ? parseInt(String(v).trim(), 10)
        : NaN;
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  throw new BadRequestException({ code: 'INVALID_FIELD', message: `${key}: yevmiye_kodu 1–4 veya boş.` });
}

function parseKonaklamaBeyan(v: unknown): 'hayir' | 'evet' | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim().toLowerCase();
  if (s === 'hayir' || s === 'hayır') return 'hayir';
  if (s === 'evet') return 'evet';
  throw new BadRequestException({
    code: 'INVALID_FIELD',
    message: 'bildirim.konaklama_beyan: hayir veya evet.',
  });
}

/** bildirim.pdf_duzenleme_tarihi — YYYY-MM-DD veya Gün.Ay.Yıl → YYYY-MM-DD */
function parseGeciciBildirimPdfDate(o: Record<string, unknown>): string | undefined {
  const s = optStr(o.pdf_duzenleme_tarihi, 24)?.trim() || optStr(o['pdfDuzenlemeTarihi'], 24)?.trim();
  if (!s) return undefined;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const y = +iso[1];
    const mo = +iso[2];
    const da = +iso[3];
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) {
      throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim.pdf_duzenleme_tarihi geçersiz.' });
    }
    return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  const tr = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (tr) {
    const da = +tr[1];
    const mo = +tr[2];
    const y = +tr[3];
    const d = new Date(y, mo - 1, da);
    if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) {
      throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim.pdf_duzenleme_tarihi geçersiz.' });
    }
    return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
  }
  throw new BadRequestException({
    code: 'INVALID_FIELD',
    message: 'bildirim.pdf_duzenleme_tarihi: YYYY-MM-DD veya GG.AA.YYYY.',
  });
}

function parseBildirim(v: unknown): GeciciBildirimMeta | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) {
    throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim nesnesi bekleniyor.' });
  }
  const o = v as Record<string, unknown>;
  let kapsam: 'yurtici' | 'yurtdisi';
  if (o.kapsam === 'yurtdisi') kapsam = 'yurtdisi';
  else if (o.kapsam === undefined || o.kapsam === null || o.kapsam === '' || o.kapsam === 'yurtici') kapsam = 'yurtici';
  else {
    throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim.kapsam: yurtici veya yurtdisi.' });
  }
  const kb = parseKonaklamaBeyan(o.konaklama_beyan);
  const pdfIn = ((optStr(o.pdf_duzenleme_tarihi, 24) || optStr(o['pdfDuzenlemeTarihi'], 24)) ?? '').trim();
  const pdfDt = pdfIn ? parseGeciciBildirimPdfDate(o) : undefined;
  let ibanOut: string | undefined;
  if (o.iban != null && String(o.iban).trim() !== '') {
    const ib = String(o.iban).replace(/\s/g, '').toUpperCase().slice(0, 34);
    if (!/^[A-Z0-9]+$/.test(ib)) {
      throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim.iban yalnızca harf ve rakam içermeli.' });
    }
    ibanOut = ib;
  }
  const kk = optStr(o.kadro_kademesi, 80) || optStr(o['kadroKademesi'], 80);
  const tcDigits = (() => {
    const t = optStr(o.tc_kimlik, 24);
    if (!t) return undefined;
    const d = t.replace(/\D/g, '').slice(0, 11);
    return d.length ? d : undefined;
  })();

  const rowsRaw = o.rows;
  if (rowsRaw !== undefined && rowsRaw !== null && !Array.isArray(rowsRaw)) {
    throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim.rows dizi olmalı.' });
  }
  const rowsArr: unknown[] = rowsRaw === undefined || rowsRaw === null ? [] : rowsRaw;
  if (rowsArr.length > 25) {
    throw new BadRequestException({ code: 'INVALID_FIELD', message: 'bildirim: en fazla 25 satır.' });
  }
  const rows: GeciciBildirimRowInput[] = [];
  for (let i = 0; i < rowsArr.length; i++) {
    const e = rowsArr[i];
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
      throw new BadRequestException({ code: 'INVALID_FIELD', message: `bildirim.rows[${i}] geçersiz.` });
    }
    const er = e as Record<string, unknown>;
    const gun_sayisi =
      er.gun_sayisi === undefined || er.gun_sayisi === null || er.gun_sayisi === ''
        ? 0
        : int(er.gun_sayisi, `bildirim.rows[${i}].gun_sayisi`, 0, 999);
    const kod = parseYevmiyeKodu(er.yevmiye_kodu, `bildirim.rows[${i}].yevmiye_kodu`);
    const hasPayField = er.yevmiye_payi !== undefined && er.yevmiye_payi !== null && er.yevmiye_payi !== '';
    if (gun_sayisi > 0 && kod == null && !hasPayField) {
      throw new BadRequestException({
        code: 'INVALID_FIELD',
        message: `bildirim.rows[${i}]: yevmiye_kodu veya yevmiye_payi gerekli.`,
      });
    }
    const tasit_ucret_tl =
      er.tasit_ucret_tl === undefined || er.tasit_ucret_tl === null || er.tasit_ucret_tl === ''
        ? 0
        : num(er.tasit_ucret_tl, `bildirim.rows[${i}].tasit_ucret_tl`, 0, 1e9);
    const doviz_cinsi_tl =
      er.doviz_cinsi_tl === undefined || er.doviz_cinsi_tl === null || er.doviz_cinsi_tl === ''
        ? 0
        : num(er.doviz_cinsi_tl, `bildirim.rows[${i}].doviz_cinsi_tl`, 0, 1e9);
    const base: GeciciBildirimRowInput = {
      tarih: optStr(er.tarih, 48),
      yer: optStr(er.yer, 400),
      gidis_saat: optStr(er.gidis_saat, 16),
      donus_saat: optStr(er.donus_saat, 16),
      gun_sayisi,
      tasit_tip: optStr(er.tasit_tip, 64),
      tasit_ucret_tl,
      doviz_cinsi_tl,
      yer_from_il: optStr(er.yer_from_il, 48),
      yer_from_ilce: optStr(er.yer_from_ilce, 64),
      yer_to_il: optStr(er.yer_to_il, 48),
      yer_to_ilce: optStr(er.yer_to_ilce, 64),
    };
    if (kod != null) rows.push({ ...base, yevmiye_kodu: kod });
    else {
      const yevmiye_payi = hasPayField
        ? num(er.yevmiye_payi, `bildirim.rows[${i}].yevmiye_payi`, 0, 1)
        : 0;
      rows.push({ ...base, yevmiye_payi });
    }
  }
  const meaningful = rows.some((r) => {
    const payOk =
      r.yevmiye_kodu != null ||
      (r.yevmiye_payi != null && Number.isFinite(r.yevmiye_payi) && r.yevmiye_payi > 0);
    return r.gun_sayisi > 0 && payOk;
  });
  const hasHeader =
    !!optStr(o.ad_soyad, 200) ||
    !!optStr(o.unvan, 120) ||
    !!tcDigits ||
    !!ibanOut ||
    !!kk ||
    !!optStr(o.dairesi, 200) ||
    !!optStr(o.birim_yetkilisi_unvan, 120) ||
    !!optStr(o.gorev_yeri, 200) ||
    kb != null ||
    !!pdfIn;
  if (!meaningful && !hasHeader) return undefined;

  return {
    kapsam,
    ad_soyad: optStr(o.ad_soyad, 200),
    unvan: optStr(o.unvan, 120),
    ...(tcDigits ? { tc_kimlik: tcDigits } : {}),
    ...(ibanOut ? { iban: ibanOut } : {}),
    ...(kk ? { kadro_kademesi: kk } : {}),
    dairesi: optStr(o.dairesi, 200),
    birim_yetkilisi_unvan: optStr(o.birim_yetkilisi_unvan, 120),
    gorev_yeri: optStr(o.gorev_yeri, 200),
    ...(kb ? { konaklama_beyan: kb } : {}),
    ...(pdfDt ? { pdf_duzenleme_tarihi: pdfDt } : {}),
    rows,
  };
}

function optEkBand(v: unknown): EkGostergeBand | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim();
  if (s === 'g8000_ust') return 'g8000_ust';
  if (s === 'g6400_8000') return 'g6400_8000';
  if (s === 'g3600_6400') return 'g3600_6400';
  if (s === 'alt3600') return 'alt3600';
  throw new BadRequestException({
    code: 'INVALID_FIELD',
    message: 'ek_gosterge_band: g8000_ust | g6400_8000 | g3600_6400 | alt3600',
  });
}

function parseYdm(v: unknown): 'tam' | 'yarim' {
  if (v === undefined || v === null || v === '') return 'tam';
  const s = String(v).trim().toLowerCase();
  if (s === 'tam' || s === '1' || s === 'full') return 'tam';
  if (s === 'yarim' || s === 'yarım' || s === '0.5' || s === 'half') return 'yarim';
  throw new BadRequestException({ code: 'INVALID_FIELD', message: 'ydm_km_mode: tam veya yarim.' });
}

function optStr(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

function num(v: unknown, key: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new BadRequestException({ code: 'INVALID_FIELD', message: `${key} geçersiz.` });
  }
  return n;
}

function int(v: unknown, key: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n) || n !== Math.floor(n) || n < min || n > max) {
    throw new BadRequestException({ code: 'INVALID_FIELD', message: `${key} geçersiz.` });
  }
  return n;
}
