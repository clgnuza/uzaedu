'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import {
  ClipboardList,
  ClipboardCheck,
  ExternalLink,
  Bell,
  Megaphone,
  SlidersHorizontal,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  CalendarClock,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { ExamDutyPreferencesForm } from '@/components/exam-duty-preferences-form';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const EXAM_DUTY_CATEGORIES = [
  { value: '', label: 'Tüm kategoriler' },
  { value: 'meb', label: 'MEB' },
  { value: 'osym', label: 'ÖSYM' },
  { value: 'aof', label: 'AÖF' },
  { value: 'ataaof', label: 'ATA-AÖF' },
  { value: 'auzef', label: 'AUZEF' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_DUTY_CATEGORIES.filter((c) => c.value).map((c) => [c.value, c.label])
);

const CATEGORY_COLORS: Record<string, string> = {
  meb: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  osym: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  aof: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ataaof: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  auzef: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
};

const CATEGORY_BORDER: Record<string, string> = {
  meb: 'border-l-[6px] border-l-amber-500 dark:border-l-amber-500',
  osym: 'border-l-[6px] border-l-blue-500 dark:border-l-blue-500',
  aof: 'border-l-[6px] border-l-emerald-500 dark:border-l-emerald-500',
  ataaof: 'border-l-[6px] border-l-violet-500 dark:border-l-violet-500',
  auzef: 'border-l-[6px] border-l-teal-500 dark:border-l-teal-500',
};

/** Üst şerit – kartları birbirinden ayırmak için */
const CATEGORY_HEADER_ROW: Record<string, string> = {
  meb: 'border-b border-amber-200/80 bg-amber-50/95 dark:border-amber-800/50 dark:bg-amber-950/40',
  osym: 'border-b border-blue-200/80 bg-blue-50/95 dark:border-blue-800/50 dark:bg-blue-950/40',
  aof: 'border-b border-emerald-200/80 bg-emerald-50/95 dark:border-emerald-800/50 dark:bg-emerald-950/40',
  ataaof: 'border-b border-violet-200/80 bg-violet-50/95 dark:border-violet-800/50 dark:bg-violet-950/40',
  auzef: 'border-b border-teal-200/80 bg-teal-50/95 dark:border-teal-800/50 dark:bg-teal-950/40',
};
const CATEGORY_HEADER_DEFAULT =
  'border-b border-border/70 bg-muted/40 dark:bg-muted/25';

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
};

type ListResponse = {
  items: ExamDutyItem[];
  total: number;
};

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
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

/** Tarihi YYYY-MM-DD string'e çevir (Turkey) */
function toDateYMD(s: string | null | undefined): string | null {
  if (!s) return null;
  try {
    const d = new Date(s);
    return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
  } catch {
    return null;
  }
}

/** Son 7 gün içinde mi */
function isWithinDays(s: string | null | undefined, days: number): boolean {
  if (!s) return false;
  try {
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = (d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
    return diff >= 0 && diff <= days;
  } catch {
    return false;
  }
}

const DATE_CHIP_VARIANT: Record<
  'başvuru' | 'onay' | 'sınav' | 'sonuç',
  { box: string; icon: string }
> = {
  başvuru: {
    box: 'border-l-blue-200 bg-blue-50/50 dark:border-l-blue-800 dark:bg-blue-950/20',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  onay: {
    box: 'border-l-violet-200 bg-violet-50/50 dark:border-l-violet-800 dark:bg-violet-950/20',
    icon: 'text-violet-600 dark:text-violet-400',
  },
  sınav: {
    box: 'border-l-amber-200 bg-amber-50/50 dark:border-l-amber-800 dark:bg-amber-950/20',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  sonuç: {
    box: 'border-l-teal-200 bg-teal-50/50 dark:border-l-teal-800 dark:bg-teal-950/20',
    icon: 'text-teal-600 dark:text-teal-400',
  },
};

function ExamDutyDateChip({
  icon: Icon,
  label,
  value,
  status,
  variant,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  status?: 'past' | 'soon' | null;
  variant?: 'başvuru' | 'onay' | 'sınav' | 'sonuç';
}) {
  const v = variant ? DATE_CHIP_VARIANT[variant] : null;
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-lg border border-border/50 px-2 py-1.5 shadow-sm border-l-[3px]',
        v ? v.box : 'bg-muted/10'
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', v ? v.icon : 'text-muted-foreground/70')} />
      <div className="min-w-0 flex-1">
        <span className="block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="flex flex-wrap items-baseline gap-1 text-xs font-medium leading-tight text-foreground">
          {value}
          {status === 'past' && <span className="text-[10px] font-normal text-destructive">geçti</span>}
          {status === 'soon' && (
            <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">yaklaşıyor</span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Öğretmen listesi: geçmiş en sonda; önce “yaklaşan”, sonra en yakın tarih */
function compareExamDutiesForTeacher(a: ExamDutyItem, b: ExamDutyItem): number {
  const pastA =
    isDatePast(a.application_end ?? a.applicationEnd) || isDatePast(a.exam_date ?? a.examDate);
  const pastB =
    isDatePast(b.application_end ?? b.applicationEnd) || isDatePast(b.exam_date ?? b.examDate);
  if (pastA !== pastB) return pastA ? 1 : -1;
  const ts = (i: ExamDutyItem) => {
    const raw = i.exam_date ?? i.examDate ?? i.application_end ?? i.applicationEnd;
    const t = raw ? new Date(raw).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };
  if (pastA) return ts(b) - ts(a);
  const soonA =
    isWithinDays(a.application_end ?? a.applicationEnd, 7) ||
    isWithinDays(a.application_approval_end ?? a.applicationApprovalEnd, 7);
  const soonB =
    isWithinDays(b.application_end ?? b.applicationEnd, 7) ||
    isWithinDays(b.application_approval_end ?? b.applicationApprovalEnd, 7);
  if (soonA !== soonB) return soonA ? -1 : 1;
  return ts(a) - ts(b);
}

export default function SinavGorevlerimPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [items, setItems] = useState<ExamDutyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [preferredDateMap, setPreferredDateMap] = useState<Record<string, string | null>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assignDayChoiceForId, setAssignDayChoiceForId] = useState<string | null>(null);

  const isTeacher = me?.role === 'teacher';

  const filteredQuery = searchQuery.trim().toLowerCase();
  const displayedItems = useMemo(() => {
    const filtered = filteredQuery
      ? items.filter(
          (i) =>
            i.title.toLowerCase().includes(filteredQuery) ||
            (i.summary ?? '').toLowerCase().includes(filteredQuery)
        )
      : [...items];
    return [...filtered].sort(compareExamDutiesForTeacher);
  }, [items, filteredQuery]);

  const fetchList = useCallback(async () => {
    if (!token || !isTeacher) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (categoryFilter) params.set('category_slug', categoryFilter);
      const listRes = await apiFetch<ListResponse>(`/exam-duties?${params}`, { token });
      setItems(listRes.items ?? []);
      try {
        const assignedRes = await apiFetch<{
          exam_duty_ids: string[];
          assignments?: Array<{ exam_duty_id: string; preferred_exam_date: string | null }>;
        }>('/exam-duties/my-assignments', { token });
        setAssignedIds(new Set(assignedRes.exam_duty_ids ?? []));
        const map: Record<string, string | null> = {};
        for (const a of assignedRes.assignments ?? []) {
          map[a.exam_duty_id] = a.preferred_exam_date ?? null;
        }
        setPreferredDateMap(map);
      } catch {
        setAssignedIds(new Set());
        setPreferredDateMap({});
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, isTeacher, categoryFilter]);

  const handleAssignMe = useCallback(
    async (examDutyId: string, preferredExamDate?: string | null) => {
      if (!token || assigningId) return;
      setAssigningId(examDutyId);
      setAssignDayChoiceForId(null);
      try {
        await apiFetch<{ assigned: boolean }>(`/exam-duties/${examDutyId}/assign-me`, {
          token,
          method: 'POST',
          body: JSON.stringify(
            preferredExamDate ? { preferred_exam_date: preferredExamDate } : {}
          ),
        });
        setAssignedIds((prev) => new Set(prev).add(examDutyId));
        setPreferredDateMap((prev) => ({ ...prev, [examDutyId]: preferredExamDate ?? null }));
        const msg =
          preferredExamDate === undefined || preferredExamDate === null
            ? 'Görev çıktı işaretlendi. Sınav günü sabah hatırlatması alacaksınız.'
            : 'Görev çıktı işaretlendi. Seçtiğiniz gün sabah hatırlatması alacaksınız.';
        toast.success(msg);
      } catch {
        toast.error('İşaretlenemedi.');
      } finally {
        setAssigningId(null);
      }
    },
    [token, assigningId]
  );

  const handleUpdatePreferredDate = useCallback(
    async (examDutyId: string, preferredExamDate: string | null) => {
      if (!token || assigningId) return;
      setAssigningId(examDutyId);
      try {
        await apiFetch<{ assigned: boolean }>(`/exam-duties/${examDutyId}/assign-me`, {
          token,
          method: 'POST',
          body: JSON.stringify({ preferred_exam_date: preferredExamDate }),
        });
        setPreferredDateMap((prev) => ({ ...prev, [examDutyId]: preferredExamDate }));
        toast.success('Sabah hatırlatması tercihi güncellendi.');
      } catch {
        toast.error('Güncellenemedi.');
      } finally {
        setAssigningId(null);
      }
    },
    [token, assigningId]
  );

  const handleUnassignMe = useCallback(
    async (examDutyId: string) => {
      if (!token || unassigningId) return;
      setUnassigningId(examDutyId);
      try {
        await apiFetch<{ unassigned: boolean }>(`/exam-duties/${examDutyId}/unassign-me`, {
          token,
          method: 'POST',
        });
        setAssignedIds((prev) => {
          const next = new Set(prev);
          next.delete(examDutyId);
          return next;
        });
        setPreferredDateMap((prev) => {
          const next = { ...prev };
          delete next[examDutyId];
          return next;
        });
        toast.success('Görev çıktı işareti kaldırıldı. Sınav günü sabah hatırlatması almayacaksınız.');
      } catch {
        toast.error('İşlem geri alınamadı.');
      } finally {
        setUnassigningId(null);
      }
    },
    [token, unassigningId]
  );

  useEffect(() => {
    if (!isTeacher) {
      router.replace('/403');
      return;
    }
    fetchList();
  }, [isTeacher, router, fetchList]);

  if (!isTeacher) return null;

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardList className="size-6 text-primary" />
            </div>
            <div>
              <ToolbarPageTitle>Sınav Görevleri</ToolbarPageTitle>
              <ToolbarIconHints
                compact
                className="hidden sm:flex"
                items={[
                  { label: 'Kurum duyuruları (MEB, ÖSYM vb.)', icon: Megaphone },
                  { label: 'Bildirimler', icon: Bell },
                  { label: 'Tercih ayarları', icon: SlidersHorizontal },
                ]}
                summary="MEB, ÖSYM vb. sınav görevi duyuruları. Bildirim tercihlerinizi aşağıdan ayarlayabilirsiniz."
              />
            </div>
          </div>
        </ToolbarHeading>
        <ToolbarActions>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchList()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
            Yenile
          </Button>
          <Link href="/bildirimler">
            <Button variant="outline" className="gap-2">
              <Bell className="size-4" />
              Tüm Bildirimler
            </Button>
          </Link>
        </ToolbarActions>
      </Toolbar>

      <ExamDutyPreferencesForm />

      <Card className="overflow-hidden rounded-xl border border-border/50 shadow-sm">
        <CardHeader className="border-b border-border/40 bg-muted/10 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold">
              <span className="inline-flex items-center gap-2">
                <ClipboardList className="size-5 text-primary" />
                Duyurular
              </span>
              {!loading && items.length > 0 && (
                <span className="rounded-md bg-muted/70 px-2 py-0.5 text-sm font-normal tabular-nums text-muted-foreground">
                  {displayedItems.length}
                  {filteredQuery ? (
                    <span className="text-muted-foreground/80"> / {items.length}</span>
                  ) : null}
                </span>
              )}
            </CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:min-w-[160px] sm:max-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="exam-duty-search"
                  placeholder="Başlık veya özette ara…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 rounded-lg border-input bg-background text-sm"
                  aria-label="Duyurularda ara"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 w-full cursor-pointer rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-auto sm:min-w-[120px]"
                aria-label="Kategori filtresi"
              >
                {EXAM_DUTY_CATEGORIES.map((c) => (
                  <option key={c.value || 'all'} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center py-12">
              <LoadingSpinner className="size-8" />
            </div>
          ) : !items.length ? (
            <EmptyState
              icon={<ClipboardList className="size-12 text-muted-foreground" />}
              title="Henüz sınav görevi duyurusu yok"
              description="Yayınlanan sınav görevi duyuruları burada görünecek. Bildirim almak için yukarıdaki tercihler kartından ayarlarınızı yapın."
              className="py-16"
            />
          ) : displayedItems.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <EmptyState
                icon={<ClipboardList className="size-12 text-muted-foreground" />}
                title="Aramanıza uygun duyuru yok"
                description="Farklı anahtar kelime deneyin veya aramayı temizleyin."
                className="py-8"
              />
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setSearchQuery('')}>
                Aramayı temizle
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3" role="list" aria-label="Sınav görevi duyuruları">
              {displayedItems.map((i, idx) => {
                  const cat = i.category_slug ?? i.categorySlug ?? '';
                  const appUrl = i.application_url ?? i.applicationUrl;
                  const srcUrl = i.source_url ?? i.sourceUrl;
                  const başvuruUrl = appUrl || null;
                  const isExpanded = expandedId === i.id;
                  const appStart = formatDate(i.application_start ?? i.applicationStart);
                  const appEnd = formatDate(i.application_end ?? i.applicationEnd);
                  const appApprovalEnd = formatDate(i.application_approval_end ?? i.applicationApprovalEnd);
                  const examStart = formatDate(i.exam_date ?? i.examDate);
                  const examEnd = formatDate(i.exam_date_end ?? i.examDateEnd);
                  const examFirstYMD = toDateYMD(i.exam_date ?? i.examDate);
                  const examLastYMD = toDateYMD(i.exam_date_end ?? i.examDateEnd);
                  const resultDt = formatDate(i.result_date ?? i.resultDate);
                  const hasBody = !!(i.body ?? i.summary);
                  const appEndPast = isDatePast(i.application_end ?? i.applicationEnd);
                  const appApprovalPast = isDatePast(i.application_approval_end ?? i.applicationApprovalEnd);
                  const examPast = isDatePast(i.exam_date ?? i.examDate);
                  const appEndSoon = isWithinDays(i.application_end ?? i.applicationEnd, 7);
                  const appApprovalSoon = isWithinDays(i.application_approval_end ?? i.applicationApprovalEnd, 7);

                  const statusType = appEndPast || examPast ? 'past' : appEndSoon || appApprovalSoon ? 'soon' : 'active';

                  return (
                    <article
                      key={i.id}
                      role="listitem"
                      className={cn(
                        'group overflow-hidden rounded-2xl border-2 bg-card shadow-md transition-[box-shadow,border-color] duration-200',
                        'ring-1 ring-black/4 dark:ring-white/6',
                        CATEGORY_BORDER[cat] ?? 'border-l-[6px] border-l-muted-foreground/40',
                        statusType === 'past' &&
                          'border-border/60 bg-muted/10 opacity-[0.92] saturate-75 shadow-sm',
                        statusType === 'soon' &&
                          'border-amber-300/70 shadow-md shadow-amber-500/10 ring-amber-500/15 dark:border-amber-700/50 dark:shadow-amber-900/20',
                        statusType === 'active' && 'hover:border-primary/25 hover:shadow-md'
                      )}
                    >
                      <div
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-1.5 px-3 py-1.5 sm:px-4',
                          CATEGORY_HEADER_ROW[cat] ?? CATEGORY_HEADER_DEFAULT
                        )}
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background/80 text-[10px] font-bold tabular-nums text-muted-foreground shadow-sm ring-1 ring-border/60 dark:bg-background/40"
                            aria-hidden
                          >
                            {idx + 1}
                          </span>
                          <span
                            className={cn(
                              'inline-flex rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide',
                              CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground'
                            )}
                          >
                            {CATEGORY_LABELS[cat] ?? (cat || 'Diğer')}
                          </span>
                          {statusType === 'past' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive ring-1 ring-destructive/20">
                              <AlertTriangle className="size-3" /> Geçti
                            </span>
                          )}
                          {statusType === 'soon' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-200/90 px-2 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-amber-400/40 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-600/40">
                              <Sun className="size-3" /> Yaklaşıyor
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2.5 p-3 sm:p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-base">
                              {i.title}
                            </h3>
                            {i.summary && (
                              <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2 sm:text-sm">
                                {i.summary}
                              </p>
                            )}
                          </div>
                          <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:max-w-full sm:flex-row sm:flex-wrap sm:items-start sm:justify-end sm:gap-1.5">
                          {assignedIds.has(i.id) ? (
                            <div className="inline-flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                                <CheckCircle2 className="size-3.5 shrink-0" />
                                <span className="hidden sm:inline">Görev çıktı</span>
                                {(examFirstYMD && examLastYMD && examFirstYMD !== examLastYMD
                                  ? ` – ${preferredDateMap[i.id] === examFirstYMD ? `İlk gün` : preferredDateMap[i.id] === examLastYMD ? `Son gün` : 'Her iki gün'}`
                                  : ' – hatırlatma alacaksınız'
                                )}
                              </span>
                              {examFirstYMD &&
                                examLastYMD &&
                                examFirstYMD !== examLastYMD && (
                                  <select
                                    value={preferredDateMap[i.id] ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      handleUpdatePreferredDate(i.id, v || null);
                                    }}
                                    disabled={!!assigningId}
                                    className="h-7 rounded-md border border-border bg-background px-1.5 text-[11px] cursor-pointer"
                                  >
                                    <option value="">Her iki gün</option>
                                    <option value={examFirstYMD}>İlk gün ({examStart})</option>
                                    <option value={examLastYMD}>Son gün ({examEnd})</option>
                                  </select>
                                )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                                onClick={() => handleUnassignMe(i.id)}
                                disabled={!!unassigningId}
                              >
                                {unassigningId === i.id ? <RefreshCw className="size-4 animate-spin" /> : 'Geri al'}
                              </Button>
                            </div>
                          ) : !examPast && (
                            <>
                              {examFirstYMD &&
                                examLastYMD &&
                                examFirstYMD !== examLastYMD &&
                                assignDayChoiceForId === i.id ? (
                                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200/60 bg-amber-50/40 p-2 dark:border-amber-800/40 dark:bg-amber-950/20">
                                  <span className="text-xs font-medium text-amber-800 dark:text-amber-200 w-full sm:w-auto">
                                    Hatırlatma hangi gün?
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleAssignMe(i.id, examFirstYMD)} disabled={!!assigningId}>
                                      İlk gün
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleAssignMe(i.id, examLastYMD)} disabled={!!assigningId}>
                                      Son gün
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleAssignMe(i.id, null)} disabled={!!assigningId}>
                                      Her ikisi
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setAssignDayChoiceForId(null)}>
                                      İptal
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full gap-1.5 border-amber-200/80 bg-amber-50/60 text-amber-800 hover:bg-amber-100 sm:w-auto dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
                                  onClick={() =>
                                    examFirstYMD &&
                                    examLastYMD &&
                                    examFirstYMD !== examLastYMD
                                      ? setAssignDayChoiceForId(i.id)
                                      : handleAssignMe(i.id)
                                  }
                                  disabled={!!assigningId}
                                >
                                  {assigningId === i.id ? (
                                    <RefreshCw className="size-4 animate-spin" />
                                  ) : (
                                    <Sun className="size-4" />
                                  )}
                                  <span className="hidden sm:inline">Görev çıktı – </span>Hatırlatma al
                                </Button>
                              )}
                            </>
                          )}
                          {başvuruUrl && (
                            <a
                              href={başvuruUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/10 sm:w-auto sm:min-h-0 sm:justify-start"
                            >
                              <ExternalLink className="size-3.5 shrink-0" />
                              Başvuru
                            </a>
                          )}
                          {srcUrl && (
                            <a
                              href={srcUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:w-auto sm:min-h-0 sm:justify-start"
                            >
                              <ExternalLink className="size-3.5 shrink-0" />
                              Kaynak
                            </a>
                          )}
                        </div>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
                          <ExamDutyDateChip
                            icon={CalendarClock}
                            label="Başvuru"
                            value={`${appStart} – ${appEnd}`}
                            status={appEndPast ? 'past' : appEndSoon ? 'soon' : null}
                            variant="başvuru"
                          />
                          {appApprovalEnd !== '—' && (
                            <ExamDutyDateChip
                              icon={FileCheck}
                              label="Onay"
                              value={appApprovalEnd}
                              status={appApprovalPast ? 'past' : appApprovalSoon ? 'soon' : null}
                              variant="onay"
                            />
                          )}
                          <ExamDutyDateChip
                            icon={Calendar}
                            label="Sınav"
                            value={examEnd !== '—' ? `${examStart} – ${examEnd}` : examStart}
                            status={examPast ? 'past' : null}
                            variant="sınav"
                          />
                          {resultDt !== '—' && (
                            <ExamDutyDateChip icon={ClipboardCheck} label="Sonuç" value={resultDt} variant="sonuç" />
                          )}
                        </div>

                        {isExpanded && hasBody && (
                          <div className="rounded-md border border-border/40 bg-muted/10 p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap sm:text-sm">
                            {i.body || i.summary}
                          </div>
                        )}
                        {hasBody && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs -ml-1"
                            onClick={() => setExpandedId(isExpanded ? null : i.id)}
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            {isExpanded ? 'Daralt' : 'Detayı göster'}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
