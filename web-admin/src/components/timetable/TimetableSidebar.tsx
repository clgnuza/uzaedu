'use client';

import { useDraggable } from '@dnd-kit/core';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { EditorContext, ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { TimetableWorkload } from './TimetableWorkload';
import { slotHighlightKey } from '@/lib/timetable-grid-build';

function PoolChip({
  assignmentId,
  label,
  sub,
  hours,
  disabled,
}: {
  assignmentId: string;
  label: string;
  sub: string;
  hours: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `pool-${assignmentId}`,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...(!disabled ? { ...attributes, ...listeners } : {})}
      className={cn(
        'rounded-md border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-xs',
        !disabled && 'cursor-grab touch-manipulation',
        isDragging && 'opacity-50',
      )}
      title="Izgaraya sürükleyin"
    >
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground">{sub}</div>
      <div className="text-[10px] text-amber-800">{hours} saat eksik</div>
    </div>
  );
}

type AuditRow = { id: string; action: string; created_at: string; user_label: string | null };

export function TimetableSidebar({
  unplaced,
  validation,
  clashes,
  entries,
  fairness,
  audit,
  busy,
  onFocusClash,
  hideUnplaced = false,
}: {
  unplaced: EditorContext['unplaced'];
  validation: ValidationIssue[];
  clashes: EditorContext['clashes'];
  entries: EditorContext['entries'];
  fairness: EditorContext['fairness'];
  audit: AuditRow[];
  busy: boolean;
  onFocusClash: (slotKey: string, entryId: string) => void;
  hideUnplaced?: boolean;
}) {
  const errors = validation.filter((v) => v.severity === 'error');
  const warns = validation.filter((v) => v.severity !== 'error');
  const seen = new Set<string>();
  const clashList = clashes.filter((c) => {
    const k = `${c.entry_id}-${c.code}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 20);
  const entryAudit = audit.filter((a) => a.action.includes('entry') || a.action.includes('swapped')).slice(0, 8);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-56 xl:w-64 print:hidden">
      <div className="rounded-lg border border-border p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Öğretmen yükü
        </h3>
        <TimetableWorkload fairness={fairness} />
      </div>
      {!hideUnplaced && (
        <div className="rounded-lg border border-border p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Atanmamış ({unplaced.length})
          </h3>
          <div className="max-h-40 space-y-1.5 overflow-y-auto">
            {unplaced.length === 0 ? (
              <p className="text-xs text-emerald-700">Tüm atamalar yerleşmiş.</p>
            ) : (
              unplaced.slice(0, 30).map((u) => (
                <PoolChip
                  key={u.assignment_id}
                  assignmentId={u.assignment_id}
                  label={`${u.class_section} · ${u.subject_name}`}
                  sub={u.teacher_label ?? '—'}
                  hours={u.remaining_hours}
                  disabled={busy}
                />
              ))
            )}
          </div>
        </div>
      )}
      {hideUnplaced && unplaced.length > 0 && (
        <p className="rounded-lg border border-dashed border-primary/30 px-3 py-2 text-xs text-muted-foreground">
          {unplaced.length} atanmamış — alttaki panele sürükleyin
        </p>
      )}
      {clashList.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <h3 className="mb-2 text-xs font-semibold text-destructive">Çakışmalar ({clashes.length})</h3>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
            {clashList.map((c, i) => {
              const ent = entries.find((e) => e.id === c.entry_id);
              const key = ent
                ? slotHighlightKey(ent.day_of_week, ent.lesson_num)
                : null;
              return (
                <li key={i}>
                  <button
                    type="button"
                    className="text-left underline hover:text-destructive"
                    onClick={() => key && onFocusClash(key, c.entry_id)}
                  >
                    {c.message}
                    {ent ? ` · ${ent.class_section} ${ent.day_of_week}/${ent.lesson_num}` : ''}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {entryAudit.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Son işlemler
          </h3>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-[10px] text-muted-foreground">
            {entryAudit.map((a) => (
              <li key={a.id}>
                {new Date(a.created_at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' })}{' '}
                {a.action.replace('program.', '')}
                {a.user_label ? ` · ${a.user_label}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-lg border border-border p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Doğrulama
        </h3>
        {errors.length === 0 && warns.length === 0 ? (
          <p className="text-xs text-emerald-700">Hata yok</p>
        ) : (
          <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
            {errors.map((v, i) => (
              <li key={`e-${i}`} className="text-destructive">
                {v.message}
                {v.href ? (
                  <>
                    {' '}
                    <Link href={v.href} className="underline">
                      {v.fix_hint ?? 'Düzelt'}
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
            {warns.slice(0, 6).map((v, i) => (
              <li key={`w-${i}`} className="text-amber-800">
                {v.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
