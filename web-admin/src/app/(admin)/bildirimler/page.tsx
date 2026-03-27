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
  { label: 'Nöbet planı', icon: CalendarClock },
  { label: 'Belirli Gün', icon: CalendarDays },
  { label: 'Ajanda', icon: BookOpen },
  { label: 'Ders programı', icon: Table2 },
  { label: 'Akıllı Tahta', icon: Monitor },
  { label: 'Destek', icon: Headphones },
  { label: 'Sınav görevleri', icon: ClipboardList },
  { label: 'Market cüzdanı', icon: Wallet },
  { label: 'Duyurular', icon: Megaphone },
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

function getNotificationIcon(item: NotificationItem): { icon: React.ReactNode; bgClass: string } {
  if (isBilsemCalendarNotification(item.event_type)) {
    return {
      icon: <CalendarDays className="size-4" />,
      bgClass: 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
    };
  }
  if (isBelirliGunNotification(item.event_type)) {
    return {
      icon: <Award className="size-4" />,
      bgClass: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    };
  }
  if (isDutyNotification(item.event_type)) {
    return {
      icon: <CalendarClock className="size-4" />,
      bgClass: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    };
  }
  if (isTimetableNotification(item.event_type)) {
    return {
      icon: <Table2 className="size-4" />,
      bgClass: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    };
  }
  if (isSmartBoardNotification(item.event_type)) {
    return {
      icon: <Monitor className="size-4" />,
      bgClass: 'bg-teal-100 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400',
    };
  }
  if (isSupportNotification(item.event_type)) {
    return {
      icon: <Megaphone className="size-4" />,
      bgClass: 'bg-violet-100 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
    };
  }
  if (isExamDutyNotification(item.event_type)) {
    return {
      icon: <ClipboardList className="size-4" />,
      bgClass: 'bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400',
    };
  }
  if (isAgendaNotification(item.event_type)) {
    return {
      icon: <CalendarDays className="size-4" />,
      bgClass: 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
    };
  }
  if (isMarketNotification(item.event_type)) {
    return {
      icon: <Wallet className="size-4" />,
      bgClass: 'bg-lime-100 dark:bg-lime-950/40 text-lime-700 dark:text-lime-400',
    };
  }
  return {
    icon: <Megaphone className="size-4" />,
    bgClass: 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-500',
  };
}

function getChipClass(item: NotificationItem): string {
  if (isBilsemCalendarNotification(item.event_type)) {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300';
  }
  if (isBelirliGunNotification(item.event_type)) {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  }
  if (isDutyNotification(item.event_type)) {
    return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
  }
  if (isTimetableNotification(item.event_type)) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  }
  if (isSmartBoardNotification(item.event_type)) {
    return 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300';
  }
  if (isSupportNotification(item.event_type)) {
    return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300';
  }
  if (isExamDutyNotification(item.event_type)) {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
  }
  if (isAgendaNotification(item.event_type)) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
  }
  if (isMarketNotification(item.event_type)) {
    return 'bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
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
      'bg-white/95 text-slate-800 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 dark:bg-slate-800/95 dark:text-slate-50 dark:ring-white/12',
    idle: 'text-slate-500 hover:bg-white/55 dark:text-slate-400 dark:hover:bg-white/[0.06]',
  },
  duty: {
    active:
      'bg-linear-to-br from-indigo-100/95 to-violet-100/80 text-indigo-950 shadow-sm ring-1 ring-indigo-200/60 dark:from-indigo-950/55 dark:to-violet-950/45 dark:text-indigo-50 dark:ring-indigo-400/25',
    idle: 'text-indigo-600/75 hover:bg-indigo-100/35 dark:text-indigo-300/80 dark:hover:bg-indigo-950/35',
  },
  belirli: {
    active:
      'bg-linear-to-br from-amber-100/95 to-orange-100/75 text-amber-950 shadow-sm ring-1 ring-amber-200/60 dark:from-amber-950/45 dark:to-orange-950/35 dark:text-amber-50 dark:ring-amber-400/25',
    idle: 'text-amber-700/80 hover:bg-amber-100/40 dark:text-amber-300/85 dark:hover:bg-amber-950/30',
  },
  bilsem: {
    active:
      'bg-linear-to-br from-violet-100/95 to-violet-100/80 text-violet-950 shadow-sm ring-1 ring-violet-200/60 dark:from-violet-950/50 dark:to-violet-900/40 dark:text-violet-50 dark:ring-violet-400/25',
    idle: 'text-violet-600/80 hover:bg-violet-100/40 dark:text-violet-300/85 dark:hover:bg-violet-950/35',
  },
  timetable: {
    active:
      'bg-linear-to-br from-emerald-100/95 to-teal-100/75 text-emerald-950 shadow-sm ring-1 ring-emerald-200/55 dark:from-emerald-950/45 dark:to-teal-950/35 dark:text-emerald-50 dark:ring-emerald-400/25',
    idle: 'text-emerald-700/80 hover:bg-emerald-100/40 dark:text-emerald-300/85 dark:hover:bg-emerald-950/30',
  },
  agenda: {
    active:
      'bg-linear-to-br from-rose-100/95 to-pink-100/75 text-rose-950 shadow-sm ring-1 ring-rose-200/55 dark:from-rose-950/45 dark:to-pink-950/35 dark:text-rose-50 dark:ring-rose-400/25',
    idle: 'text-rose-600/80 hover:bg-rose-100/40 dark:text-rose-300/85 dark:hover:bg-rose-950/30',
  },
  smart_board: {
    active:
      'bg-linear-to-br from-cyan-100/95 to-sky-100/75 text-cyan-950 shadow-sm ring-1 ring-cyan-200/55 dark:from-cyan-950/45 dark:to-sky-950/35 dark:text-cyan-50 dark:ring-cyan-400/25',
    idle: 'text-cyan-700/80 hover:bg-cyan-100/40 dark:text-cyan-300/85 dark:hover:bg-cyan-950/30',
  },
  support: {
    active:
      'bg-linear-to-br from-fuchsia-100/95 to-purple-100/75 text-purple-950 shadow-sm ring-1 ring-fuchsia-200/55 dark:from-fuchsia-950/40 dark:to-purple-950/40 dark:text-fuchsia-50 dark:ring-fuchsia-400/25',
    idle: 'text-purple-600/80 hover:bg-fuchsia-100/35 dark:text-fuchsia-300/85 dark:hover:bg-fuchsia-950/30',
  },
  announcement: {
    active:
      'bg-linear-to-br from-amber-100/90 to-yellow-100/75 text-amber-950 shadow-sm ring-1 ring-amber-200/50 dark:from-amber-950/40 dark:to-yellow-950/30 dark:text-amber-50 dark:ring-amber-400/25',
    idle: 'text-amber-700/75 hover:bg-amber-100/35 dark:text-amber-300/80 dark:hover:bg-amber-950/28',
  },
  exam_duty: {
    active:
      'bg-linear-to-br from-sky-100/95 to-blue-100/75 text-sky-950 shadow-sm ring-1 ring-sky-200/55 dark:from-sky-950/45 dark:to-blue-950/40 dark:text-sky-50 dark:ring-sky-400/25',
    idle: 'text-sky-700/80 hover:bg-sky-100/40 dark:text-sky-300/85 dark:hover:bg-sky-950/30',
  },
  market: {
    active:
      'bg-linear-to-br from-lime-100/95 to-green-100/75 text-lime-950 shadow-sm ring-1 ring-lime-200/55 dark:from-lime-950/40 dark:to-green-950/35 dark:text-lime-50 dark:ring-lime-400/25',
    idle: 'text-lime-700/85 hover:bg-lime-100/40 dark:text-lime-300/85 dark:hover:bg-lime-950/30',
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
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Bell className="size-6 text-primary" />
              </div>
              <div className="min-w-0">
                <ToolbarPageTitle>Bildirimler</ToolbarPageTitle>
                <ToolbarIconHints
                  items={BILDIRIM_KAYNAK_ICONS}
                  summary="Nöbet planı, Belirli Gün, ajanda, ders programı, Akıllı Tahta, destek, sınav görevleri, market cüzdanı ve duyurularda burada bildirim alırsınız."
                />
              </div>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                  >
                    <CheckCheck className="size-4" />
                    Tümünü okundu yap
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="text-destructive hover:text-destructive"
                >
                  {deletingAll ? <LoadingSpinner className="size-4" /> : <Trash2 className="size-4" />}
                  Tümünü sil
                </Button>
              </div>
            )}
          </div>
        </ToolbarHeading>
      </Toolbar>

      {/* Filtre sekmeleri */}
      <div
        className={cn(
          'rounded-2xl border border-border/60 bg-linear-to-br from-slate-100/90 via-violet-50/50 to-sky-50/40 p-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.6)]',
          'dark:from-slate-950/80 dark:via-violet-950/20 dark:to-sky-950/25 dark:border-white/10 dark:shadow-inner',
        )}
      >
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterAndUpdateUrl(tab)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
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

      <Card>
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
                <div className="flex flex-wrap gap-2 justify-center">
                  <Link href="/duty">
                    <Button variant="outline" className="gap-2">
                      <CalendarClock className="size-4" />
                      Nöbetlere git
                    </Button>
                  </Link>
                  <Link href="/akademik-takvim">
                    <Button variant="outline" className="gap-2">
                      <Award className="size-4" />
                      Akademik Takvim
                    </Button>
                  </Link>
                  <Link href="/bilsem/takvim">
                    <Button variant="outline" className="gap-2">
                      <CalendarDays className="size-4" />
                      BİLSEM Takvim
                    </Button>
                  </Link>
                  <Link href="/ogretmen-ajandasi">
                    <Button variant="outline" className="gap-2">
                      <CalendarDays className="size-4" />
                      Öğretmen Ajandası
                    </Button>
                  </Link>
                  <Link href="/ders-programi/programlarim">
                    <Button variant="outline" className="gap-2">
                      <Table2 className="size-4" />
                      Programlarım
                    </Button>
                  </Link>
                  <Link href="/akilli-tahta">
                    <Button variant="outline" className="gap-2">
                      <Monitor className="size-4" />
                      Akıllı Tahta
                    </Button>
                  </Link>
                  <Link href="/support">
                    <Button variant="outline" className="gap-2">
                      <Megaphone className="size-4" />
                      Destek Talepleri
                    </Button>
                  </Link>
                  <Link href="/sinav-gorevlerim">
                    <Button variant="outline" className="gap-2">
                      <ClipboardList className="size-4" />
                      Sınav Görevleri
                    </Button>
                  </Link>
                  <Link href="/market">
                    <Button variant="outline" className="gap-2">
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
                return (
                  <li
                    key={item.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors rounded-lg mx-1 my-0.5',
                      !item.read_at && 'bg-primary/5',
                      isToday && !item.read_at && 'border-l-4 border-l-indigo-500',
                      isBelirliHighlight && 'border-l-4 border-l-amber-500',
                    )}
                  >
                    <Link
                      href={getNotificationLink(item)}
                      className="flex-1 min-w-0"
                      onClick={(e) => handleLinkClick(e, item)}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl',
                            bgClass,
                          )}
                        >
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'text-sm font-semibold',
                                !item.read_at && 'text-foreground',
                                item.read_at && 'text-muted-foreground',
                              )}
                            >
                              {item.title}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium',
                                getChipClass(item),
                              )}
                            >
                              {EVENT_LABELS[item.event_type] ?? item.event_type}
                            </span>
                            {!item.read_at && (
                              <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                            )}
                          </div>
                          {item.body && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.body}</p>
                          )}
                          <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isSwap && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="text-xs gap-1.5"
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
                          className="shrink-0"
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
                        className="shrink-0 text-muted-foreground hover:text-destructive"
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
            <div className="border-t px-4 py-3">
              <Button variant="ghost" size="sm" className="w-full" onClick={loadMore}>
                Daha fazla yükle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
