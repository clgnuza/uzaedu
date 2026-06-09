'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ReminderFormSection } from './reminder-form-section';
import { Repeat, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AGENDA_DIALOG_CLASS,
  AgendaFormActions,
  AgendaPriorityPills,
  agendaInput,
  agendaLabel,
  agendaSection,
  agendaTextarea,
} from './agenda-form-ui';

function localTodayYMD(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
  editTaskId?: string | null;
  students?: { id: string; name: string }[];
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? initialDate ?? localTodayYMD());
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? '09:00');
  const [priority, setPriority] = useState<TaskFormData['priority']>(initial?.priority ?? 'medium');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.error('Tekrar için son tarih zorunludur');
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
      <DialogContent
        title={editTaskId ? 'Görevi Düzenle' : 'Yeni Görev'}
        className={AGENDA_DIALOG_CLASS}
      >
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <span className={agendaLabel}>Başlık</span>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Görev başlığı"
              required
              className={agendaInput}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className={agendaLabel}>Son tarih</span>
              <Input
                id="task-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={agendaInput}
              />
            </div>
            <div>
              <span className={agendaLabel}>Saat</span>
              <Input
                id="task-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className={agendaInput}
              />
            </div>
          </div>
          <div>
            <span className={agendaLabel}>Açıklama</span>
            <textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsiyonel"
              rows={2}
              className={agendaTextarea}
            />
          </div>
          <div>
            <span className={agendaLabel}>Öncelik</span>
            <AgendaPriorityPills value={priority} onChange={setPriority} />
          </div>
          {students.length > 0 && (
            <div>
              <span className={agendaLabel}>Öğrenci</span>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className={cn(agendaInput, 'w-full')}
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

          <details className={cn(agendaSection, 'group open:pb-1.5')}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <Repeat className="size-3.5 text-violet-500" aria-hidden />
              Tekrar
            </summary>
            <select
              value={repeat}
              onChange={(e) => setRepeat(e.target.value as TaskFormData['repeat'])}
              className={cn(agendaInput, 'mt-1.5 w-full')}
            >
              <option value="none">Yok</option>
              <option value="daily">Günlük</option>
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
            </select>
            {editTaskId && repeat !== 'none' && (
              <button
                type="button"
                onClick={() => setRepeat('none')}
                className="mt-1.5 w-full rounded-md border border-border/70 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/40"
              >
                Tekrarı durdur
              </button>
            )}
          </details>

          <details className={cn(agendaSection, 'group open:pb-1.5')} open={reminderWanted}>
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              <BellRing className="size-3.5 text-teal-500" aria-hidden />
              Hatırlatıcı
            </summary>
            <div className="mt-1.5">
              <ReminderFormSection
                enabled={reminderWanted}
                remindAt={remindAt}
                onChange={setRemindAt}
                disabled={loading}
                onEnabledChange={setReminderWanted}
                showLeadingBell={false}
              />
            </div>
          </details>

          <AgendaFormActions
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel="Kaydet"
            disabled={!title.trim()}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
