'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
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
  X,
} from 'lucide-react';
import {
  SvgViewAll,
  SvgViewActive,
  SvgViewSoon,
  SvgViewAssigned,
  SvgViewPast,
  SvgMegaphone,
} from '@/components/exam-duty-icons';
import { ExamDutyPreferencesForm } from '@/components/exam-duty-preferences-form';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/* ─── constants ─── */

const EXAM_DUTY_CATEGORIES = [
  { value: '', label: 'Tümü' },
  { value: 'meb', label: 'MEB' },
  { value: 'osym', label: 'ÖSYM' },
  { value: 'aof', label: 'AÖF' },
  { value: 'ataaof', label: 'ATA-AÖF' },
  { value: 'auzef', label: 'AUZEF' },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_DUTY_CATEGORIES.filter((c) => c.value).map((c) => [c.value, c.label])
);

const CAT = {
  meb: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', stripe: 'bg-amber-500' },
  osym: { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', stripe: 'bg-blue-500' },
  aof: { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', stripe: 'bg-emerald-500' },
  ataaof: { badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300', stripe: 'bg-violet-500' },
  auzef: { badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300', stripe: 'bg-teal-500' },
} as Record<string, { badge: string; stripe: string }>;
const CAT_DEFAULT = { badge: 'bg-muted text-muted-foreground', stripe: 'bg-muted-foreground/40' };

type StatusTab = 'all' | 'active' | 'soon' | 'assigned' | 'past';

const STATUS_TABS: {
  value: StatusTab;
  label: string;
  shortLabel: string;
  hint: string;
  Icon: ComponentType<{ className?: string }>;
  well: string;
  wellActive: string;
  /** Seçili sekme kartı */
  tabSelected: string;
  /** Seçili sayaç rozeti */
  countSelected: string;
}[] = [
  {
    value: 'all',
    label: 'Tümü',
    shortLabel: 'Tümü',
    hint: 'Tüm duyuruları göster',
    Icon: SvgViewAll,
    well: 'bg-muted/70 text-muted-foreground ring-1 ring-border/45',
    wellActive: 'bg-slate-500/18 text-slate-800 ring-1 ring-slate-400/45 dark:bg-slate-400/15 dark:text-slate-100 dark:ring-slate-500/40',
    tabSelected: 'border border-slate-300/70 bg-slate-50/90 shadow-sm dark:border-slate-600/60 dark:bg-slate-900/50',
    countSelected: 'bg-slate-600 text-white dark:bg-slate-500',
  },
  {
    value: 'active',
    label: 'Aktif',
    shortLabel: 'Aktif',
    hint: 'Başvuru veya sınav tarihi henüz geçmemiş duyurular',
    Icon: SvgViewActive,
    well: 'bg-muted/70 text-muted-foreground ring-1 ring-border/45',
    wellActive: 'bg-emerald-500/22 text-emerald-800 ring-1 ring-emerald-500/35 dark:bg-emerald-500/18 dark:text-emerald-200 dark:ring-emerald-400/35',
    tabSelected: 'border border-emerald-300/60 bg-emerald-50/85 shadow-sm dark:border-emerald-800/55 dark:bg-emerald-950/40',
    countSelected: 'bg-emerald-600 text-white dark:bg-emerald-600',
  },
  {
    value: 'soon',
    label: 'Yaklaşan',
    shortLabel: 'Yakın',
    hint: 'Son başvuru veya onay tarihi 7 gün içinde',
    Icon: SvgViewSoon,
    well: 'bg-muted/70 text-muted-foreground ring-1 ring-border/45',
    wellActive: 'bg-amber-500/24 text-amber-900 ring-1 ring-amber-500/40 dark:bg-amber-500/18 dark:text-amber-200 dark:ring-amber-400/40',
    tabSelected: 'border border-amber-300/65 bg-amber-50/90 shadow-sm dark:border-amber-800/55 dark:bg-amber-950/35',
    countSelected: 'bg-amber-600 text-white dark:bg-amber-600',
  },
  {
    value: 'assigned',
    label: 'Görevlerim',
    shortLabel: 'Çıktı',
    hint: 'Görev çıktı işaretlediğiniz duyurular (hatırlatma)',
    Icon: SvgViewAssigned,
    well: 'bg-muted/70 text-muted-foreground ring-1 ring-border/45',
    wellActive: 'bg-sky-500/22 text-sky-900 ring-1 ring-sky-500/38 dark:bg-sky-500/18 dark:text-sky-200 dark:ring-sky-400/38',
    tabSelected: 'border border-sky-300/60 bg-sky-50/88 shadow-sm dark:border-sky-800/55 dark:bg-sky-950/40',
    countSelected: 'bg-sky-600 text-white dark:bg-sky-600',
  },
  {
    value: 'past',
    label: 'Geçmiş',
    shortLabel: 'Eski',
    hint: 'Başvuru veya sınav tarihi geçmiş duyurular',
    Icon: SvgViewPast,
    well: 'bg-muted/70 text-muted-foreground ring-1 ring-border/45',
    wellActive: 'bg-zinc-500/20 text-zinc-800 ring-1 ring-zinc-400/40 dark:bg-zinc-500/15 dark:text-zinc-200 dark:ring-zinc-500/35',
    tabSelected: 'border border-zinc-300/60 bg-zinc-50/90 shadow-sm dark:border-zinc-600/55 dark:bg-zinc-900/45',
    countSelected: 'bg-zinc-600 text-white dark:bg-zinc-500',
  },
];

/* ─── types ─── */

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

type ListResponse = { items: ExamDutyItem[]; total: number };

/* ─── helpers ─── */

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function isDatePast(s: string | null | undefined): boolean {
  if (!s) return false;
  try { const d = new Date(s); d.setHours(23, 59, 59, 999); return d.getTime() < Date.now(); } catch { return false; }
}

function toDateYMD(s: string | null | undefined): string | null {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' }); } catch { return null; }
}

function isWithinDays(s: string | null | undefined, days: number): boolean {
  if (!s) return false;
  try {
    const d = new Date(s); d.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = (d.getTime() - now.getTime()) / 86400000;
    return diff >= 0 && diff <= days;
  } catch { return false; }
}

function daysUntil(s: string | null | undefined): number | null {
  if (!s) return null;
  try {
    const d = new Date(s); d.setHours(0, 0, 0, 0);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    return diff >= 0 ? diff : null;
  } catch { return null; }
}

function compareForTeacher(a: ExamDutyItem, b: ExamDutyItem): number {
  const pastA = isDatePast(a.application_end ?? a.applicationEnd) || isDatePast(a.exam_date ?? a.examDate);
  const pastB = isDatePast(b.application_end ?? b.applicationEnd) || isDatePast(b.exam_date ?? b.examDate);
  if (pastA !== pastB) return pastA ? 1 : -1;
  const ts = (i: ExamDutyItem) => { const r = i.exam_date ?? i.examDate ?? i.application_end ?? i.applicationEnd; const t = r ? new Date(r).getTime() : 0; return Number.isNaN(t) ? 0 : t; };
  if (pastA) return ts(b) - ts(a);
  const soonA = isWithinDays(a.application_end ?? a.applicationEnd, 7) || isWithinDays(a.application_approval_end ?? a.applicationApprovalEnd, 7);
  const soonB = isWithinDays(b.application_end ?? b.applicationEnd, 7) || isWithinDays(b.application_approval_end ?? b.applicationApprovalEnd, 7);
  if (soonA !== soonB) return soonA ? -1 : 1;
  return ts(a) - ts(b);
}

function getStatus(i: ExamDutyItem): 'past' | 'soon' | 'active' {
  if (isDatePast(i.application_end ?? i.applicationEnd) || isDatePast(i.exam_date ?? i.examDate)) return 'past';
  if (isWithinDays(i.application_end ?? i.applicationEnd, 7) || isWithinDays(i.application_approval_end ?? i.applicationApprovalEnd, 7)) return 'soon';
  return 'active';
}

const URL_SPLIT_RE = /(https?:\/\/[^\s<]+)/g;

function linkifyPlain(text: string, keyPrefix: string): ReactNode {
  if (!text) return null;
  const parts = text.split(URL_SPLIT_RE);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline decoration-primary/35 underline-offset-[3px] transition-colors hover:text-primary/90 hover:decoration-primary/60 break-all"
        >
          {part}
        </a>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

type ParsedDutyBody = {
  rows: { label: string; value: string }[];
  sessionsBlock: string | null;
  intro: string | null;
};

function isNoiseLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^güncelleme\s*:/i.test(t)) return true;
  if (/^sınav görevi\s+başvuru\s*süreci$/i.test(t.replace(/\s+/g, ' '))) return true;
  if (/^\d{1,2}-\d{1,2}-\d{4}(\s+\d{1,2}:\d{2})?\s*$/i.test(t)) return true;
  if (/^\d{1,2}[./]\d{1,2}[./]\d{4}\s+\d{1,2}:\d{2}/.test(t)) return true;
  return false;
}

function extractUrlFromText(s: string): string | null {
  const m = s.match(/https?:\/\/[^\s<"'`]+/i);
  if (m) return m[0].replace(/[.,;]+$/, '');
  const dom = s.match(
    /\b((?:gis\.)?osym\.gov\.tr|mebbis\.meb\.gov\.tr|augis\.anadolu\.edu\.tr|augis\.ata\.edu\.tr|auzefgis\.istanbul\.edu\.tr)\b/i,
  );
  if (dom) return `https://${dom[1]}`;
  return null;
}

function normalizeKvLabel(captured: string): string {
  const c = captured.toLowerCase().trim();
  if (c.includes('sınavın') && c.includes('ad')) return 'Sınav adı';
  if (c.includes('sınav') && c.includes('tarih')) return 'Sınav tarihi';
  if (c === 'sınav') return 'Sınav tarihi';
  if (c.includes('son') && c.includes('başvuru')) return 'Son başvuru';
  if (c.includes('başvuru')) return 'Başvuru';
  return captured;
}

function parseExamDutyBodyText(raw: string): ParsedDutyBody {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], sessionsBlock: null, intro: null };

  let head = trimmed;
  let sessionsBlock: string | null = null;
  const sessParts = trimmed.split(/\n\s*Sınav günleri ve oturumlar:\s*\n?/i);
  if (sessParts.length > 1) {
    head = sessParts[0].trim();
    sessionsBlock = sessParts.slice(1).join('\n').trim();
  }

  const kvRe =
    /^(Sınavın\s*Adı|Sınavın\s*adı|Sınav\s*Tarihi|Sınav\s*tarihi|Son\s*Başvuru\s*Tarihi|Son\s*başvuru\s*tarihi|Son\s*başvuru|Sınav|Başvuru)\s*:\s*(.+)$/i;
  const lines = head.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const rows: { label: string; value: string }[] = [];
  const loose: string[] = [];
  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    const m = line.match(kvRe);
    if (m) {
      rows.push({ label: normalizeKvLabel(m[1]), value: m[2].trim() });
      continue;
    }
    loose.push(line);
  }

  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const k = `${r.label}:${r.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const hasBaşvuruUrl = deduped.some((r) => r.label === 'Başvuru' && /^https?:\/\//i.test(r.value));
  if (!hasBaşvuruUrl) {
    const u = extractUrlFromText(trimmed);
    if (u) deduped.push({ label: 'Başvuru', value: u });
  }

  let intro = loose
    .filter((l) => !isNoiseLine(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (intro.length > 120) intro = `${intro.slice(0, 117)}…`;

  if (deduped.length === 0 && !sessionsBlock) {
    const t = trimmed.replace(/\s+/g, ' ');
    intro = t.length > 120 ? `${t.slice(0, 117)}…` : t;
    return { rows: [], sessionsBlock: null, intro: intro || null };
  }

  return { rows: deduped, sessionsBlock, intro: intro || null };
}

function ExamDutyExpandedContent({
  summary,
  body,
}: {
  summary: string | null | undefined;
  body: string;
}) {
  const parsed = useMemo(() => parseExamDutyBodyText(body), [body]);
  const summaryTrim = summary?.trim() ?? '';
  const fallbackSum =
    summaryTrim && summaryTrim.length <= 100 && !body.trim().startsWith(summaryTrim) ? summaryTrim : '';
  const extraLine = (parsed.intro?.trim() || fallbackSum) || null;

  return (
    <div className="mt-2 space-y-2">
      {extraLine && (
        <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">{linkifyPlain(extraLine, 'ex')}</p>
      )}

      {parsed.rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {parsed.rows.map((r, idx) => (
            <div
              key={`${r.label}-${idx}`}
              className="min-w-[140px] max-w-full rounded-md border border-border/45 bg-muted/30 px-2 py-1.5 shadow-sm dark:bg-muted/20"
            >
              <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</span>
              <span className="mt-0.5 block text-[11px] font-medium leading-tight text-foreground wrap-anywhere">
                {/^https?:\/\//i.test(r.value) ? (
                  <a
                    href={r.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline decoration-primary/30 underline-offset-2 hover:text-primary/90 break-all"
                  >
                    {r.value.replace(/^https:\/\//i, '')}
                  </a>
                ) : (
                  linkifyPlain(r.value, `r-${idx}`)
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {parsed.sessionsBlock && (
        <div className="max-h-24 overflow-y-auto rounded-md border border-border/35 bg-muted/20 px-2 py-1.5 font-mono text-[10px] leading-snug text-foreground/90 wrap-anywhere dark:bg-muted/15">
          <div className="whitespace-pre-wrap">{linkifyPlain(parsed.sessionsBlock, 'sess')}</div>
        </div>
      )}
    </div>
  );
}

/* ─── page ─── */

export default function SinavGorevlerimPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [items, setItems] = useState<ExamDutyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [preferredDateMap, setPreferredDateMap] = useState<Record<string, string | null>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assignDayChoiceForId, setAssignDayChoiceForId] = useState<string | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);

  const isTeacher = me?.role === 'teacher';
  const q = searchQuery.trim().toLowerCase();

  const statusCounts = useMemo(() => {
    let active = 0;
    let soon = 0;
    let past = 0;
    let assignedInList = 0;
    for (const i of items) {
      const s = getStatus(i);
      if (s === 'past') past++;
      else if (s === 'soon') soon++;
      else active++;
      if (assignedIds.has(i.id)) assignedInList++;
    }
    return { all: items.length, active, soon, past, assigned: assignedInList };
  }, [items, assignedIds]);

  const displayedItems = useMemo(() => {
    let list = [...items];
    if (q) list = list.filter((i) => i.title.toLowerCase().includes(q) || (i.summary ?? '').toLowerCase().includes(q));
    if (statusTab === 'active') list = list.filter((i) => getStatus(i) === 'active');
    else if (statusTab === 'soon') list = list.filter((i) => getStatus(i) === 'soon');
    else if (statusTab === 'past') list = list.filter((i) => getStatus(i) === 'past');
    else if (statusTab === 'assigned') list = list.filter((i) => assignedIds.has(i.id));
    return list.sort(compareForTeacher);
  }, [items, q, statusTab, assignedIds]);

  /* ── API ── */

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
        for (const a of assignedRes.assignments ?? []) map[a.exam_duty_id] = a.preferred_exam_date ?? null;
        setPreferredDateMap(map);
      } catch { setAssignedIds(new Set()); setPreferredDateMap({}); }
    } catch { setItems([]); } finally { setLoading(false); }
  }, [token, isTeacher, categoryFilter]);

  const handleAssignMe = useCallback(async (examDutyId: string, preferredExamDate?: string | null) => {
    if (!token || assigningId) return;
    setAssigningId(examDutyId);
    setAssignDayChoiceForId(null);
    try {
      await apiFetch<{ assigned: boolean }>(`/exam-duties/${examDutyId}/assign-me`, { token, method: 'POST', body: JSON.stringify(preferredExamDate ? { preferred_exam_date: preferredExamDate } : {}) });
      setAssignedIds((prev) => new Set(prev).add(examDutyId));
      setPreferredDateMap((prev) => ({ ...prev, [examDutyId]: preferredExamDate ?? null }));
      toast.success(preferredExamDate == null ? 'Görev çıktı işaretlendi. Sınav günü sabah hatırlatması alacaksınız.' : 'Görev çıktı işaretlendi. Seçtiğiniz gün sabah hatırlatması alacaksınız.');
    } catch { toast.error('İşaretlenemedi.'); } finally { setAssigningId(null); }
  }, [token, assigningId]);

  const handleUpdatePreferredDate = useCallback(async (examDutyId: string, preferredExamDate: string | null) => {
    if (!token || assigningId) return;
    setAssigningId(examDutyId);
    try {
      await apiFetch<{ assigned: boolean }>(`/exam-duties/${examDutyId}/assign-me`, { token, method: 'POST', body: JSON.stringify({ preferred_exam_date: preferredExamDate }) });
      setPreferredDateMap((prev) => ({ ...prev, [examDutyId]: preferredExamDate }));
      toast.success('Sabah hatırlatması tercihi güncellendi.');
    } catch { toast.error('Güncellenemedi.'); } finally { setAssigningId(null); }
  }, [token, assigningId]);

  const handleUnassignMe = useCallback(async (examDutyId: string) => {
    if (!token || unassigningId) return;
    setUnassigningId(examDutyId);
    try {
      await apiFetch<{ unassigned: boolean }>(`/exam-duties/${examDutyId}/unassign-me`, { token, method: 'POST' });
      setAssignedIds((prev) => { const n = new Set(prev); n.delete(examDutyId); return n; });
      setPreferredDateMap((prev) => { const n = { ...prev }; delete n[examDutyId]; return n; });
      toast.success('Görev çıktı işareti kaldırıldı.');
    } catch { toast.error('İşlem geri alınamadı.'); } finally { setUnassigningId(null); }
  }, [token, unassigningId]);

  useEffect(() => { if (!isTeacher) { router.replace('/403'); return; } fetchList(); }, [isTeacher, router, fetchList]);

  if (!isTeacher) return null;

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <Toolbar>
        <ToolbarHeading>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardList className="size-5 text-primary" />
            </div>
            <div>
              <ToolbarPageTitle>Sınav Görevlerim</ToolbarPageTitle>
              <ToolbarIconHints
                compact
                className="hidden sm:flex"
                items={[
                  { label: 'Kurum duyuruları (MEB, ÖSYM vb.)', icon: Megaphone },
                  { label: 'Bildirimler', icon: Bell },
                  { label: 'Tercih ayarları', icon: SlidersHorizontal },
                ]}
                summary="MEB, ÖSYM vb. sınav görevi duyuruları"
              />
            </div>
          </div>
        </ToolbarHeading>
        <ToolbarActions>
          <Button variant="ghost" size="sm" onClick={() => fetchList()} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Yenile
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowPrefs((p) => !p)} className="gap-1.5">
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Bildirim</span> Tercihleri
          </Button>
          <Link href="/bildirimler">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bell className="size-4" /> <span className="hidden sm:inline">Bildirimler</span>
            </Button>
          </Link>
        </ToolbarActions>
      </Toolbar>

      {/* ── Preferences (collapsible) ── */}
      {showPrefs && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <ExamDutyPreferencesForm />
        </div>
      )}

      {/* ── Görünüm + liste ── */}
      <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border/40 bg-linear-to-br from-muted/25 via-muted/10 to-background px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary ring-1 ring-primary/15">
                <SvgMegaphone className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">Liste</p>
                <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
                  Sınav görevi duyuruları
                </CardTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Görünüm sekmesi ile süzün; kurum seçimi ve arama birlikte uygulanır.
                </p>
              </div>
            </div>
            {!loading && items.length > 0 && (
              <div className="flex shrink-0 flex-col items-end gap-1 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-right shadow-sm sm:min-w-36">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Gösterilen
                </span>
                <p className="text-lg font-bold tabular-nums leading-none text-foreground">
                  {displayedItems.length}
                  <span className="text-sm font-semibold text-muted-foreground">
                    {q || statusTab !== 'all' || categoryFilter ? ` / ${items.length}` : ''}
                  </span>
                </p>
                <span className="text-[10px] text-muted-foreground">duyuru</span>
              </div>
            )}
          </div>

          {/* Görünüm sekmeleri — segment */}
          <div
            className="flex gap-1 overflow-x-auto scroll-pb-1 rounded-xl border border-border/45 bg-linear-to-b from-muted/55 to-muted/35 p-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Duyuru görünümü"
          >
            {STATUS_TABS.map((t) => {
              const count = statusCounts[t.value];
              const active = statusTab === t.value;
              const Icon = t.Icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  title={t.hint}
                  aria-selected={active}
                  aria-label={`${t.label}. ${t.hint}`}
                  onClick={() => setStatusTab(t.value)}
                  className={cn(
                    'flex min-h-[44px] min-w-0 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-all touch-manipulation sm:min-h-[48px] sm:flex-1 sm:flex-row sm:gap-2 sm:px-2.5 sm:text-xs',
                    active
                      ? cn('text-foreground shadow-md', t.tabSelected)
                      : 'border border-transparent text-muted-foreground hover:border-border/60 hover:bg-background/75 hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg transition-colors',
                      active ? t.wellActive : t.well
                    )}
                  >
                    <Icon className="size-4.5 sm:size-5" aria-hidden />
                  </span>
                  <span className="max-w-18 truncate text-center leading-tight sm:max-w-none">
                    <span className="hidden sm:inline">{t.label}</span>
                    <span className="sm:hidden">{t.shortLabel}</span>
                  </span>
                  {!loading && (
                    <span
                      className={cn(
                        'tabular-nums rounded-full px-2 py-0.5 text-[10px] font-bold',
                        active ? t.countSelected : 'bg-muted/90 text-muted-foreground'
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Arama + kurum */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Başlık veya özet ara…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 border-border/60 bg-background/80 pl-9 pr-9 text-sm shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Aramayı temizle"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Kurum</span>
              <label htmlFor="exam-duty-cat" className="sr-only">
                Kuruma göre filtrele
              </label>
              <select
                id="exam-duty-cat"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-border/60 bg-background/80 px-3 text-sm shadow-sm sm:w-[min(100%,12rem)]"
              >
                {EXAM_DUTY_CATEGORIES.map((c) => (
                  <option key={c.value || '_all'} value={c.value}>
                    {c.value ? `Kurum: ${c.label}` : c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="border-t border-border/30 bg-muted/15 p-0">
          {loading ? (
            <LoadingSpinner
              label="Sınav görevi duyuruları yükleniyor…"
              className="min-h-[220px] gap-2 py-14"
            />
          ) : !items.length ? (
            <EmptyState
              icon={<ClipboardList className="size-12 text-muted-foreground/70" />}
              title="Henüz duyuru yok"
              description="Yayınlanan MEB, ÖSYM ve diğer kurum sınav görevi duyuruları burada listelenir."
              className="py-16"
            />
          ) : displayedItems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/80 text-muted-foreground">
                <Search className="size-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Bu filtrelere uygun duyuru yok</p>
                <p className="mt-1 text-xs text-muted-foreground">Arama, görünüm veya kurum seçimini değiştirmeyi deneyin.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setSearchQuery('');
                  setStatusTab('all');
                  setCategoryFilter('');
                }}
              >
                Tüm filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-0.5 sm:mb-3">
                <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Kayıtlar
                </h2>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {displayedItems.length} duyuru
                </span>
              </div>
              <ul className="list-none space-y-3">
              {displayedItems.map((i) => (
                <DutyRow
                  key={i.id}
                  item={i}
                  isAssigned={assignedIds.has(i.id)}
                  preferredDate={preferredDateMap[i.id]}
                  isExpanded={expandedId === i.id}
                  onToggleExpand={() => setExpandedId(expandedId === i.id ? null : i.id)}
                  assigningId={assigningId}
                  unassigningId={unassigningId}
                  assignDayChoiceForId={assignDayChoiceForId}
                  onSetDayChoice={setAssignDayChoiceForId}
                  onAssign={handleAssignMe}
                  onUnassign={handleUnassignMe}
                  onUpdateDate={handleUpdatePreferredDate}
                />
              ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Row Component ─── */

function DutyRow({
  item: i,
  isAssigned,
  preferredDate,
  isExpanded,
  onToggleExpand,
  assigningId,
  unassigningId,
  assignDayChoiceForId,
  onSetDayChoice,
  onAssign,
  onUnassign,
  onUpdateDate,
}: {
  item: ExamDutyItem;
  isAssigned: boolean;
  preferredDate: string | null | undefined;
  isExpanded: boolean;
  onToggleExpand: () => void;
  assigningId: string | null;
  unassigningId: string | null;
  assignDayChoiceForId: string | null;
  onSetDayChoice: (id: string | null) => void;
  onAssign: (id: string, date?: string | null) => void;
  onUnassign: (id: string) => void;
  onUpdateDate: (id: string, date: string | null) => void;
}) {
  const cat = i.category_slug ?? i.categorySlug ?? '';
  const accent = CAT[cat] ?? CAT_DEFAULT;
  const appUrl = i.application_url ?? i.applicationUrl;
  const srcUrl = i.source_url ?? i.sourceUrl;
  const appEndRaw = i.application_end ?? i.applicationEnd;
  const appApprovalEndRaw = i.application_approval_end ?? i.applicationApprovalEnd;
  const examDateRaw = i.exam_date ?? i.examDate;
  const examEndRaw = i.exam_date_end ?? i.examDateEnd;
  const resultRaw = i.result_date ?? i.resultDate;

  const appStart = fmtDate(i.application_start ?? i.applicationStart);
  const appEnd = fmtDate(appEndRaw);
  const appApprovalEnd = fmtDate(appApprovalEndRaw);
  const examStart = fmtDate(examDateRaw);
  const examEnd = fmtDate(examEndRaw);
  const examFirstYMD = toDateYMD(examDateRaw);
  const examLastYMD = toDateYMD(examEndRaw);
  const resultDt = fmtDate(resultRaw);

  const hasBody = !!(i.body ?? i.summary);
  const appEndPast = isDatePast(appEndRaw);
  const examPast = isDatePast(examDateRaw);
  const appEndSoon = isWithinDays(appEndRaw, 7);
  const appApprovalSoon = isWithinDays(appApprovalEndRaw, 7);
  const status = getStatus(i);

  const daysLeft = daysUntil(appEndRaw);
  const multiDay = examFirstYMD && examLastYMD && examFirstYMD !== examLastYMD;
  const showDayChoice = assignDayChoiceForId === i.id;

  return (
    <li className="list-none">
    <article
      className={cn(
        'relative flex gap-0 overflow-hidden rounded-xl border border-border/55 bg-card shadow-sm transition-all',
        'hover:border-primary/18 hover:shadow-md',
        status === 'past' && 'opacity-[0.88]',
        status === 'soon' && 'border-amber-200/45 bg-amber-50/25 dark:border-amber-900/35 dark:bg-amber-950/15',
        isAssigned && 'border-emerald-200/40 bg-emerald-50/20 dark:border-emerald-900/35 dark:bg-emerald-950/15'
      )}
    >
      {/* left stripe */}
      <div className={cn('w-1.5 shrink-0 self-stretch', accent.stripe)} aria-hidden />

      <div className="flex-1 min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        {/* row 1: badges + title */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold', accent.badge)}>
                {CATEGORY_LABELS[cat] ?? (cat || 'Diğer')}
              </span>
              {status === 'past' && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <AlertTriangle className="size-2.5" /> Geçti
                </span>
              )}
              {status === 'soon' && daysLeft != null && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  <Sun className="size-2.5" /> {daysLeft === 0 ? 'Bugün son gün' : `${daysLeft} gün kaldı`}
                </span>
              )}
              {isAssigned && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <CheckCircle2 className="size-2.5" /> Görev çıktı
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">{i.title}</h3>
            {i.summary && !isExpanded && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{i.summary}</p>
            )}
          </div>

          {/* action buttons (right side on desktop) */}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:ml-3">
            {isAssigned ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {multiDay && (
                  <select
                    value={preferredDate ?? ''}
                    onChange={(e) => onUpdateDate(i.id, e.target.value || null)}
                    disabled={!!assigningId}
                    className="h-8 min-h-[36px] cursor-pointer rounded-lg border border-emerald-300/60 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 touch-manipulation"
                  >
                    <option value="">Her iki gün</option>
                    <option value={examFirstYMD!}>İlk gün ({examStart})</option>
                    <option value={examLastYMD!}>Son gün ({examEnd})</option>
                  </select>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 min-h-[36px] gap-1 text-xs text-muted-foreground hover:text-destructive touch-manipulation"
                  onClick={() => onUnassign(i.id)}
                  disabled={!!unassigningId}
                >
                  {unassigningId === i.id ? <RefreshCw className="size-3.5 animate-spin" /> : <><X className="size-3.5" /> Kaldır</>}
                </Button>
              </div>
            ) : !examPast && (
              showDayChoice ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-200/60 bg-amber-50/80 px-2 py-1.5 dark:border-amber-800/40 dark:bg-amber-950/30">
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200">Hangi gün?</span>
                  {[
                    { label: 'İlk gün', val: examFirstYMD },
                    { label: 'Son gün', val: examLastYMD },
                    { label: 'İkisi de', val: null },
                  ].map((opt) => (
                    <Button key={opt.label} variant="outline" size="sm" className="h-7 min-h-[32px] text-[11px] touch-manipulation" onClick={() => onAssign(i.id, opt.val)} disabled={!!assigningId}>
                      {opt.label}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" className="h-7 min-h-[32px] text-[11px] touch-manipulation" onClick={() => onSetDayChoice(null)}>
                    İptal
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 min-h-[36px] gap-1.5 border-primary/30 text-xs font-medium text-primary hover:bg-primary/5 touch-manipulation"
                  onClick={() => multiDay ? onSetDayChoice(i.id) : onAssign(i.id)}
                  disabled={!!assigningId}
                >
                  {assigningId === i.id ? <RefreshCw className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />}
                  Hatırlatma al
                </Button>
              )
            )}

            {appUrl && (
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 min-h-[36px] items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 touch-manipulation"
              >
                <ExternalLink className="size-3.5" /> Başvuru
              </a>
            )}
            {srcUrl && (
              <a
                href={srcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 min-h-[36px] items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation"
              >
                <ExternalLink className="size-3.5" /> Kaynak
              </a>
            )}
          </div>
        </div>

        {/* Tarihler — rozet kartları */}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/35 pt-3 sm:gap-2.5">
          <DateChip icon={CalendarClock} label="Başvuru" value={`${appStart} – ${appEnd}`} past={appEndPast} soon={appEndSoon} tone="blue" />
          {appApprovalEnd !== '—' && (
            <DateChip icon={FileCheck} label="Onay" value={appApprovalEnd} past={isDatePast(appApprovalEndRaw)} soon={appApprovalSoon} tone="violet" />
          )}
          <DateChip icon={Calendar} label="Sınav" value={examEnd !== '—' ? `${examStart} – ${examEnd}` : examStart} past={examPast} tone="amber" />
          {resultDt !== '—' && <DateChip icon={ClipboardCheck} label="Sonuç" value={resultDt} tone="teal" />}
        </div>

        {/* expandable body */}
        {isExpanded && hasBody && (
          <ExamDutyExpandedContent summary={i.summary ?? null} body={(i.body ?? i.summary) ?? ''} />
        )}
        {hasBody && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-primary hover:bg-primary/5 sm:w-auto sm:justify-start sm:py-1.5 touch-manipulation"
          >
            {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {isExpanded ? 'Metni daralt' : 'Tam metni göster'}
          </button>
        )}
      </div>
    </article>
    </li>
  );
}

/* ─── DateChip (SVG ikon + rozet) ─── */

const DATE_TONE: Record<string, { card: string; iconBg: string; iconFg: string }> = {
  blue: {
    card: 'border-blue-200/70 bg-blue-50/90 ring-blue-500/20 dark:border-blue-800/55 dark:bg-blue-950/35 dark:ring-blue-500/25',
    iconBg: 'bg-blue-500/18 dark:bg-blue-500/25',
    iconFg: 'text-blue-700 dark:text-blue-300',
  },
  violet: {
    card: 'border-violet-200/70 bg-violet-50/90 ring-violet-500/20 dark:border-violet-800/55 dark:bg-violet-950/35 dark:ring-violet-500/25',
    iconBg: 'bg-violet-500/18 dark:bg-violet-500/25',
    iconFg: 'text-violet-700 dark:text-violet-300',
  },
  amber: {
    card: 'border-amber-200/75 bg-amber-50/92 ring-amber-500/22 dark:border-amber-800/55 dark:bg-amber-950/32 dark:ring-amber-500/25',
    iconBg: 'bg-amber-500/20 dark:bg-amber-500/22',
    iconFg: 'text-amber-800 dark:text-amber-300',
  },
  teal: {
    card: 'border-teal-200/70 bg-teal-50/90 ring-teal-500/20 dark:border-teal-800/55 dark:bg-teal-950/35 dark:ring-teal-500/25',
    iconBg: 'bg-teal-500/18 dark:bg-teal-500/25',
    iconFg: 'text-teal-800 dark:text-teal-300',
  },
};

function DateChip({
  icon: Icon,
  label,
  value,
  past,
  soon,
  tone,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  past?: boolean;
  soon?: boolean;
  tone: keyof typeof DATE_TONE;
}) {
  const t = DATE_TONE[tone] ?? DATE_TONE.blue;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] shadow-sm ring-1 sm:text-xs',
        t.card,
        past && 'opacity-50 saturate-[0.65]',
        soon && !past && 'border-amber-300/80 bg-amber-50 ring-amber-400/35 dark:border-amber-700/60 dark:bg-amber-950/45'
      )}
    >
      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', t.iconBg, t.iconFg)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span
          className={cn(
            'font-medium text-foreground',
            past && 'line-through decoration-muted-foreground/50',
            soon && !past && 'text-amber-800 dark:text-amber-200'
          )}
        >
          {value}
        </span>
      </span>
    </span>
  );
}
