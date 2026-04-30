import { getAyForWeek } from '../config/meb-calendar';

const TR_MONTHS = [
  'EYLÜL',
  'EKİM',
  'KASIM',
  'ARALIK',
  'OCAK',
  'ŞUBAT',
  'MART',
  'NİSAN',
  'MAYIS',
  'HAZİRAN',
  'TEMMUZ',
  'AĞUSTOS',
] as const;

/** hafta_label (ör. "4. Hafta: 29 EYLÜL - 3 EKİM") metninden ay; çift ayda sondaki (Cuma) ayı alır. */
export function inferAyFromHaftaLabel(haftaLabel: string | null | undefined): string {
  if (!haftaLabel?.trim()) return '';
  const u = haftaLabel.toLocaleUpperCase('tr-TR');
  const hits: { name: string; index: number }[] = [];
  for (const m of TR_MONTHS) {
    const idx = u.indexOf(m);
    if (idx >= 0) hits.push({ name: m, index: idx });
  }
  if (hits.length === 0) return '';
  hits.sort((a, b) => a.index - b.index);
  const uniq: string[] = [];
  for (const h of hits) {
    if (!uniq.includes(h.name)) uniq.push(h.name);
  }
  if (uniq.length === 0) return '';
  if (uniq.length === 1) return uniq[0] ?? '';
  return uniq[uniq.length - 1] ?? '';
}

export function resolveAyForYillikPlanRow(params: {
  haftaLabel: string;
  calendarAy?: string | null;
  weekOrder: number;
  academicYear?: string | null;
}): string {
  const fromLabel = inferAyFromHaftaLabel(params.haftaLabel);
  if (fromLabel) return fromLabel;
  const cal = (params.calendarAy ?? '').trim();
  if (cal) return cal;
  if (params.academicYear?.trim()) {
    const m = getAyForWeek(params.academicYear.trim(), params.weekOrder);
    if (m) return m;
  }
  if (params.weekOrder >= 37 && params.weekOrder <= 38) return 'HAZİRAN';
  return '';
}
