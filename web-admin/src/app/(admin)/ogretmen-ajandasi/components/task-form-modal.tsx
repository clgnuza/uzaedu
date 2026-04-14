'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReminderFormSection } from './reminder-form-section';

function localTodayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ymdToSlash(ymd: string): string {
  if (ymd.length < 10) return ymd;
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

type TaskFormData = {
  title: string;
  description: string;
  dueDate?: string;
  dueTime?: string;
  priority: 'low' | 'medium' | 'high';
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly';
  studentId?: string;
  remindAt?: string;
};

export function TaskFormModal({
  open,
  onOpenChange,
  onSubmit,
  initialDate,
  initial,
  editTaskId,
  students = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  initialDate?: string;
  initial?: Partial<TaskFormData>;
  /** Düzenleme modu — yoksa yeni görev; initial nesne referansı her render değişmesin diye */
  editTaskId?: string | null;
  students?: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ?? initialDate ?? localTodayYMD(),
  );
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '09:00');
  const [priority, setPriority] = useState<TaskFormData['priority']>(
    initial?.priority ?? 'medium',
  );
  const [repeat, setRepeat] = useState<TaskFormData['repeat']>(initial?.repeat ?? 'none');
  const [studentId, setStudentId] = useState(initial?.studentId ?? '');
  const [remindAt, setRemindAt] = useState<string | undefined>();
  const [reminderWanted, setReminderWanted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editTaskId) {
      if (!initial) return;
      setTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setDueDate(initial.dueDate ?? localTodayYMD());
      setDueTime(initial.dueTime ?? '09:00');
      setPriority((initial.priority as TaskFormData['priority']) ?? 'medium');
      setRepeat(initial.repeat ?? 'none');
      setStudentId(initial.studentId ?? '');
      setRemindAt(initial.remindAt);
      setReminderWanted(!!initial.remindAt?.trim());
    } else {
      setTitle('');
      setDescription('');
      setDueDate(initialDate ?? localTodayYMD());
      setDueTime('09:00');
      setPriority('medium');
      setRepeat('none');
      setStudentId('');
      setRemindAt(undefined);
      setReminderWanted(false);
    }
  }, [
    open,
    editTaskId,
    initialDate,
    initial?.title,
    initial?.description,
    initial?.dueDate,
    initial?.dueTime,
    initial?.priority,
    initial?.repeat,
    initial?.studentId,
    initial?.remindAt,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (reminderWanted && !remindAt?.trim()) {
      toast.error('Hatırlatma için tarih ve saat seçin');
      return;
    }
    if (repeat !== 'none' && (!dueDate || dueDate.length < 10)) {
      toast.error('Tekrar (günlük / haftalık / aylık) için son tarih zorunludur');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
        dueTime: dueTime || undefined,
        priority,
        repeat,
        studentId: studentId || undefined,
        remindAt: editTaskId
          ? reminderWanted && remindAt?.trim()
            ? remindAt
            : ''
          : reminderWanted && remindAt?.trim()
            ? remindAt
            : undefined,
      });
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setDueDate(localTodayYMD());
      setDueTime('09:00');
      setPriority('medium');
      setRepeat('none');
      setStudentId('');
      setRemindAt(undefined);
      setReminderWanted(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={editTaskId ? 'Görevi Düzenle' : 'Yeni Görev'}>
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <Label htmlFor="task-title" className="text-xs sm:text-sm">
              Başlık
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Görev başlığı"
              required
              className="mt-1 min-h-10 text-sm sm:min-h-11"
            />
          </div>
          <div>
            <Label htmlFor="task-desc" className="text-xs sm:text-sm">
              Açıklama
            </Label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              rows={2}
              className="mt-1 min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-[80px] sm:py-2.5"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <Label htmlFor="task-date" className="text-xs sm:text-sm">
                Son tarih
              </Label>
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 min-h-10 text-sm sm:min-h-11"
              />
              {dueDate && dueDate.length >= 10 ? (
                <p className="mt-1 text-[11px] font-medium tabular-nums text-muted-foreground sm:hidden">{ymdToSlash(dueDate)}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="task-time" className="text-xs sm:text-sm">
                Saat
              </Label>
              <Input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1 min-h-10 text-sm sm:min-h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <Label className="text-xs sm:text-sm">Öncelik</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskFormData['priority'])}
                className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-11"
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
              </select>
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Tekrar</Label>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as TaskFormData['repeat'])}
                className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-11"
              >
                <option value="none">Yok</option>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
              </select>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-xs">
                Tamamlayınca bir sonraki vade için yeni görev oluşur (vade tarihi gerekli).
              </p>
            </div>
          </div>
          {students.length > 0 && (
            <div>
              <Label className="text-xs sm:text-sm">Öğrenci (opsiyonel)</Label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-11"
              >
                <option value="">Seçin</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <ReminderFormSection
            enabled={reminderWanted}
            remindAt={remindAt}
            onChange={setRemindAt}
            disabled={loading}
            onEnabledChange={setReminderWanted}
          />
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              İptal
            </Button>
            <Button type="submit" disabled={loading || !title.trim()} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              {loading ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
