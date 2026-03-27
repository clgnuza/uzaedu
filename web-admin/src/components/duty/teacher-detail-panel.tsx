'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Calendar, BookOpen, ShieldOff, CalendarDays, Info } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetClose,
} from '@/components/ui/sheet';
import { type TeacherColor } from '@/components/duty/teacher-color';

type DutySlot = {
  id: string;
  date: string;
  shift?: 'morning' | 'afternoon';
  area_name: string | null;
  user_id: string;
  absent_marked_at: string | null;
  reassigned_from_user_id?: string | null;
  user?: { display_name: string | null; email: string };
};

type UserItem = {
  id: string;
  display_name: string | null;
  email: string;
  teacherBranch?: string | null;
  dutyExempt?: boolean;
};

type TimetableEntry = {
  user_id: string;
  day_of_week: number; // 1=Pzt … 5=Cum
  lesson_num: number;  // 1-12
  class_section: string;
  subject: string;
};

const WEEK_DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
const SHIFT_LABELS: Record<string, string> = {
  morning: 'Sabah',
  afternoon: 'Öğle',
};

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function getInitials(name: string | null, email: string) {
  const src = name ?? email;
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

interface TeacherDetailPanelProps {
  open: boolean;
  onClose: () => void;
  teacherId: string | null;
  teachers: UserItem[];
  rangeSlots: DutySlot[];   // tüm dönemin slot'ları
  daySlots: DutySlot[];     // seçili günün slot'ları (day view için)
  colorMap: Map<string, TeacherColor>;
  token: string;
  focusDate: string; // mevcut görünümün odak tarihi
}

export function TeacherDetailPanel({
  open,
  onClose,
  teacherId,
  teachers,
  rangeSlots,
  daySlots,
  colorMap,
  token,
  focusDate,
}: TeacherDetailPanelProps) {
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttError, setTtError] = useState(false);

  const teacher = teachers.find((t) => t.id === teacherId) ?? null;
  const color = teacherId ? (colorMap.get(teacherId) ?? null) : null;

  // Ders programını çek (panel açıldığında veya teacher değiştiğinde)
  useEffect(() => {
    if (!open || !token || !teacherId) {
      setTimetable([]);
      return;
    }
    setTtLoading(true);
    setTtError(false);
    apiFetch<TimetableEntry[]>('/teacher-timetable', { token })
      .then((entries) => {
        const filtered = Array.isArray(entries)
          ? entries.filter((e) => e.user_id === teacherId)
          : [];
        setTimetable(filtered);
      })
      .catch(() => setTtError(true))
      .finally(() => setTtLoading(false));
  }, [open, token, teacherId]);

  // Bu öğretmenin mevcut periyottaki nöbetleri
  const teacherSlots = teacherId
    ? [...rangeSlots, ...daySlots]
        .filter((s) => s.user_id === teacherId)
        // deduplicate by id
        .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];

  // Ders programı grid'i: day_of_week (1-5) × lesson_num
  const maxLesson = timetable.length
    ? Math.max(...timetable.map((e) => e.lesson_num))
    : 0;

  // lesson → day → entry
  const timetableGrid: Record<number, Record<number, TimetableEntry | undefined>> = {};
  for (let ln = 1; ln <= maxLesson; ln++) {
    timetableGrid[ln] = {};
    for (let d = 1; d <= 5; d++) {
      timetableGrid[ln][d] = timetable.find(
        (e) => e.lesson_num === ln && e.day_of_week === d,
      );
    }
  }

  // Bu haftaki nöbet günleri (ders çakışması uyarısı için)
  const dutyDayOfWeeks = new Set(
    teacherSlots.map((s) => {
      const d = new Date(s.date + 'T12:00:00').getDay();
      return d === 0 ? 7 : d; // 1=Pzt … 7=Paz
    }),
  );

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-[420px] flex flex-col">
        {/* Başlık */}
        <SheetHeader className="gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {color ? (
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  color.bg, color.text,
                )}
              >
                {teacher ? getInitials(teacher.display_name, teacher.email) : '?'}
              </div>
            ) : (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-sm font-bold">
                ?
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground text-sm">
                {teacher?.display_name ?? teacher?.email ?? '—'}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {teacher?.teacherBranch && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {teacher.teacherBranch}
                  </span>
                )}
                {teacher?.dutyExempt && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                    <ShieldOff className="size-3" />
                    Muaf
                  </span>
                )}
                {teacherSlots.length > 0 && (
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                    color ? `${color.bg} ${color.text}` : 'bg-muted text-muted-foreground',
                  )}>
                    {teacherSlots.length} nöbet
                  </span>
                )}
              </div>
            </div>
          </div>
          <SheetClose />
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* ─── Nöbetler ─── */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Calendar className="size-3.5" />
              Bu Dönemdeki Nöbetler
            </h3>
            {teacherSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu dönemde nöbet kaydı yok.
              </p>
            ) : (
              <div className="space-y-1">
                {teacherSlots.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-sm',
                      s.absent_marked_at
                        ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/20'
                        : 'border-border bg-muted/30',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">
                        {formatDate(s.date)}
                      </span>
                      {s.shift && (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {SHIFT_LABELS[s.shift] ?? s.shift}
                        </span>
                      )}
                      {s.area_name && (
                        <span className="ml-1.5 truncate text-xs text-muted-foreground">
                          · {s.area_name}
                        </span>
                      )}
                    </div>
                    <div className="ml-2 flex shrink-0 gap-1">
                      {s.absent_marked_at && (
                        <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          Gelmeyen
                        </span>
                      )}
                      {s.reassigned_from_user_id && (
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          Değiştirildi
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Ders Programı ─── */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="size-3.5" />
              Haftalık Ders Programı
            </h3>

            {ttLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : ttError ? (
              <p className="text-sm text-muted-foreground">
                Ders programı yüklenemedi.
              </p>
            ) : timetable.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <CalendarDays className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Bu öğretmen için ders programı yüklenmemiş.
                </p>
                <Link
                  href="/ders-programi"
                  className="mt-1 inline-block text-xs text-primary hover:underline"
                  onClick={onClose}
                >
                  Ders programı yükle →
                </Link>
              </div>
            ) : (
              <div className="table-x-scroll rounded-lg border border-border">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="border-r px-2 py-1.5 text-center font-semibold text-muted-foreground w-10">
                        Ders
                      </th>
                      {WEEK_DAY_LABELS.map((d, idx) => {
                        const dayNum = idx + 1;
                        const hasDuty = dutyDayOfWeeks.has(dayNum);
                        return (
                          <th
                            key={d}
                            className={cn(
                              'border-r px-2 py-1.5 text-center font-semibold last:border-r-0',
                              hasDuty
                                ? (color ? `${color.bg} ${color.text}` : 'bg-primary/10 text-primary')
                                : 'text-muted-foreground',
                            )}
                          >
                            {d}
                            {hasDuty && (
                              <span
                                title="Bu gün nöbet var"
                                className={cn(
                                  'ml-1 inline-block size-1.5 rounded-full align-middle',
                                  color ? color.dot : 'bg-primary',
                                )}
                              />
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxLesson }, (_, ln) => (
                      <tr key={ln + 1} className="border-b last:border-b-0">
                        <td className="border-r bg-muted/30 px-2 py-1 text-center font-medium text-muted-foreground">
                          {ln + 1}
                        </td>
                        {Array.from({ length: 5 }, (_, d) => {
                          const entry = timetableGrid[ln + 1]?.[d + 1];
                          return (
                            <td
                              key={d}
                              className={cn(
                                'border-r px-2 py-1 text-center last:border-r-0',
                                entry
                                  ? 'bg-muted/20 font-medium text-foreground'
                                  : 'text-muted-foreground/40',
                              )}
                            >
                              {entry ? (
                                <span title={`${entry.class_section} – ${entry.subject}`}>
                                  <span className="font-semibold">{entry.class_section}</span>
                                  <br />
                                  <span className="text-[9px]">{entry.subject}</span>
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {timetable.length > 0 && dutyDayOfWeeks.size > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info className="size-3 shrink-0" />
                Vurgulanan sütunlarda bu öğretmenin nöbeti var.
              </p>
            )}
          </section>

          {/* ─── Takvime git ─── */}
          <section className="border-t pt-4">
            <Link
              href="/ders-programi"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              onClick={onClose}
            >
              <BookOpen className="size-3.5" />
              Ders programını güncelle
            </Link>
          </section>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
