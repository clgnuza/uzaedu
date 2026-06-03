'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Clock, Lock, Trash2, UserRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { cn } from '@/lib/utils';
import { dayLabel } from '@/lib/ders-dagit-labels';
import { entryCellColor } from '@/lib/timetable-colors';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import {
  distributionOptionsForHours,
  formatDayDistribution,
  inferDayDistribution,
  isValidDayDistribution,
} from '@/lib/lesson-distribution';
import type { LessonAssignmentRow } from '@/lib/lesson-assignment';
import { assignmentDistributionLabel } from '@/lib/lesson-assignment';

const DAY_OPTIONS = [
  { value: '1', label: 'Pazartesi' },
  { value: '2', label: 'Salı' },
  { value: '3', label: 'Çarşamba' },
  { value: '4', label: 'Perşembe' },
  { value: '5', label: 'Cuma' },
  { value: '6', label: 'Cumartesi' },
  { value: '7', label: 'Pazar' },
];

export type TimetableEntryEditSave =
  | { mode: 'release'; day_distribution: number[]; locked: boolean; roomId: string }
  | { mode: 'move'; day: number; lesson: number; locked: boolean; roomId: string };

export function TimetableEntryEditDialog({
  entry,
  open,
  assignment,
  assignmentLoading,
  rooms,
  busy,
  hasClash,
  blockHint,
  onClose,
  onSave,
  onDelete,
}: {
  entry: EditorEntry | null;
  open: boolean;
  assignment: LessonAssignmentRow | null;
  assignmentLoading?: boolean;
  rooms: Array<{ id: string; name: string }>;
  busy?: boolean;
  hasClash?: boolean;
  blockHint?: string | null;
  onClose: () => void;
  onSave: (data: TimetableEntryEditSave) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [day, setDay] = useState(1);
  const [lesson, setLesson] = useState(1);
  const [locked, setLocked] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [dayDistribution, setDayDistribution] = useState<number[]>([2, 2]);
  const [showMove, setShowMove] = useState(false);

  const weeklyHours = assignment?.weekly_hours ?? 0;
  const effHours = assignment?.biweekly ? Math.ceil(weeklyHours / 2) : weeklyHours;
  const distOptions = useMemo(() => distributionOptionsForHours(effHours || 4), [effHours]);
  const distValue = isValidDayDistribution(dayDistribution, effHours)
    ? formatDayDistribution(dayDistribution)
    : (distOptions[0]?.value ?? '');

  useEffect(() => {
    if (!entry) return;
    setDay(entry.day_of_week);
    setLesson(entry.lesson_num);
    setLocked(!!entry.is_locked);
    setRoomId(entry.room_id ?? '');
    setShowMove(false);
  }, [entry]);

  useEffect(() => {
    if (!assignment) return;
    setDayDistribution(inferDayDistribution(assignment.weekly_hours, assignment.options, !!assignment.biweekly));
  }, [assignment]);

  const colors = entry ? entryCellColor(entry, 'class') : null;
  const canEditDistribution = !!entry?.assignment_id && !!assignment && effHours > 0;
  const currentDistLabel = assignment ? assignmentDistributionLabel(assignment) : blockHint;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        {entry && colors && (
          <>
            <div
              className="border-b px-5 py-4"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${colors.border} 18%, ${colors.bg}) 0%, ${colors.bg} 100%)`,
                borderBottomColor: `${colors.border}44`,
              }}
            >
              <DialogHeader className="space-y-2 text-left">
                <DialogTitle className="text-base font-semibold tracking-tight" style={{ color: colors.text }}>
                  Dersi düzenle
                </DialogTitle>
                <div className="flex items-start gap-3" style={{ color: colors.text }}>
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
                    style={{ backgroundColor: colors.border, color: '#fff' }}
                  >
                    <BookOpen className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold leading-tight">{entry.subject}</p>
                    <p className="text-sm font-medium opacity-90">{entry.class_section}</p>
                    {entry.teacher_label ? (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs opacity-80">
                        <UserRound className="size-3 shrink-0" />
                        {entry.teacher_label}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs opacity-60">Öğretmen atanmamış</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-black/10 px-2 py-0.5 text-[10px] font-medium dark:bg-white/10">
                    {dayLabel(entry.day_of_week)} · {entry.lesson_num}. saat
                  </span>
                  {weeklyHours > 0 ? (
                    <span className="rounded-md bg-black/10 px-2 py-0.5 text-[10px] font-medium dark:bg-white/10">
                      Haftalık {weeklyHours}
                    </span>
                  ) : null}
                  {currentDistLabel ? (
                    <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-900 dark:text-violet-100">
                      {currentDistLabel}
                    </span>
                  ) : null}
                  {entry.is_locked ? (
                    <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium">Kilitli</span>
                  ) : null}
                  {hasClash ? (
                    <span className="rounded-md bg-destructive/20 px-2 py-0.5 text-[10px] font-medium text-destructive">
                      Çakışma
                    </span>
                  ) : null}
                </div>
                <DialogDescription className="sr-only">
                  {entry.subject}, {entry.class_section}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="max-h-[min(60vh,420px)] space-y-4 overflow-y-auto px-5 py-4">
              {canEditDistribution ? (
                <section className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Haftalık dağılım
                  </h3>
                  {assignmentLoading ? (
                    <p className="text-xs text-muted-foreground">Atama yükleniyor…</p>
                  ) : (
                    <>
                      <DdSelectField
                        label="Gün başına saat deseni"
                        labelClassName="text-xs font-medium"
                        value={distValue}
                        onValueChange={(v) => {
                          const opt = distOptions.find((o) => o.value === v);
                          if (opt) setDayDistribution(opt.parts);
                        }}
                        options={distOptions.map((o) => ({ value: o.value, label: o.label }))}
                      />
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        Örn. 4 saat için 2+2: iki günde ikişer ardışık blok. Kayıt sonrası tüm saatler havuza alınır;
                        yeniden sürükleyerek yerleştirin.
                      </p>
                    </>
                  )}
                </section>
              ) : entry.assignment_id ? (
                <p className="text-xs text-muted-foreground">Atama bilgisi yüklenemedi; yalnızca konum güncellenebilir.</p>
              ) : null}

              {rooms.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                  <DdSelectField
                    label="Derslik"
                    labelClassName="text-xs font-medium"
                    value={roomId}
                    onValueChange={setRoomId}
                    placeholder="Seçin"
                    options={[
                      { value: '', label: '— Derslik yok —' },
                      ...rooms.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                  />
                </div>
              )}

              <button
                type="button"
                role="checkbox"
                aria-checked={locked}
                onClick={() => setLocked((v) => !v)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  locked
                    ? 'border-amber-400/60 bg-amber-50/90 dark:bg-amber-950/30'
                    : 'border-border/60 bg-muted/20 hover:bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-lg',
                    locked ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Lock className="size-3.5" aria-hidden />
                </span>
                <span>
                  <span className="font-medium">Kilitli kart</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {locked ? 'Yeniden yerleştirmede korunur' : 'Taşınabilir'}
                  </span>
                </span>
              </button>

              <section>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setShowMove((v) => !v)}
                >
                  Havuza almadan yalnızca konumu değiştir
                  <ChevronDown className={cn('size-4 transition-transform', showMove && 'rotate-180')} />
                </button>
                {showMove ? (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                      <DdSelectField
                        label="Gün"
                        labelClassName="text-xs font-medium"
                        value={String(day)}
                        onValueChange={(v) => setDay(Number(v))}
                        options={DAY_OPTIONS}
                      />
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/25 p-3">
                      <Label className="text-xs font-medium">Ders saati</Label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        <Input
                          type="number"
                          min={1}
                          className="h-9"
                          value={lesson}
                          onChange={(e) => setLesson(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <DialogFooter className="flex-col gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 sm:flex-col">
              <div className="flex w-full items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={busy}
                  onClick={() => void onDelete()}
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Kartı sil
                </Button>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
                    İptal
                  </Button>
                  {showMove ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onSave({ mode: 'move', day, lesson, locked, roomId })}
                    >
                      Konumu güncelle
                    </Button>
                  ) : null}
                  {canEditDistribution ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy || assignmentLoading}
                      onClick={() =>
                        void onSave({ mode: 'release', day_distribution: dayDistribution, locked, roomId })
                      }
                    >
                      Kaydet ve havuza al
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onSave({ mode: 'move', day, lesson, locked, roomId })}
                    >
                      Kaydet
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
