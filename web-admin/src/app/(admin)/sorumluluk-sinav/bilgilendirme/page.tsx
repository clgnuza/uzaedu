'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  Bell,
  Calendar,
  ChevronRight,
  Clock,
  DoorOpen,
  FolderOpen,
  GraduationCap,
  Layers,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Assignment = {
  sessionId: string;
  groupId: string;
  groupTitle: string;
  examType: string;
  academicYear: string | null;
  groupStatus: string;
  proctorRole: 'komisyon_uye' | 'gozcu';
  proctorRoleLabel: string;
  subjectName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string | null;
  sessionStatus: string;
};

type FilterTab = 'upcoming' | 'past';

type GroupBlock = {
  groupId: string;
  groupTitle: string;
  examType: string;
  academicYear: string | null;
  groupStatus: string;
  assignmentCount: number;
  dateFrom: string;
  dateTo: string;
  days: Array<[string, Assignment[]]>;
};

const GROUP_STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  completed: 'Tamamlandı',
  archived: 'Arşiv',
};

function sessionAtMs(sessionDate: string, time: string): number {
  const day = sessionDate.slice(0, 10);
  const parts = time.split(':');
  const hh = Number(parts[0] ?? 0);
  const mm = Number(parts[1] ?? 0);
  const d = new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

function fmtTime(t: string) {
  const [h, m] = t.split(':');
  return `${h}:${m ?? '00'}`;
}

function dayKey(d: string) {
  return d.slice(0, 10);
}

function fmtDateShort(ymd: string) {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateRange(from: string, to: string) {
  if (from === to) return fmtDateShort(from);
  return `${fmtDateShort(from)} – ${fmtDateShort(to)}`;
}

function dayHeading(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const target = new Date(d);
  target.setHours(12, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const label = d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (diff === 0) return `Bugün · ${label}`;
  if (diff === 1) return `Yarın · ${label}`;
  if (diff === -1) return `Dün · ${label}`;
  return label;
}

function groupByDay(items: Assignment[]) {
  const map = new Map<string, Assignment[]>();
  for (const r of items) {
    const k = dayKey(r.sessionDate);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function buildGroupBlocks(items: Assignment[], past: boolean): GroupBlock[] {
  const byGroup = new Map<string, Assignment[]>();
  for (const r of items) {
    if (!byGroup.has(r.groupId)) byGroup.set(r.groupId, []);
    byGroup.get(r.groupId)!.push(r);
  }

  const blocks: GroupBlock[] = [];
  for (const [groupId, arr] of byGroup) {
    const dates = arr.map((a) => dayKey(a.sessionDate)).sort();
    const sample = arr[0]!;
    blocks.push({
      groupId,
      groupTitle: sample.groupTitle,
      examType: sample.examType,
      academicYear: sample.academicYear,
      groupStatus: sample.groupStatus,
      assignmentCount: arr.length,
      dateFrom: dates[0]!,
      dateTo: dates[dates.length - 1]!,
      days: groupByDay(arr),
    });
  }

  blocks.sort((a, b) => {
    const cmp = past
      ? b.dateFrom.localeCompare(a.dateFrom)
      : a.dateFrom.localeCompare(b.dateFrom);
    if (cmp !== 0) return cmp;
    return a.groupTitle.localeCompare(b.groupTitle, 'tr');
  });
  return blocks;
}

function GroupHeader({ block }: { block: GroupBlock }) {
  const isBeceri = block.examType === 'beceri';
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3',
        isBeceri
          ? 'border-violet-200/70 bg-linear-to-r from-violet-500/10 to-fuchsia-500/5 dark:border-violet-800/40 dark:from-violet-950/35'
          : 'border-indigo-200/70 bg-linear-to-r from-indigo-500/10 to-sky-500/5 dark:border-indigo-800/40 dark:from-indigo-950/35',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm sm:size-9',
            isBeceri ? 'bg-violet-600 shadow-violet-500/25' : 'bg-indigo-600 shadow-indigo-500/25',
          )}
        >
          <FolderOpen className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-snug text-foreground sm:text-sm">{block.groupTitle}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase sm:text-[10px]',
                isBeceri
                  ? 'bg-violet-500/15 text-violet-900 dark:text-violet-200'
                  : 'bg-indigo-500/15 text-indigo-900 dark:text-indigo-200',
              )}
            >
              {isBeceri ? 'Beceri sınavı' : 'Sorumluluk sınavı'}
            </span>
            {block.academicYear ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
                {block.academicYear}
              </span>
            ) : null}
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
              {GROUP_STATUS_LABEL[block.groupStatus] ?? block.groupStatus}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3 shrink-0 opacity-70" />
              {fmtDateRange(block.dateFrom, block.dateTo)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3 shrink-0 opacity-70" />
              {block.assignmentCount} görev
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignmentRow({ row, dimmed }: { row: Assignment; dimmed?: boolean }) {
  const isGozcu = row.proctorRole === 'gozcu';

  return (
    <article
      className={cn(
        'flex items-stretch gap-2 rounded-xl border bg-card/90 p-2.5 shadow-sm transition-colors sm:gap-3 sm:p-3',
        dimmed ? 'border-border/50 opacity-80' : 'border-border/80 hover:border-teal-300/60 dark:hover:border-teal-700/50',
      )}
    >
      <div className={cn('flex w-1 shrink-0 rounded-full', isGozcu ? 'bg-amber-500' : 'bg-teal-600')} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:text-[10px]',
              isGozcu
                ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                : 'bg-teal-500/15 text-teal-900 dark:text-teal-200',
            )}
          >
            {isGozcu ? <Shield className="size-2.5" /> : <GraduationCap className="size-2.5" />}
            {row.proctorRoleLabel}
          </span>
        </div>
        <p className="truncate text-[13px] font-semibold leading-tight text-foreground sm:text-sm">{row.subjectName}</p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground sm:text-[11px]">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Calendar className="size-3 shrink-0 opacity-70" />
            {fmtDateShort(dayKey(row.sessionDate))}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3 shrink-0 opacity-70" />
            {fmtTime(row.startTime)}–{fmtTime(row.endTime)}
          </span>
          {row.roomName ? (
            <span className="inline-flex min-w-0 max-w-40 items-center gap-1 truncate sm:max-w-none">
              <DoorOpen className="size-3 shrink-0 opacity-70" />
              {row.roomName}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function SorumlulukBilgilendirmePage() {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('upcoming');

  useEffect(() => {
    if (!token || me?.role !== 'teacher') return;
    setLoading(true);
    apiFetch<Assignment[]>('/sorumluluk-exam/my-assignments', { token })
      .then(setRows)
      .catch(() => toast.error('Görevler yüklenemedi'))
      .finally(() => setLoading(false));
  }, [token, me?.role]);

  const { overdue, upcoming, nextAssignment, groupCount } = useMemo(() => {
    const now = Date.now();
    const past: Assignment[] = [];
    const future: Assignment[] = [];
    for (const r of rows) {
      if (sessionAtMs(r.sessionDate, r.endTime) < now) past.push(r);
      else future.push(r);
    }
    past.sort((a, b) => sessionAtMs(b.sessionDate, b.endTime) - sessionAtMs(a.sessionDate, a.endTime));
    future.sort((a, b) => sessionAtMs(a.sessionDate, a.startTime) - sessionAtMs(b.sessionDate, b.startTime));
    const groups = new Set(rows.map((r) => r.groupId));
    return { overdue: past, upcoming: future, nextAssignment: future[0] ?? null, groupCount: groups.size };
  }, [rows]);

  const visible = tab === 'upcoming' ? upcoming : overdue;
  const groupBlocks = useMemo(() => buildGroupBlocks(visible, tab === 'past'), [visible, tab]);

  if (me?.role !== 'teacher') {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
        Bu sayfa yalnızca öğretmen hesapları içindir.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {[
          { label: 'Grup', value: groupCount, tone: 'text-indigo-700 dark:text-indigo-300', bg: 'from-indigo-500/10 to-violet-500/5 border-indigo-200/60 dark:border-indigo-800/40' },
          { label: 'Yaklaşan', value: upcoming.length, tone: 'text-teal-700 dark:text-teal-300', bg: 'from-teal-500/10 to-cyan-500/5 border-teal-200/60 dark:border-teal-800/40' },
          { label: 'Geçmiş', value: overdue.length, tone: 'text-slate-600 dark:text-slate-300', bg: 'from-slate-500/8 to-slate-500/4 border-slate-200/70 dark:border-zinc-700/50' },
          { label: 'Toplam', value: rows.length, tone: 'text-sky-700 dark:text-sky-300', bg: 'from-sky-500/10 to-blue-500/5 border-sky-200/60 dark:border-sky-800/40' },
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border bg-linear-to-br px-1.5 py-2 text-center sm:px-3 sm:py-2.5', s.bg)}>
            <p className={cn('text-base font-bold tabular-nums leading-none sm:text-xl', s.tone)}>{s.value}</p>
            <p className="mt-1 text-[8px] font-medium text-muted-foreground sm:text-[10px]">{s.label}</p>
          </div>
        ))}
      </div>

      {nextAssignment && tab === 'upcoming' && (
        <div className="rounded-xl border border-teal-300/50 bg-linear-to-r from-teal-500/12 via-cyan-500/8 to-transparent p-2.5 sm:p-3 dark:border-teal-800/50">
          <p className="text-[9px] font-bold uppercase tracking-wider text-teal-800/90 dark:text-teal-300/90 sm:text-[10px]">
            En yakın görev
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-muted-foreground">{nextAssignment.groupTitle}</p>
              <p className="truncate text-sm font-semibold text-foreground">{nextAssignment.subjectName}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground sm:text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="size-3" />
                  {dayHeading(dayKey(nextAssignment.sessionDate)).split(' · ')[0]}
                </span>
                <span className="tabular-nums">
                  {fmtTime(nextAssignment.startTime)}–{fmtTime(nextAssignment.endTime)}
                </span>
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-teal-600/70" />
          </div>
        </div>
      )}

      <div className="flex rounded-xl border border-border/70 bg-muted/30 p-0.5 dark:bg-zinc-900/40">
        {([
          { id: 'upcoming' as const, label: 'Yaklaşan', count: upcoming.length },
          { id: 'past' as const, label: 'Geçmiş', count: overdue.length },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition-all sm:text-xs',
              tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span
              className={cn(
                'rounded-full px-1.5 py-px text-[9px] tabular-nums',
                tab === t.id ? 'bg-teal-500/15 text-teal-800 dark:text-teal-200' : 'bg-muted text-muted-foreground',
              )}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/25 px-4 py-8 text-center sm:py-10">
          <Bell className="mx-auto size-7 text-muted-foreground/40" strokeWidth={1.5} />
          <p className="mt-2 text-xs font-medium sm:text-sm">Henüz atanmış görev yok</p>
          <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
            Okul yönetimi atama yaptığında burada ve bildirimlerde görünür.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-[11px] text-muted-foreground sm:text-xs">
          {tab === 'upcoming' ? 'Yaklaşan görev bulunmuyor.' : 'Geçmiş görev bulunmuyor.'}
        </p>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          {groupBlocks.map((block) => (
            <section key={block.groupId} className="space-y-2 sm:space-y-2.5">
              <GroupHeader block={block} />
              {block.days.map(([ymd, dayRows]) => (
                <div key={`${block.groupId}-${ymd}`} className="space-y-1.5 pl-1 sm:pl-2">
                  <h4 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                    <Calendar className="size-3 opacity-60" />
                    {dayHeading(ymd)}
                  </h4>
                  <ul className="space-y-1.5 sm:space-y-2">
                    {dayRows.map((r) => (
                      <li key={`${r.sessionId}-${r.proctorRole}`}>
                        <AssignmentRow row={r} dimmed={tab === 'past'} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
