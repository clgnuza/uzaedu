import { BadRequestException } from '@nestjs/common';
import type { ParsedPlanRow } from '../meb/meb-fetch.service';

function stripBom(s: string): string {
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function toNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function rowFromRecord(o: Record<string, unknown>): ParsedPlanRow | null {
  const keys = Object.keys(o);
  const lower = new Map(keys.map((k) => [k.toLowerCase().trim(), o[k]]));
  const pick = (...names: string[]): unknown => {
    for (const n of names) {
      const v = lower.get(n.toLowerCase());
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    for (const k of keys) {
      if (normHeader(k) === normHeader(names[0] ?? '')) return o[k];
    }
    return undefined;
  };
  const wo = toNum(
    pick('week_order', 'weekorder', 'hafta', 'week', 'hafta_no', 'haftano', 'sira', 'sıra'),
    NaN,
  );
  if (!Number.isFinite(wo) || wo < 1 || wo > 40) return null;
  const ds = toNum(pick('ders_saati', 'ders saati', 'saat', 'hours'), 2);
  return {
    week_order: Math.round(wo),
    unite: str(pick('unite', 'ünite', 'unit', 'tema', 'theme')),
    konu: str(pick('konu', 'topic', 'icerik', 'içerik')),
    kazanimlar: str(
      pick(
        'kazanimlar',
        'kazanımlar',
        'kazanim',
        'ogrenme_ciktilari',
        'ogrenme ciktilari',
        'öğrenme çıktıları',
        'outcomes',
      ),
    ),
    ders_saati: Number.isFinite(ds) && ds >= 0 ? Math.round(ds) : 2,
    belirli_gun_haftalar: str(pick('belirli_gun_haftalar', 'belirli gün ve haftalar', 'belirli gun')),
    surec_bilesenleri: str(pick('surec_bilesenleri', 'süreç bileşenleri', 'surec')),
    olcme_degerlendirme: str(pick('olcme_degerlendirme', 'ölçme ve değerlendirme', 'olcme')),
    sosyal_duygusal: str(pick('sosyal_duygusal', 'sosyal duygusal')),
    degerler: str(pick('degerler', 'değerler')),
    okuryazarlik_becerileri: str(pick('okuryazarlik_becerileri', 'okuryazarlık')),
    zenginlestirme: str(pick('zenginlestirme', 'farklılaştırma')),
    okul_temelli_planlama: str(pick('okul_temelli_planlama', 'okul temelli')),
  };
}

function extractArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    for (const k of ['items', 'haftalar', 'weeks', 'rows', 'plan', 'data']) {
      const v = o[k];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

function parseCsv(payload: string): ParsedPlanRow[] {
  const lines = payload
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new BadRequestException({ code: 'CSV_EMPTY', message: 'CSV en az başlık + 1 veri satırı olmalıdır.' });
  }
  const first = lines[0]!;
  const semi = (first.match(/;/g) ?? []).length;
  const comma = (first.match(/,/g) ?? []).length;
  const sep = semi >= comma ? ';' : ',';
  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (c === '"') {
        q = !q;
        continue;
      }
      if (!q && c === sep) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out.map((c) => c.replace(/^"|"$/g, '').trim());
  };
  const headers = splitLine(first).map(normHeader);
  const idx = (name: string, ...aliases: string[]) => {
    const want = [name, ...aliases].map(normHeader);
    const j = headers.findIndex((h) => want.includes(h));
    return j;
  };
  const colWeek =
    idx('week_order', 'hafta', 'week', 'haftano', 'sira', 'sıra') >= 0
      ? idx('week_order', 'hafta', 'week', 'haftano', 'sira', 'sıra')
      : 0;
  const colUnite = idx('unite', 'ünite', 'tema', 'unit');
  const colKonu = idx('konu', 'topic', 'icerik', 'içerik');
  const colKaz = idx(
    'kazanimlar',
    'kazanımlar',
    'kazanim',
    'ogrenme_ciktilari',
    'ogrenme ciktilari',
    'öğrenme çıktıları',
  );
  const colSaat = idx('ders_saati', 'ders saati', 'saat');
  const colSurec = idx('surec_bilesenleri', 'süreç bileşenleri', 'surec');
  const colOlcme = idx('olcme_degerlendirme', 'ölçme ve değerlendirme', 'olcme');
  const colSos = idx('sosyal_duygusal', 'sosyal duygusal');
  const colDeger = idx('degerler', 'değerler');
  const colOkur = idx('okuryazarlik_becerileri', 'okuryazarlık');
  const colZeng = idx('zenginlestirme', 'farklılaştırma');
  const colOkul = idx('okul_temelli_planlama', 'okul temelli');
  const colBel = idx('belirli_gun_haftalar', 'belirli gün ve haftalar');
  if (colWeek < 0) {
    throw new BadRequestException({
      code: 'CSV_NO_WEEK',
      message: 'CSV başlığında hafta sütunu bulunamadı (week_order, hafta, week…).',
    });
  }
  const rows: ParsedPlanRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = splitLine(lines[li]!);
    const o: Record<string, unknown> = {};
    const set = (ci: number, key: string) => {
      if (ci >= 0 && ci < cells.length) o[key] = cells[ci];
    };
    set(colWeek, 'week_order');
    if (colUnite >= 0) set(colUnite, 'unite');
    if (colKonu >= 0) set(colKonu, 'konu');
    if (colKaz >= 0) set(colKaz, 'kazanimlar');
    if (colSaat >= 0) set(colSaat, 'ders_saati');
    if (colSurec >= 0) set(colSurec, 'surec_bilesenleri');
    if (colOlcme >= 0) set(colOlcme, 'olcme_degerlendirme');
    if (colSos >= 0) set(colSos, 'sosyal_duygusal');
    if (colDeger >= 0) set(colDeger, 'degerler');
    if (colOkur >= 0) set(colOkur, 'okuryazarlik_becerileri');
    if (colZeng >= 0) set(colZeng, 'zenginlestirme');
    if (colOkul >= 0) set(colOkul, 'okul_temelli_planlama');
    if (colBel >= 0) set(colBel, 'belirli_gun_haftalar');
    const r = rowFromRecord(o);
    if (r) rows.push(r);
  }
  return rows;
}

/**
 * JSON dizi / { items: [] } veya UTF-8 CSV (hafta;ünite;konu;…).
 */
export function parsePlanPastePayload(payload: string): { rows: ParsedPlanRow[]; detected: 'json' | 'csv' } {
  const raw = stripBom(String(payload ?? '').trim());
  if (!raw) {
    throw new BadRequestException({ code: 'PASTE_EMPTY', message: 'JSON veya CSV metni boş.' });
  }
  const looksJson = raw.startsWith('{') || raw.startsWith('[');
  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new BadRequestException({ code: 'JSON_PARSE', message: 'JSON ayrıştırılamadı. Virgül/köşeli parantezleri kontrol edin.' });
    }
    const arr = extractArray(parsed);
    if (!arr?.length) {
      throw new BadRequestException({
        code: 'JSON_NO_ARRAY',
        message: 'JSON kökünde dizi veya items/haftalar/weeks dizisi bulunamadı.',
      });
    }
    const rows: ParsedPlanRow[] = [];
    for (const el of arr) {
      if (!el || typeof el !== 'object') continue;
      const r = rowFromRecord(el as Record<string, unknown>);
      if (r) rows.push(r);
    }
    if (!rows.length) {
      throw new BadRequestException({ code: 'JSON_NO_ROWS', message: 'Geçerli hafta satırı çıkarılamadı (week_order 1-38).' });
    }
    return { rows, detected: 'json' };
  }
  return { rows: parseCsv(raw), detected: 'csv' };
}
