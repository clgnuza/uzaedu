'use client';

import {
  AlertTriangle,
  ClipboardCopy,
  ExternalLink,
  Focus,
  Lock,
  LockOpen,
  Settings2,
  Trash2,
} from 'lucide-react';
import { dayLabel } from '@/lib/ders-dagit-labels';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import type { TimetableMatrixRowMenuHandlers } from '@/lib/timetable-cell-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ContextMenuShell, MenuSep } from './TimetableContextMenuUi';

const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

function displayName(raw: string): string {
  const s = raw.trim();
  if (!s) return '—';
  if (s.includes('@')) return s.split('@')[0]!.replace(/[._]/g, ' ').trim() || s;
  return s;
}

function rowInitials(name: string): string {
  const parts = displayName(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  return displayName(name).slice(0, 2).toUpperCase();
}

function StatPill({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' | 'muted' }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2 py-1 text-center',
        tone === 'warn' && 'border-destructive/30 bg-destructive/5 text-destructive',
        tone === 'muted' && 'border-border/60 bg-muted/40 text-muted-foreground',
        !tone && 'border-violet-500/20 bg-violet-500/5 text-violet-900 dark:text-violet-100',
      )}
    >
      <div className="text-[15px] font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  hint,
  onClick,
  destructive,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all',
        'hover:bg-accent/70 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40',
        destructive && 'hover:bg-destructive/10',
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-colors',
          destructive
            ? 'border-destructive/20 bg-destructive/10 text-destructive group-hover:bg-destructive/15'
            : 'border-border/60 bg-background text-violet-600 group-hover:border-violet-500/30 group-hover:bg-violet-500/10 dark:text-violet-300',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] font-medium', destructive && 'text-destructive')}>{label}</span>
        {hint ? <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

export function TimetableMatrixRowMenu({
  label,
  userId,
  entries,
  clashIds,
  x,
  y,
  onClose,
  handlers,
  editable,
}: {
  label: string;
  userId: string | null;
  entries: EditorEntry[];
  clashIds: Set<string>;
  x: number;
  y: number;
  onClose: () => void;
  handlers: TimetableMatrixRowMenuHandlers;
  editable: boolean;
}) {
  const name = displayName(label);
  const clashEntries = entries.filter((e) => clashIds.has(e.id));
  const locked = entries.filter((e) => e.is_locked);
  const unlockable = entries.filter((e) => !e.is_locked);
  const days = new Set(entries.map((e) => e.day_of_week));
  const ids = entries.map((e) => e.id);
  const firstClash = clashEntries[0];

  const copySummary = () => {
    const lines = [...entries]
      .sort(
        (a, b) =>
          a.day_of_week - b.day_of_week || a.lesson_num - b.lesson_num || a.class_section.localeCompare(b.class_section, 'tr'),
      )
      .map(
        (e) =>
          `${DAY_SHORT[e.day_of_week - 1] ?? e.day_of_week} ${e.lesson_num}. · ${e.class_section} · ${e.subject}${e.is_locked ? ' [K]' : ''}`,
      );
    const text = `${name}\n${lines.join('\n')}`;
    void navigator.clipboard.writeText(text).then(() => {
      toast.success('Program özeti panoya kopyalandı');
      onClose();
    });
  };

  const header = (
    <div className="border-b border-border/60 bg-gradient-to-br from-violet-500/10 via-background to-background px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-violet-400 text-sm font-bold text-white shadow-md shadow-violet-500/25">
          {rowInitials(name)}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-300">
            <Settings2 className="size-3" aria-hidden />
            Öğretmen özellikleri
          </p>
          <p className="truncate text-sm font-semibold text-foreground" title={name}>
            {name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {entries.length} ders · {days.size} gün
            {locked.length ? ` · ${locked.length} kilitli` : ''}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <StatPill label="Ders" value={entries.length} />
        <StatPill label="Gün" value={days.size} />
        <StatPill label="Çakışma" value={clashEntries.length} tone={clashEntries.length ? 'warn' : 'muted'} />
      </div>
    </div>
  );

  return (
    <ContextMenuShell x={x} y={y} widthClass="w-[min(100vw-1rem,280px)]" onClose={onClose} header={header}>
      <div className="px-1.5 py-1">
        <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Görünüm</p>
        {handlers.onFocusTeacher ? (
          <ActionBtn
            icon={<Focus className="size-4" />}
            label="Bu öğretmene odaklan"
            hint="Öğretmen filtresine geç"
            onClick={() => {
              handlers.onFocusTeacher!(userId, label);
              onClose();
            }}
          />
        ) : null}
        {firstClash && handlers.onFocusClash ? (
          <ActionBtn
            icon={<AlertTriangle className="size-4" />}
            label="Çakışmaya git"
            hint={`${dayLabel(firstClash.day_of_week)} · ${firstClash.lesson_num}. ders`}
            onClick={() => {
              handlers.onFocusClash!(
                firstClash.id,
                `${firstClash.day_of_week}-${firstClash.lesson_num}`,
              );
              onClose();
            }}
          />
        ) : null}
      </div>

      {editable ? (
        <>
          <MenuSep />
          <div className="px-1.5 py-1">
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Hızlı işlemler
            </p>
            <ActionBtn
              icon={<ClipboardCopy className="size-4" />}
              label="Program özetini kopyala"
              hint="Panoya metin olarak"
              disabled={!entries.length}
              onClick={copySummary}
            />
            {handlers.onLockAll && unlockable.length ? (
              <ActionBtn
                icon={<Lock className="size-4" />}
                label="Tüm kartları kilitle"
                hint={`${unlockable.length} kart`}
                onClick={() => {
                  void handlers.onLockAll!(unlockable.map((e) => e.id), true);
                  onClose();
                }}
              />
            ) : null}
            {handlers.onLockAll && locked.length ? (
              <ActionBtn
                icon={<LockOpen className="size-4" />}
                label="Tüm kilitleri aç"
                hint={`${locked.length} kart`}
                onClick={() => {
                  void handlers.onLockAll!(locked.map((e) => e.id), false);
                  onClose();
                }}
              />
            ) : null}
            {handlers.onClearAll && entries.length ? (
              <ActionBtn
                icon={<Trash2 className="size-4" />}
                label="Tüm kartları kaldır"
                hint={`${entries.length} kart — onay toast ile`}
                destructive
                onClick={() => {
                  handlers.onClearAll!(ids);
                  onClose();
                }}
              />
            ) : null}
          </div>
        </>
      ) : null}

      <MenuSep />
      <div className="px-1.5 pb-1">
        {handlers.onOpenAssignments ? (
          <ActionBtn
            icon={<ExternalLink className="size-4" />}
            label="Ders atamalarına git"
            hint="Stüdyo · atamalar"
            onClick={() => {
              handlers.onOpenAssignments!(userId, label);
              onClose();
            }}
          />
        ) : null}
      </div>
    </ContextMenuShell>
  );
}
