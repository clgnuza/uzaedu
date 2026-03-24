'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ReminderFormSection } from './reminder-form-section';

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
  students = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  initialDate?: string;
  initial?: Partial<TaskFormData>;
  students?: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState(
    initial?.dueDate ?? initialDate ?? new Date().toISOString().slice(0, 10),
  );
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '09:00');
  const [priority, setPriority] = useState<TaskFormData['priority']>(
    initial?.priority ?? 'medium',
  );
  const [repeat, setRepeat] = useState<TaskFormData['repeat']>(initial?.repeat ?? 'none');
  const [studentId, setStudentId] = useState(initial?.studentId ?? '');
  const [remindAt, setRemindAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && initial) {
      setTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setDueDate(initial.dueDate ?? new Date().toISOString().slice(0, 10));
      setDueTime(initial.dueTime ?? '09:00');
      setPriority((initial.priority as TaskFormData['priority']) ?? 'medium');
      setRepeat(initial.repeat ?? 'none');
      setStudentId(initial.studentId ?? '');
    }
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
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
        remindAt,
      });
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setDueDate(new Date().toISOString().slice(0, 10));
      setDueTime('09:00');
      setPriority('medium');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={initial ? 'Görevi Düzenle' : 'Yeni Görev'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="task-title">Başlık</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Görev başlığı"
              required
              className="mt-1 min-h-[44px] text-base sm:text-sm"
            />
          </div>
          <div>
            <Label htmlFor="task-desc">Açıklama</Label>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Açıklama (opsiyonel)"
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-date">Son Tarih</Label>
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 min-h-[44px] text-base sm:text-sm"
              />
            </div>
            <div>
              <Label htmlFor="task-time">Saat</Label>
              <Input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1 min-h-[44px] text-base sm:text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Öncelik</Label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskFormData['priority'])}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[44px]"
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
              </select>
            </div>
            <div>
              <Label>Tekrar</Label>
              <select
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as TaskFormData['repeat'])}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[44px]"
              >
                <option value="none">Yok</option>
                <option value="daily">Günlük</option>
                <option value="weekly">Haftalık</option>
                <option value="monthly">Aylık</option>
              </select>
            </div>
          </div>
          {students.length > 0 && (
            <div>
              <Label>Öğrenci (opsiyonel)</Label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 sm:py-2 text-base sm:text-sm min-h-[44px]"
              >
                <option value="">Seçin</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {!initial && (
            <ReminderFormSection remindAt={remindAt} onChange={setRemindAt} disabled={loading} />
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-[44px] w-full sm:w-auto rounded-xl">
              İptal
            </Button>
            <Button type="submit" disabled={loading || !title.trim()} className="min-h-[44px] w-full sm:w-auto rounded-xl">
              {loading ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
