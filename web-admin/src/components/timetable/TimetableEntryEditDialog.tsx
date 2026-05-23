'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Clock, Lock, Trash2 } from 'lucide-react';
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
import { entryCellColor } from '@/lib/timetable-colors';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

const DAY_OPTIONS = [
  { value: '1', label: 'Pazartesi' },
  { value: '2', label: 'Salı' },
  { value: '3', label: 'Çarşamba' },
  { value: '4', label: 'Perşembe' },
  { value: '5', label: 'Cuma' },
  { value: '6', label: 'Cumartesi' },
  { value: '7', label: 'Pazar' },
];

export function TimetableEntryEditDialog({
  entry,
  open,
  rooms,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  entry: EditorEntry | null;
  open: boolean;
  rooms: Array<{ id: string; name: string }>;
  busy?: boolean;
  onClose: () => void;
  onSave: (data: {
    day: number;
    lesson: number;
    locked: boolean;
    roomId: string;
  }) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [day, setDay] = useState(1);
  const [lesson, setLesson] = useState(1);
  const [locked, setLocked] = useState(false);
  const [roomId, setRoomId] = useState('');

  useEffect(() => {
    if (!entry) return;
    setDay(entry.day_of_week);
    setLesson(entry.lesson_num);
    setLocked(!!entry.is_locked);
    setRoomId(entry.room_id ?? '');
  }, [entry]);

  const colors = entry ? entryCellColor(entry, 'class') : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
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
                  Ders saatini düzenle
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-start gap-2.5" style={{ color: colors.text }}>
                    <span
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm"
                      style={{ backgroundColor: colors.border, color: '#fff' }}
                    >
                      <BookOpen className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold leading-tight">{entry.subject}</p>
                      <p className="text-xs font-medium opacity-80">{entry.class_section}</p>
                      {entry.teacher_label ? (
                        <p className="mt-0.5 truncate text-[11px] opacity-70">{entry.teacher_label}</p>
                      ) : null}
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
                  <DdSelectField
                    label="Gün"
                    labelClassName="text-xs font-medium"
                    value={String(day)}
                    onValueChange={(v) => setDay(Number(v))}
                    options={DAY_OPTIONS}
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
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

              {rooms.length > 0 && (
                <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
                  <DdSelectField
                    label="Derslik"
                    labelClassName="text-xs font-medium"
                    value={roomId}
                    onValueChange={setRoomId}
                    placeholder="Seçin"
                    options={[
                      { value: '', label: '—' },
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
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  locked
                    ? 'border-amber-400/60 bg-amber-50/90 dark:bg-amber-950/30'
                    : 'border-border/60 bg-muted/20 hover:bg-muted/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md',
                    locked ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Lock className="size-3.5" aria-hidden />
                </span>
                <span>
                  <span className="font-medium">Kilitli</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {locked ? 'Bu saat otomatik dağıtımda değişmez' : 'Sürükle-bırak ile taşınabilir'}
                  </span>
                </span>
              </button>
            </div>

            <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-3 sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                <Trash2 className="mr-1 size-3.5" />
                Sil
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
                  İptal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSave({ day, lesson, locked, roomId })}
                >
                  Kaydet
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
