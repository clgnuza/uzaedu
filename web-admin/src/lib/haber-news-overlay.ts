/** Kurum şeritleri + başlık bölme — Haberler / Yayın ortak. */

export const REFERENCE_BANDS = {
  top: 'bg-yellow-400 text-neutral-900',
  bottom: 'bg-red-600 text-white',
} as const;

export const SOURCE_BANDS: Record<string, { top: string; bottom: string }> = {
  meb: REFERENCE_BANDS,
  meb_haber: REFERENCE_BANDS,
  meb_duyuru: REFERENCE_BANDS,
  personel_gm: { top: 'bg-blue-700 text-white', bottom: 'bg-slate-950 text-white' },
  tegm: { top: 'bg-cyan-400 text-cyan-950', bottom: 'bg-cyan-900 text-cyan-50' },
  ogm: { top: 'bg-indigo-500 text-white', bottom: 'bg-indigo-950 text-indigo-100' },
  yegitek: { top: 'bg-violet-400 text-violet-950', bottom: 'bg-violet-900 text-violet-50' },
  orgm: { top: 'bg-emerald-400 text-emerald-950', bottom: 'bg-emerald-900 text-white' },
  ttkb: { top: 'bg-amber-400 text-amber-950', bottom: 'bg-amber-900 text-amber-50' },
  odsgm: { top: 'bg-orange-400 text-orange-950', bottom: 'bg-orange-800 text-orange-50' },
  il_meb: { top: 'bg-teal-400 text-teal-950', bottom: 'bg-teal-800 text-white' },
  bbc_turkce: { top: 'bg-zinc-800 text-white', bottom: 'bg-red-700 text-white' },
  dw_turkce: { top: 'bg-blue-600 text-white', bottom: 'bg-slate-900 text-slate-100' },
  aa_egitim: { top: 'bg-rose-500 text-white', bottom: 'bg-rose-950 text-rose-50' },
  dogm: { top: 'bg-slate-500 text-white', bottom: 'bg-slate-900 text-slate-100' },
  mtegm: { top: 'bg-sky-400 text-sky-950', bottom: 'bg-sky-900 text-white' },
  sgb: { top: 'bg-zinc-600 text-white', bottom: 'bg-zinc-900 text-zinc-100' },
  akademi: { top: 'bg-purple-500 text-white', bottom: 'bg-purple-950 text-purple-100' },
  yyegm: { top: 'bg-green-500 text-white', bottom: 'bg-green-900 text-green-50' },
};

export const BANDS_FALLBACK: { top: string; bottom: string }[] = [
  REFERENCE_BANDS,
  { top: 'bg-sky-400 text-sky-950', bottom: 'bg-blue-800 text-white' },
  { top: 'bg-fuchsia-400 text-fuchsia-950', bottom: 'bg-fuchsia-900 text-fuchsia-50' },
  { top: 'bg-lime-400 text-lime-950', bottom: 'bg-lime-800 text-lime-50' },
  { top: 'bg-indigo-400 text-indigo-950', bottom: 'bg-indigo-900 text-indigo-50' },
  { top: 'bg-pink-400 text-pink-950', bottom: 'bg-pink-900 text-pink-50' },
];

function hashMod(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % mod;
}

export function overlayBandsForSource(
  sourceKey: string | undefined,
  sourceLabel: string | undefined,
): { top: string; bottom: string } {
  const k = (sourceKey || '').trim().toLowerCase();
  if (k && SOURCE_BANDS[k]) return SOURCE_BANDS[k]!;
  if (k.startsWith('il_')) return SOURCE_BANDS.il_meb!;
  const seed = k || (sourceLabel || 'x').trim().toLowerCase();
  return BANDS_FALLBACK[hashMod(seed, BANDS_FALLBACK.length)]!;
}

export function splitTitleForOverlay(title: string): { line1: string; line2: string } {
  const t = title.trim();
  if (!t) return { line1: '', line2: '' };
  const byColon = t.split(/:\s*/);
  if (byColon.length >= 2 && byColon[0]!.length >= 6) {
    return { line1: byColon[0]!.trim(), line2: byColon.slice(1).join(': ').trim() };
  }
  const byDash = t.split(/\s+[–—-]\s+/);
  if (byDash.length >= 2) {
    return { line1: byDash[0]!.trim(), line2: byDash.slice(1).join(' – ').trim() };
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { line1: t, line2: '' };
  const mid = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, mid).join(' '),
    line2: words.slice(mid).join(' '),
  };
}

export function overlayUpper(s: string): string {
  return s.toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ').trim();
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  announcement: 'Duyuru',
  news: 'Haber',
  competition: 'Yarışma',
  exam: 'Sınav',
  project: 'Proje',
  event: 'Etkinlik',
  document: 'Belge',
};

/** Haberler içerik türü filtresi (sıra sabit) */
export const CONTENT_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tüm Türler' },
  { value: 'announcement', label: 'Duyuru' },
  { value: 'news', label: 'Haber' },
  { value: 'competition', label: 'Yarışma' },
  { value: 'exam', label: 'Sınav' },
  { value: 'project', label: 'Proje' },
  { value: 'event', label: 'Etkinlik' },
  { value: 'document', label: 'Belge' },
];

const CONTENT_TYPE_FILTER_VALUES = new Set(
  CONTENT_TYPE_FILTER_OPTIONS.map((o) => o.value).filter(Boolean),
);

export function normalizeContentTypeFilterParam(raw: string | null): string {
  if (raw == null || raw === '') return '';
  return CONTENT_TYPE_FILTER_VALUES.has(raw) ? raw : '';
}

export const CONTENT_TYPE_CHIP: Record<string, string> = {
  announcement: 'bg-amber-500/12 text-amber-800 dark:text-amber-200',
  news: 'bg-sky-500/12 text-sky-800 dark:text-sky-200',
  competition: 'bg-violet-500/12 text-violet-800 dark:text-violet-200',
  exam: 'bg-rose-500/12 text-rose-800 dark:text-rose-200',
  project: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200',
  event: 'bg-orange-500/12 text-orange-800 dark:text-orange-200',
  document: 'bg-slate-500/12 text-slate-700 dark:text-slate-300',
};
