import { BadRequestException } from '@nestjs/common';
import type { ParsedPlanRow } from '../meb/meb-fetch.service';
import type { KazanimEntry, KazanimPlanPayload, KazanimPlanScope } from './plan-import-parse';

type CalW = { weekOrder: number; isTatil: boolean; tatilLabel: string | null };

/** 1–36 arası öğretim haftaları; tatiller hariç. */
export function eligibleTeachingWeekOrders(cal: CalW[]): number[] {
  const sorted = [...cal].filter((w) => w.weekOrder >= 1 && w.weekOrder <= 36).sort((a, b) => a.weekOrder - b.weekOrder);
  const orders = sorted.filter((w) => !w.isTatil).map((w) => w.weekOrder);
  return [...new Set(orders)].sort((a, b) => a - b);
}

export function splitTeachingWeeksByTerm(cal: CalW[]): {
  term1: number[];
  term2: number[];
  eligibleAll: number[];
} {
  const eligibleAll = eligibleTeachingWeekOrders(cal);
  const sorted = [...cal].filter((w) => w.weekOrder >= 1 && w.weekOrder <= 36).sort((a, b) => a.weekOrder - b.weekOrder);
  const yariBlocks = sorted.filter((w) => {
    if (!w.isTatil) return false;
    const t = (w.tatilLabel ?? '').toLowerCase();
    return t.includes('yarıyıl') || t.includes('yariyil') || t.includes('kis') || t.includes('kış');
  });
  if (!yariBlocks.length) {
    const mid = Math.ceil(eligibleAll.length / 2) || 1;
    return { term1: eligibleAll.slice(0, mid), term2: eligibleAll.slice(mid), eligibleAll };
  }
  const minY = Math.min(...yariBlocks.map((w) => w.weekOrder));
  const maxY = Math.max(...yariBlocks.map((w) => w.weekOrder));
  return {
    term1: eligibleAll.filter((w) => w < minY),
    term2: eligibleAll.filter((w) => w > maxY),
    eligibleAll,
  };
}

function pickScopeWeeks(scope: KazanimPlanScope, term1: number[], term2: number[], eligibleAll: number[]): number[] {
  if (scope === 'term1') return term1;
  if (scope === 'term2') return term2;
  return eligibleAll;
}

/** Kazanımları hedef öğretim haftalarına eşit böler. */
function distributeEntriesToWeeks(entries: KazanimEntry[], weekOrders: number[]): ParsedPlanRow[] {
  const weeks = [...new Set(weekOrders)].sort((a, b) => a - b);
  const n = weeks.length;
  const g = entries.length;
  if (!n) {
    throw new BadRequestException({
      code: 'NO_TEACHING_WEEKS',
      message: 'Çalışma takviminde öğretim haftası bulunamadı (tatil dışı 1–36). Takvimi kontrol edin.',
    });
  }
  const out: ParsedPlanRow[] = [];
  let gi = 0;
  let remE = g;
  let remW = n;
  for (const wo of weeks) {
    const take = remW > 0 ? Math.ceil(remE / remW) : 0;
    const slice = entries.slice(gi, gi + take);
    gi += take;
    remE -= take;
    remW -= 1;
    const kazanimlar =
      slice.length > 0
        ? slice.map((s) => s.kazanimlar.trim()).filter(Boolean).join('\n\n')
        : 'Önceki kazanımların pekiştirilmesi ve uygulama.';
    const unite = slice.find((s) => String(s.unite ?? '').trim())?.unite?.trim() || null;
    const konu = slice.find((s) => String(s.konu ?? '').trim())?.konu?.trim() || null;
    out.push({
      week_order: wo,
      unite,
      konu,
      kazanimlar,
      ders_saati: 2,
      belirli_gun_haftalar: null,
    });
  }
  return out;
}

/**
 * Seçilen kazanımları çalışma takvimindeki döneme yayar; diğer öğretim haftalarına yer tutucu yazar.
 */
export function buildParsedRowsFromKazanimPlan(plan: KazanimPlanPayload, cal: CalW[]): ParsedPlanRow[] {
  const { term1, term2, eligibleAll } = splitTeachingWeeksByTerm(cal);
  const scopeWeeks = pickScopeWeeks(plan.scope, term1, term2, eligibleAll);
  if (!scopeWeeks.length) {
    throw new BadRequestException({
      code: 'SCOPE_EMPTY',
      message: 'Seçilen dönem için öğretim haftası yok (çalışma takvimi / yarıyıl ayrımı).',
    });
  }
  const filled = distributeEntriesToWeeks(plan.entries, scopeWeeks);
  const byWeek = new Map(filled.map((r) => [r.week_order, r]));
  const defU = plan.default_unite?.trim() || null;
  const out: ParsedPlanRow[] = [];
  for (const wo of eligibleAll) {
    const hit = byWeek.get(wo);
    if (hit) {
      out.push({
        ...hit,
        unite: hit.unite?.trim() || defU || null,
        belirli_gun_haftalar: hit.belirli_gun_haftalar ?? null,
      });
    } else {
      out.push({
        week_order: wo,
        unite: defU || '—',
        konu: 'Seçilen dönem dışı (içerik girilmesi bekleniyor).',
        kazanimlar: 'Henüz planlanmadı.',
        ders_saati: 2,
        belirli_gun_haftalar: null,
      });
    }
  }
  return out.sort((a, b) => a.week_order - b.week_order);
}
