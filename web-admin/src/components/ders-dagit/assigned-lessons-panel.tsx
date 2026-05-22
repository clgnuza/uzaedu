'use client';

import { Button } from '@/components/ui/button';
import { formatClassSectionsList } from '@/lib/class-section-sort';
import type { LessonAssignmentRow } from '@/lib/lesson-assignment';
import { cn } from '@/lib/utils';
import { BookOpen, Copy, DoorOpen, GraduationCap, Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';

type Subject = { id: string; name: string; short_code?: string | null };

const SUBJECT_CHIP: Record<string, string> = {
  coğ: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100',
  fel: 'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-100',
  mat: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100',
  fiz: 'bg-amber-100 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100',
  kim: 'bg-teal-100 text-teal-950 dark:bg-teal-950/50 dark:text-teal-100',
};

function chipClass(code: string): string {
  const k = code.slice(0, 3).toLocaleLowerCase('tr');
  return SUBJECT_CHIP[k] ?? 'bg-primary/10 text-primary';
}

function shortCode(row: LessonAssignmentRow, subjects: Subject[]): string {
  const s = subjects.find((x) => x.id === row.subject_id || x.name === row.subject_name);
  if (s?.short_code) return s.short_code.toUpperCase().slice(0, 4);
  return row.subject_name.slice(0, 3).toUpperCase();
}

type Props = {
  title: string;
  rows: LessonAssignmentRow[];
  subjects: Subject[];
  activeId: string | null;
  teacherName?: string | null;
  headerIcon?: LucideIcon;
  teacherNames?: Map<string, string>;
  roomNames?: Map<string, string>;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy?: () => void;
};

export function AssignedLessonsPanel({
  title,
  rows,
  subjects,
  activeId,
  teacherName,
  headerIcon: HeaderIcon = GraduationCap,
  teacherNames,
  roomNames,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  onCopy,
}: Props) {
  const totalHours = rows.reduce((s, r) => s + r.weekly_hours, 0);

  return (
    <div className="dd-assigned-panel flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-white/60 bg-gradient-to-b from-card/95 to-muted/30 shadow-sm dark:border-white/10">
      <div className="border-b border-primary/10 bg-gradient-to-r from-primary/8 via-transparent to-teal-500/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-inner">
            <HeaderIcon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
            {teacherName ? (
              <p className="truncate text-xs font-medium text-primary">{teacherName}</p>
            ) : null}
            <p className="text-[10px] text-muted-foreground">
              {rows.length} atama · {totalHours} haftalık ders saati
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/80 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
            <tr>
              <th className="w-12 px-2 py-2">Kısa</th>
              <th className="px-2 py-2">Ders</th>
              <th className="hidden px-2 py-2 md:table-cell">Şube</th>
              <th className="hidden px-2 py-2 lg:table-cell">Öğretmen</th>
              <th className="w-12 px-2 py-2 text-right">Saat</th>
              <th className="hidden w-24 px-2 py-2 xl:table-cell">Derslik</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const code = shortCode(r, subjects);
              const teacher =
                r.teacher_ids?.map((id) => teacherNames?.get(id) ?? '—').join(', ') || '—';
              const room =
                r.room_ids?.map((id) => roomNames?.get(id) ?? '—').join(', ') || '—';
              return (
                <tr
                  key={r.id}
                  className={cn(
                    'cursor-pointer border-t border-border/50 transition-colors hover:bg-primary/5',
                    activeId === r.id && 'bg-primary/12 ring-1 ring-inset ring-primary/25',
                  )}
                  onClick={() => onSelect(r.id)}
                  onDoubleClick={onEdit}
                >
                  <td className="px-2 py-2">
                    <span
                      className={cn(
                        'inline-flex min-w-[2.25rem] justify-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold',
                        chipClass(code),
                      )}
                    >
                      {code}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-medium">{r.subject_name}</td>
                  <td className="hidden max-w-[8rem] truncate px-2 py-2 text-xs text-muted-foreground md:table-cell">
                    {formatClassSectionsList(r.class_sections) || '—'}
                  </td>
                  <td className="hidden max-w-[7rem] truncate px-2 py-2 text-xs lg:table-cell">{teacher}</td>
                  <td className="px-2 py-2 text-right tabular-nums font-semibold">{r.weekly_hours}</td>
                  <td className="hidden px-2 py-2 text-xs text-muted-foreground xl:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <DoorOpen className="size-3 shrink-0 opacity-60" aria-hidden />
                      <span className="truncate">{room}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <BookOpen className="mx-auto mb-2 size-8 text-muted-foreground/40" aria-hidden />
                  <p className="text-xs text-muted-foreground">Henüz atama yok</p>
                  <Button type="button" size="sm" variant="secondary" className="mt-3 gap-1" onClick={onNew}>
                    <Plus className="size-3.5" />
                    İlk dersi ekle
                  </Button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t bg-muted/30 p-2.5">
        <Button type="button" size="sm" className="gap-1 shadow-sm" onClick={onNew}>
          <Plus className="size-3.5" />
          Yeni ders
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" disabled={!activeId} onClick={onEdit}>
          <Pencil className="size-3.5" />
          Güncelle
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1 text-destructive hover:text-destructive"
          disabled={!activeId}
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
          Sil
        </Button>
        {onCopy ? (
          <Button type="button" size="sm" variant="ghost" className="gap-1" disabled={!activeId} onClick={onCopy}>
            <Copy className="size-3.5" />
            Kopyala
          </Button>
        ) : null}
      </div>
    </div>
  );
}
