'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const TURKEY_TZ = 'Europe/Istanbul';

function useTurkeyClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('tr-TR', { timeZone: TURKEY_TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('tr-TR', { timeZone: TURKEY_TZ, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setTime(`${dateStr} ${timeStr}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { applyExamDutyWallClockInTurkey } from '@/lib/exam-duty-turkey-time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DateTimeInput } from '@/components/ui/datetime-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Send,
  ExternalLink,
  Search,
  Users,
  AlertTriangle,
  RefreshCw,
  FileEdit,
  CheckCircle2,
  FileText,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarRange,
  Calendar,
  Settings,
  SkipForward,
  CalendarPlus,
  CalendarX,
  FileCheck,
  Bell,
  Megaphone,
  PlayCircle,
  StopCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EXAM_DUTY_SAMPLES } from './exam-duty-samples';

const EXAM_DUTY_CATEGORIES = [
  { value: 'meb', label: 'MEB' },
  { value: 'osym', label: 'ÖSYM' },
  { value: 'aof', label: 'AÖF' },
  { value: 'ataaof', label: 'ATA-AÖF' },
  { value: 'auzef', label: 'AUZEF' },
] as const;

const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function padHHmm(s: string): string {
  const m = s.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) return s;
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

const DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES = ['09:00', '13:00', '17:00', '21:00'] as const;

const EXAM_DUTY_CARD_PRESET_TIMES: Record<string, string> = {
  application_start: '00:00',
  application_end: '23:59',
  application_approval_end: '11:00',
  result_date: '10:00',
  exam_date: '06:00',
  exam_date_end: '05:00',
};

const EXAM_DUTY_CARD_DEFAULT_TIME_FIELDS = [
  { key: 'application_start', label: 'Başvuru Açılış' },
  { key: 'application_end', label: 'Son Başvuru' },
  { key: 'application_approval_end', label: 'Başvuru Onay' },
  { key: 'result_date', label: 'Sonuç / Sınav öncesi (duvar saati)' },
  { key: 'exam_date', label: 'Sınav Tarihi' },
  { key: 'exam_date_end', label: 'Sınav sonrası (duvar saati)' },
] as const;

type ExamDutyNotifKey = 'deadline' | 'approval_day' | 'exam_minus_1d' | 'exam_plus_1d';

const DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES: Record<ExamDutyNotifKey, string> = {
  deadline: '09:00',
  approval_day: '09:00',
  exam_minus_1d: '09:00',
  exam_plus_1d: '09:00',
};

const EXAM_DUTY_CARD_NOTIFICATION_FIELDS: { key: ExamDutyNotifKey; label: string }[] = [
  { key: 'deadline', label: 'Son başvuru günü bildirimi' },
  { key: 'approval_day', label: 'Onay günü bildirimi' },
  { key: 'exam_minus_1d', label: 'Sınavdan 1 gün önce' },
  { key: 'exam_plus_1d', label: 'Sınavdan 1 gün sonra' },
];

const CATEGORY_COLORS: Record<string, string> = {
  meb: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  osym: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  aof: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ataaof: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  auzef: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
};

type ExamDutyItem = {
  id: string;
  title: string;
  category_slug?: string;
  categorySlug?: string;
  summary?: string | null;
  body?: string | null;
  source_url?: string | null;
  sourceUrl?: string | null;
  application_url?: string | null;
  applicationUrl?: string | null;
  application_start?: string | null;
  applicationStart?: string | null;
  application_end?: string | null;
  applicationEnd?: string | null;
  application_approval_end?: string | null;
  applicationApprovalEnd?: string | null;
  result_date?: string | null;
  resultDate?: string | null;
  exam_date?: string | null;
  examDate?: string | null;
  exam_date_end?: string | null;
  examDateEnd?: string | null;
  status: 'draft' | 'published';
  published_at?: string | null;
  publishedAt?: string | null;
  created_at?: string;
  createdAt?: string;
  source_list_section?: string | null;
  sourceListSection?: string | null;
  source_section_order?: number | null;
  sourceSectionOrder?: number | null;
  source_slider_pool_size?: number | null;
  sourceSliderPoolSize?: number | null;
};

type ListResponse = {
  items: ExamDutyItem[];
  total: number;
  draft_count?: number;
  published_count?: number;
};

type SyncSourceItem = {
  id: string;
  key: string;
  label: string;
  category_slug?: string;
  categorySlug?: string;
  rss_url?: string | null;
  is_active?: boolean;
  last_synced_at?: string | null;
  lastSyncedAt?: string | null;
  last_result_created?: number;
  lastResultCreated?: number;
  last_result_skipped?: number;
  lastResultSkipped?: number;
  last_result_error?: string | null;
  lastResultError?: string | null;
};

type SkippedItem = {
  source_key: string;
  source_label: string;
  title: string;
  url: string;
  reason: string;
  list_section?: 'slider' | 'list' | 'rss' | 'recheck';
  section_order?: number;
  slider_pool_size?: number;
};

function formatDutySourcePlace(i: ExamDutyItem): string {
  const sec = i.source_list_section ?? i.sourceListSection;
  const ord = i.source_section_order ?? i.sourceSectionOrder;
  const pool = i.source_slider_pool_size ?? i.sourceSliderPoolSize;
  if (sec === 'slider' && ord != null) {
    return pool != null && pool > 0 ? `Slayt ${ord + 1}/${pool}` : `Slayt · ${ord + 1}. sıra`;
  }
  if (sec === 'list' && ord != null) return `Liste ${ord + 1}`;
  if (sec === 'rss' && ord != null) return `RSS ${ord + 1}`;
  if (sec === 'recheck' && ord != null) return `Yeniden kontrol ${ord + 1}`;
  return '—';
}

function formatSkippedListPlace(row: SkippedItem): string {
  const n = row.section_order;
  if (row.list_section === 'slider') {
    const pool = row.slider_pool_size;
    if (n != null && pool != null && pool > 0) return `Slayt ${n + 1}/${pool}`;
    return n != null ? `Slayt · ${n + 1}. sıra (üstten)` : 'Slayt';
  }
  if (row.list_section === 'list') {
    return n != null ? `Sayfa listesi · ${n + 1}. sıra` : 'Sayfa listesi';
  }
  if (row.list_section === 'rss') {
    return n != null ? `RSS akışı · ${n + 1}. kayıt` : 'RSS akışı';
  }
  if (row.list_section === 'recheck') {
    return n != null ? `Yeniden kontrol · ${n + 1}.` : 'Yeniden kontrol';
  }
  return '—';
}

function compareSkippedItems(a: SkippedItem, b: SkippedItem): number {
  const rank = (s: SkippedItem): number => {
    switch (s.list_section) {
      case 'slider':
        return 0;
      case 'list':
        return 1;
      case 'rss':
        return 2;
      case 'recheck':
        return 3;
      default:
        return 9;
    }
  };
  const sk = (a.source_key || '').localeCompare(b.source_key || '', 'tr');
  if (sk !== 0) return sk;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  const oa = a.section_order ?? 1e9;
  const ob = b.section_order ?? 1e9;
  if (oa !== ob) return oa - ob;
  return (a.title || '').localeCompare(b.title || '', 'tr');
}

const EXAM_DUTY_HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Ayarlardaki HH:mm ile İstanbul takvim günü korunarak gösterim (sync’teki duvar saati ile uyum). */
function examDutyInstantWithDefaultWall(
  iso: string | null | undefined,
  defaultHHmm: string | undefined,
): string | null | undefined {
  if (iso == null || !String(iso).trim()) return iso ?? undefined;
  const t = (defaultHHmm ?? '').trim();
  if (!t || !EXAM_DUTY_HHMM_RE.test(t)) return iso;
  try {
    const adj = applyExamDutyWallClockInTurkey(new Date(iso), t);
    if (!adj || Number.isNaN(adj.getTime())) return iso;
    return adj.toISOString();
  } catch {
    return iso;
  }
}

/** Liste/akış: Bşv. Açılış kayıt anı (duvar saati uygulanmaz); diğer tarihlerde ayarlı duvar saati varsa İstanbul günü + o saat. */
function normalizeItem(i: ExamDutyItem, defaultTimes?: Record<string, string>): ExamDutyItem {
  const t = defaultTimes;
  let application_start = i.application_start ?? i.applicationStart;
  let application_end = examDutyInstantWithDefaultWall(i.application_end ?? i.applicationEnd, t?.application_end) ?? (i.application_end ?? i.applicationEnd);
  let application_approval_end =
    examDutyInstantWithDefaultWall(i.application_approval_end ?? i.applicationApprovalEnd, t?.application_approval_end) ??
    (i.application_approval_end ?? i.applicationApprovalEnd);
  let result_date = examDutyInstantWithDefaultWall(i.result_date ?? i.resultDate, t?.result_date) ?? (i.result_date ?? i.resultDate);
  let exam_date = examDutyInstantWithDefaultWall(i.exam_date ?? i.examDate, t?.exam_date) ?? (i.exam_date ?? i.examDate);
  let exam_date_end = examDutyInstantWithDefaultWall(i.exam_date_end ?? i.examDateEnd, t?.exam_date_end) ?? (i.exam_date_end ?? i.examDateEnd);
  return {
    ...i,
    category_slug: i.category_slug ?? i.categorySlug ?? '',
    source_url: i.source_url ?? i.sourceUrl,
    application_url: i.application_url ?? i.applicationUrl,
    application_start,
    application_end,
    application_approval_end,
    result_date,
    exam_date,
    exam_date_end,
    published_at: i.published_at ?? i.publishedAt,
  };
}

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
}

/** Tarih + saat (örn. 10.02.2026 09:15) - sadece gece yarısı değilse saati göster */
function formatDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
    if (hasTime) {
      return d.toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return formatDate(s);
  } catch {
    return '—';
  }
}

/** ISO date/datetime → datetime-local input value (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(s: string | null | undefined): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  } catch {
    return '';
  }
}

/** API'de result yokken: sınavın TR gününden −1 gün + varsayılan saat (form önerisi). */
function fillResultDateIfMissing(n: ExamDutyItem, defaultTimeHHmm: string): string {
  const rd = toDatetimeLocal(n.result_date ?? n.resultDate) || '';
  if (rd) return rd;
  const examIso = n.exam_date ?? n.examDate;
  if (!examIso) return '';
  const examInstant = new Date(examIso);
  if (Number.isNaN(examInstant.getTime())) return '';
  const examYmd = examInstant.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  const anchor = new Date(`${examYmd}T12:00:00+03:00`);
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  const prevYmd = anchor.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  const tm = (defaultTimeHHmm || '00:00').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  const h = tm ? parseInt(tm[1]!, 10) : 0;
  const min = tm ? parseInt(tm[2]!, 10) : 0;
  const resultAt = new Date(
    `${prevYmd}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+03:00`,
  );
  if (Number.isNaN(resultAt.getTime())) return '';
  return toDatetimeLocal(resultAt.toISOString());
}

/** datetime-local value → ISO string for API. defaultTime: HH:mm (varsayılan saat, sadece tarih girildiğinde) */
function toIsoForApi(s: string, defaultTime = '00:00'): string | undefined {
  if (!s?.trim()) return undefined;
  const v = s.trim();
  if (v.includes('T')) {
    return v.length === 16 ? `${v}:00` : v;
  }
  const [h, m] = defaultTime.split(':').map((x) => x.padStart(2, '0'));
  return `${v}T${h}:${m}:00`;
}

function isDatePast(s: string | null | undefined): boolean {
  if (!s) return false;
  try {
    const d = new Date(s);
    d.setHours(23, 59, 59, 999);
    return d.getTime() < Date.now();
  } catch {
    return false;
  }
}

type DateStatus = 'past' | 'today' | 'tomorrow' | 'soon' | 'approaching' | null;

/** Tarihe göre rozet: Geçti, Bugün, Yarın, Az kaldı, Yaklaşıyor */
function getDateStatus(s: string | null | undefined): DateStatus {
  if (!s) return null;
  try {
    const d = new Date(s);
    d.setHours(12, 0, 0, 0);
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const diffDays = Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return 'past';
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays <= 3) return 'soon';
    if (diffDays <= 7) return 'approaching';
    return null;
  } catch {
    return null;
  }
}

const DATE_STATUS_LABELS: Record<NonNullable<DateStatus>, { label: string; cn: string }> = {
  past: { label: 'Geçti', cn: 'text-destructive font-medium' },
  today: { label: 'Bugün', cn: 'text-amber-600 dark:text-amber-400 font-medium' },
  tomorrow: { label: 'Yarın', cn: 'text-amber-600 dark:text-amber-400' },
  soon: { label: 'Az kaldı', cn: 'text-amber-600 dark:text-amber-400' },
  approaching: { label: 'Yaklaşıyor', cn: 'text-muted-foreground' },
};

function renderDateWithStatus(s: string | null | undefined) {
  if (!s) return '—';
  const status = getDateStatus(s);
  const cfg = status ? DATE_STATUS_LABELS[status] : null;
  return (
    <span className={cfg?.cn}>
      {formatDateTime(s)}
      {status && (
        <span
          className={cn(
            'ml-1 inline-flex items-center gap-0.5 text-xs',
            status === 'past' && 'text-destructive'
          )}
          title={cfg!.label}
        >
          {status === 'past' && <AlertTriangle className="size-3.5" />}
          {cfg!.label}
        </span>
      )}
    </span>
  );
}

/** Tablo için kompakt tarih + saat (DD.MM.YY HH:mm – saat her zaman gösterilir) */
function formatDateShort(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Tablo hücresi için kompakt tarih + durum rozeti */
function renderDateCompact(s: string | null | undefined) {
  if (!s) return <span className="text-muted-foreground">—</span>;
  const status = getDateStatus(s);
  const cfg = status ? DATE_STATUS_LABELS[status] : null;
  const fullTitle = formatDateTime(s);
  return (
    <span
      className={cn('inline-flex flex-col gap-0.5 min-w-0', cfg?.cn)}
      title={status ? `${fullTitle} – ${cfg!.label}` : fullTitle}
    >
      <span className="text-xs tabular-nums">{formatDateShort(s)}</span>
      {status && (
        <span className={cn(
          'text-[10px] leading-tight truncate',
          status === 'past' ? 'text-destructive font-medium' : 'text-muted-foreground'
        )}>
          {status === 'past' && <AlertTriangle className="size-2.5 inline align-middle mr-0.5 shrink-0" />}
          {cfg!.label}
        </span>
      )}
    </span>
  );
}


/** ISO / tarih string → YYYY-MM-DD (Türkiye günü; takvim hücresi eşlemesi) */
function toYMDTurkey(s: string | null | undefined): string | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  } catch {
    return null;
  }
}

function turkeyCalendarNow(): { ymd: string; year: number; monthIndex: number } {
  const ymd = new Date().toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
  const [y, m] = ymd.split('-').map((x) => parseInt(x, 10));
  return { ymd, year: y, monthIndex: m - 1 };
}

type FlowEvent = {
  item: ExamDutyItem;
  type: 'application_start' | 'application_end' | 'application_approval_end' | 'result_date' | 'exam_date' | 'exam_date_end';
  label: string;
  datetime: string;
  color: string;
};

const FLOW_EVENT_ICONS: Record<FlowEvent['type'], typeof Calendar> = {
  application_start: CalendarPlus,
  application_end: CalendarX,
  application_approval_end: FileCheck,
  result_date: Bell,
  exam_date: PlayCircle,
  exam_date_end: StopCircle,
};

const FLOW_EVENT_CONFIG: Record<FlowEvent['type'], { label: string; color: string }> = {
  application_start: { label: 'Başvuru açıldı', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border-blue-300/50' },
  application_end: { label: 'Başvuru kapandı', color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/50 dark:text-slate-300 border-slate-300/50' },
  application_approval_end: { label: 'Başvuru onay son gün', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-amber-300/50' },
  result_date: { label: 'Sınav öncesi hatırlatma', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300/50' },
  exam_date: { label: 'Sınav başladı', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300/50' },
  exam_date_end: { label: 'Sınav bitti', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300 border-teal-300/50' },
};

function buildFlowEvents(items: ExamDutyItem[], defaultTimes?: Record<string, string>): FlowEvent[] {
  const events: FlowEvent[] = [];
  for (const item of items) {
    const n = normalizeItem(item, defaultTimes);
    const fields: { key: FlowEvent['type']; val: string | null | undefined }[] = [
      { key: 'application_start', val: n.application_start ?? n.applicationStart },
      { key: 'application_end', val: n.application_end ?? n.applicationEnd },
      { key: 'application_approval_end', val: n.application_approval_end ?? n.applicationApprovalEnd },
      { key: 'result_date', val: n.result_date ?? n.resultDate },
      { key: 'exam_date', val: n.exam_date ?? n.examDate },
      { key: 'exam_date_end', val: n.exam_date_end ?? n.examDateEnd },
    ];
    for (const { key, val } of fields) {
      if (val) {
        const cfg = FLOW_EVENT_CONFIG[key];
        events.push({ item, type: key, label: cfg.label, datetime: val, color: cfg.color });
      }
    }
  }
  return events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

function ExamDutyFlowCalendar({
  items,
  defaultTimes,
  onEdit,
  onSelectDate,
}: {
  items: ExamDutyItem[];
  defaultTimes?: Record<string, string>;
  onEdit: (item: ExamDutyItem) => void;
  onSelectDate: (d: string | null) => void;
}) {
  const [monthState, setMonthState] = useState(() => {
    const { year, monthIndex } = turkeyCalendarNow();
    return { year, month: monthIndex };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const flowEvents = useMemo(() => buildFlowEvents(items, defaultTimes), [items, defaultTimes]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, FlowEvent[]>();
    for (const e of flowEvents) {
      const ymd = toYMDTurkey(e.datetime);
      if (ymd) {
        const list = map.get(ymd) ?? [];
        list.push(e);
        map.set(ymd, list);
      }
    }
    map.forEach((list) => list.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()));
    return map;
  }, [flowEvents]);

  const firstDay = new Date(monthState.year, monthState.month, 1);
  const lastDay = new Date(monthState.year, monthState.month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const monthLabel = new Date(
    `${monthState.year}-${String(monthState.month + 1).padStart(2, '0')}-15T12:00:00+03:00`,
  ).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: TURKEY_TZ });
  const dayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const todayYMD = new Date().toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });

  const cells: { dateStr: string | null; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ dateStr: null, isCurrentMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthState.year}-${String(monthState.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ dateStr, isCurrentMonth: true });
  }
  const remainder = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < remainder; i++) cells.push({ dateStr: null, isCurrentMonth: false });

  const prevMonth = () => {
    if (monthState.month === 0) setMonthState({ year: monthState.year - 1, month: 11 });
    else setMonthState({ year: monthState.year, month: monthState.month - 1 });
  };
  const nextMonth = () => {
    if (monthState.month === 11) setMonthState({ year: monthState.year + 1, month: 0 });
    else setMonthState({ year: monthState.year, month: monthState.month + 1 });
  };

  const dayEvents = selectedDate ? (eventsByDate.get(selectedDate) ?? []) : [];

  const handleDayClick = (dateStr: string | null) => {
    setSelectedDate(dateStr);
    onSelectDate(dateStr);
  };

  const summaryLine = `${items.length} duyuru · ${flowEvents.length} olay · Türkiye saati`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-sm font-medium text-foreground">{summaryLine}</p>
        <p className="text-xs text-muted-foreground max-w-xl">
          Sync ile gelen kayıtlarda <strong className="font-medium text-foreground/90">başvuru onayı</strong>, son başvuru gününden{' '}
          <strong className="font-medium text-foreground/90">2 takvim günü</strong> sonraya otomatik yazılır; saat sınav görevi varsayılan saatlerinden gelir.
        </p>
      </div>

      {/* Olay türleri göstergesi */}
      <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Takvimdeki olay türleri</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(FLOW_EVENT_CONFIG) as [FlowEvent['type'], { label: string; color: string }][]).map(([k, cfg]) => {
            const Icon = FLOW_EVENT_ICONS[k];
            return (
              <span key={k} className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', cfg.color)}>
                {Icon && <Icon className="size-3.5 shrink-0" />}
                {cfg.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Ay navigasyonu */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={prevMonth} aria-label="Önceki ay">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-0 flex-1 text-center text-base font-semibold capitalize text-foreground">{monthLabel}</span>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={nextMonth} aria-label="Sonraki ay">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const { ymd, year, monthIndex } = turkeyCalendarNow();
            setMonthState({ year, month: monthIndex });
            handleDayClick(ymd);
          }}
          className="border-primary/40 text-primary hover:bg-primary/10 shrink-0"
        >
          <Calendar className="size-4 mr-1.5" />
          Bugüne git
        </Button>
      </div>

      {/* Takvim grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 gap-px bg-border">
          {dayLabels.map((l, idx) => (
            <div key={l} className={cn('py-2.5 text-center text-xs font-semibold uppercase tracking-wider', idx === 5 || idx === 6 ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/30 text-foreground')}>
              {l}
            </div>
          ))}
          {cells.map((c, i) => {
            if (!c.dateStr) return <div key={i} className="min-h-[100px] bg-muted/10" />;
            const isSelected = c.dateStr === selectedDate;
            const isToday = c.dateStr === todayYMD;
            const day = parseInt(c.dateStr.slice(8), 10);
            const dayOfWeek = new Date(`${c.dateStr}T12:00:00+03:00`).getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const evts = eventsByDate.get(c.dateStr) ?? [];
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDayClick(c.dateStr)}
                className={cn(
                  'min-h-[92px] sm:min-h-[100px] flex flex-col items-stretch justify-start p-1.5 rounded-md transition-all bg-card text-left',
                  !c.isCurrentMonth && 'opacity-40',
                  isWeekend && c.isCurrentMonth && !isSelected && 'bg-muted/20',
                  isSelected && 'bg-primary/20 ring-2 ring-primary shadow-md',
                  isToday && !isSelected && 'ring-2 ring-primary/30 bg-primary/5 font-semibold',
                  !isSelected && !isToday && 'hover:bg-muted/40',
                )}
              >
                <div className="flex items-center justify-between gap-1 shrink-0 w-full">
                  <span className={cn('text-sm font-medium tabular-nums', isSelected && 'font-semibold')}>{day}</span>
                  {evts.length > 0 && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-semibold text-primary tabular-nums">
                      {evts.length}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 mt-1 space-y-0.5 overflow-hidden">
                  {evts.slice(0, 3).map((e, j) => {
                    const CellIcon = FLOW_EVENT_ICONS[e.type];
                    return (
                      <div key={j} className={cn('flex items-center gap-1 rounded px-1.5 py-0.5 truncate border text-[10px]', e.color)} title={`${e.label}: ${e.item.title}`}>
                        {CellIcon && <CellIcon className="size-3 shrink-0 opacity-80" />}
                        <span className="truncate">{e.label}</span>
                      </div>
                    );
                  })}
                  {evts.length > 3 && <span className="text-[10px] text-muted-foreground">+{evts.length - 3} olay</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seçilen günün detayları */}
      {selectedDate && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border flex flex-wrap items-center gap-2">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <div>
              <h3 className="font-semibold text-foreground capitalize">
                {new Date(`${selectedDate}T12:00:00+03:00`).toLocaleDateString('tr-TR', { weekday: 'long', timeZone: TURKEY_TZ })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {new Date(`${selectedDate}T12:00:00+03:00`).toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: TURKEY_TZ,
                })}
                {dayEvents.length > 0 && ` · ${dayEvents.length} olay`}
              </p>
            </div>
          </div>
          <div className="p-4">
            {dayEvents.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="size-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">Bu günde kayıtlı olay yok</p>
                <p className="text-xs text-muted-foreground mt-1">Başka bir güne tıklayın veya liste görünümünden duyuru ekleyin.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dayEvents.map((e, i) => {
                  const EventIcon = FLOW_EVENT_ICONS[e.type];
                  return (
                  <div
                    key={i}
                    className={cn('flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3', e.color)}
                  >
                    <div className="flex shrink-0 items-center justify-center rounded-lg bg-background/80 p-2">
                      {EventIcon && <EventIcon className="size-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm">{e.item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <span className="font-medium text-foreground/80">{e.label}</span>
                        <span>·</span>
                        <span>{formatDateTime(e.datetime)}</span>
                      </p>
                      <span className={cn('inline-flex mt-1 rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_COLORS[e.item.category_slug ?? e.item.categorySlug ?? ''] ?? 'bg-muted')}>
                        {EXAM_DUTY_CATEGORIES.find((c) => c.value === (e.item.category_slug ?? e.item.categorySlug))?.label ?? (e.item.category_slug ?? e.item.categorySlug)}
                      </span>
                      <span className={cn('ml-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium', e.item.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300')}>
                        {e.item.status === 'published' ? 'Yayında' : 'Taslak'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {(e.item.application_url ?? e.item.applicationUrl) && (
                        <a href={e.item.application_url ?? e.item.applicationUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/10">
                          <ExternalLink className="size-3.5" /> Başvuru
                        </a>
                      )}
                      {(e.item.source_url ?? e.item.sourceUrl) && (
                        <a href={e.item.source_url ?? e.item.sourceUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                          <ExternalLink className="size-3.5" /> Kaynak
                        </a>
                      )}
                      <Button variant="outline" size="sm" onClick={() => onEdit(e.item)} className="gap-1.5">
                        <Pencil className="size-4" />
                        Düzenle
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SinavGorevleriPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [items, setItems] = useState<ExamDutyItem[]>([]);
  const [calendarItems, setCalendarItems] = useState<ExamDutyItem[]>([]);
  const [total, setTotal] = useState(0);
  const [listStats, setListStats] = useState({ draft: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [mainView, setMainView] = useState<'list' | 'flow-calendar' | 'skipped'>('list');
  const systemTimeTurkey = useTurkeyClock();
  const [skippedItems, setSkippedItems] = useState<SkippedItem[]>([]);
  const [skippedSyncedAt, setSkippedSyncedAt] = useState<string | null>(null);
  const [skippedLoading, setSkippedLoading] = useState(false);
  const skippedItemsSorted = useMemo(() => [...skippedItems].sort(compareSkippedItems), [skippedItems]);
  const [issueDutyRows, setIssueDutyRows] = useState<{ item: ExamDutyItem; reason: string }[]>([]);
  const [issueDutyLoading, setIssueDutyLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExamDutyItem | null>(null);
  const [bodyEditRaw, setBodyEditRaw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDateOpen, setBulkDateOpen] = useState(false);
  const [bulkDateForm, setBulkDateForm] = useState({ field: 'application_end', value: '' });
  const [targetCountCache, setTargetCountCache] = useState<Record<string, number>>({});
  const [syncSources, setSyncSources] = useState<SyncSourceItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [defaultTimes, setDefaultTimes] = useState<Record<string, string>>({});
  const [syncScheduleTimes, setSyncScheduleTimes] = useState<string[]>([...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES]);
  const [notificationTimes, setNotificationTimes] = useState<Record<ExamDutyNotifKey, string>>({
    ...DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES,
  });
  const [form, setForm] = useState({
    title: '',
    category_slug: 'meb',
    summary: '',
    body: '',
    source_url: '',
    application_url: '',
    application_start: '',
    application_end: '',
    application_approval_end: '',
    result_date: '',
    exam_date: '',
    exam_date_end: '',
  });

  const isSuperadmin = me?.role === 'superadmin';

  const fetchSyncSources = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    try {
      const sources = await apiFetch<SyncSourceItem[]>('/admin/exam-duties/sync-sources', { token });
      setSyncSources(Array.isArray(sources) ? sources : []);
    } catch {
      setSyncSources([]);
    }
  }, [token, isSuperadmin]);

  const fetchExamDutyConfig = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    try {
      const cfg = await apiFetch<{
        default_times?: Record<string, string>;
        notification_times?: Partial<Record<ExamDutyNotifKey, string>>;
        sync_options?: { sync_schedule_times?: string[] };
      }>('/app-config/exam-duty-sync', { token });
      const times = cfg?.default_times ?? {};
      const valid: Record<string, string> = {};
      const keys = ['application_start', 'application_end', 'application_approval_end', 'result_date', 'exam_date', 'exam_date_end'];
      for (const k of keys) {
        const v = times[k]?.trim();
        const preset = EXAM_DUTY_CARD_PRESET_TIMES[k] ?? '00:00';
        valid[k] = v && HHMM_RE.test(v) ? padHHmm(v) : preset;
      }
      setDefaultTimes(valid);

      const rawSched = cfg?.sync_options?.sync_schedule_times;
      const schedSet = new Set<string>();
      if (Array.isArray(rawSched)) {
        for (const x of rawSched) {
          const s = String(x).trim();
          if (HHMM_RE.test(s)) schedSet.add(padHHmm(s));
        }
      }
      const sched = schedSet.size > 0 ? [...schedSet].sort() : [...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES];
      setSyncScheduleTimes(sched);

      const nt = cfg?.notification_times ?? {};
      const nextNotif: Record<ExamDutyNotifKey, string> = { ...DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES };
      for (const k of Object.keys(DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES) as ExamDutyNotifKey[]) {
        const v = nt[k]?.trim();
        if (v && HHMM_RE.test(v)) nextNotif[k] = padHHmm(v);
      }
      setNotificationTimes(nextNotif);
    } catch {
      setDefaultTimes({});
      setSyncScheduleTimes([...DEFAULT_EXAM_DUTY_SYNC_SCHEDULE_TIMES]);
      setNotificationTimes({ ...DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES });
    }
  }, [token, isSuperadmin]);

  const fetchSkippedItems = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    setSkippedLoading(true);
    try {
      const res = await apiFetch<{ items: SkippedItem[]; synced_at: string | null }>(
        '/admin/exam-duties/sync-last-skipped',
        { token }
      );
      setSkippedItems(Array.isArray(res?.items) ? res.items : []);
      setSkippedSyncedAt(res?.synced_at ?? null);
    } catch {
      setSkippedItems([]);
      setSkippedSyncedAt(null);
    } finally {
      setSkippedLoading(false);
    }
  }, [token, isSuperadmin]);

  const effectiveLimit = mainView === 'flow-calendar' ? 500 : limit;
  const fetchIssueDutyRows = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    setIssueDutyLoading(true);
    try {
      const pNoSource = new URLSearchParams({ missing_source_dates: '1', limit: '100', page: '1' });
      const pNoExam = new URLSearchParams({ missing_exam_date: '1', limit: '100', page: '1' });
      const [r1, r2] = await Promise.all([
        apiFetch<ListResponse>(`/admin/exam-duties?${pNoSource}`, { token }),
        apiFetch<ListResponse>(`/admin/exam-duties?${pNoExam}`, { token }),
      ]);
      const fromSource = r1?.items ?? [];
      const fromExam = r2?.items ?? [];
      const byId = new Map<string, { item: ExamDutyItem; fromNoSource: boolean; fromNoExam: boolean }>();
      for (const it of fromSource) {
        byId.set(it.id, { item: it, fromNoSource: true, fromNoExam: true });
      }
      for (const it of fromExam) {
        const ex = byId.get(it.id);
        if (ex) ex.fromNoExam = true;
        else byId.set(it.id, { item: it, fromNoSource: false, fromNoExam: true });
      }
      const rows: { item: ExamDutyItem; reason: string }[] = [];
      for (const { item, fromNoSource } of byId.values()) {
        const app = item.application_end ?? item.applicationEnd;
        if (fromNoSource) {
          rows.push({
            item,
            reason:
              'Hem son başvuru hem sınav alanları boş. GPT+regex tüm metni taramış olmalı; “tarihsiz taslak ekle” ile de açılmış olabilir. Kaynağı açıp Düzenle veya yeni sync dene.',
          });
        } else {
          rows.push({
            item,
            reason: `Sınav başlangıç/bitiş yok. Son başvuru kayıtta: ${app ? 'dolu' : 'boş'}. Haber çoğunlukla ücret/son başvuru listesi; sınav günü ayrı ilan. Kaynak linkinden kontrol, Düzenle veya re-sync.`,
          });
        }
      }
      rows.sort((a, b) => a.item.title.localeCompare(b.item.title, 'tr'));
      setIssueDutyRows(rows);
    } catch {
      setIssueDutyRows([]);
    } finally {
      setIssueDutyLoading(false);
    }
  }, [token, isSuperadmin]);

  const fetchList = useCallback(async (opts?: { forCalendar?: boolean }) => {
    if (!token || !isSuperadmin) return;
    const forCalendar = opts?.forCalendar ?? false;
    if (mainView === 'skipped' && !forCalendar) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category_slug', categoryFilter);
      if (statusFilter && !forCalendar) params.set('status', statusFilter);
      if (forCalendar || mainView === 'list') params.set('has_exam_date', '1');
      params.set('page', String(forCalendar ? 1 : page));
      params.set('limit', String(forCalendar ? 100 : limit));
      const res = await apiFetch<ListResponse>(`/admin/exam-duties?${params}`, { token });
      const list = (res.items ?? []).map((it) => normalizeItem(it, defaultTimes));
      if (forCalendar) {
        setCalendarItems(list);
      } else {
        setItems(list);
      }
      setTotal(res.total ?? list.length);
      setListStats({
        draft: res.draft_count ?? 0,
        published: res.published_count ?? 0,
      });
    } catch {
      if (forCalendar) setCalendarItems([]);
      else {
        setItems([]);
      }
      setTotal(0);
      setListStats({ draft: 0, published: 0 });
    } finally {
      setLoading(false);
    }
  }, [token, isSuperadmin, categoryFilter, statusFilter, page, limit, mainView, defaultTimes]);

  useEffect(() => {
    if (!isSuperadmin) {
      router.replace('/403');
      return;
    }
    void fetchExamDutyConfig();
    void fetchSyncSources();
  }, [isSuperadmin, router, fetchExamDutyConfig, fetchSyncSources]);

  useEffect(() => {
    if (!isSuperadmin || !token) return;
    void fetchList();
  }, [isSuperadmin, token, fetchList]);

  const refreshAtlananlar = useCallback(() => {
    void fetchSkippedItems();
    void fetchIssueDutyRows();
  }, [fetchSkippedItems, fetchIssueDutyRows]);

  useEffect(() => {
    if (mainView === 'skipped' && isSuperadmin && token) {
      refreshAtlananlar();
    }
  }, [mainView, isSuperadmin, token, refreshAtlananlar]);

  // Akış Takvimi açıldığında sadece takvim için veri çek (limit 100, backend max; status yok); yayınlanan duyurular dahil tüm tarihler görünsün
  useEffect(() => {
    if (mainView === 'flow-calendar' && isSuperadmin && token) {
      setCalendarItems([]);
      fetchList({ forCalendar: true });
    }
  }, [mainView, isSuperadmin, token, fetchList]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, statusFilter, limit, mainView]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      category_slug: 'meb',
      summary: '',
      body: '',
      source_url: '',
      application_url: '',
      application_start: '',
      application_end: '',
      application_approval_end: '',
      result_date: '',
      exam_date: '',
      exam_date_end: '',
    });
    setBodyEditRaw(false);
    setShowForm(true);
  };

  const openEdit = async (item: ExamDutyItem) => {
    setEditing(item);
    setBodyEditRaw(false);
    setShowForm(true);
    if (!token || !item.id) return;
    try {
      const full = await apiFetch<ExamDutyItem>(`/admin/exam-duties/${item.id}`, { token });
      const n = normalizeItem(full, defaultTimes);
      setForm({
        title: n.title,
        category_slug: (n.category_slug ?? n.categorySlug ?? 'meb') as string,
        summary: n.summary ?? '',
        body: n.body ?? '',
        source_url: n.source_url ?? n.sourceUrl ?? '',
        application_url: n.application_url ?? n.applicationUrl ?? '',
        application_start: toDatetimeLocal(n.application_start ?? n.applicationStart) || '',
        application_end: toDatetimeLocal(n.application_end ?? n.applicationEnd) || '',
        application_approval_end: toDatetimeLocal(n.application_approval_end ?? n.applicationApprovalEnd) || '',
        result_date: fillResultDateIfMissing(n, defaultTimes.result_date ?? '00:00'),
        exam_date: toDatetimeLocal(n.exam_date ?? n.examDate) || '',
        exam_date_end: toDatetimeLocal(n.exam_date_end ?? n.examDateEnd) || '',
      });
    } catch {
      const n = normalizeItem(item, defaultTimes);
      setForm({
        title: n.title,
        category_slug: (n.category_slug ?? n.categorySlug ?? 'meb') as string,
        summary: n.summary ?? '',
        body: n.body ?? '',
        source_url: n.source_url ?? n.sourceUrl ?? '',
        application_url: n.application_url ?? n.applicationUrl ?? '',
        application_start: toDatetimeLocal(n.application_start ?? n.applicationStart) || '',
        application_end: toDatetimeLocal(n.application_end ?? n.applicationEnd) || '',
        application_approval_end: toDatetimeLocal(n.application_approval_end ?? n.applicationApprovalEnd) || '',
        result_date: fillResultDateIfMissing(n, defaultTimes.result_date ?? '00:00'),
        exam_date: toDatetimeLocal(n.exam_date ?? n.examDate) || '',
        exam_date_end: toDatetimeLocal(n.exam_date_end ?? n.examDateEnd) || '',
      });
    }
  };

  const handleSave = async () => {
    if (!token || !form.title.trim()) {
      toast.error('Başlık zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        category_slug: form.category_slug,
        summary: form.summary.trim() || undefined,
        body: form.body.trim() || undefined,
        source_url: form.source_url.trim() || undefined,
        application_url: form.application_url.trim() || undefined,
        application_start: toIsoForApi(form.application_start, defaultTimes.application_start),
        application_end: toIsoForApi(form.application_end, defaultTimes.application_end),
        application_approval_end: toIsoForApi(form.application_approval_end, defaultTimes.application_approval_end),
        result_date: toIsoForApi(form.result_date, defaultTimes.result_date),
        exam_date: toIsoForApi(form.exam_date, defaultTimes.exam_date),
        exam_date_end: toIsoForApi(form.exam_date_end, defaultTimes.exam_date_end),
      };
      if (editing) {
        await apiFetch(`/admin/exam-duties/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Sınav görevi güncellendi');
      } else {
        await apiFetch('/admin/exam-duties', { method: 'POST', token, body: JSON.stringify(body) });
        toast.success('Sınav görevi oluşturuldu');
      }
      setShowForm(false);
      fetchList();
      if (mainView === 'skipped') void fetchIssueDutyRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Bu sınav görevini silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/admin/exam-duties/${id}`, { method: 'DELETE', token });
      toast.success('Silindi');
      fetchList();
      if (mainView === 'skipped') void fetchIssueDutyRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const fetchTargetCount = useCallback(
    async (id: string) => {
      if (!token) return 0;
      try {
        const res = await apiFetch<{ count: number }>(`/admin/exam-duties/${id}/target-count`, { token });
        setTargetCountCache((c) => ({ ...c, [id]: res.count }));
        return res.count;
      } catch {
        return 0;
      }
    },
    [token]
  );

  const handlePublish = async (id: string) => {
    if (!token) return;
    const count = await fetchTargetCount(id);
    const msg =
      count > 0
        ? `Bu sınav görevini yayınlayacaksınız. ${count} öğretmene bildirim gidecek. Devam?`
        : 'Bu sınav görevini yayınlayacaksınız. (Tercihe uyan öğretmen yok) Devam?';
    if (!confirm(msg)) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/exam-duties/${id}/publish`, { method: 'POST', token });
      toast.success('Yayınlandı');
      fetchList();
      if (mainView === 'skipped') void fetchIssueDutyRows();
      setSelectedIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlanamadı');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = searchQuery.trim()
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (i.summary ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : items;

  /** Bşv. Açılış (application_start): yeniden eskiye — bugüne yakın üstte; tarihsiz en altta */
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const dA = a.application_start ?? a.applicationStart ?? '';
      const dB = b.application_start ?? b.applicationStart ?? '';
      if (!dA && !dB) return 0;
      if (!dA) return 1;
      if (!dB) return -1;
      return new Date(dB).getTime() - new Date(dA).getTime();
    });
  }, [filteredItems]);

  const draftItems = filteredItems.filter((i) => i.status === 'draft');
  const selectedDraftIds = draftItems.filter((i) => selectedIds.has(i.id)).map((i) => i.id);
  const allDraftsSelected = draftItems.length > 0 && selectedDraftIds.length === draftItems.length;

  const handleBulkPublish = async () => {
    if (!token || selectedDraftIds.length === 0) return;
    if (!confirm(`${selectedDraftIds.length} taslak yayınlanacak. Her biri için tercihe uyan öğretmenlere bildirim gidecek. Devam?`)) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ published: number; errors: { id: string; message: string }[] }>(
        '/admin/exam-duties/bulk-publish',
        { method: 'POST', token, body: JSON.stringify({ ids: selectedDraftIds }) }
      );
      if (res.errors?.length) {
        toast.warning(`${res.published} yayınlandı, ${res.errors.length} hata.`);
      } else {
        toast.success(`${res.published} sınav görevi yayınlandı`);
      }
      setSelectedIds(new Set());
      fetchList();
      if (mainView === 'skipped') void fetchIssueDutyRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu yayınlama başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!token || selectedDraftIds.length === 0) return;
    if (!confirm(`${selectedDraftIds.length} taslak silinecek. Bu işlem geri alınamaz. Devam?`)) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ deleted: number; errors: { id: string; message: string }[] }>(
        '/admin/exam-duties/bulk-delete',
        { method: 'POST', token, body: JSON.stringify({ ids: selectedDraftIds }) }
      );
      if (res.errors?.length) {
        toast.warning(`${res.deleted} silindi, ${res.errors.length} hata.`);
      } else {
        toast.success(`${res.deleted} taslak silindi`);
      }
      setSelectedIds(new Set());
      fetchList();
      if (mainView === 'skipped') void fetchIssueDutyRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu silme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkUpdateDates = async () => {
    if (!token || selectedDraftIds.length === 0 || !bulkDateForm.value) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ updated: number; errors: { id: string; message: string }[] }>(
        '/admin/exam-duties/bulk-update-dates',
        { method: 'POST', token, body: JSON.stringify({ ids: selectedDraftIds, field: bulkDateForm.field, value: bulkDateForm.value }) }
      );
      if (res.errors?.length) {
        toast.warning(`${res.updated} güncellendi, ${res.errors.length} hata.`);
      } else {
        toast.success(`${res.updated} taslakta tarih güncellendi`);
      }
      setBulkDateOpen(false);
      setBulkDateForm({ field: 'application_end', value: '' });
      setSelectedIds(new Set());
      fetchList();
      if (mainView === 'skipped') void fetchIssueDutyRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu tarih güncelleme başarısız');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllDrafts = () => {
    if (allDraftsSelected) {
      setSelectedIds((s) => {
        const next = new Set(s);
        draftItems.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedIds((s) => {
        const next = new Set(s);
        draftItems.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const handleShowTargetCount = async (id: string) => {
    const count = await fetchTargetCount(id);
    toast.info(`${count} öğretmene bildirim gidecek`);
  };

  const handleRunSync = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        message: string;
        total_created: number;
        total_restored?: number;
        total_gpt_errors?: number;
        quota_limit?: number;
        quota_skipped?: number;
        results?: { source_key: string; created: number; skipped: number; error?: string }[];
        skipped_items?: SkippedItem[];
      }>('/admin/exam-duties/sync', { method: 'POST', token });
      toast.success(res.message);
      if ((res.total_restored ?? 0) > 0) toast.info(`${res.total_restored} silinen duyuru geri yüklendi`);
      setSkippedItems(Array.isArray(res.skipped_items) ? res.skipped_items : []);
      setSkippedSyncedAt(new Date().toISOString());
      fetchList();
      void fetchIssueDutyRows();
      fetchSyncSources();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync başarısız');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearSyncData = async () => {
    if (!token) return;
    if (
      !confirm(
        'Kaynaklara bağlı TÜM sınav görevi duyuruları kalıcı silinecek (taslak, yayın, admin soft silinmiş), kaynak satırlarının sync geçmişi ve slayt adımı (0) sıfırlanacak; işlemcideki son atlananlar listesi de temizlenir. Devam?',
      )
    )
      return;
    setSyncing(true);
    try {
      const res = await apiFetch<{
        deleted: number;
        sources_reset: number;
        scrape_slider_reset?: boolean;
      }>('/admin/exam-duties/clear-sync-data', {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      const sliderNote = res.scrape_slider_reset ? ' Slayt sırası (küresel) sıfırlandı.' : '';
      toast.success(
        res.deleted > 0
          ? `${res.deleted} duyuru silindi, ${res.sources_reset} kaynak sync sıfırlandı.${sliderNote}`
          : `Silinecek kayıt yok; ${res.sources_reset} kaynak sync sıfırlandı.${sliderNote}`,
      );
      fetchList();
      void fetchIssueDutyRows();
      void fetchSkippedItems();
      fetchSyncSources();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Temizleme başarısız');
    } finally {
      setSyncing(false);
    }
  };

  const draftCount = listStats.draft;
  const publishedCount = listStats.published;
  const totalPages = Math.ceil(total / limit) || 1;

  const statsScopeLabel =
    mainView === 'list'
      ? 'Sınav tarihi olan duyurular'
      : mainView === 'flow-calendar'
        ? 'Takvim (sınav tarihi olan)'
        : mainView === 'skipped'
          ? 'Sync atlananları + kayıtta tarihi eksik taslaklar (Atlananlar sekmesi)'
          : 'Filtreye göre';

  if (!isSuperadmin) return null;

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <ClipboardList className="size-6 text-primary" />
              </div>
              <div>
                <ToolbarPageTitle>Sınav Görevleri</ToolbarPageTitle>
                <ToolbarIconHints
                  compact
                  items={[
                    { label: 'Duyuru yönetimi', icon: Megaphone },
                    { label: 'Yayın ve öğretmen bildirimi', icon: Send },
                    { label: 'Bildirimler', icon: Bell },
                  ]}
                  summary="MEB, ÖSYM vb. sınav görevi duyurularını yönetin. Yayınlayınca tercihe uyan öğretmenlere bildirim gider."
                />
                {systemTimeTurkey && (
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground" title="Planlanan bildirimler her gün 09:00 (Türkiye) civarında gider">
                    <span className="tabular-nums font-medium text-foreground/90">{systemTimeTurkey}</span>
                    <span className="text-muted-foreground/80">(Türkiye)</span>
                    <span className="hidden sm:inline">— Bildirimler 09:00&apos;da</span>
                  </p>
                )}
              </div>
            </div>
            <ToolbarActions>
              {selectedDraftIds.length > 0 && (
                <>
                  <Button
                    onClick={handleBulkPublish}
                    disabled={saving}
                    variant="default"
                    className="gap-2"
                  >
                    <Send className="size-4" />
                    Seçilenleri Yayınla ({selectedDraftIds.length})
                  </Button>
                  <Button
                    onClick={handleBulkDelete}
                    disabled={saving}
                    variant="destructive"
                    className="gap-2"
                  >
                    <Trash2 className="size-4" />
                    Seçilenleri Sil ({selectedDraftIds.length})
                  </Button>
                  <Button
                    onClick={() => setBulkDateOpen(true)}
                    disabled={saving}
                    variant="outline"
                    className="gap-2"
                  >
                    <CalendarPlus className="size-4" />
                    Toplu Tarih ({selectedDraftIds.length})
                  </Button>
                </>
              )}
              <Button onClick={openCreate} className="gap-2">
                <Plus className="size-4" />
                Yeni Sınav Görevi
              </Button>
            </ToolbarActions>
          </div>
        </ToolbarHeading>
      </Toolbar>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground px-0.5">{statsScopeLabel}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="overflow-hidden rounded-xl border-amber-200/60 bg-amber-50/50 shadow-sm dark:border-amber-800/40 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <FileEdit className="size-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums text-foreground">{draftCount}</p>
                <p className="text-sm font-medium text-muted-foreground">Taslak</p>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-xl border-green-200/60 bg-green-50/50 shadow-sm dark:border-green-800/40 dark:bg-green-950/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="size-6 text-green-700 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums text-foreground">{publishedCount}</p>
                <p className="text-sm font-medium text-muted-foreground">Yayında</p>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden rounded-xl border-blue-200/60 bg-blue-50/50 shadow-sm dark:border-blue-800/40 dark:bg-blue-950/20">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40">
                <ClipboardList className="size-6 text-blue-700 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums text-foreground">{total}</p>
                <p className="text-sm font-medium text-muted-foreground">Toplam</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Görünüm seçici: Liste / Akış Takvimi / Atlananlar */}
      <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Görünüm</p>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-stretch">
          <button
            type="button"
            onClick={() => setMainView('list')}
            title="Duyuruları tablo veya kart olarak listele"
            className={cn(
              'flex min-h-[48px] w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all sm:min-w-[120px] sm:w-auto',
              mainView === 'list'
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent'
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <List className="size-4 shrink-0" />
              Liste
            </span>
            <span className={cn('text-xs', mainView === 'list' ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              Tablo veya kart
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMainView('flow-calendar')}
            title="Tarihlere göre takvimde görüntüle"
            className={cn(
              'flex min-h-[48px] w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all sm:min-w-[120px] sm:w-auto',
              mainView === 'flow-calendar'
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent'
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <CalendarRange className="size-4 shrink-0" />
              Akış Takvimi
            </span>
            <span className={cn('text-xs', mainView === 'flow-calendar' ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              Tarih bazlı akış
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMainView('skipped')}
            title="Sync’te neden atlandığı + kayıtta tarih eksik taslaklar (tek sayfa)"
            className={cn(
              'flex min-h-[48px] w-full flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-all sm:min-w-[140px] sm:w-auto',
              mainView === 'skipped'
                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-transparent'
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <SkipForward className="size-4 shrink-0" />
              Atlananlar
            </span>
            <span className={cn('text-xs', mainView === 'skipped' ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
              Atlanan + tarihsiz / sınav yok
            </span>
          </button>
        </div>
      </div>

      {mainView === 'skipped' && (
        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <SkipForward className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Atlananlar ve eksik tarih</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    (1) Sync’te neden haber alınmadı, (2) alındıysa kayıtta hangi alan boş kaldı — tüm nedenler bu sayfada
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {skippedSyncedAt && (
                  <span className="text-xs text-muted-foreground">
                    Son sync: {new Date(skippedSyncedAt).toLocaleString('tr-TR')}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshAtlananlar()}
                  disabled={skippedLoading || issueDutyLoading}
                  className="gap-1.5"
                >
                  <RefreshCw className={skippedLoading || issueDutyLoading ? 'size-4 animate-spin' : 'size-4'} />
                  Yenile
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Üst bölüm: son sync’te atlanan RSS/Slayt satırları. Alt bölüm: veritabanındaki taslak/yayın kayıtları; “tarihsiz” ve
              “sınav yok” filtreleri yönetimden kaldırıldı, hepsi burada birleşir. Yeni özet için &quot;Şimdi Sync&quot; çalıştırın.
            </p>
          </CardHeader>
          <CardContent className="p-0 space-y-0">
            <div className="border-b border-border/60 bg-muted/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              1. Sync’te hiç eklenmeyen (kaynak satırı)
            </div>
            {skippedLoading ? (
              <div className="flex min-h-[120px] items-center justify-center py-8">
                <LoadingSpinner className="size-6" />
              </div>
            ) : skippedItemsSorted.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">Son sync’te atlanan satır yok (veya henüz sync yapılmadı).</p>
            ) : (
              <div className="table-x-scroll">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left font-semibold">Kaynak</th>
                        <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Sayfadaki yer</th>
                        <th className="px-4 py-3 text-left font-semibold">Başlık</th>
                        <th className="px-4 py-3 text-left font-semibold min-w-[220px]">Haber linki</th>
                        <th className="px-4 py-3 text-left font-semibold">Neden atlandı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skippedItemsSorted.map((row, idx) => (
                        <tr key={`${row.source_key}-${row.url}-${idx}`} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium text-foreground/90">{row.source_label}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap" title={formatSkippedListPlace(row)}>
                            {formatSkippedListPlace(row)}
                          </td>
                          <td className="px-4 py-2.5 text-foreground line-clamp-2" title={row.title}>{row.title}</td>
                          <td className="px-4 py-2.5 text-xs break-all max-w-[min(28rem,40vw)]">
                            {row.url ? (
                              <a
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline font-medium"
                                title={row.url}
                              >
                                {row.url}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs leading-relaxed">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>
            )}

            <div className="border-b border-t border-border/60 bg-muted/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              2. Kayıtta tamamlanmamış tarih (Tarihsiz / Sınav yok — aynı liste)
            </div>
            <p className="px-4 py-2 text-xs text-muted-foreground border-b border-border/40">
              Bölüm 1 boşken burada satır olabilir: haber sync’te atlanmadan kayda alınmış; tarihler GPT/kaynakta
              bulunamadı veya <span className="whitespace-nowrap">“tarihsiz taslak ekle”</span> açıkken eklendi.
            </p>
            {issueDutyLoading && issueDutyRows.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center py-8">
                <LoadingSpinner className="size-6" />
              </div>
            ) : issueDutyRows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                Bu aralıktaki taslakta eksik alan yok (veya kayıt yok).
              </p>
            ) : (
              <div className="table-x-scroll">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                      <th className="px-4 py-3 text-left font-semibold">Durum</th>
                      <th className="px-4 py-3 text-left font-semibold">Başlık</th>
                      <th className="px-4 py-3 text-left font-semibold min-w-[200px]">Kaynak linki</th>
                      <th className="px-4 py-3 text-left font-semibold">Açıklama (neden)</th>
                      <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Kaynak yeri</th>
                      <th className="w-24 px-4 py-3 text-right font-semibold">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueDutyRows.map(({ item: r, reason }) => {
                      const n = normalizeItem(r, defaultTimes);
                      const cat = n.category_slug ?? n.categorySlug ?? '';
                      const srcUrl = r.source_url ?? r.sourceUrl ?? '';
                      return (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground',
                              )}
                            >
                              {EXAM_DUTY_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            {r.status === 'published' ? 'Yayında' : 'Taslak'}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-foreground line-clamp-2" title={r.title}>
                            {r.title}
                          </td>
                          <td className="px-4 py-2.5 text-xs break-all max-w-[min(20rem,35vw)]">
                            {srcUrl ? (
                              <a
                                href={srcUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline"
                                title={srcUrl}
                              >
                                {srcUrl}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs leading-snug max-w-md">{reason}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap" title={formatDutySourcePlace(n)}>
                            {formatDutySourcePlace(n)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(r)}>
                              <Pencil className="size-3.5" />
                              Düzenle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <RefreshCw className="size-5 text-primary" />
                Otomatik Sync
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                RSS ve scrape kaynaklarından duyurular, Ayarlar → Senkronizasyon’da kayıtlı İstanbul saatlerinde günde{' '}
                {syncScheduleTimes.length} kez tetiklenir ({syncScheduleTimes.join(', ')}). Kaynakları ve bu saatleri Ayarlar
                sayfasından yönetin.
              </p>
              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground/80">Taslakta yalnız gün geldiğinde duvar saati:</span>
                  {EXAM_DUTY_CARD_DEFAULT_TIME_FIELDS.map(({ key, label }) => (
                    <span key={key} title={label}>
                      {label}: {defaultTimes[key] ?? EXAM_DUTY_CARD_PRESET_TIMES[key] ?? '—'}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="font-medium text-foreground/80">Planlı öğretmen bildirimleri (İstanbul):</span>
                  {EXAM_DUTY_CARD_NOTIFICATION_FIELDS.map(({ key, label }) => (
                    <span key={key} title={label}>
                      {label}: {notificationTimes[key] ?? DEFAULT_EXAM_DUTY_NOTIFICATION_TIMES[key]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/sinav-gorevleri/ayarlar">
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="size-4" />
                  Ayarlar
                </Button>
              </Link>
              <Button onClick={handleRunSync} disabled={syncing} variant="outline" className="gap-2">
                <RefreshCw className={syncing ? 'size-4 animate-spin' : 'size-4'} />
                {syncing ? 'Sync ediliyor…' : 'Şimdi Sync'}
              </Button>
              <Button onClick={handleClearSyncData} disabled={syncing} variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                Sync Verilerini Temizle
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {syncSources.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Henüz sync kaynağı yok. Migration ile varsayılan MEB Personel GM eklenir.</p>
          ) : (
            <div className="table-x-scroll">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Kaynak</th>
                    <th>Kategori</th>
                    <th>Son Sync</th>
                    <th>Eklenen</th>
                    <th>Atlanan</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {syncSources.map((s) => {
                    const lastAt = s.last_synced_at ?? s.lastSyncedAt;
                    const created = s.last_result_created ?? s.lastResultCreated ?? 0;
                    const skipped = s.last_result_skipped ?? s.lastResultSkipped ?? 0;
                    const err = s.last_result_error ?? s.lastResultError;
                    return (
                      <tr key={s.id}>
                        <td className="font-medium">{s.label}</td>
                        <td>
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                              CATEGORY_COLORS[s.category_slug ?? s.categorySlug ?? ''] ?? 'bg-muted text-muted-foreground'
                            )}
                          >
                            {EXAM_DUTY_CATEGORIES.find((c) => c.value === (s.category_slug ?? s.categorySlug))?.label ?? s.category_slug ?? s.categorySlug}
                          </span>
                        </td>
                        <td>{lastAt ? formatDate(lastAt) : '—'}</td>
                        <td>{created}</td>
                        <td>{skipped}</td>
                        <td>
                          {err ? (
                            <span className="text-destructive text-xs" title={err}>{err.length > 40 ? `${err.slice(0, 40)}…` : err}</span>
                          ) : created > 0 ? (
                            <span className="text-muted-foreground text-xs">OK</span>
                          ) : skipped > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 text-xs" title="Sync tamamlandı, tüm adaylar mevcut/duplicate/filtre nedeniyle atlandı">Tümü atlandı</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {mainView === 'flow-calendar' && (
        <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                <CalendarRange className="size-5 text-primary" />
              </div>
              Akış Takvimi
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Başvuru, onay ve sınav tarihlerini Türkiye takvim gününe göre hücrelerde görün. Güne tıklayınca o günkü olaylar listelenir; duyuruyu düzenleyebilirsiniz.
            </p>
          </CardHeader>
          <CardContent className="p-6">
            {loading && calendarItems.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <LoadingSpinner className="size-8" />
              </div>
            ) : !loading && calendarItems.length === 0 ? (
              <EmptyState
                icon={<CalendarRange className="size-12 text-muted-foreground" />}
                title="Takvimde gösterilecek duyuru yok"
                description="Bu sekme sınav veya başvuru tarihi olan kayıtları çeker. Sync sonrası veya elle duyuru ekleyip tarihleri doldurun; ardından Yenile ile tekrar açın."
                className="py-12"
              />
            ) : (
              <ExamDutyFlowCalendar
                items={calendarItems}
                defaultTimes={defaultTimes}
                onEdit={openEdit}
                onSelectDate={() => {}}
              />
            )}
          </CardContent>
        </Card>
      )}

      {mainView === 'list' && (
      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
                  <ClipboardList className="size-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Liste</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sınav tarihi olan duyurular. Tarih eksik taslak ve sync’te atlanan satırlar &quot;Atlananlar&quot; sekmesinde birleşir. Scrape kaynaklarda 1. slayt
                    her sync’te kontrol edilir; kaynak yeri sütunu slayt/liste/RSS sırasını gösterir.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchList()}
                  disabled={loading}
                  className="gap-1.5 shrink-0"
                >
                  <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
                  Yenile
                </Button>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative w-full sm:min-w-[160px] sm:max-w-[220px]">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Başlık veya özet ara…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-10 w-full shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-auto sm:min-w-[120px]"
                  title="Kategori filtresi"
                >
                  <option value="">Tüm kategoriler</option>
                  {EXAM_DUTY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-full shrink-0 rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-auto sm:min-w-[110px]"
                  title="Durum filtresi (Taslak / Yayında)"
                >
                  <option value="">Tüm durumlar</option>
                  <option value="draft">Taslak</option>
                  <option value="published">Yayında</option>
                </select>
                <div className="flex items-center rounded-lg border border-input bg-background" role="group" aria-label="İçerik görünümü">
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={cn(
                      'rounded-l-lg p-2.5 transition-colors',
                      viewMode === 'table'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                    title="Tablo görünümü – satırlar halinde listele"
                  >
                    <List className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={cn(
                      'rounded-r-lg p-2.5 transition-colors',
                      viewMode === 'cards'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted'
                    )}
                    title="Kart görünümü – kartlar halinde listele"
                  >
                    <LayoutGrid className="size-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Toplam <strong className="text-foreground">{total}</strong> kayıt
              </span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm"
              >
                <option value={10}>10 / sayfa</option>
                <option value={20}>20 / sayfa</option>
                <option value={50}>50 / sayfa</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner className="size-8" />
            </div>
          ) : !items.length ? (
            <EmptyState
              icon={<ClipboardList className="size-10 text-muted-foreground" />}
              title="Henüz sınav görevi yok"
              description="Yeni sınav görevi ekleyip taslak olarak kaydedin. Hazır olduğunda yayınlayın."
              action={
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="size-4" />
                  Yeni Sınav Görevi Ekle
                </Button>
              }
            />
          ) : (
            <div className="table-x-scroll rounded-lg border border-border">
              {draftItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-4 py-3">
                  <label className="flex cursor-pointer select-none items-center gap-2.5 text-sm font-medium">
                    <input
                      type="checkbox"
                      role="checkbox"
                      aria-label="Tüm taslakları seç"
                      checked={allDraftsSelected}
                      onChange={toggleSelectAllDrafts}
                      className="size-5 shrink-0 rounded border-2 border-primary accent-primary"
                    />
                    Tüm taslakları seç ({draftItems.length})
                  </label>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedDraftIds.length} taslak seçili
                  </span>
                </div>
              )}
              {viewMode === 'cards' ? (
                <div className="divide-y divide-border/50 p-4">
                  {sortedItems.map((i) => {
                    const n = normalizeItem(i, defaultTimes);
                    const cat = n.category_slug ?? n.categorySlug ?? '';
                    const appEndPast = isDatePast(n.application_end ?? n.applicationEnd);
                    const examPast = isDatePast(n.exam_date ?? n.examDate);
                    const isSelected = selectedIds.has(i.id);
                    return (
                      <div
                        key={i.id}
                        className={cn(
                          'group flex flex-col gap-4 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between',
                          (appEndPast || examPast) && 'bg-destructive/5 -mx-4 px-4',
                          isSelected && 'bg-primary/10 ring-1 ring-primary/20 -mx-4 px-4'
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {i.status === 'draft' && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(i.id)}
                                className="size-5 shrink-0 rounded border-2 border-primary accent-primary"
                              />
                            )}
                            <h3 className="font-semibold text-foreground line-clamp-2">{i.title}</h3>
                            <span
                              className={cn(
                                'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                                CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground'
                              )}
                            >
                              {EXAM_DUTY_CATEGORIES.find((c) => c.value === cat)?.label ?? cat}
                            </span>
                            <span
                              className={cn(
                                'inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                                i.status === 'published'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              )}
                            >
                              {i.status === 'published' ? 'Yayında' : 'Taslak'}
                            </span>
                            <span
                              className="inline-flex max-w-[160px] truncate rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                              title={formatDutySourcePlace(i)}
                            >
                              {formatDutySourcePlace(i)}
                            </span>
                            {(appEndPast || examPast) && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                <AlertTriangle className="size-3" /> Tarih geçti
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Başvuru: {renderDateWithStatus(n.application_start ?? n.applicationStart)} – {renderDateWithStatus(n.application_end ?? n.applicationEnd)}</span>
                            <span>Başvuru Onay: {renderDateWithStatus(n.application_approval_end ?? n.applicationApprovalEnd)}</span>
                            <span>Sınav: {renderDateWithStatus(n.exam_date ?? n.examDate)} – {renderDateWithStatus(n.exam_date_end ?? n.examDateEnd)}</span>
                            <span>
                              Öncesi: {(() => {
                                const ed = n.exam_date ?? n.examDate;
                                if (!ed) return '—';
                                const d = new Date(ed);
                                d.setDate(d.getDate() - 1);
                                return renderDateWithStatus(d.toISOString());
                              })()}
                            </span>
                            <span>
                              Sonrası: {(() => {
                                const edEnd = n.exam_date_end ?? n.examDateEnd;
                                if (!edEnd) return '—';
                                const d = new Date(edEnd);
                                d.setDate(d.getDate() + 1);
                                return renderDateWithStatus(d.toISOString());
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(i)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Düzenle"
                          >
                            <Pencil className="size-4" />
                          </button>
                          {i.status === 'draft' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleShowTargetCount(i.id)}
                                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Hedef kitle"
                              >
                                <Users className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePublish(i.id)}
                                disabled={saving}
                                className="rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                                title="Yayınla"
                              >
                                <Send className="size-4" />
                              </button>
                            </>
                          )}
                          {(n.application_url ?? n.applicationUrl) && (
                            <a
                              href={n.application_url ?? n.applicationUrl ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Başvuru"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          )}
                          {(n.source_url ?? n.sourceUrl) && (
                            <a
                              href={n.source_url ?? n.sourceUrl ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Kaynak"
                            >
                              <ExternalLink className="size-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(i.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Sil"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
              <div className="table-x-scroll rounded-xl border border-border/80 shadow-sm">
              <table className="exam-duty-table evrak-admin-table w-full min-w-[980px] text-sm">
                <thead className="sticky top-0 z-10 bg-muted/98 backdrop-blur-sm border-b-2 border-primary/20">
                  <tr>
                    <th className="sticky left-0 z-20 w-11 shrink-0 exam-duty-sticky px-2 py-3">
                      {draftItems.length > 0 ? <span className="sr-only">Seç</span> : null}
                    </th>
                    <th className="sticky left-[44px] z-20 w-[140px] min-w-[100px] max-w-[200px] exam-duty-sticky pl-2 pr-3 py-3 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                      Başlık
                    </th>
                    <th className="w-14 shrink-0 px-2 py-3" title="Kategori">Kat.</th>
                    <th className="w-[88px] min-w-[84px] shrink-0 px-2 py-3 text-left" title="Sync sonrası kaynak konumu (slayt sırası)">
                      Kaynak
                    </th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="Başvuru Açılış">Bşv. Açılış</th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="Son Başvuru">Son Bşv.</th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="Başvuru Onay">Onay</th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="Öncesi Hatırlatma">Öncesi</th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="İlk Sınav">İlk Sınav</th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="Son Sınav">Son Sınav</th>
                    <th className="w-[90px] min-w-[86px] shrink-0 px-2 py-3 text-left" title="Sonrası Hatırlatma">Sonrası</th>
                    <th className="w-16 shrink-0 px-2 py-3">Durum</th>
                    <th className="sticky right-0 z-20 w-24 shrink-0 exam-duty-sticky px-3 py-3 text-right shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                      İşlem
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((i) => {
                    const n = normalizeItem(i, defaultTimes);
                    const appEndPast = isDatePast(n.application_end ?? n.applicationEnd);
                    const examPast = isDatePast(n.exam_date ?? n.examDate);
                    const isSelected = selectedIds.has(i.id);
                    return (
                      <tr
                        key={i.id}
                        className={cn(
                          'group',
                          (appEndPast || examPast) && 'bg-destructive/5',
                          isSelected && 'bg-primary/10 ring-1 ring-primary/20 ring-inset'
                        )}
                        data-row-past={(appEndPast || examPast) ? '' : undefined}
                        data-row-selected={isSelected ? '' : undefined}
                      >
                        <td className="sticky left-0 z-10 w-11 shrink-0 exam-duty-sticky px-2 py-2">
                          {i.status === 'draft' ? (
                            <input
                              type="checkbox"
                              role="checkbox"
                              aria-label={`${i.title} - seç`}
                              checked={isSelected}
                              onChange={() => toggleSelect(i.id)}
                              className="size-4 shrink-0 rounded border-2 border-primary accent-primary cursor-pointer"
                            />
                          ) : (
                            <span className="inline-block w-4" aria-hidden />
                          )}
                        </td>
                        <td className="sticky left-[44px] z-10 w-[140px] min-w-[100px] max-w-[200px] exam-duty-sticky pl-2 pr-3 py-2 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                          <span className="font-medium truncate block text-foreground" title={i.title}>{i.title}</span>
                        </td>
                        <td className="w-14 shrink-0 px-2 py-2">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium',
                              CATEGORY_COLORS[n.category_slug ?? n.categorySlug ?? ''] ?? 'bg-muted text-muted-foreground'
                            )}
                          >
                            {EXAM_DUTY_CATEGORIES.find((c) => c.value === (n.category_slug ?? n.categorySlug))?.label ?? n.category_slug ?? n.categorySlug}
                          </span>
                        </td>
                        <td className="w-[88px] min-w-[84px] shrink-0 px-2 py-2 align-top">
                          <span
                            className="inline-block max-w-[84px] truncate rounded border border-border/80 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                            title={formatDutySourcePlace(i)}
                          >
                            {formatDutySourcePlace(i)}
                          </span>
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {renderDateCompact(n.application_start ?? n.applicationStart)}
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {renderDateCompact(n.application_end ?? n.applicationEnd)}
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {renderDateCompact(n.application_approval_end ?? n.applicationApprovalEnd)}
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {(() => {
                            const ed = n.exam_date ?? n.examDate;
                            if (!ed) return <span className="text-muted-foreground">—</span>;
                            const d = new Date(ed);
                            d.setDate(d.getDate() - 1);
                            return renderDateCompact(d.toISOString());
                          })()}
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {renderDateCompact(n.exam_date ?? n.examDate)}
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {renderDateCompact(n.exam_date_end ?? n.examDateEnd)}
                        </td>
                        <td className="w-[90px] min-w-[86px] shrink-0 px-2 py-2 align-top">
                          {(() => {
                            const edEnd = n.exam_date_end ?? n.examDateEnd;
                            if (!edEnd) return <span className="text-muted-foreground">—</span>;
                            const d = new Date(edEnd);
                            d.setDate(d.getDate() + 1);
                            return renderDateCompact(d.toISOString());
                          })()}
                        </td>
                        <td className="w-16 shrink-0 px-2 py-2">
                          <span
                            className={cn(
                              'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium',
                              i.status === 'published'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            )}
                          >
                            {i.status === 'published' ? 'Yayında' : 'Taslak'}
                          </span>
                        </td>
                        <td className="sticky right-0 z-10 w-24 shrink-0 exam-duty-sticky px-3 py-2 text-right shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]">
                          <div className="flex justify-end gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEdit(i)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Düzenle"
                            >
                              <Pencil className="size-4" />
                            </button>
                            {i.status === 'draft' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleShowTargetCount(i.id)}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Hedef kitle sayısı"
                                >
                                  <Users className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePublish(i.id)}
                                  disabled={saving}
                                  className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                                  title="Yayınla"
                                >
                                  <Send className="size-4" />
                                </button>
                              </>
                            )}
                            {(n.application_url ?? n.applicationUrl) && (
                              <a
                                href={n.application_url ?? n.applicationUrl ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Başvuru linki"
                              >
                                <ExternalLink className="size-4" />
                              </a>
                            )}
                            {(n.source_url ?? n.sourceUrl) && (
                              <a
                                href={n.source_url ?? n.sourceUrl ?? '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                title="Kaynağı aç"
                              >
                                <ExternalLink className="size-4" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(i.id)}
                              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Sil"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              )}
            </div>
          )}
          {items.length > 0 && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{total}</strong> kayıt · Sayfa <strong className="text-foreground">{page}</strong> / {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="h-9 w-9 p-0"
                  title="İlk sayfa"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 gap-1"
                >
                  <ChevronLeft className="size-4" />
                  Önceki
                </Button>
                <span className="px-3 py-1.5 text-sm font-medium text-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 gap-1"
                >
                  Sonraki
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  className="h-9 w-9 p-0"
                  title="Son sayfa"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[min(90vh,calc(100dvh-2rem))] max-w-[min(42rem,calc(100vw-2rem))] overflow-y-auto">
          <h2 className="text-lg font-semibold">{editing ? 'Sınav Görevi Düzenle' : 'Yeni Sınav Görevi'}</h2>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground border-l-2 border-primary/50 pl-3">
              Başvuru ve sınav tarih/saatleri bildirim zamanlaması için kullanılır. Tarih ve saat girebilirsiniz.
            </p>
            <div>
              <Label htmlFor="egd-title">Başlık *</Label>
              <Input
                id="egd-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Sınav görevi başlığı"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="egd-cat">Kategori</Label>
              <div className="mt-1 flex gap-2">
                <select
                  id="egd-cat"
                  value={form.category_slug}
                  onChange={(e) => setForm((f) => ({ ...f, category_slug: e.target.value }))}
                  className="h-10 flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {EXAM_DUTY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                {!editing && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={() => {
                      const sample = EXAM_DUTY_SAMPLES[form.category_slug];
                      if (sample) {
                        setForm((f) => ({
                          ...f,
                          title: sample.title,
                          summary: sample.summary,
                          body: sample.body,
                          source_url: sample.source_url,
                          application_url: sample.application_url ?? '',
                        }));
                        toast.success(`${EXAM_DUTY_CATEGORIES.find((c) => c.value === form.category_slug)?.label ?? form.category_slug} örnek duyuru yüklendi.`);
                      }
                    }}
                  >
                    <FileText className="size-4" />
                    Örnek Yükle
                  </Button>
                )}
              </div>
            </div>
            <div>
              <Label htmlFor="egd-summary">Özet</Label>
              <Input
                id="egd-summary"
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Kısa özet (opsiyonel)"
                className="mt-1"
              />
            </div>
            <div className="rounded-lg border border-border bg-muted/20 p-4 overflow-visible">
              <Label className="text-sm font-medium mb-2 block">Tarih ve Saat (opsiyonel)</Label>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-w-0">
                <div className="min-w-0 space-y-1 sm:min-w-48">
                  <Label htmlFor="egd-app-start" className="text-xs text-muted-foreground">Başvuru Açılış</Label>
                  <DateTimeInput
                    id="egd-app-start"
                    value={form.application_start ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, application_start: v }))}
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:min-w-48">
                  <Label htmlFor="egd-app-end" className="text-xs text-muted-foreground">Son Başvuru</Label>
                  <DateTimeInput
                    id="egd-app-end"
                    value={form.application_end ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, application_end: v }))}
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:min-w-48">
                  <Label htmlFor="egd-app-approval-end" className="text-xs text-muted-foreground">Başvuru Onay</Label>
                  <DateTimeInput
                    id="egd-app-approval-end"
                    value={form.application_approval_end ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, application_approval_end: v }))}
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:min-w-48">
                  <Label htmlFor="egd-result" className="text-xs text-muted-foreground">Sınav öncesi hatırlatma</Label>
                  <DateTimeInput
                    id="egd-result"
                    value={form.result_date ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, result_date: v }))}
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:min-w-48">
                  <Label htmlFor="egd-exam" className="text-xs text-muted-foreground">Sınav Tarihi</Label>
                  <DateTimeInput
                    id="egd-exam"
                    value={form.exam_date ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, exam_date: v }))}
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:min-w-48">
                  <Label htmlFor="egd-exam-end" className="text-xs text-muted-foreground">Sınav sonrası hatırlatma</Label>
                  <DateTimeInput
                    id="egd-exam-end"
                    value={form.exam_date_end ?? ''}
                    onValueChange={(v) => setForm((f) => ({ ...f, exam_date_end: v }))}
                  />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="egd-body">İçerik</Label>
              {(() => {
                const body = form.body?.trim() ?? '';
                const tableRows = body
                  .split(/\n+/)
                  .map((line) => {
                    const pipe = line.split(/\s*\|\s*/);
                    if (pipe.length >= 2) return pipe.map((c) => c.trim());
                    const colon = line.match(/^([^:]+):\s*(.+)$/);
                    if (colon) return [colon[1].trim(), colon[2].trim()];
                    return null;
                  })
                  .filter((r): r is string[] => Array.isArray(r) && r.length >= 2);
                const hasTable = tableRows.length > 0 && !bodyEditRaw;
                if (hasTable) {
                  return (
                    <div className="mt-1 space-y-1">
                      <div className="table-x-scroll rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <tbody>
                            {tableRows.map((row, i) => (
                              <tr key={i} className="border-b border-border last:border-0">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 align-top">
                                    {j === 0 ? <span className="font-medium text-muted-foreground">{cell}</span> : cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted-foreground">Tablo yalnızca metin önizlemesidir; tarih/saat için yukarıdaki «Tarih ve Saat» alanlarını kullanın.</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => setBodyEditRaw(true)}
                      >
                        İçeriği düzenle
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="mt-1 space-y-1">
                    <textarea
                      id="egd-body"
                      value={form.body}
                      onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                      placeholder="Etiket: değer formatında satırlar (örn: Son başvuru: 20.03.2026)"
                      className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                    />
                    {tableRows.length > 0 && bodyEditRaw && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => setBodyEditRaw(false)}
                      >
                        Tablo görünümüne dön
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label htmlFor="egd-url">Kaynak URL</Label>
              <Input
                id="egd-url"
                type="url"
                value={form.source_url}
                onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
                placeholder="https://... (duyuru sayfası)"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="egd-app-url">Başvuru linki</Label>
              <Input
                id="egd-app-url"
                type="url"
                value={form.application_url}
                onChange={(e) => setForm((f) => ({ ...f, application_url: e.target.value }))}
                placeholder="https://... (başvuru yapılacak adres, sınava göre)"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">Kaynak = duyuru; Başvuru = MEB/e-devlet vb. başvuru sayfası</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '…' : editing ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDateOpen} onOpenChange={setBulkDateOpen}>
        <DialogContent className="max-w-md">
          <h3 className="text-lg font-semibold">Toplu Tarih Güncelle</h3>
          <p className="text-sm text-muted-foreground">{selectedDraftIds.length} taslakta seçilen alan güncellenecek.</p>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Alan</Label>
              <select
                value={bulkDateForm.field}
                onChange={(e) => setBulkDateForm((f) => ({ ...f, field: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="application_start">Başvuru açılış</option>
                <option value="application_end">Son başvuru</option>
                <option value="application_approval_end">Onay son gün</option>
                <option value="result_date">Sonuç tarihi</option>
                <option value="exam_date">İlk sınav</option>
                <option value="exam_date_end">Son sınav</option>
              </select>
            </div>
            <div>
              <Label>Tarih (YYYY-MM-DD)</Label>
              <Input
                type="date"
                value={bulkDateForm.value}
                onChange={(e) => setBulkDateForm((f) => ({ ...f, value: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setBulkDateOpen(false)}>İptal</Button>
            <Button onClick={handleBulkUpdateDates} disabled={saving || !bulkDateForm.value}>Güncelle</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
