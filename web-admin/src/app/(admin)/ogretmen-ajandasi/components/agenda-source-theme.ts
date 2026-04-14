/**
 * Takvim / ajanda — Kişisel · Okul · Platform renkleri birbirinden ve takvim vurgularından ayrık.
 * Kişisel: violet | Okul: sky | Platform: amber
 */
export const AGENDA_SOURCE_KEYS = ['PERSONAL', 'SCHOOL', 'PLATFORM'] as const;

export type AgendaSourceKey = (typeof AGENDA_SOURCE_KEYS)[number];

export const AGENDA_SOURCE_THEME: Record<
  AgendaSourceKey,
  {
    label: string;
    shortLabel: string;
    /** Takvim hücresindeki etkinlik kartı */
    chip: string;
    /** Filtre segmenti — seçili değil */
    filterIdle: string;
    /** Filtre segmenti — seçili */
    filterActive: string;
    /** Lejant noktası */
    legendDot: string;
    /** Detay modal kart şeridi */
    modalCard: string;
    modalBadge: string;
  }
> = {
  PERSONAL: {
    label: 'Kişisel',
    shortLabel: 'Kş.',
    chip:
      'border-l-[4px] border-l-violet-600 bg-violet-500/[0.14] text-violet-950 shadow-sm ring-1 ring-inset ring-violet-500/25 dark:border-l-violet-400 dark:bg-violet-950/40 dark:text-violet-50 dark:ring-violet-400/20',
    filterIdle:
      'border border-violet-200/70 bg-violet-500/10 text-violet-900 hover:bg-violet-500/16 dark:border-violet-800/60 dark:bg-violet-950/35 dark:text-violet-100',
    filterActive:
      'border border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-600/25 dark:border-violet-500 dark:bg-violet-600',
    legendDot: 'bg-violet-500 shadow-sm ring-1 ring-violet-600/30 dark:bg-violet-400',
    modalCard: 'bg-violet-500/10 border-l-4 border-l-violet-600 dark:bg-violet-950/40 dark:border-l-violet-400',
    modalBadge: 'bg-violet-500/20 text-violet-800 dark:bg-violet-500/25 dark:text-violet-100',
  },
  SCHOOL: {
    label: 'Okul',
    shortLabel: 'Okul',
    chip:
      'border-l-[4px] border-l-sky-600 bg-sky-500/[0.14] text-sky-950 shadow-sm ring-1 ring-inset ring-sky-500/25 dark:border-l-sky-400 dark:bg-sky-950/40 dark:text-sky-50 dark:ring-sky-400/20',
    filterIdle:
      'border border-sky-200/80 bg-sky-500/10 text-sky-950 hover:bg-sky-500/16 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100',
    filterActive:
      'border border-sky-600 bg-sky-600 text-white shadow-md shadow-sky-600/25 dark:border-sky-500 dark:bg-sky-600',
    legendDot: 'bg-sky-500 shadow-sm ring-1 ring-sky-600/30 dark:bg-sky-400',
    modalCard: 'bg-sky-500/10 border-l-4 border-l-sky-600 dark:bg-sky-950/40 dark:border-l-sky-400',
    modalBadge: 'bg-sky-500/20 text-sky-800 dark:bg-sky-500/25 dark:text-sky-100',
  },
  PLATFORM: {
    label: 'Platform',
    shortLabel: 'Plt.',
    chip:
      'border-l-[4px] border-l-amber-600 bg-amber-500/[0.16] text-amber-950 shadow-sm ring-1 ring-inset ring-amber-500/30 dark:border-l-amber-400 dark:bg-amber-950/35 dark:text-amber-50 dark:ring-amber-400/25',
    filterIdle:
      'border border-amber-200/80 bg-amber-500/10 text-amber-950 hover:bg-amber-500/16 dark:border-amber-800/55 dark:bg-amber-950/35 dark:text-amber-100',
    filterActive:
      'border border-amber-600 bg-amber-600 text-white shadow-md shadow-amber-600/25 dark:border-amber-500 dark:bg-amber-600',
    legendDot: 'bg-amber-500 shadow-sm ring-1 ring-amber-600/35 dark:bg-amber-400',
    modalCard: 'bg-amber-500/10 border-l-4 border-l-amber-600 dark:bg-amber-950/35 dark:border-l-amber-400',
    modalBadge: 'bg-amber-500/20 text-amber-900 dark:bg-amber-500/25 dark:text-amber-100',
  },
};

const FALLBACK_CHIP =
  'border-l-[4px] border-l-zinc-400 bg-zinc-500/10 text-foreground shadow-sm ring-1 ring-inset ring-zinc-500/15 dark:border-l-zinc-500 dark:bg-zinc-900/40';

export function agendaEventChipClass(source: string): string {
  if (source === 'PERSONAL' || source === 'SCHOOL' || source === 'PLATFORM') {
    return AGENDA_SOURCE_THEME[source].chip;
  }
  return FALLBACK_CHIP;
}

/** Nöbet / ders programı kartları kaynak renginden ayrılsın (mobil takvim) */
const DUTY_CHIP =
  'border-l-[4px] border-l-orange-600 bg-orange-500/[0.16] text-orange-950 shadow-sm ring-1 ring-inset ring-orange-500/25 dark:border-l-orange-400 dark:bg-orange-950/45 dark:text-orange-50 dark:ring-orange-400/20';
const TIMETABLE_CHIP =
  'border-l-[4px] border-l-emerald-600 bg-emerald-500/[0.14] text-emerald-950 shadow-sm ring-1 ring-inset ring-emerald-500/25 dark:border-l-emerald-400 dark:bg-emerald-950/45 dark:text-emerald-50 dark:ring-emerald-400/20';

export function agendaEventChipClassForEvent(ev: { type: string; source: string }): string {
  if (ev.type === 'duty') return DUTY_CHIP;
  if (ev.type === 'timetable') return TIMETABLE_CHIP;
  return agendaEventChipClass(ev.source);
}

export const AGENDA_TYPE_MODAL_THEME: Record<
  string,
  { card: string; badge: string } | undefined
> = {
  duty: {
    card: 'bg-orange-500/10 border-l-4 border-l-orange-600 dark:bg-orange-950/40 dark:border-l-orange-400',
    badge: 'bg-orange-500/20 text-orange-900 dark:bg-orange-500/25 dark:text-orange-100',
  },
  timetable: {
    card: 'bg-emerald-500/10 border-l-4 border-l-emerald-600 dark:bg-emerald-950/40 dark:border-l-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-900 dark:bg-emerald-500/25 dark:text-emerald-100',
  },
};
