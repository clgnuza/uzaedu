'use client';

import { useCallback, useEffect, useState } from 'react';
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
  meb: 'border-l-4 border-l-amber-400 dark:border-l-amber-600',
  osym: 'border-l-4 border-l-blue-400 dark:border-l-blue-600',
  aof: 'border-l-4 border-l-emerald-400 dark:border-l-emerald-600',
  ataaof: 'border-l-4 border-l-violet-400 dark:border-l-violet-600',
  auzef: 'border-l-4 border-l-teal-400 dark:border-l-teal-600',
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
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardList className="size-5 text-primary" />
              Duyurular
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[160px] max-w-[220px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Ara…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 rounded-lg border-input bg-background text-sm"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 py-2 text-sm min-w-[120px] cursor-pointer"
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
          ) : (
            <div className="space-y-3">
              {(() => {
                const q = searchQuery.trim().toLowerCase();
                const filtered = q
                  ? items.filter(
                      (i) =>
                        i.title.toLowerCase().includes(q) ||
                        (i.summary ?? '').toLowerCase().includes(q)
                    )
                  : items;
                if (filtered.length === 0) {
                  return (
                    <EmptyState
                      icon={<ClipboardList className="size-12 text-muted-foreground" />}
                      title={q ? 'Aramanıza uygun duyuru yok' : 'Henüz sınav görevi duyurusu yok'}
                      description={
                        q
                          ? 'Farklı anahtar kelimeler deneyin veya filtreyi kaldırın.'
                          : 'Yayınlanan sınav görevi duyuruları burada görünecek.'
                      }
                      className="py-16"
                    />
                  );
                }
                return filtered.map((i) => {
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

                  const chipColors: Record<string, string> = {
                    başvuru: 'border-l-blue-200 bg-blue-50/50 dark:border-l-blue-800 dark:bg-blue-950/20',
                    onay: 'border-l-violet-200 bg-violet-50/50 dark:border-l-violet-800 dark:bg-violet-950/20',
                    sınav: 'border-l-amber-200 bg-amber-50/50 dark:border-l-amber-800 dark:bg-amber-950/20',
                    sonuç: 'border-l-teal-200 bg-teal-50/50 dark:border-l-teal-800 dark:bg-teal-950/20',
                  };
                  const chipIconColors: Record<string, string> = {
                    başvuru: 'text-blue-600 dark:text-blue-400',
                    onay: 'text-violet-600 dark:text-violet-400',
                    sınav: 'text-amber-600 dark:text-amber-400',
                    sonuç: 'text-teal-600 dark:text-teal-400',
                  };
                  const DateChip = ({
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
                  }) => (
                    <div className={cn('flex min-w-0 items-center gap-2 rounded-lg border border-border/40 px-2.5 py-2 border-l-4', variant ? chipColors[variant] : 'bg-muted/10')}>
                      <Icon className={cn('size-4 shrink-0', variant ? chipIconColors[variant] : 'text-muted-foreground/70')} />
                      <div className="min-w-0 flex-1">
                        <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
                        <span className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
                          {value}
                          {status === 'past' && <span className="text-[10px] font-normal text-destructive">geçti</span>}
                          {status === 'soon' && <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">yaklaşıyor</span>}
                        </span>
                      </div>
                    </div>
                  );

                  return (
                    <article
                      key={i.id}
                      className={cn(
                        'group rounded-xl border bg-card transition-all duration-200',
                        CATEGORY_BORDER[cat] ?? 'border-l-4 border-l-muted-foreground/30',
                        statusType === 'past' && 'border-border/40 bg-muted/5 opacity-90',
                        statusType === 'soon' && 'border-amber-200/60 bg-amber-50/20 dark:border-amber-800/40 dark:bg-amber-950/10',
                        statusType === 'active' && 'border-border/50 hover:border-primary/20 hover:shadow-sm'
                      )}
                    >
                      <div className="flex flex-col gap-4 p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', CATEGORY_COLORS[cat] ?? 'bg-muted text-muted-foreground')}>
                                {CATEGORY_LABELS[cat] ?? cat}
                              </span>
                              {statusType === 'past' && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                                  <AlertTriangle className="size-3" /> Geçti
                                </span>
                              )}
                              {statusType === 'soon' && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                  <Sun className="size-3" /> Yaklaşıyor
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-semibold leading-snug text-foreground">{i.title}</h3>
                            {i.summary && (
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{i.summary}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {assignedIds.has(i.id) ? (
                            <div className="inline-flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/20 dark:text-emerald-300">
                                <CheckCircle2 className="size-4 shrink-0" />
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
                                    className="h-8 rounded-md border border-border bg-background px-2 text-xs cursor-pointer"
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
                                className="h-9 gap-1.5 text-muted-foreground hover:text-destructive"
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
                                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/20 p-2.5">
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
                                  className="gap-1.5 border-amber-200/80 bg-amber-50/60 text-amber-800 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
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
                              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors"
                            >
                              <ExternalLink className="size-4" />
                              Başvuru
                            </a>
                          )}
                          {srcUrl && (
                            <a
                              href={srcUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                              <ExternalLink className="size-4" />
                              Kaynak
                            </a>
                          )}
                        </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <DateChip
                            icon={CalendarClock}
                            label="Başvuru"
                            value={`${appStart} – ${appEnd}`}
                            status={appEndPast ? 'past' : appEndSoon ? 'soon' : null}
                            variant="başvuru"
                          />
                          {appApprovalEnd !== '—' && (
                            <DateChip
                              icon={FileCheck}
                              label="Onay"
                              value={appApprovalEnd}
                              status={appApprovalPast ? 'past' : appApprovalSoon ? 'soon' : null}
                              variant="onay"
                            />
                          )}
                          <DateChip
                            icon={Calendar}
                            label="Sınav"
                            value={examEnd !== '—' ? `${examStart} – ${examEnd}` : examStart}
                            status={examPast ? 'past' : null}
                            variant="sınav"
                          />
                          {resultDt !== '—' && (
                            <DateChip icon={ClipboardCheck} label="Sonuç" value={resultDt} variant="sonuç" />
                          )}
                        </div>

                        {isExpanded && hasBody && (
                          <div className="rounded-lg border border-border/40 bg-muted/10 p-4 text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                            {i.body || i.summary}
                          </div>
                        )}
                        {hasBody && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs -ml-1"
                            onClick={() => setExpandedId(isExpanded ? null : i.id)}
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                            {isExpanded ? 'Daralt' : 'Detayı göster'}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
