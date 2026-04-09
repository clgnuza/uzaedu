'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  ExternalLink,
  Bell,
  Megaphone,
  CalendarCheck,
  SlidersHorizontal,
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
  tabIdle: string;
  tabActive: string;
  iconIdle: string;
  iconActive: string;
  countMuted: string;
  countSelected: string;
}[] = [
  {
    value: 'all',
    label: 'Tümü',
    shortLabel: 'Tümü',
    hint: 'Tüm duyuruları göster',
    Icon: SvgViewAll,
    tabIdle:
      'border border-slate-200/80 bg-linear-to-b from-slate-50/95 to-slate-100/50 text-slate-700 shadow-sm hover:border-slate-300 hover:shadow dark:border-slate-700/70 dark:from-slate-900/55 dark:to-slate-950/40 dark:text-slate-200',
    tabActive:
      'border-2 border-slate-400/75 bg-linear-to-br from-white via-slate-50 to-slate-100 text-slate-900 shadow-lg shadow-slate-500/20 ring-2 ring-slate-400/35 dark:border-slate-500 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 dark:text-white dark:shadow-slate-900/40 dark:ring-slate-500/45',
    iconIdle: 'bg-slate-200/70 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100',
    iconActive: 'bg-slate-600 text-white shadow-inner dark:bg-slate-500',
    countMuted: 'bg-white/80 text-slate-700 dark:bg-slate-800/90 dark:text-slate-200',
    countSelected: 'bg-slate-600 text-white dark:bg-slate-500',
  },
  {
    value: 'active',
    label: 'Aktif',
    shortLabel: 'Aktif',
    hint: 'Başvuru veya sınav tarihi henüz geçmemiş duyurular',
    Icon: SvgViewActive,
    tabIdle:
      'border border-emerald-200/80 bg-linear-to-b from-emerald-50/95 to-teal-50/40 text-emerald-900 shadow-sm hover:border-emerald-300 hover:shadow-md dark:border-emerald-900/50 dark:from-emerald-950/45 dark:to-teal-950/25 dark:text-emerald-100',
    tabActive:
      'border-2 border-emerald-400/80 bg-linear-to-br from-emerald-100 via-emerald-50 to-teal-50 text-emerald-950 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/40 dark:border-emerald-500 dark:from-emerald-900/70 dark:via-emerald-950 dark:to-teal-950/60 dark:text-emerald-50 dark:shadow-emerald-950/50 dark:ring-emerald-500/35',
    iconIdle: 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-800/60 dark:text-emerald-100',
    iconActive: 'bg-emerald-600 text-white shadow-inner dark:bg-emerald-500',
    countMuted: 'bg-emerald-100/90 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
    countSelected: 'bg-emerald-600 text-white dark:bg-emerald-600',
  },
  {
    value: 'soon',
    label: 'Yaklaşan',
    shortLabel: 'Yakın',
    hint: 'Son başvuru veya onay tarihi 7 gün içinde',
    Icon: SvgViewSoon,
    tabIdle:
      'border border-amber-200/85 bg-linear-to-b from-amber-50/95 to-orange-50/35 text-amber-950 shadow-sm hover:border-amber-300 hover:shadow-md dark:border-amber-900/45 dark:from-amber-950/40 dark:to-orange-950/25 dark:text-amber-100',
    tabActive:
      'border-2 border-amber-400/85 bg-linear-to-br from-amber-100 via-amber-50 to-orange-50 text-amber-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/45 dark:border-amber-500 dark:from-amber-900/65 dark:via-amber-950 dark:to-orange-950/55 dark:text-amber-50 dark:shadow-amber-950/45 dark:ring-amber-500/40',
    iconIdle: 'bg-amber-200/85 text-amber-950 dark:bg-amber-800/55 dark:text-amber-100',
    iconActive: 'bg-amber-600 text-white shadow-inner dark:bg-amber-500',
    countMuted: 'bg-amber-100/95 text-amber-950 dark:bg-amber-900/45 dark:text-amber-100',
    countSelected: 'bg-amber-600 text-white dark:bg-amber-600',
  },
  {
    value: 'assigned',
    label: 'Görevlerim',
    shortLabel: 'Çıktı',
    hint: 'Görev çıktı işaretlediğiniz duyurular (hatırlatma)',
    Icon: SvgViewAssigned,
    tabIdle:
      'border border-sky-200/85 bg-linear-to-b from-sky-50/95 to-cyan-50/40 text-sky-950 shadow-sm hover:border-sky-300 hover:shadow-md dark:border-sky-900/45 dark:from-sky-950/45 dark:to-cyan-950/25 dark:text-sky-100',
    tabActive:
      'border-2 border-sky-400/85 bg-linear-to-br from-sky-100 via-sky-50 to-cyan-50 text-sky-950 shadow-lg shadow-sky-500/28 ring-2 ring-sky-400/42 dark:border-sky-500 dark:from-sky-900/65 dark:via-sky-950 dark:to-cyan-950/55 dark:text-sky-50 dark:shadow-sky-950/45 dark:ring-sky-500/38',
    iconIdle: 'bg-sky-200/85 text-sky-950 dark:bg-sky-800/55 dark:text-sky-100',
    iconActive: 'bg-sky-600 text-white shadow-inner dark:bg-sky-500',
    countMuted: 'bg-sky-100/95 text-sky-950 dark:bg-sky-900/45 dark:text-sky-100',
    countSelected: 'bg-sky-600 text-white dark:bg-sky-600',
  },
  {
    value: 'past',
    label: 'Geçmiş',
    shortLabel: 'Eski',
    hint: 'Başvuru veya sınav tarihi geçmiş duyurular',
    Icon: SvgViewPast,
    tabIdle:
      'border border-zinc-200/80 bg-linear-to-b from-zinc-50/95 to-neutral-50/45 text-zinc-800 shadow-sm hover:border-zinc-300 hover:shadow-md dark:border-zinc-700/70 dark:from-zinc-900/50 dark:to-neutral-950/35 dark:text-zinc-200',
    tabActive:
      'border-2 border-zinc-400/75 bg-linear-to-br from-zinc-100 via-zinc-50 to-neutral-100 text-zinc-900 shadow-lg shadow-zinc-500/20 ring-2 ring-zinc-400/35 dark:border-zinc-600 dark:from-zinc-800/80 dark:via-zinc-900 dark:to-neutral-950/70 dark:text-zinc-50 dark:shadow-zinc-950/40 dark:ring-zinc-500/35',
    iconIdle: 'bg-zinc-200/80 text-zinc-800 dark:bg-zinc-700/55 dark:text-zinc-100',
    iconActive: 'bg-zinc-600 text-white shadow-inner dark:bg-zinc-500',
    countMuted: 'bg-zinc-100/95 text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200',
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
  published_at?: string | null;
  publishedAt?: string | null;
};

type ListResponse = { items: ExamDutyItem[]; total: number };

/** Bildirim tercihlerinden ortak sabah saati (kart metninde) */
type ExamDutyPrefsForList = {
  morningTime: string | null;
};

/* ─── helpers ─── */

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

/** Mobil tek satır (yıl kısaltılır) */
function fmtDateTimeShort(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function addDaysISO(iso: string | null | undefined, deltaDays: number): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + deltaDays);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

/** «Hatırlatma al» sonrası sabah kartı: tek gün veya çok günlükte tercih (iki gün / ilk / son). */
function getSabahMorningReminderChip(args: {
  isAssigned: boolean;
  examDateRaw: string | null | undefined;
  examEndRaw: string | null | undefined;
  examFirstYMD: string | null;
  examLastYMD: string | null;
  preferredDate: string | null | undefined;
  examStartFmt: string;
  examEndFmt: string;
  morningClock: string;
}): { show: boolean; value: string; past: boolean; soon: boolean } {
  const {
    isAssigned,
    examDateRaw,
    examEndRaw,
    examFirstYMD,
    examLastYMD,
    preferredDate,
    examStartFmt,
    examEndFmt,
    morningClock,
  } = args;

  if (!isAssigned) return { show: false, value: '', past: false, soon: false };

  const clock = morningClock.trim() || '07:00';

  if (!examDateRaw) {
    return { show: true, value: `— · ${clock}`, past: false, soon: false };
  }

  const multiDay = !!(examFirstYMD && examLastYMD && examFirstYMD !== examLastYMD);
  const prefRaw = preferredDate != null && String(preferredDate).trim() !== '' ? String(preferredDate).trim() : null;

  if (!multiDay) {
    return {
      show: true,
      value: `${examStartFmt} · sabah · ${clock}`,
      past: isDatePast(examDateRaw),
      soon: isWithinDays(examDateRaw, 7),
    };
  }

  if (!prefRaw) {
    const lastRaw = examEndRaw ?? examDateRaw;
    return {
      show: true,
      value: `${examStartFmt} – ${examEndFmt} · her iki sınav günü sabah · ${clock}`,
      past: isDatePast(lastRaw),
      soon:
        isWithinDays(examDateRaw, 7) ||
        (!!examEndRaw && isWithinDays(examEndRaw, 7)),
    };
  }

  if (examFirstYMD && prefRaw === examFirstYMD) {
    return {
      show: true,
      value: `${examStartFmt} · yalnız ilk gün sabah · ${clock}`,
      past: isDatePast(examDateRaw),
      soon: isWithinDays(examDateRaw, 7),
    };
  }

  if (examLastYMD && prefRaw === examLastYMD) {
    const lastRaw = examEndRaw ?? examDateRaw;
    return {
      show: true,
      value: `${examEndFmt} · yalnız son gün sabah · ${clock}`,
      past: isDatePast(lastRaw),
      soon: isWithinDays(lastRaw, 7),
    };
  }

  const lastRaw = examEndRaw ?? examDateRaw;
  return {
    show: true,
    value: `${examStartFmt} – ${examEndFmt} · sabah · ${clock}`,
    past: isDatePast(lastRaw),
    soon: isWithinDays(examDateRaw, 7) || (!!examEndRaw && isWithinDays(examEndRaw, 7)),
  };
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [preferredDateMap, setPreferredDateMap] = useState<Record<string, string | null>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [assignDayChoiceForId, setAssignDayChoiceForId] = useState<string | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);
  const [examDutyPrefs, setExamDutyPrefs] = useState<ExamDutyPrefsForList | null>(null);

  const isTeacher = me?.role === 'teacher';

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
    if (statusTab === 'active') list = list.filter((i) => getStatus(i) === 'active');
    else if (statusTab === 'soon') list = list.filter((i) => getStatus(i) === 'soon');
    else if (statusTab === 'past') list = list.filter((i) => getStatus(i) === 'past');
    else if (statusTab === 'assigned') list = list.filter((i) => assignedIds.has(i.id));
    return list.sort(compareForTeacher);
  }, [items, statusTab, assignedIds]);

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

  const fetchExamDutyPrefs = useCallback(async () => {
    if (!token || !isTeacher) return;
    try {
      const data = await apiFetch<Array<{ pref_exam_day_morning_time?: string | null }>>('/exam-duty-preferences', {
        token,
      });
      const list = Array.isArray(data) ? data : [];
      let morningTime: string | null = null;
      for (const p of list) {
        const t = p.pref_exam_day_morning_time;
        if (t != null && String(t).trim() !== '') {
          morningTime = String(t).trim();
          break;
        }
      }
      setExamDutyPrefs({ morningTime });
    } catch {
      setExamDutyPrefs({ morningTime: null });
    }
  }, [token, isTeacher]);

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

  useEffect(() => {
    if (!isTeacher) {
      router.replace('/403');
      return;
    }
    fetchList();
  }, [isTeacher, router, fetchList]);

  useEffect(() => {
    void fetchExamDutyPrefs();
  }, [fetchExamDutyPrefs]);

  const prevShowPrefs = useRef(false);
  useEffect(() => {
    if (prevShowPrefs.current && !showPrefs) void fetchExamDutyPrefs();
    prevShowPrefs.current = showPrefs;
  }, [showPrefs, fetchExamDutyPrefs]);

  if (!isTeacher) return null;

  return (
    <div className="space-y-3">
      {showPrefs && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <ExamDutyPreferencesForm onSaved={() => setShowPrefs(false)} />
        </div>
      )}

      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-md ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="space-y-0 border-b-0 p-0">
          <div className="relative overflow-hidden bg-linear-to-br from-violet-600 via-indigo-600 to-sky-600 px-3 py-2.5 sm:px-4 sm:py-3 dark:from-violet-800 dark:via-indigo-800 dark:to-sky-800">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 20%, white 0%, transparent 45%), radial-gradient(circle at 80% 80%, #fbbf24 0%, transparent 40%)',
              }}
              aria-hidden
            />
            <div className="relative flex min-h-[44px] items-center gap-2 sm:gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner ring-1 ring-white/25">
                <ClipboardList className="size-4 sm:size-[18px]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-white sm:text-base">
                  Sınav görevlerim
                </h1>
                <p className="truncate text-[11px] leading-snug text-white/85 sm:text-xs">
                  MEB, ÖSYM vb. · görünüm ve kurum süzün
                </p>
              </div>
              {!loading && items.length > 0 ? (
                <span
                  className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold tabular-nums leading-none text-white ring-1 ring-white/30 sm:px-2.5 sm:py-1 sm:text-xs"
                  title="Gösterilen / toplam duyuru"
                >
                  {displayedItems.length}
                  {statusTab !== 'all' || categoryFilter ? (
                    <span className="font-semibold text-white/80">/{items.length}</span>
                  ) : null}
                </span>
              ) : null}
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void fetchList();
                    void fetchExamDutyPrefs();
                  }}
                  disabled={loading}
                  className="size-9 text-white hover:bg-white/20 sm:size-10"
                  aria-label="Yenile"
                >
                  <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPrefs((p) => !p)}
                  className={cn(
                    'size-9 text-white hover:bg-white/20 sm:size-10',
                    showPrefs && 'bg-white/25 ring-1 ring-white/35'
                  )}
                  aria-label="Bildirim tercihleri"
                >
                  <SlidersHorizontal className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-9 text-white hover:bg-white/20 sm:size-10" asChild>
                  <Link href="/bildirimler" aria-label="Bildirimler">
                    <Bell className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3 border-b border-border/40 bg-linear-to-b from-violet-50/40 via-muted/25 to-muted/10 px-2.5 pb-3 pt-3 dark:from-violet-950/20 sm:px-4">
          <div
            className="grid grid-cols-5 gap-1 sm:gap-2"
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
                    'flex min-h-18 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[9px] font-semibold leading-tight transition-all active:scale-[0.98] touch-manipulation sm:min-h-15 sm:gap-1 sm:rounded-2xl sm:px-1 sm:py-2 sm:text-[11px] md:text-xs',
                    active ? t.tabActive : t.tabIdle
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl',
                      active ? t.iconActive : t.iconIdle
                    )}
                  >
                    <Icon className="size-[15px] sm:size-[18px]" aria-hidden />
                  </span>
                  <span className="w-full truncate text-center text-balance">
                    <span className="sm:hidden">{t.shortLabel}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </span>
                  {!loading && (
                    <span
                      className={cn(
                        'tabular-nums rounded-full px-1 py-px text-[8px] font-bold sm:px-1.5 sm:text-[10px]',
                        active ? t.countSelected : t.countMuted
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex w-full items-center gap-2">
            <label htmlFor="exam-duty-cat" className="sr-only">
              Kuruma göre filtrele
            </label>
            <select
              id="exam-duty-cat"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 w-full min-w-0 cursor-pointer rounded-xl border border-border/60 bg-background/90 px-3 text-sm shadow-sm ring-1 ring-black/5 dark:bg-background/80 dark:ring-white/10"
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
                <ClipboardList className="size-7" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Bu filtrelere uygun duyuru yok</p>
                <p className="mt-1 text-xs text-muted-foreground">Görünüm veya kurum seçimini değiştirmeyi deneyin.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setStatusTab('all');
                  setCategoryFilter('');
                }}
              >
                Filtreleri sıfırla
              </Button>
            </div>
          ) : (
            <div className="px-2 pb-2 pt-1 sm:px-4 sm:pb-4 sm:pt-3">
              <ul className="list-none space-y-2.5 sm:space-y-5">
              {displayedItems.map((i) => (
                <DutyRow
                  key={i.id}
                  item={i}
                  examPrefs={examDutyPrefs}
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
  examPrefs,
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
  examPrefs: ExamDutyPrefsForList | null;
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

  const publishedRaw = i.published_at ?? i.publishedAt;
  const lastExamDayRaw = examEndRaw ?? examDateRaw;
  const examMinusIso = addDaysISO(examDateRaw, -1);
  const examPlusIso = addDaysISO(lastExamDayRaw, 1);
  const morningClock = examPrefs?.morningTime?.trim() || '07:00';
  const sabahChip = getSabahMorningReminderChip({
    isAssigned,
    examDateRaw,
    examEndRaw,
    examFirstYMD,
    examLastYMD,
    preferredDate,
    examStartFmt: examStart,
    examEndFmt: examEnd,
    morningClock,
  });

  const hasBody = !!(i.body ?? i.summary);
  const appEndPast = isDatePast(appEndRaw);
  const examPast = isDatePast(examDateRaw);
  const appEndSoon = isWithinDays(appEndRaw, 7);
  const appApprovalSoon = isWithinDays(appApprovalEndRaw, 7);
  const status = getStatus(i);

  const daysLeft = daysUntil(appEndRaw);
  const multiDay = examFirstYMD && examLastYMD && examFirstYMD !== examLastYMD;
  const showDayChoice = assignDayChoiceForId === i.id;

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const soonChipId = appEndSoon && !appEndPast && appEndRaw ? `duty-soon-${i.id}` : undefined;

  useEffect(() => {
    if (!soonChipId) return;
    const sc = timelineScrollRef.current;
    const chip = document.getElementById(soonChipId);
    if (!sc || !chip) return;
    const raf = requestAnimationFrame(() => {
      const left = chip.offsetLeft - sc.clientWidth / 2 + chip.offsetWidth / 2;
      sc.scrollLeft = Math.max(0, left);
    });
    return () => cancelAnimationFrame(raf);
  }, [soonChipId, i.id]);

  return (
    <li className="list-none">
    <article
      className={cn(
        'relative flex gap-0 overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/4 transition-all sm:rounded-xl sm:border-2 sm:border-border/70 sm:shadow-md dark:border-border/80 dark:bg-card dark:ring-white/6',
        'hover:z-1 hover:border-primary/25 sm:hover:shadow-lg',
        status === 'past' && 'opacity-[0.88]',
        status === 'soon' && 'border-amber-200/45 bg-amber-50/25 dark:border-amber-900/35 dark:bg-amber-950/15',
        isAssigned && 'border-emerald-200/40 bg-emerald-50/20 dark:border-emerald-900/35 dark:bg-emerald-950/15'
      )}
    >
      {/* left stripe */}
      <div className={cn('w-1 shrink-0 self-stretch sm:w-1.5', accent.stripe)} aria-hidden />

      <div className="flex-1 min-w-0 px-2 py-2 sm:px-4 sm:py-4">
        {/* row 1: badges + title + özet (sadece sm+) + aksiyonlar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1 sm:mb-1.5 sm:gap-1.5">
              <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold sm:rounded-md sm:px-2 sm:text-[11px]', accent.badge)}>
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
            <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground sm:text-[17px] sm:leading-tight">
              {i.title}
            </h3>
            {i.summary && !isExpanded && (
              <p className="mt-1.5 hidden rounded-md border border-border/50 bg-muted/35 px-2 py-1.5 text-xs leading-snug text-muted-foreground line-clamp-2 dark:bg-muted/25 sm:mt-2 sm:block sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-[13px]">
                {i.summary}
              </p>
            )}
          </div>

          <div className="flex w-full flex-col sm:w-auto sm:max-w-[min(100%,20rem)] sm:shrink-0 sm:items-end">
            <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:justify-end">
            {isAssigned ? (
              <div className="flex w-full flex-wrap items-center justify-end gap-1 sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-0.5 border-destructive/30 px-2 text-[10px] font-medium text-destructive hover:bg-destructive/10 touch-manipulation sm:h-7 sm:text-xs"
                  onClick={() => onUnassign(i.id)}
                  disabled={!!unassigningId}
                >
                  {unassigningId === i.id ? <RefreshCw className="size-3 animate-spin" /> : <><X className="size-3" /> Kaldır</>}
                </Button>
                {multiDay && (
                  <select
                    value={preferredDate ?? ''}
                    onChange={(e) => onUpdateDate(i.id, e.target.value || null)}
                    disabled={!!assigningId}
                    className="h-7 min-h-0 min-w-0 max-w-full flex-1 cursor-pointer rounded-md border border-emerald-300/60 bg-emerald-50 px-1.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 touch-manipulation sm:max-w-56 sm:flex-none sm:text-xs"
                  >
                    <option value="">Her iki gün</option>
                    <option value={examFirstYMD!}>İlk gün ({examStart})</option>
                    <option value={examLastYMD!}>Son gün ({examEnd})</option>
                  </select>
                )}
              </div>
            ) : !examPast && (
              showDayChoice ? (
                <div className="flex w-full flex-wrap items-center justify-end gap-1 rounded-md border border-amber-200/60 bg-amber-50/80 px-1.5 py-1 dark:border-amber-800/40 dark:bg-amber-950/30 sm:w-auto">
                  <span className="w-full text-[10px] font-medium text-amber-800 dark:text-amber-200 sm:w-auto sm:text-xs">Hangi gün?</span>
                  {[
                    { label: 'İlk gün', val: examFirstYMD },
                    { label: 'Son gün', val: examLastYMD },
                    { label: 'İkisi de', val: null },
                  ].map((opt) => (
                    <Button key={opt.label} variant="outline" size="sm" className="h-7 px-2 text-[10px] touch-manipulation sm:text-xs" onClick={() => onAssign(i.id, opt.val)} disabled={!!assigningId}>
                      {opt.label}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] touch-manipulation sm:text-xs" onClick={() => onSetDayChoice(null)}>
                    İptal
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 border-primary/30 px-2 text-[10px] font-medium text-primary hover:bg-primary/5 touch-manipulation sm:text-xs"
                  onClick={() => multiDay ? onSetDayChoice(i.id) : onAssign(i.id)}
                  disabled={!!assigningId}
                >
                  {assigningId === i.id ? <RefreshCw className="size-3 animate-spin" /> : <Bell className="size-3" />}
                  Hatırlatma al
                </Button>
              )
            )
            }

            {appUrl && (
              <a
                href={appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-0.5 rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 touch-manipulation sm:text-xs"
              >
                <ExternalLink className="size-3 shrink-0" /> Başvuru
              </a>
            )}
            {srcUrl && (
              <a
                href={srcUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-background px-2 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground touch-manipulation sm:text-xs"
              >
                <ExternalLink className="size-3 shrink-0" /> Kaynak
              </a>
            )}
            </div>
          </div>
        </div>

        {/* Zaman çizelgesi — metinden ayrı kutu */}
        <div className="mt-2 rounded-lg border border-border/50 bg-muted/30 p-1.5 shadow-sm ring-1 ring-border/25 dark:bg-muted/15 dark:ring-border/40 sm:mt-4 sm:rounded-xl sm:p-3">
          <p className="mb-1.5 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/90 sm:mb-2 sm:text-[10px] sm:tracking-widest">
            Tarihler
          </p>
          <div
            ref={timelineScrollRef}
            className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-2.5 sm:overflow-visible sm:pb-0 sm:pt-0 [&::-webkit-scrollbar]:hidden"
          >
          <DateChip
            icon={Megaphone}
            label="Başvuru açıldı"
            labelShort="Yayın"
            value={fmtDateTime(publishedRaw)}
            valueCompact={fmtDateTimeShort(publishedRaw)}
            past={!!publishedRaw && isDatePast(publishedRaw)}
            soon={false}
            tone="blue"
          />
          <DateChip
            id={soonChipId}
            icon={CalendarClock}
            label="Son başvuru günü"
            labelShort="Son başv."
            value={fmtDate(appEndRaw)}
            past={appEndPast}
            soon={appEndSoon}
            tone="blue"
          />
          <DateChip
            icon={FileCheck}
            label="Onay günü"
            labelShort="Onay"
            value={fmtDate(appApprovalEndRaw)}
            past={!!appApprovalEndRaw && isDatePast(appApprovalEndRaw)}
            soon={appApprovalSoon}
            tone="violet"
          />
          <DateChip
            icon={CalendarCheck}
            label="Sınavdan 1 gün önce"
            labelShort="Önceki gün"
            value={examMinusIso ? fmtDate(examMinusIso) : '—'}
            past={!!examMinusIso && isDatePast(examMinusIso)}
            soon={!!examMinusIso && isWithinDays(examMinusIso, 7)}
            tone="amber"
          />
          {examDateRaw ? (
            <DateChip
              icon={Calendar}
              label="Sınav günü"
              labelShort="Sınav"
              value={examEnd !== '—' && examStart !== examEnd ? `${examStart} – ${examEnd}` : examStart}
              valueCompact={
                examEnd !== '—' && examStart !== examEnd && examDateRaw && examEndRaw
                  ? `${fmtDate(examDateRaw).replace(/ \d{4}$/, '')} – ${fmtDate(examEndRaw).replace(/ \d{4}$/, '')}`
                  : examStart
              }
              past={!!lastExamDayRaw && isDatePast(lastExamDayRaw)}
              soon={
                !!examDateRaw &&
                !isDatePast(lastExamDayRaw) &&
                (isWithinDays(examDateRaw, 7) || (!!examEndRaw && isWithinDays(examEndRaw, 7)))
              }
              tone="emerald"
            />
          ) : null}
          <DateChip
            icon={CalendarCheck}
            label="Sınavdan 1 gün sonra"
            labelShort="Sonraki gün"
            value={examPlusIso ? fmtDate(examPlusIso) : '—'}
            past={!!examPlusIso && isDatePast(examPlusIso)}
            soon={!!examPlusIso && isWithinDays(examPlusIso, 7)}
            tone="amber"
          />
          {sabahChip.show ? (
            <DateChip
              icon={Bell}
              label="Sabah hatırlatma"
              labelShort="Sabah"
              value={sabahChip.value}
              past={sabahChip.past}
              soon={sabahChip.soon}
              tone="teal"
            />
          ) : null}
          </div>
        {(appStart !== '—' || examStart !== '—' || resultDt !== '—') && (
          <div className="mt-2 hidden flex-wrap gap-x-4 gap-y-1.5 border-t border-border/40 pt-2.5 text-[11px] tabular-nums sm:flex">
            {appStart !== '—' && (
              <span className="text-muted-foreground">
                <span className="mr-1 font-medium text-foreground/70">Başvuru</span>
                <span className="text-foreground/85">{appStart} – {appEnd}</span>
              </span>
            )}
            {examStart !== '—' && (
              <span className="text-muted-foreground">
                <span className="mr-1 font-medium text-foreground/70">Sınav</span>
                <span className="text-foreground/85">
                  {examEnd !== '—' && examStart !== examEnd ? `${examStart} – ${examEnd}` : examStart}
                </span>
              </span>
            )}
            {resultDt !== '—' && (
              <span className="text-muted-foreground">
                <span className="mr-1 font-medium text-foreground/70">Sonuç</span>
                <span className="text-foreground/85">{resultDt}</span>
              </span>
            )}
          </div>
        )}
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
  emerald: {
    card: 'rounded-2xl border-emerald-200/55 bg-linear-to-br from-emerald-50/98 via-emerald-50/80 to-teal-50/45 shadow-[0_1px_2px_rgba(16,185,129,0.06)] ring-emerald-300/30 dark:border-emerald-800/45 dark:from-emerald-950/50 dark:via-emerald-950/38 dark:to-teal-950/28 dark:ring-emerald-500/18',
    iconBg: 'bg-emerald-400/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] dark:bg-emerald-500/22 dark:shadow-none',
    iconFg: 'text-emerald-800 dark:text-emerald-200',
  },
};

function DateChip({
  id,
  icon: Icon,
  label,
  labelShort,
  value,
  valueCompact,
  past,
  soon,
  tone,
}: {
  id?: string;
  icon: typeof Calendar;
  label: string;
  /** Mobilde kısa başlık */
  labelShort?: string;
  value: string;
  /** Mobilde kısa tarih/saat */
  valueCompact?: string;
  past?: boolean;
  soon?: boolean;
  tone: keyof typeof DATE_TONE;
}) {
  const t = DATE_TONE[tone] ?? DATE_TONE.blue;
  const show = valueCompact ?? value;
  return (
    <span
      id={id}
      className={cn(
        'inline-flex max-w-[min(100%,11.5rem)] shrink-0 snap-start items-center gap-1 rounded-lg border px-1.5 py-1 text-[9px] shadow-sm ring-1 sm:max-w-full sm:gap-2 sm:rounded-xl sm:px-2.5 sm:py-1.5 sm:text-[11px] sm:text-xs',
        t.card,
        past && 'opacity-50 saturate-[0.65]',
        soon &&
          !past &&
          (tone === 'emerald'
            ? 'border-emerald-400/65 bg-linear-to-br from-emerald-100/90 to-teal-50/70 ring-emerald-400/45 dark:border-emerald-600/55 dark:from-emerald-900/55 dark:to-teal-950/40'
            : 'border-amber-300/80 bg-amber-50 ring-amber-400/35 dark:border-amber-700/60 dark:bg-amber-950/45')
      )}
    >
      <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md sm:size-7 sm:rounded-lg', t.iconBg, t.iconFg)}>
        <Icon className="size-2.5 sm:size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span
          className={cn(
            'block font-semibold uppercase tracking-wide sm:text-[10px]',
            tone === 'emerald' ? 'text-emerald-800/75 dark:text-emerald-300/85' : 'text-muted-foreground',
            'text-[8px] sm:tracking-wide'
          )}
        >
          <span className="sm:hidden">{labelShort ?? label}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <span
          className={cn(
            'block font-medium text-foreground sm:inline',
            past && 'line-through decoration-muted-foreground/50',
            soon &&
              !past &&
              (tone === 'emerald' ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-800 dark:text-amber-200')
          )}
        >
          <span className="text-[10px] sm:hidden">
            {show}
            {past ? <span className="text-muted-foreground"> · geçti</span> : null}
          </span>
          <span className="hidden text-xs sm:inline">{value}</span>
        </span>
        {past ? (
          <span className="mt-0.5 hidden text-[9px] font-medium text-muted-foreground sm:block">Geçti</span>
        ) : null}
      </span>
    </span>
  );
}
