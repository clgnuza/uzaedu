import { BadRequestException } from '@nestjs/common';
import type { GeciciInputs, SurekliInputs } from './yolluk-calculator.engine';

export function parseCalcInput(raw: unknown): GeciciInputs | SurekliInputs {
  if (!raw || typeof raw !== 'object') {
    throw new BadRequestException({ code: 'INVALID_INPUT', message: 'input gerekli.' });
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  if (kind === 'gecici') {
    return {
      kind: 'gecici',
      mission_days: num(o.mission_days, 'mission_days', 0, 1e6),
      yol_masrafi_tl: num(o.yol_masrafi_tl, 'yol_masrafi_tl', 0, 1e9),
      konaklama_tl: num(o.konaklama_tl, 'konaklama_tl', 0, 1e9),
      diger_tl: num(o.diger_tl, 'diger_tl', 0, 1e9),
      ...optGecici(o),
    };
  }
  if (kind === 'surekli') {
    return {
      kind: 'surekli',
      mesafe_km: num(o.mesafe_km, 'mesafe_km', 0, 2e4),
      aile_ferdi_sayisi: int(o.aile_ferdi_sayisi, 'aile_ferdi_sayisi', 0, 50),
      ydm_km_mode: parseYdm(o.ydm_km_mode),
      tasit_ucreti_tl: o.tasit_ucreti_tl === undefined ? 0 : num(o.tasit_ucreti_tl, 'tasit_ucreti_tl', 0, 1e9),
      ...optSurekli(o),
    };
  }
  throw new BadRequestException({ code: 'INVALID_KIND', message: 'kind: gecici veya surekli olmalı.' });
}

function optGecici(o: Record<string, unknown>): Pick<GeciciInputs, 'derece' | 'gundelik_tl_override' | 'tasit_ucreti_tl' | 'taksi_tl'> {
  const out: Pick<GeciciInputs, 'derece' | 'gundelik_tl_override' | 'tasit_ucreti_tl' | 'taksi_tl'> = {
    tasit_ucreti_tl: o.tasit_ucreti_tl === undefined ? 0 : num(o.tasit_ucreti_tl, 'tasit_ucreti_tl', 0, 1e9),
    taksi_tl: o.taksi_tl === undefined ? 0 : num(o.taksi_tl, 'taksi_tl', 0, 1e9),
  };
  if (o.derece !== undefined && o.derece !== null && o.derece !== '') {
    out.derece = int(o.derece, 'derece', 1, 15);
  }
  if (o.gundelik_tl_override !== undefined && o.gundelik_tl_override !== null && o.gundelik_tl_override !== '') {
    out.gundelik_tl_override = num(o.gundelik_tl_override, 'gundelik_tl_override', 0, 1e6);
  }
  return out;
}

function optSurekli(
  o: Record<string, unknown>,
): Pick<SurekliInputs, 'derece' | 'gundelik_tl_override' | 'eski_mahal' | 'yeni_mahal'> {
  const out: Pick<SurekliInputs, 'derece' | 'gundelik_tl_override' | 'eski_mahal' | 'yeni_mahal'> = {};
  if (o.derece !== undefined && o.derece !== null && o.derece !== '') {
    out.derece = int(o.derece, 'derece', 1, 15);
  }
  if (o.gundelik_tl_override !== undefined && o.gundelik_tl_override !== null && o.gundelik_tl_override !== '') {
    out.gundelik_tl_override = num(o.gundelik_tl_override, 'gundelik_tl_override', 0, 1e6);
  }
  const em = optStr(o.eski_mahal, 256);
  const ym = optStr(o.yeni_mahal, 256);
  if (em) out.eski_mahal = em;
  if (ym) out.yeni_mahal = ym;
  return out;
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
