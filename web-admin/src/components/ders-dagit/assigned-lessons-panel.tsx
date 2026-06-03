'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatClassSectionsList } from '@/lib/class-section-sort';
import {
  assignmentCardBadgeLabels,
  assignmentDistributionLabel,
  type LessonAssignmentRow,
} from '@/lib/lesson-assignment';
import {
  assignedLessonsStatusLabel,
  type ClassProfileCapacity,
  computeAssignedLessonsSummary,
} from '@/lib/assigned-lessons-summary';
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
  /** Sabit yükseklik + iç kaydırma; gömülü panellerde `fillHeight` kullanın */
  maxHeightClass?: string;
  fillHeight?: boolean;
  className?: string;
  toolbar?: ReactNode;
  /** Tam genişlik sayfada tüm sütunları göster */
  wideTable?: boolean;
  /** Şube filtresi — özet ve katalog karşılaştırması */
  filterSection?: string;
  /** Seçili şube için katalog (plan) saat toplamı */
  catalogPlanHours?: number | null;
  /** Sınıf profili — haftalık saat sınırı uyarısı */
  classProfiles?: ClassProfileCapacity[];
  /** Kapasite hesabı için tüm atamalar (liste filtreliyse) */
  capacityRows?: LessonAssignmentRow[];
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
  maxHeightClass = 'max-h-[min(72vh,640px)]',
  fillHeight = false,
  className,
  toolbar,
  wideTable = false,
  filterSection,
  catalogPlanHours,
  classProfiles,
  capacityRows,
}: Props) {
  const summary = computeAssignedLessonsSummary(rows, {
    filterSection,
    catalogPlanHours,
    classProfiles,
    capacityRows,
  });
  const status = assignedLessonsStatusLabel(summary);
  const colSection = wideTable ? 'table-cell' : 'hidden md:table-cell';
  const colTeacher = wideTable ? 'table-cell' : 'hidden lg:table-cell';
  const colRoom = wideTable ? 'table-cell' : 'hidden xl:table-cell';
  const colPattern = wideTable ? 'table-cell' : 'hidden sm:table-cell';

  return (
    <div
      className={cn(
        'dd-assigned-panel flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-white/60 bg-gradient-to-b from-card/95 to-muted/30 shadow-sm dark:border-white/10',
        fillHeight ? 'h-full min-h-0' : maxHeightClass,
        className,
      )}
    >
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
              {summary.count} atama · {summary.totalHours} saat/hafta
              {filterSection ? ` · ${filterSection}` : ''}
            </p>
          </div>
        </div>
      </div>

      {toolbar ? <div className="shrink-0 border-b bg-muted/20 px-3 py-2">{toolbar}</div> : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b bg-muted/80 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
            <tr>
              <th className="w-12 px-2 py-2">Kısa</th>
              <th className="px-2 py-2">Ders</th>
              <th className={cn('px-2 py-2', colSection)}>Şube</th>
              <th className={cn('px-2 py-2', colTeacher)}>Öğretmen</th>
              <th className="w-12 px-2 py-2 text-right">Saat</th>
              <th className={cn('min-w-[4.5rem] px-2 py-2', colPattern)}>Dağılım</th>
              <th className={cn('w-24 px-2 py-2', colRoom)}>Derslik</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const code = shortCode(r, subjects);
              const teacher =
                r.teacher_ids?.map((id) => teacherNames?.get(id) ?? '—').join(', ') || '—';
              const room =
                r.room_ids?.map((id) => roomNames?.get(id) ?? '—').join(', ') || '—';
              const pattern = assignmentDistributionLabel(r);
              const badges = assignmentCardBadgeLabels(r);
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
                  <td className="max-w-[10rem] truncate px-2 py-2 font-medium sm:max-w-none">{r.subject_name}</td>
                  <td className={cn('max-w-[10rem] truncate px-2 py-2 text-xs text-muted-foreground', colSection)}>
                    {formatClassSectionsList(r.class_sections) || '—'}
                  </td>
                  <td className={cn('max-w-[9rem] truncate px-2 py-2 text-xs', colTeacher)}>{teacher}</td>
                  <td className="px-2 py-2 text-right">
                    <span className="tabular-nums font-semibold">{r.weekly_hours}</span>
                    {!wideTable ? (
                      <span className="mt-0.5 block text-[10px] font-medium text-primary/90 sm:hidden">{pattern}</span>
                    ) : null}
                  </td>
                  <td className={cn('px-2 py-2', colPattern)}>
                    <span className="font-mono text-[11px] font-semibold tabular-nums text-primary">{pattern}</span>
                    {badges.length ? (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="rounded bg-muted/80 px-1 py-px text-[8px] font-medium leading-tight text-muted-foreground"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td className={cn('px-2 py-2 text-xs text-muted-foreground', colRoom)}>
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
                <td colSpan={7} className="px-4 py-10 text-center">
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

      <div className="shrink-0 border-t bg-muted/40 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{summary.count}</span> atama
            </span>
            <span>
              <span className="font-semibold text-foreground">{summary.totalHours}</span> saat/hafta
            </span>
            <span>
              <span className="font-semibold text-foreground">{summary.subjectCount}</span> ders
            </span>
            {!filterSection ? (
              <span>
                <span className="font-semibold text-foreground">{summary.sectionCount}</span> şube
              </span>
            ) : null}
            {summary.biweeklyCount > 0 ? (
              <span>
                <span className="font-semibold text-foreground">{summary.biweeklyCount}</span> iki haftada bir
              </span>
            ) : null}
            {summary.planHours != null ? (
              <span>
                Katalog <span className="font-semibold text-foreground">{summary.planHours}</span> saat
              </span>
            ) : null}
            {summary.weeklyLimit != null ? (
              <span
                className={cn(
                  summary.capacityWarnings.some((w) => w.severity === 'error') &&
                    'font-medium text-destructive',
                )}
              >
                Sınır <span className="font-semibold text-foreground">{summary.weeklyLimit}</span> saat
              </span>
            ) : null}
          </div>
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
              status.tone === 'ok' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
              status.tone === 'warn' && 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
              status.tone === 'error' && 'bg-destructive/15 text-destructive',
              status.tone === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            {status.label}
          </span>
        </div>
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
