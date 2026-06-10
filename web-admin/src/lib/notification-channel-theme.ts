import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Banknote,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Gavel,
  GraduationCap,
  Headphones,
  LayoutGrid,
  Mail,
  Megaphone,
  MessageSquare,
  Monitor,
  Newspaper,
  Table2,
  Wallet,
} from 'lucide-react';

export type NotificationChannelId =
  | 'nobet'
  | 'ders_programi'
  | 'akilli_tahta'
  | 'sinav_gorevi'
  | 'sinav_modulleri'
  | 'destek'
  | 'ajanda'
  | 'bilsem'
  | 'belirli_gun'
  | 'mesaj_merkezi'
  | 'market'
  | 'yolluk'
  | 'okul_degerlendirme'
  | 'duyuru'
  | 'genel';

export type ChannelTheme = {
  id: NotificationChannelId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Kilit ekranı / sistem bildirimi */
  pushIcon: string;
  tileClass: string;
  iconClass: string;
  chipClass: string;
  rowAccent: string;
  cardRing: string;
  previewGradient: string;
};

const ICON_SM = 'size-[0.9375rem] sm:size-4';

export const CHANNEL_THEMES: Record<NotificationChannelId, ChannelTheme> = {
  nobet: {
    id: 'nobet',
    label: 'Nöbet',
    shortLabel: 'Nöbet',
    icon: CalendarClock,
    pushIcon: '/push-icons/nobet.png',
    tileClass:
      'bg-linear-to-br from-indigo-400/35 to-violet-500/30 text-indigo-950 ring-2 ring-indigo-400/50 shadow-sm dark:from-indigo-600/45 dark:to-violet-700/40 dark:text-indigo-50 dark:ring-indigo-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-indigo-300/50 bg-indigo-200/80 font-medium text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-900/45 dark:text-indigo-100',
    rowAccent: 'border-l-[3px] border-l-indigo-500 bg-indigo-50/35 dark:border-l-indigo-400 dark:bg-indigo-950/20',
    cardRing: 'ring-indigo-400/35',
    previewGradient: 'from-indigo-500 to-violet-600',
  },
  ders_programi: {
    id: 'ders_programi',
    label: 'Ders programı / müsaitlik',
    shortLabel: 'Program',
    icon: Table2,
    pushIcon: '/push-icons/ders_programi.png',
    tileClass:
      'bg-linear-to-br from-emerald-400/35 to-teal-500/30 text-emerald-950 ring-2 ring-emerald-400/50 shadow-sm dark:from-emerald-600/45 dark:to-teal-700/40 dark:text-emerald-50 dark:ring-emerald-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-emerald-300/50 bg-emerald-200/80 font-medium text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-900/45 dark:text-emerald-100',
    rowAccent: 'border-l-[3px] border-l-emerald-500 bg-emerald-50/35 dark:border-l-emerald-400 dark:bg-emerald-950/20',
    cardRing: 'ring-emerald-400/35',
    previewGradient: 'from-emerald-500 to-teal-600',
  },
  akilli_tahta: {
    id: 'akilli_tahta',
    label: 'Akıllı tahta',
    shortLabel: 'Tahta',
    icon: Monitor,
    pushIcon: '/push-icons/akilli_tahta.png',
    tileClass:
      'bg-linear-to-br from-cyan-400/35 to-sky-500/30 text-cyan-950 ring-2 ring-cyan-400/50 shadow-sm dark:from-cyan-600/45 dark:to-sky-700/40 dark:text-cyan-50 dark:ring-cyan-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-cyan-300/50 bg-cyan-200/80 font-medium text-cyan-950 dark:border-cyan-500/35 dark:bg-cyan-900/45 dark:text-cyan-100',
    rowAccent: 'border-l-[3px] border-l-cyan-500 bg-cyan-50/35 dark:border-l-cyan-400 dark:bg-cyan-950/20',
    cardRing: 'ring-cyan-400/35',
    previewGradient: 'from-cyan-500 to-sky-600',
  },
  sinav_gorevi: {
    id: 'sinav_gorevi',
    label: 'Sınav görevi (planlı)',
    shortLabel: 'Sınav görevi',
    icon: ClipboardList,
    pushIcon: '/push-icons/sinav_gorevi.png',
    tileClass:
      'bg-linear-to-br from-sky-400/40 to-blue-600/35 text-sky-950 ring-2 ring-sky-400/50 shadow-sm dark:from-sky-600/45 dark:to-blue-800/40 dark:text-sky-50 dark:ring-sky-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-sky-300/50 bg-sky-200/80 font-medium text-sky-950 dark:border-sky-500/35 dark:bg-sky-900/45 dark:text-sky-100',
    rowAccent: 'border-l-[3px] border-l-sky-500 bg-sky-50/40 dark:border-l-sky-400 dark:bg-sky-950/20',
    cardRing: 'ring-sky-400/35',
    previewGradient: 'from-sky-500 to-blue-600',
  },
  sinav_modulleri: {
    id: 'sinav_modulleri',
    label: 'Kertenkele / sorumluluk',
    shortLabel: 'Sınav',
    icon: LayoutGrid,
    pushIcon: '/push-icons/sinav_modulleri.png',
    tileClass:
      'bg-linear-to-br from-amber-400/45 to-orange-500/35 text-amber-950 ring-2 ring-amber-400/50 shadow-sm dark:from-amber-600/45 dark:to-orange-800/40 dark:text-amber-50 dark:ring-amber-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-amber-300/50 bg-amber-200/85 font-medium text-amber-950 dark:border-amber-500/35 dark:bg-amber-900/45 dark:text-amber-100',
    rowAccent: 'border-l-[3px] border-l-teal-500 bg-teal-50/40 dark:border-l-teal-400 dark:bg-teal-950/20',
    cardRing: 'ring-amber-400/35',
    previewGradient: 'from-amber-500 to-orange-600',
  },
  destek: {
    id: 'destek',
    label: 'Destek talepleri',
    shortLabel: 'Destek',
    icon: Headphones,
    pushIcon: '/push-icons/destek.png',
    tileClass:
      'bg-linear-to-br from-fuchsia-400/40 to-purple-500/35 text-purple-950 ring-2 ring-fuchsia-400/50 shadow-sm dark:from-fuchsia-600/45 dark:to-purple-800/40 dark:text-fuchsia-50 dark:ring-fuchsia-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-fuchsia-300/50 bg-fuchsia-200/80 font-medium text-purple-950 dark:border-fuchsia-500/35 dark:bg-fuchsia-950/50 dark:text-fuchsia-100',
    rowAccent: 'border-l-[3px] border-l-fuchsia-500 bg-fuchsia-50/40 dark:border-l-fuchsia-400 dark:bg-fuchsia-950/20',
    cardRing: 'ring-fuchsia-400/35',
    previewGradient: 'from-fuchsia-500 to-purple-600',
  },
  ajanda: {
    id: 'ajanda',
    label: 'Öğretmen ajandası',
    shortLabel: 'Ajanda',
    icon: BookOpen,
    pushIcon: '/push-icons/ajanda.png',
    tileClass:
      'bg-linear-to-br from-rose-400/35 to-pink-500/30 text-rose-950 ring-2 ring-rose-400/50 shadow-sm dark:from-rose-600/45 dark:to-pink-800/40 dark:text-rose-50 dark:ring-rose-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-rose-300/50 bg-rose-200/80 font-medium text-rose-950 dark:border-rose-500/35 dark:bg-rose-900/45 dark:text-rose-100',
    rowAccent: 'border-l-[3px] border-l-rose-500 bg-rose-50/40 dark:border-l-rose-400 dark:bg-rose-950/20',
    cardRing: 'ring-rose-400/35',
    previewGradient: 'from-rose-500 to-pink-600',
  },
  bilsem: {
    id: 'bilsem',
    label: 'Bilsem takvim',
    shortLabel: 'Bilsem',
    icon: CalendarDays,
    pushIcon: '/push-icons/bilsem.png',
    tileClass:
      'bg-linear-to-br from-violet-400/35 to-purple-500/30 text-violet-950 ring-2 ring-violet-400/50 shadow-sm dark:from-violet-600/45 dark:to-purple-700/40 dark:text-violet-100 dark:ring-violet-400/35',
    iconClass: ICON_SM,
    chipClass:
      'border border-violet-300/50 bg-violet-200/80 font-medium text-violet-950 dark:border-violet-500/35 dark:bg-violet-900/45 dark:text-violet-100',
    rowAccent: 'border-l-[3px] border-l-violet-500 bg-violet-50/40 dark:border-l-violet-400 dark:bg-violet-950/20',
    cardRing: 'ring-violet-400/35',
    previewGradient: 'from-violet-500 to-purple-600',
  },
  belirli_gun: {
    id: 'belirli_gun',
    label: 'Belirli gün / hafta',
    shortLabel: 'Belirli gün',
    icon: Award,
    pushIcon: '/push-icons/belirli_gun.png',
    tileClass:
      'bg-linear-to-br from-amber-300/90 to-orange-300/80 text-amber-950 ring-2 ring-amber-400/55 shadow-sm dark:from-amber-600/40 dark:to-orange-700/35 dark:text-amber-50 dark:ring-amber-500/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-amber-300/50 bg-amber-200/80 font-medium text-amber-950 dark:border-amber-500/35 dark:bg-amber-900/45 dark:text-amber-100',
    rowAccent: 'border-l-[3px] border-l-amber-500 bg-amber-50/40 dark:border-l-amber-400 dark:bg-amber-950/20',
    cardRing: 'ring-amber-400/35',
    previewGradient: 'from-amber-500 to-orange-500',
  },
  mesaj_merkezi: {
    id: 'mesaj_merkezi',
    label: 'Mesaj merkezi',
    shortLabel: 'Mesaj',
    icon: MessageSquare,
    pushIcon: '/push-icons/mesaj_merkezi.png',
    tileClass:
      'bg-linear-to-br from-emerald-400/45 to-green-600/35 text-emerald-950 ring-2 ring-emerald-400/50 shadow-sm dark:from-emerald-600/45 dark:to-green-800/40 dark:text-emerald-50 dark:ring-emerald-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-emerald-300/50 bg-emerald-200/85 font-medium text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-900/45 dark:text-emerald-100',
    rowAccent: 'border-l-[3px] border-l-emerald-500 bg-emerald-50/40 dark:border-l-emerald-400 dark:bg-emerald-950/20',
    cardRing: 'ring-emerald-400/35',
    previewGradient: 'from-emerald-500 to-green-600',
  },
  market: {
    id: 'market',
    label: 'Market',
    shortLabel: 'Market',
    icon: Wallet,
    pushIcon: '/push-icons/market.png',
    tileClass:
      'bg-linear-to-br from-lime-400/50 to-green-500/35 text-lime-950 ring-2 ring-lime-400/55 shadow-sm dark:from-lime-600/40 dark:to-green-800/35 dark:text-lime-50 dark:ring-lime-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-lime-300/50 bg-lime-200/85 font-medium text-lime-950 dark:border-lime-500/35 dark:bg-lime-900/45 dark:text-lime-100',
    rowAccent: 'border-l-[3px] border-l-lime-500 bg-lime-50/40 dark:border-l-lime-400 dark:bg-lime-950/20',
    cardRing: 'ring-lime-400/35',
    previewGradient: 'from-lime-500 to-green-600',
  },
  yolluk: {
    id: 'yolluk',
    label: 'Yolluk',
    shortLabel: 'Yolluk',
    icon: Banknote,
    pushIcon: '/push-icons/yolluk.png',
    tileClass:
      'bg-linear-to-br from-teal-400/45 to-emerald-600/40 text-teal-950 ring-2 ring-teal-400/50 shadow-sm dark:from-teal-600/50 dark:to-emerald-800/45 dark:text-teal-50 dark:ring-teal-400/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-teal-300/50 bg-teal-200/85 font-medium text-teal-950 dark:border-teal-500/35 dark:bg-teal-900/45 dark:text-teal-100',
    rowAccent: 'border-l-[3px] border-l-teal-500 bg-teal-50/45 dark:border-l-teal-400 dark:bg-teal-950/25',
    cardRing: 'ring-teal-400/35',
    previewGradient: 'from-teal-500 to-emerald-600',
  },
  okul_degerlendirme: {
    id: 'okul_degerlendirme',
    label: 'Okul değerlendirme',
    shortLabel: 'Değerlendirme',
    icon: Gavel,
    pushIcon: '/push-icons/okul_degerlendirme.png',
    tileClass:
      'bg-linear-to-br from-rose-500/50 to-red-700/40 text-white ring-2 ring-rose-400/55 shadow-sm dark:from-rose-700/55 dark:to-red-900/45 dark:ring-rose-400/45',
    iconClass: ICON_SM,
    chipClass:
      'border border-rose-400/55 bg-rose-200/90 font-semibold text-rose-950 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-50',
    rowAccent: 'border-l-[3px] border-l-rose-600 bg-rose-50/50 dark:border-l-rose-500 dark:bg-rose-950/30',
    cardRing: 'ring-rose-500/40',
    previewGradient: 'from-rose-600 to-red-700',
  },
  duyuru: {
    id: 'duyuru',
    label: 'Duyurular',
    shortLabel: 'Duyuru',
    icon: Newspaper,
    pushIcon: '/push-icons/duyuru.png',
    tileClass:
      'bg-linear-to-br from-yellow-300/90 to-amber-200/90 text-amber-950 ring-2 ring-yellow-400/60 shadow-sm dark:from-yellow-600/40 dark:to-amber-700/35 dark:text-yellow-50 dark:ring-yellow-500/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-yellow-400/50 bg-yellow-200/90 font-semibold text-yellow-950 ring-1 ring-yellow-500/25 dark:border-yellow-500/30 dark:bg-yellow-900/50 dark:text-yellow-100',
    rowAccent: 'border-l-[3px] border-l-yellow-500 bg-yellow-50/45 dark:border-l-yellow-400 dark:bg-yellow-950/25',
    cardRing: 'ring-yellow-400/40',
    previewGradient: 'from-yellow-500 to-amber-500',
  },
  genel: {
    id: 'genel',
    label: 'Diğer',
    shortLabel: 'Genel',
    icon: Megaphone,
    pushIcon: '/push-icons/genel.png',
    tileClass:
      'bg-linear-to-br from-slate-200/90 to-slate-300/80 text-slate-800 ring-2 ring-slate-400/40 shadow-sm dark:from-slate-600/50 dark:to-slate-700/50 dark:text-slate-100 dark:ring-slate-500/40',
    iconClass: ICON_SM,
    chipClass:
      'border border-slate-300/50 bg-slate-200/80 font-medium text-slate-800 dark:border-slate-500/35 dark:bg-slate-800/50 dark:text-slate-100',
    rowAccent: 'border-l-[3px] border-l-slate-400 bg-slate-50/40 dark:border-l-slate-500 dark:bg-slate-950/20',
    cardRing: 'ring-slate-400/30',
    previewGradient: 'from-slate-500 to-slate-600',
  },
};

const DOMAIN_CHANNEL: Record<string, NotificationChannelId> = {
  duty: 'nobet',
  timetable: 'ders_programi',
  ders_dagit: 'ders_programi',
  smart_board: 'akilli_tahta',
  exam_duty: 'sinav_gorevi',
  support: 'destek',
  agenda: 'ajanda',
  bilsem_calendar: 'bilsem',
  belirli_gun_hafta: 'belirli_gun',
  butterfly_exam: 'sinav_modulleri',
  sorumluluk_exam: 'sinav_modulleri',
  messaging: 'mesaj_merkezi',
  admin_message: 'mesaj_merkezi',
  market: 'market',
  yolluk: 'yolluk',
  school_reviews: 'okul_degerlendirme',
  announcement: 'duyuru',
};

/** event_type → kanal (backend ile aynı). */
export function eventTypeToChannelId(eventType: string): NotificationChannelId {
  const et = eventType?.trim() ?? '';
  if (!et) return 'genel';
  if (et === 'exam_duty.sync_source_error') return 'sinav_gorevi';
  if (et.startsWith('admin_message.')) return 'mesaj_merkezi';
  const domain = et.split('.')[0] ?? '';
  return DOMAIN_CHANNEL[domain] ?? 'genel';
}

export function getChannelTheme(channelId: string): ChannelTheme {
  return CHANNEL_THEMES[channelId as NotificationChannelId] ?? CHANNEL_THEMES.genel;
}

export function getThemeForEventType(eventType: string): ChannelTheme {
  return getChannelTheme(eventTypeToChannelId(eventType));
}

/** Sorumluluk sınavı — ayrı ikon */
export function getThemeForEventTypeDetailed(eventType: string): ChannelTheme {
  if (eventType?.startsWith('sorumluluk_exam.')) {
    return { ...CHANNEL_THEMES.sinav_modulleri, icon: GraduationCap };
  }
  if (eventType?.startsWith('admin_message.')) {
    return { ...CHANNEL_THEMES.mesaj_merkezi, icon: Mail };
  }
  return getThemeForEventType(eventType);
}

export function pushIconForChannel(channelId: string): string {
  return getChannelTheme(channelId).pushIcon;
}

export const CHANNEL_THEME_LIST = Object.values(CHANNEL_THEMES);
