'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bell,
  BookOpen,
  CalendarClock,
  CheckCheck,
  Check,
  Megaphone,
  ArrowRightLeft,
  Trash2,
  Table2,
  ExternalLink,
  Award,
  Monitor,
  ClipboardList,
  CalendarDays,
  Wallet,
  Headphones,
  Newspaper,
  LayoutGrid,
} from 'lucide-react';
import { ToolbarIconHints, type ToolbarHintItem } from '@/components/layout/toolbar-icon-hints';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { emitNotificationsUpdated } from '@/hooks/use-duty-notifications-unread';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type NotificationItem = {
  id: string;
  event_type: string;
  entity_id: string | null;
  target_screen: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: { date?: string } | null;
};

type PaginatedResponse = {
  items: NotificationItem[];
  total: number;
  page: number;
  limit: number;
};

const EVENT_LABELS: Record<string, string> = {
  'duty.published': 'Nöbet planı',
  'duty.changed': 'Nöbet değişikliği',
  'duty.reassigned': 'Yerine görevlendirme',
  'duty.coverage_assigned': 'Ders görevi',
  'duty.reminder': 'Nöbet hatırlatması',
  'duty.swap_requested': 'Takas talebi',
  'duty.swap_approved': 'Takas onayı',
  'duty.swap_rejected': 'Takas reddi',
  'duty.swap_teacher2_approved': 'Takas onay bekliyor',
  'belirli_gun_hafta.assigned': 'Belirli Gün görevlendirmesi',
  'belirli_gun_hafta.reminder': 'Belirli Gün hatırlatması',
  'belirli_gun_hafta.notification_sent': 'Bildirim gönderildi',
  'bilsem_calendar.assigned': 'BİLSEM görevlendirmesi',
  'bilsem_calendar.notification_sent': 'BİLSEM bildirimi',
  'timetable.published': 'Ders programı',
  'announcement.created': 'Duyuru',
  'smart_board.disconnected_by_admin': 'Tahta bağlantısı kesildi',
  'smart_board.session_ended_by_admin': 'Tahta oturumu sonlandı',
  'exam_duty.open': 'Sınav görevi açıldı',
  'exam_duty.lastday': 'Sınav görevi son başvuru',
  'exam_duty.approval_day': 'Sınav görevi onay günü',
  'exam_duty.examday': 'Sınav görevi sınav günü',
  'exam_duty.reminder': 'Sınav görevi hatırlatma',
  'exam_duty.exam_day_morning': 'Sınav günü sabah hatırlatması',
  'exam_duty.sync_source_error': 'Sınav görevi sync (kaynak hatası)',
  'exam_duty.sync_items_processed': 'Sınav görevi sync (işlenen duyurular)',
  'support.ticket.created': 'Yeni destek talebi',
  'support.ticket.replied': 'Talebinize yanıt verildi',
  'support.ticket.assigned': 'Size destek talebi atandı',
  'support.ticket.escalated': 'Üst birime iletildi',
  'agenda.school_event_added': 'Okul etkinliği',
  'market.school_credit_added': 'Market (okul)',
  'market.user_credit_added': 'Market (bireysel)',
};

const SWAP_EVENT_TYPES = ['duty.swap_requested', 'duty.swap_approved', 'duty.swap_rejected', 'duty.swap_teacher2_approved'];
const EXAM_DUTY_EVENT_TYPES = ['exam_duty.open', 'exam_duty.lastday', 'exam_duty.approval_day', 'exam_duty.examday', 'exam_duty.reminder', 'exam_duty.exam_day_morning'];
const SUPPORT_EVENT_TYPES = ['support.ticket.created', 'support.ticket.replied', 'support.ticket.assigned', 'support.ticket.escalated'];
const TIMETABLE_EVENT_TYPES = ['timetable.published'];
const DUTY_PLAN_EVENT_TYPES = ['duty.published', 'duty.changed'];
const DUTY_DAILY_EVENT_TYPES = ['duty.reassigned', 'duty.coverage_assigned', 'duty.reminder'];
const BELIRLI_GUN_EVENT_TYPES = ['belirli_gun_hafta.assigned', 'belirli_gun_hafta.reminder', 'belirli_gun_hafta.notification_sent'];
const BILSEM_CALENDAR_EVENT_TYPES = ['bilsem_calendar.assigned', 'bilsem_calendar.notification_sent'];
const AGENDA_EVENT_TYPES = ['agenda.school_event_added'];
const SMART_BOARD_EVENT_TYPES = ['smart_board.disconnected_by_admin', 'smart_board.session_ended_by_admin'];
const MARKET_EVENT_TYPES = ['market.school_credit_added', 'market.user_credit_added'];

const BILDIRIM_KAYNAK_ICONS: ToolbarHintItem[] = [
  { label: 'Nöbet', icon: CalendarClock },
  { label: 'Takvim', icon: CalendarDays },
  { label: 'Ders', icon: Table2 },
  { label: 'Diğer', icon: LayoutGrid },
];

function formatDate(s: string) {
  const d = new Date(s);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dk önce`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} gün önce`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getNotificationLink(item: NotificationItem): string {
  if (item.event_type?.startsWith('market.') || item.target_screen === 'market') {
    return '/market';
  }
  if (item.target_screen === 'sinav-gorevi' || EXAM_DUTY_EVENT_TYPES.includes(item.event_type)) {
    return '/sinav-gorevlerim';
  }
  if (item.target_screen === 'nobet_takas' || SWAP_EVENT_TYPES.includes(item.event_type)) {
    return '/duty/takas';
  }
  if (BILSEM_CALENDAR_EVENT_TYPES.includes(item.event_type) || item.target_screen === 'bilsem/takvim') {
    return '/bilsem/takvim';
  }
  if (BELIRLI_GUN_EVENT_TYPES.includes(item.event_type) || item.target_screen === 'akademik-takvim') {
    return '/akademik-takvim';
  }
  if (AGENDA_EVENT_TYPES.includes(item.event_type) || item.target_screen === 'ogretmen-ajandasi' || item.target_screen === '/ogretmen-ajandasi') {
    return '/ogretmen-ajandasi';
  }
  if (SMART_BOARD_EVENT_TYPES.includes(item.event_type) || item.target_screen === 'akilli-tahta') {
    return '/akilli-tahta';
  }
  if (TIMETABLE_EVENT_TYPES.includes(item.event_type) || item.target_screen === 'ders-programi') {
    return '/ders-programi/programlarim';
  }
  if (SUPPORT_EVENT_TYPES.includes(item.event_type) || item.target_screen?.startsWith('support/tickets/')) {
    if (item.entity_id) return `/support/${item.entity_id}`;
    return '/support';
  }
  if (item.event_type?.startsWith('duty.')) {
    const date = item.metadata?.date;
    if (date) return `/duty/gunluk-tablo?date=${date}`;
    if (item.event_type === 'duty.published' || item.event_type === 'duty.changed') {
      return '/duty/planlar';
    }
    return '/duty';
  }
  return '/dashboard';
}

function isDutyNotification(eventType: string): boolean {
  return eventType?.startsWith('duty.');
}

function isBelirliGunNotification(eventType: string): boolean {
  return eventType?.startsWith('belirli_gun_hafta.');
}

function isBilsemCalendarNotification(eventType: string): boolean {
  return eventType?.startsWith('bilsem_calendar.');
}

function isTimetableNotification(eventType: string): boolean {
  return eventType?.startsWith('timetable.');
}

function isSmartBoardNotification(eventType: string): boolean {
  return eventType?.startsWith('smart_board.');
}

function isSupportNotification(eventType: string): boolean {
  return eventType?.startsWith('support.ticket.');
}

function isExamDutyNotification(eventType: string): boolean {
  return eventType?.startsWith('exam_duty.');
}

function isAgendaNotification(eventType: string): boolean {
  return eventType?.startsWith('agenda.');
}

function isMarketNotification(eventType: string): boolean {
  return eventType?.startsWith('market.');
}

function isAnnouncementNotification(eventType: string): boolean {
  return eventType === 'announcement.created' || eventType?.startsWith('announcement.');
}

/** Liste satırı sol şerit — nöbet hatırlatma / belirli gün ile çakışmaz */
function getNotificationRowAccentClass(item: NotificationItem): string | null {
  if (item.event_type === 'duty.reminder' && isTodayReminder(item)) return null;
  if (isBelirliGunReminderHighlight(item)) return null;
  if (isAnnouncementNotification(item.event_type)) {
    return 'border-l-[3px] border-l-yellow-500 bg-yellow-50/45 dark:border-l-yellow-400 dark:bg-yellow-950/25';
  }
  if (isBilsemCalendarNotification(item.event_type)) {
    return 'border-l-[3px] border-l-violet-500 bg-violet-50/40 dark:border-l-violet-400 dark:bg-violet-950/20';
  }
  if (isBelirliGunNotification(item.event_type)) {
    return 'border-l-[3px] border-l-amber-500 bg-amber-50/40 dark:border-l-amber-400 dark:bg-amber-950/20';
  }
  if (isDutyNotification(item.event_type)) {
    return 'border-l-[3px] border-l-indigo-500 bg-indigo-50/35 dark:border-l-indigo-400 dark:bg-indigo-950/20';
  }
  if (isTimetableNotification(item.event_type)) {
    return 'border-l-[3px] border-l-emerald-500 bg-emerald-50/35 dark:border-l-emerald-400 dark:bg-emerald-950/20';
  }
  if (isSmartBoardNotification(item.event_type)) {
    return 'border-l-[3px] border-l-cyan-500 bg-cyan-50/35 dark:border-l-cyan-400 dark:bg-cyan-950/20';
  }
  if (isSupportNotification(item.event_type)) {
    return 'border-l-[3px] border-l-fuchsia-500 bg-fuchsia-50/40 dark:border-l-fuchsia-400 dark:bg-fuchsia-950/20';
  }
  if (isExamDutyNotification(item.event_type)) {
    return 'border-l-[3px] border-l-sky-500 bg-sky-50/40 dark:border-l-sky-400 dark:bg-sky-950/20';
  }
  if (isAgendaNotification(item.event_type)) {
    return 'border-l-[3px] border-l-rose-500 bg-rose-50/40 dark:border-l-rose-400 dark:bg-rose-950/20';
  }
  if (isMarketNotification(item.event_type)) {
    return 'border-l-[3px] border-l-lime-500 bg-lime-50/40 dark:border-l-lime-400 dark:bg-lime-950/20';
  }
  return null;
}

function getNotificationIcon(item: NotificationItem): { icon: React.ReactNode; bgClass: string } {
  const iconSm = 'size-[0.9375rem] sm:size-4';
  if (isAnnouncementNotification(item.event_type)) {
    return {
      icon: <Newspaper className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-yellow-300/90 to-amber-200/90 text-amber-950 ring-2 ring-yellow-400/60 shadow-sm dark:from-yellow-600/40 dark:to-amber-700/35 dark:text-yellow-50 dark:ring-yellow-500/40',
    };
  }
  if (isBilsemCalendarNotification(item.event_type)) {
    return {
      icon: <CalendarDays className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-violet-400/35 to-purple-500/30 text-violet-950 ring-2 ring-violet-400/50 shadow-sm dark:from-violet-600/45 dark:to-purple-700/40 dark:text-violet-100 dark:ring-violet-400/35',
    };
  }
  if (isBelirliGunNotification(item.event_type)) {
    return {
      icon: <Award className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-amber-300/90 to-orange-300/80 text-amber-950 ring-2 ring-amber-400/55 shadow-sm dark:from-amber-600/40 dark:to-orange-700/35 dark:text-amber-50 dark:ring-amber-500/40',
    };
  }
  if (isDutyNotification(item.event_type)) {
    return {
      icon: <CalendarClock className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-indigo-400/35 to-violet-500/30 text-indigo-950 ring-2 ring-indigo-400/50 shadow-sm dark:from-indigo-600/45 dark:to-violet-700/40 dark:text-indigo-50 dark:ring-indigo-400/40',
    };
  }
  if (isTimetableNotification(item.event_type)) {
    return {
      icon: <Table2 className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-emerald-400/35 to-teal-500/30 text-emerald-950 ring-2 ring-emerald-400/50 shadow-sm dark:from-emerald-600/45 dark:to-teal-700/40 dark:text-emerald-50 dark:ring-emerald-400/40',
    };
  }
  if (isSmartBoardNotification(item.event_type)) {
    return {
      icon: <Monitor className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-cyan-400/35 to-sky-500/30 text-cyan-950 ring-2 ring-cyan-400/50 shadow-sm dark:from-cyan-600/45 dark:to-sky-700/40 dark:text-cyan-50 dark:ring-cyan-400/40',
    };
  }
  if (isSupportNotification(item.event_type)) {
    return {
      icon: <Headphones className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-fuchsia-400/40 to-purple-500/35 text-purple-950 ring-2 ring-fuchsia-400/50 shadow-sm dark:from-fuchsia-600/45 dark:to-purple-800/40 dark:text-fuchsia-50 dark:ring-fuchsia-400/40',
    };
  }
  if (isExamDutyNotification(item.event_type)) {
    return {
      icon: <ClipboardList className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-sky-400/40 to-blue-600/35 text-sky-950 ring-2 ring-sky-400/50 shadow-sm dark:from-sky-600/45 dark:to-blue-800/40 dark:text-sky-50 dark:ring-sky-400/40',
    };
  }
  if (isAgendaNotification(item.event_type)) {
    return {
      icon: <BookOpen className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-rose-400/35 to-pink-500/30 text-rose-950 ring-2 ring-rose-400/50 shadow-sm dark:from-rose-600/45 dark:to-pink-800/40 dark:text-rose-50 dark:ring-rose-400/40',
    };
  }
  if (isMarketNotification(item.event_type)) {
    return {
      icon: <Wallet className={iconSm} strokeWidth={2} />,
      bgClass:
        'bg-linear-to-br from-lime-400/50 to-green-500/35 text-lime-950 ring-2 ring-lime-400/55 shadow-sm dark:from-lime-600/40 dark:to-green-800/35 dark:text-lime-50 dark:ring-lime-400/40',
    };
  }
  return {
    icon: <Megaphone className={iconSm} strokeWidth={2} />,
    bgClass:
      'bg-linear-to-br from-slate-200/90 to-slate-300/80 text-slate-800 ring-2 ring-slate-400/40 shadow-sm dark:from-slate-600/50 dark:to-slate-700/50 dark:text-slate-100 dark:ring-slate-500/40',
  };
}

function getChipClass(item: NotificationItem): string {
  if (isAnnouncementNotification(item.event_type)) {
    return 'border border-yellow-400/50 bg-yellow-200/90 font-semibold text-yellow-950 ring-1 ring-yellow-500/25 dark:border-yellow-500/30 dark:bg-yellow-900/50 dark:text-yellow-100 dark:ring-yellow-400/20';
  }
  if (isBilsemCalendarNotification(item.event_type)) {
    return 'border border-violet-300/50 bg-violet-200/80 font-medium text-violet-950 dark:border-violet-500/35 dark:bg-violet-900/45 dark:text-violet-100';
  }
  if (isBelirliGunNotification(item.event_type)) {
    return 'border border-amber-300/50 bg-amber-200/80 font-medium text-amber-950 dark:border-amber-500/35 dark:bg-amber-900/45 dark:text-amber-100';
  }
  if (isDutyNotification(item.event_type)) {
    return 'border border-indigo-300/50 bg-indigo-200/80 font-medium text-indigo-950 dark:border-indigo-500/35 dark:bg-indigo-900/45 dark:text-indigo-100';
  }
  if (isTimetableNotification(item.event_type)) {
    return 'border border-emerald-300/50 bg-emerald-200/80 font-medium text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-900/45 dark:text-emerald-100';
  }
  if (isSmartBoardNotification(item.event_type)) {
    return 'border border-cyan-300/50 bg-cyan-200/80 font-medium text-cyan-950 dark:border-cyan-500/35 dark:bg-cyan-900/45 dark:text-cyan-100';
  }
  if (isSupportNotification(item.event_type)) {
    return 'border border-fuchsia-300/50 bg-fuchsia-200/80 font-medium text-purple-950 dark:border-fuchsia-500/35 dark:bg-fuchsia-950/50 dark:text-fuchsia-100';
  }
  if (isExamDutyNotification(item.event_type)) {
    return 'border border-sky-300/50 bg-sky-200/80 font-medium text-sky-950 dark:border-sky-500/35 dark:bg-sky-900/45 dark:text-sky-100';
  }
  if (isAgendaNotification(item.event_type)) {
    return 'border border-rose-300/50 bg-rose-200/80 font-medium text-rose-950 dark:border-rose-500/35 dark:bg-rose-900/45 dark:text-rose-100';
  }
  if (isMarketNotification(item.event_type)) {
    return 'border border-lime-300/50 bg-lime-200/85 font-medium text-lime-950 dark:border-lime-500/35 dark:bg-lime-900/45 dark:text-lime-100';
  }
  return 'border border-slate-300/50 bg-slate-200/80 font-medium text-slate-800 dark:border-slate-500/35 dark:bg-slate-800/60 dark:text-slate-200';
}

function isTodayReminder(item: NotificationItem): boolean {
  if (item.event_type !== 'duty.reminder') return false;
  const metaDate = item.metadata?.date;
  if (!metaDate) return true;
  const today = new Date().toISOString().slice(0, 10);
  return metaDate === today;
}

function isBelirliGunReminderHighlight(item: NotificationItem): boolean {
  return item.event_type === 'belirli_gun_hafta.reminder' && !item.read_at;
}

type FilterTab =
  | 'all'
  | 'duty'
  | 'belirli'
  | 'bilsem'
  | 'timetable'
  | 'agenda'
  | 'announcement'
  | 'smart_board'
  | 'support'
  | 'exam_duty'
  | 'market';

const FILTER_TABS = [
  'all',
  'duty',
  'belirli',
  'bilsem',
  'timetable',
  'agenda',
  'smart_board',
  'support',
  'announcement',
  'exam_duty',
  'market',
] as const;

const TAB_PASTEL: Record<
  (typeof FILTER_TABS)[number],
  { active: string; idle: string }
> = {
  all: {
    active:
      'bg-white text-slate-900 shadow-md ring-2 ring-slate-300/70 dark:bg-slate-800 dark:text-slate-50 dark:ring-white/25',
    idle:
      'bg-slate-100/95 text-slate-700 ring-1 ring-slate-300/60 hover:bg-white hover:ring-slate-400/50 dark:bg-slate-800/80 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-800',
  },
  duty: {
    active:
      'bg-linear-to-br from-indigo-500 to-violet-600 text-white shadow-md ring-2 ring-indigo-400/50 dark:ring-indigo-400/40',
    idle:
      'bg-indigo-100/95 text-indigo-900 ring-1 ring-indigo-300/70 hover:bg-indigo-200/90 dark:bg-indigo-950/70 dark:text-indigo-100 dark:ring-indigo-500/40 dark:hover:bg-indigo-900/80',
  },
  belirli: {
    active:
      'bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md ring-2 ring-amber-400/50 dark:ring-amber-400/40',
    idle:
      'bg-amber-100/95 text-amber-950 ring-1 ring-amber-300/70 hover:bg-amber-200/90 dark:bg-amber-950/55 dark:text-amber-100 dark:ring-amber-600/35 dark:hover:bg-amber-900/70',
  },
  bilsem: {
    active:
      'bg-linear-to-br from-violet-500 to-purple-700 text-white shadow-md ring-2 ring-violet-400/50 dark:ring-violet-400/40',
    idle:
      'bg-violet-100/95 text-violet-950 ring-1 ring-violet-300/70 hover:bg-violet-200/90 dark:bg-violet-950/60 dark:text-violet-100 dark:ring-violet-500/40 dark:hover:bg-violet-900/75',
  },
  timetable: {
    active:
      'bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-md ring-2 ring-emerald-400/50 dark:ring-emerald-400/40',
    idle:
      'bg-emerald-100/95 text-emerald-950 ring-1 ring-emerald-300/70 hover:bg-emerald-200/90 dark:bg-emerald-950/55 dark:text-emerald-100 dark:ring-emerald-500/35 dark:hover:bg-emerald-900/75',
  },
  agenda: {
    active:
      'bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-md ring-2 ring-rose-400/50 dark:ring-rose-400/40',
    idle:
      'bg-rose-100/95 text-rose-950 ring-1 ring-rose-300/70 hover:bg-rose-200/90 dark:bg-rose-950/55 dark:text-rose-100 dark:ring-rose-500/35 dark:hover:bg-rose-900/75',
  },
  smart_board: {
    active:
      'bg-linear-to-br from-cyan-500 to-sky-600 text-white shadow-md ring-2 ring-cyan-400/50 dark:ring-cyan-400/40',
    idle:
      'bg-cyan-100/95 text-cyan-950 ring-1 ring-cyan-300/70 hover:bg-cyan-200/90 dark:bg-cyan-950/55 dark:text-cyan-100 dark:ring-cyan-500/35 dark:hover:bg-cyan-900/75',
  },
  support: {
    active:
      'bg-linear-to-br from-fuchsia-500 to-purple-700 text-white shadow-md ring-2 ring-fuchsia-400/50 dark:ring-fuchsia-400/40',
    idle:
      'bg-fuchsia-100/95 text-purple-950 ring-1 ring-fuchsia-300/70 hover:bg-fuchsia-200/90 dark:bg-fuchsia-950/50 dark:text-fuchsia-100 dark:ring-fuchsia-500/35 dark:hover:bg-fuchsia-900/70',
  },
  announcement: {
    active:
      'bg-linear-to-br from-yellow-400 to-amber-500 text-amber-950 shadow-md ring-2 ring-yellow-400/60 dark:text-amber-950 dark:ring-yellow-500/40',
    idle:
      'bg-yellow-100/95 text-amber-950 ring-1 ring-yellow-300/80 hover:bg-yellow-200/90 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-600/35 dark:hover:bg-amber-900/65',
  },
  exam_duty: {
    active:
      'bg-linear-to-br from-sky-500 to-blue-700 text-white shadow-md ring-2 ring-sky-400/50 dark:ring-sky-400/40',
    idle:
      'bg-sky-100/95 text-sky-950 ring-1 ring-sky-300/70 hover:bg-sky-200/90 dark:bg-sky-950/55 dark:text-sky-100 dark:ring-sky-500/35 dark:hover:bg-sky-900/75',
  },
  market: {
    active:
      'bg-linear-to-br from-lime-500 to-green-600 text-white shadow-md ring-2 ring-lime-400/50 dark:ring-lime-400/40',
    idle:
      'bg-lime-100/95 text-lime-950 ring-1 ring-lime-300/70 hover:bg-lime-200/90 dark:bg-lime-950/45 dark:text-lime-100 dark:ring-lime-500/35 dark:hover:bg-lime-900/70',
  },
};

export default function BildirimlerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const urlFilter = searchParams.get('filter');
  const validFilter: FilterTab =
    urlFilter === 'duty' ||
    urlFilter === 'belirli' ||
    urlFilter === 'bilsem' ||
    urlFilter === 'timetable' ||
    urlFilter === 'agenda' ||
    urlFilter === 'announcement' ||
    urlFilter === 'smart_board' ||
    urlFilter === 'support' ||
    urlFilter === 'exam_duty' ||
    urlFilter === 'market'
      ? urlFilter
      : 'all';
  const [filter, setFilter] = useState<FilterTab>(validFilter);
  const limit = 20;

  const canAccess = me?.role === 'teacher' || me?.role === 'school_admin';

  useEffect(() => {
    setFilter(validFilter);
  }, [validFilter, searchParams]);

  const eventTypeParam =
    filter === 'duty'
      ? 'duty'
      : filter === 'belirli'
        ? 'belirli_gun_hafta'
        : filter === 'bilsem'
          ? 'bilsem_calendar'
          : filter === 'timetable'
          ? 'timetable'
          : filter === 'agenda'
            ? 'agenda'
            : filter === 'announcement'
              ? 'announcement'
              : filter === 'smart_board'
                ? 'smart_board'
                : filter === 'support'
                  ? 'support'
                  : filter === 'exam_duty'
                    ? 'exam_duty'
                    : filter === 'market'
                      ? 'market'
                      : undefined;

  const setFilterAndUpdateUrl = (tab: FilterTab) => {
    setFilter(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'all') params.delete('filter');
    else params.set('filter', tab);
    const qs = params.toString();
    router.replace(qs ? `/bildirimler?${qs}` : '/bildirimler', { scroll: false });
  };

  const fetchList = useCallback(async () => {
    if (!token || !canAccess) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: '1', limit: String(limit) });
      if (eventTypeParam) q.set('event_type', eventTypeParam);
      const res = await apiFetch<PaginatedResponse>(`/notifications?${q}`, { token });
      setItems(res?.items ?? []);
      setTotal(res?.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [token, canAccess, eventTypeParam]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const loadMore = useCallback(() => {
    if (!token) return;
    const nextPage = Math.floor(items.length / limit) + 1;
    if (nextPage * limit <= total) {
      const q = new URLSearchParams({ page: String(nextPage), limit: String(limit) });
      if (eventTypeParam) q.set('event_type', eventTypeParam);
      apiFetch<PaginatedResponse>(`/notifications?${q}`, { token })
        .then((res) => {
          setItems((prev) => [...prev, ...(res?.items ?? [])]);
        })
        .catch(() => {});
    }
  }, [token, items.length, total, limit, eventTypeParam]);

  const loadMoreVisible = items.length < total && items.length > 0;

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    setMarkingRead(id);
    try {
      await apiFetch(`/notifications/${id}/read`, { token, method: 'PATCH' });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      emitNotificationsUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Okundu işaretlenemedi.');
    } finally {
      setMarkingRead(null);
    }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    setMarkingAllRead(true);
    try {
      await apiFetch('/notifications/read-all', { token, method: 'PATCH' });
      setItems((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      emitNotificationsUpdated();
      toast.success('Tüm bildirimler okundu olarak işaretlendi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    if (!token || !confirm('Bu bildirimi silmek istediğinize emin misiniz?')) return;
    setDeletingId(id);
    try {
      await apiFetch(`/notifications/${id}`, { token, method: 'DELETE' });
      setItems((prev) => prev.filter((n) => n.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      emitNotificationsUpdated();
      toast.success('Bildirim silindi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!token || !confirm('Tüm bildirimleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    setDeletingAll(true);
    try {
      await apiFetch('/notifications/delete-all', { token, method: 'DELETE' });
      setItems([]);
      setTotal(0);
      emitNotificationsUpdated();
      toast.success('Tüm bildirimler silindi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setDeletingAll(false);
    }
  };

  const handleNavigate = (item: NotificationItem, markRead = true) => {
    if (markRead && !item.read_at) handleMarkRead(item.id);
    router.push(getNotificationLink(item));
  };

  const handleLinkClick = (e: React.MouseEvent, item: NotificationItem) => {
    e.preventDefault();
    handleNavigate(item);
  };

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle>Bildirimler</ToolbarPageTitle>
          </ToolbarHeading>
        </Toolbar>
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Bell className="size-10 text-muted-foreground" />}
              title="Erişim yok"
              description="Bu sayfaya erişim yetkiniz bulunmuyor."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.read_at).length;

  return (
    <div className="max-sm:-mt-2 space-y-2 sm:space-y-6">
      <Toolbar className="max-sm:border-0 max-sm:pb-1.5 max-sm:pt-0 sm:pb-5">
        <ToolbarHeading>
          <div className="flex items-center justify-between gap-2 sm:min-h-0 sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-orange-400/35 via-violet-500/25 to-sky-400/30 ring-1 ring-orange-400/35 dark:from-orange-500/25 dark:via-violet-500/20 dark:to-sky-500/25 dark:ring-orange-500/30 sm:size-12 sm:rounded-2xl sm:ring-2">
                <Bell className="size-[1rem] text-orange-700 dark:text-orange-300 sm:size-6 sm:text-primary" strokeWidth={2} />
              </div>
              <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden sm:gap-3">
                <ToolbarPageTitle className="shrink-0 truncate text-base font-bold leading-none sm:text-2xl sm:font-semibold sm:leading-tight">
                  Bildirimler
                </ToolbarPageTitle>
                <ToolbarIconHints
                  compact
                  showOnMobile
                  items={BILDIRIM_KAYNAK_ICONS}
                  summary="Nöbet, takvim, ders ve diğer modüllere ait bildirimler burada."
                  className="min-w-0 flex-1"
                />
              </div>
            </div>
            {total > 0 && (
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                    aria-label="Tümünü okundu yap"
                    title="Tümünü okundu yap"
                    className="h-9 w-9 shrink-0 gap-0 p-0 sm:h-auto sm:min-h-9 sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
                  >
                    {markingAllRead ? (
                      <LoadingSpinner className="size-4" />
                    ) : (
                      <CheckCheck className="size-4" />
                    )}
                    <span className="hidden sm:inline">Tümünü okundu yap</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  aria-label="Tümünü sil"
                  title="Tümünü sil"
                  className="h-9 w-9 shrink-0 gap-0 p-0 text-destructive hover:text-destructive sm:h-auto sm:min-h-9 sm:w-auto sm:gap-2 sm:px-3 sm:py-2"
                >
                  {deletingAll ? <LoadingSpinner className="size-4" /> : <Trash2 className="size-4" />}
                  <span className="hidden sm:inline">Tümünü sil</span>
                </Button>
              </div>
            )}
          </div>
        </ToolbarHeading>
      </Toolbar>

      {/* Filtre sekmeleri — mobilde yatay kaydırma; grup renkleri belirgin */}
      <div
        className={cn(
          'overflow-hidden rounded-2xl border-2 border-violet-300/50 bg-linear-to-br from-violet-100/90 via-fuchsia-50/70 to-amber-50/60 p-2 shadow-md',
          'dark:border-violet-500/35 dark:from-violet-950/60 dark:via-fuchsia-950/35 dark:to-amber-950/25',
        )}
      >
        <p className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-800 dark:text-violet-200 sm:hidden">
          Gruba göre filtre
        </p>
        <div className="relative sm:static">
          <div
            className="pointer-events-none absolute inset-y-1 left-0 z-1 w-5 bg-linear-to-r from-violet-100/98 to-transparent dark:from-violet-950/95 sm:hidden"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-1 right-0 z-1 w-5 bg-linear-to-l from-amber-50/98 to-transparent dark:from-zinc-950/90 sm:hidden"
            aria-hidden
          />
          <div className="-mx-0.5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-0.5 pt-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pt-0 sm:snap-none [&::-webkit-scrollbar]:hidden">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterAndUpdateUrl(tab)}
            className={cn(
              'flex shrink-0 snap-start items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold transition-all duration-200 sm:snap-none sm:shrink sm:py-2 sm:text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 focus-visible:ring-offset-2',
              filter === tab ? TAB_PASTEL[tab].active : TAB_PASTEL[tab].idle,
            )}
          >
            {tab === 'all' && <>Tümü</>}
            {tab === 'duty' && (
              <>
                <CalendarClock className="size-3.5 shrink-0" />
                Nöbet
              </>
            )}
            {tab === 'belirli' && (
              <>
                <Award className="size-3.5 shrink-0" />
                Belirli Gün
              </>
            )}
            {tab === 'bilsem' && (
              <>
                <CalendarDays className="size-3.5 shrink-0" />
                BİLSEM
              </>
            )}
            {tab === 'timetable' && (
              <>
                <Table2 className="size-3.5 shrink-0" />
                Ders Programı
              </>
            )}
            {tab === 'agenda' && (
              <>
                <CalendarDays className="size-3.5 shrink-0" />
                Ajanda
              </>
            )}
            {tab === 'smart_board' && (
              <>
                <Monitor className="size-3.5 shrink-0" />
                Akıllı Tahta
              </>
            )}
            {tab === 'support' && (
              <>
                <Megaphone className="size-3.5 shrink-0" />
                Destek
              </>
            )}
            {tab === 'announcement' && (
              <>
                <Megaphone className="size-3.5 shrink-0" />
                Duyuru
              </>
            )}
            {tab === 'exam_duty' && (
              <>
                <ClipboardList className="size-3.5 shrink-0" />
                Sınav Görevi
              </>
            )}
            {tab === 'market' && (
              <>
                <Wallet className="size-3.5 shrink-0" />
                Market
              </>
            )}
          </button>
        ))}
          </div>
        </div>
        <p className="mt-1.5 text-center text-[10px] font-medium text-violet-700/90 dark:text-violet-300/90 sm:hidden">
          ← Tüm grupları görmek için kaydırın →
        </p>
      </div>

      <Card className="overflow-hidden rounded-2xl border-violet-200/40 shadow-md dark:border-violet-500/20 sm:rounded-xl">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Bell className="size-10 text-muted-foreground" />}
              title="Henüz bildirim yok"
              description={
                filter === 'all'
                  ? 'Nöbet, Belirli Gün, ajanda, ders programı, Akıllı Tahta, market cüzdanı veya duyuru geldiğinde burada göreceksiniz.'
                  : filter === 'duty'
                    ? 'Henüz nöbet bildiriminiz yok.'
                    : filter === 'belirli'
                      ? 'Henüz Belirli Gün görevlendirmesi bildiriminiz yok.'
                      : filter === 'bilsem'
                        ? 'Henüz BİLSEM görevlendirmesi bildiriminiz yok.'
                        : filter === 'timetable'
                        ? 'Henüz ders programı bildiriminiz yok.'
                        : filter === 'agenda'
                          ? 'Henüz ajanda etkinliği bildiriminiz yok.'
                          : filter === 'smart_board'
                            ? 'Henüz Akıllı Tahta bildiriminiz yok.'
                            : filter === 'support'
                              ? 'Henüz destek talebi bildiriminiz yok.'
                              : filter === 'exam_duty'
                                ? 'Henüz sınav görevi bildiriminiz yok.'
                                : filter === 'market'
                                  ? 'Henüz market / cüzdan bildiriminiz yok.'
                                  : 'Henüz duyuru bildiriminiz yok.'
              }
              action={
                <div className="flex max-w-md flex-col gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
                  <Link href="/duty" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <CalendarClock className="size-4" />
                      Nöbetlere git
                    </Button>
                  </Link>
                  <Link href="/akademik-takvim" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <Award className="size-4" />
                      Akademik Takvim
                    </Button>
                  </Link>
                  <Link href="/bilsem/takvim" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <CalendarDays className="size-4" />
                      BİLSEM Takvim
                    </Button>
                  </Link>
                  <Link href="/ogretmen-ajandasi" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <CalendarDays className="size-4" />
                      Öğretmen Ajandası
                    </Button>
                  </Link>
                  <Link href="/ders-programi/programlarim" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <Table2 className="size-4" />
                      Programlarım
                    </Button>
                  </Link>
                  <Link href="/akilli-tahta" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <Monitor className="size-4" />
                      Akıllı Tahta
                    </Button>
                  </Link>
                  <Link href="/support" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <Megaphone className="size-4" />
                      Destek Talepleri
                    </Button>
                  </Link>
                  <Link href="/sinav-gorevlerim" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <ClipboardList className="size-4" />
                      Sınav Görevleri
                    </Button>
                  </Link>
                  <Link href="/market" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full gap-2 sm:w-auto">
                      <Wallet className="size-4" />
                      Market / Cüzdan
                    </Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const isSwap = SWAP_EVENT_TYPES.includes(item.event_type);
                const isTimetable = TIMETABLE_EVENT_TYPES.includes(item.event_type);
                const isDutyPlan = DUTY_PLAN_EVENT_TYPES.includes(item.event_type);
                const isDutyDaily = DUTY_DAILY_EVENT_TYPES.includes(item.event_type) && item.metadata?.date;
                const isToday = isTodayReminder(item);
                const isBelirliHighlight = isBelirliGunReminderHighlight(item);
                const { icon, bgClass } = getNotificationIcon(item);
                const rowAccent = getNotificationRowAccentClass(item);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'flex flex-col gap-2 px-2.5 py-2 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:gap-3 sm:px-4 sm:py-3.5',
                      'mx-0 my-0 rounded-none sm:mx-1 sm:my-0.5 sm:rounded-lg',
                      !item.read_at && !rowAccent && !isToday && !isBelirliHighlight && 'bg-primary/6',
                      isToday && !item.read_at && 'border-l-4 border-l-indigo-500 pl-2 sm:pl-3',
                      isBelirliHighlight && 'border-l-4 border-l-amber-500 pl-2 sm:pl-3',
                      rowAccent && !isToday && !isBelirliHighlight && 'pl-2.5 sm:pl-3.5',
                      rowAccent && !isToday && !isBelirliHighlight,
                    )}
                  >
                    <Link
                      href={getNotificationLink(item)}
                      className="min-w-0 flex-1"
                      onClick={(e) => handleLinkClick(e, item)}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div
                          className={cn(
                            'mt-0 flex size-9 shrink-0 items-center justify-center rounded-xl sm:mt-0.5 sm:size-11 sm:rounded-2xl',
                            bgClass,
                            'ring-1 sm:ring-2',
                          )}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 flex-nowrap items-center gap-1.5 sm:flex-wrap sm:gap-x-2 sm:gap-y-1">
                            <span
                              className={cn(
                                'min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight sm:flex-none sm:text-sm sm:leading-snug',
                                !item.read_at && 'text-foreground',
                                item.read_at && 'text-muted-foreground',
                              )}
                            >
                              {item.title}
                            </span>
                            <span
                              className={cn(
                                'inline-flex max-w-[46%] shrink-0 items-center truncate rounded px-1.5 py-px text-[9px] font-semibold leading-none sm:max-w-none sm:rounded-md sm:px-2 sm:py-0.5 sm:text-[11px] sm:font-medium',
                                getChipClass(item),
                              )}
                            >
                              {EVENT_LABELS[item.event_type] ?? item.event_type}
                            </span>
                            {!item.read_at && (
                              <span className="size-1.5 shrink-0 rounded-full bg-primary sm:size-2" aria-hidden />
                            )}
                          </div>
                          {item.body && (
                            <p className="mt-0.5 text-xs leading-snug text-muted-foreground line-clamp-2 sm:mt-1 sm:text-sm sm:leading-normal">
                              {item.body}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums sm:mt-1.5 sm:text-xs">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <div className="flex w-full shrink-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden border-t border-border/30 pt-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:w-auto sm:flex-wrap sm:justify-end sm:gap-1.5 sm:border-0 sm:pt-0 [&::-webkit-scrollbar]:hidden">
                      {isSwap && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ArrowRightLeft className="size-3.5" />
                          Takasa git
                        </Button>
                      )}
                      {isTimetable && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ExternalLink className="size-3.5" />
                          Programa git
                        </Button>
                      )}
                      {isDutyPlan && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ExternalLink className="size-3.5" />
                          Planlara git
                        </Button>
                      )}
                      {isDutyDaily && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ExternalLink className="size-3.5" />
                          Günlük tabloya git
                        </Button>
                      )}
                      {(BELIRLI_GUN_EVENT_TYPES.includes(item.event_type) || BILSEM_CALENDAR_EVENT_TYPES.includes(item.event_type)) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ExternalLink className="size-3.5" />
                          Takvime git
                        </Button>
                      )}
                      {SMART_BOARD_EVENT_TYPES.includes(item.event_type) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <Monitor className="size-3.5" />
                          Tahtaya git
                        </Button>
                      )}
                      {SUPPORT_EVENT_TYPES.includes(item.event_type) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ExternalLink className="size-3.5" />
                          Talebe git
                        </Button>
                      )}
                      {EXAM_DUTY_EVENT_TYPES.includes(item.event_type) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <ClipboardList className="size-3.5" />
                          Sınav görevlerine git
                        </Button>
                      )}
                      {MARKET_EVENT_TYPES.includes(item.event_type) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-10 flex-1 gap-1.5 text-xs max-sm:min-h-8 max-sm:gap-1 max-sm:px-2 max-sm:text-[11px] sm:min-h-9 sm:flex-initial"
                          onClick={(e) => {
                            e.preventDefault();
                            handleLinkClick(e, item);
                          }}
                        >
                          <Wallet className="size-3.5" />
                          Markete git
                        </Button>
                      )}
                      {!item.read_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="min-h-10 min-w-10 shrink-0 max-sm:min-h-8 max-sm:min-w-8 sm:min-h-9 sm:min-w-9"
                          onClick={(e) => {
                            e.preventDefault();
                            handleMarkRead(item.id);
                          }}
                          disabled={!!markingRead}
                          title="Okundu işaretle"
                        >
                          {markingRead === item.id ? (
                            <LoadingSpinner className="size-4" />
                          ) : (
                            <Check className="size-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-10 min-w-10 shrink-0 text-muted-foreground hover:text-destructive max-sm:min-h-8 max-sm:min-w-8 sm:min-h-9 sm:min-w-9"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteOne(item.id);
                        }}
                        disabled={!!deletingId}
                        title="Sil"
                      >
                        {deletingId === item.id ? (
                          <LoadingSpinner className="size-4" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {loadMoreVisible && (
            <div className="border-t px-3 py-3 sm:px-4">
              <Button variant="ghost" size="sm" className="min-h-11 w-full sm:min-h-9" onClick={loadMore}>
                Daha fazla yükle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
