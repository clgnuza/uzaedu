import { BadRequestException } from '@nestjs/common';
import type { ParsedPlanRow } from '../meb/meb-fetch.service';
import { parsePlanPastePayload } from './plan-paste-parser';

export type KazanimPlanScope = 'full_year' | 'term1' | 'term2';

export type KazanimEntry = { kazanimlar: string; unite?: string | null; konu?: string | null };

export type KazanimPlanPayload = {
  scope: KazanimPlanScope;
  default_unite?: string | null;
  entries: KazanimEntry[];
};

export type PlanImportResult =
  | { kind: 'week_rows'; rows: ParsedPlanRow[]; detected: 'json' | 'csv' }
  | { kind: 'kazanim_plan'; plan: KazanimPlanPayload };

function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function asKazanimEntry(v: unknown): KazanimEntry | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t ? { kazanimlar: t } : null;
  }
  if (typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const k =
    String(o.kazanimlar ?? o.kazanımlar ?? o.text ?? o.metin ?? '').trim() ||
    String(o.kazanim ?? '').trim();
  if (!k) return null;
  const unite = o.unite != null ? String(o.unite).trim() || null : null;
  const konu = o.konu != null ? String(o.konu).trim() || null : null;
  return { kazanimlar: k, unite, konu };
}

function parseKazanimPlanJson(o: Record<string, unknown>): KazanimPlanPayload {
  const scopeRaw = String(o.scope ?? o.donem ?? 'full_year').trim().toLowerCase();
  const scope: KazanimPlanScope =
    scopeRaw === 'term1' || scopeRaw === 'donem1' || scopeRaw === '1'
      ? 'term1'
      : scopeRaw === 'term2' || scopeRaw === 'donem2' || scopeRaw === '2'
        ? 'term2'
        : 'full_year';
  const rawList = o.kazanimlar ?? o.items ?? o.kazanımlar;
  if (!Array.isArray(rawList) || rawList.length === 0) {
    throw new BadRequestException({
      code: 'KAZANIM_LIST_EMPTY',
      message: 'kazanim_plan için "kazanimlar" dizisi (en az 1 öğe) zorunludur.',
    });
  }
  const entries: KazanimEntry[] = [];
  for (const el of rawList) {
    const e = asKazanimEntry(el);
    if (e) entries.push(e);
  }
  if (!entries.length) {
    throw new BadRequestException({
      code: 'KAZANIM_LIST_INVALID',
      message: 'kazanimlar dizisinde geçerli kazanım metni yok.',
    });
  }
  const default_unite = o.default_unite != null ? String(o.default_unite).trim() || null : null;
  return { scope, entries, default_unite };
}

/**
 * Yıllık plan içe aktarma: haftalık satırlar (JSON dizi / CSV) veya { mode: "kazanim_plan", ... }.
 */
export function parsePlanImportPayload(payload: string): PlanImportResult {
  const raw = stripBom(String(payload ?? '').trim());
  if (!raw) {
    throw new BadRequestException({ code: 'IMPORT_EMPTY', message: 'JSON veya CSV metni boş.' });
  }
  const looksJson = raw.startsWith('{') || raw.startsWith('[');
  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new BadRequestException({ code: 'JSON_PARSE', message: 'JSON ayrıştırılamadı.' });
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>;
      if (String(o.mode ?? '').trim() === 'kazanim_plan') {
        return { kind: 'kazanim_plan', plan: parseKazanimPlanJson(o) };
      }
    }
  }
  const { rows, detected } = parsePlanPastePayload(payload);
  return { kind: 'week_rows', rows, detected };
}
