'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Calendar, Sparkles, Tag } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  AGENDA_DIALOG_WIDE,
  AgendaFormActions,
  agendaInput,
  agendaLabel,
  agendaSection,
  agendaTextarea,
} from './agenda-form-ui';
import { AgendaStudentPicker } from './agenda-student-picker';

type StudentNoteFormData = {
  studentId: string;
  noteType: 'positive' | 'negative' | 'observation';
  description?: string;
  subjectId?: string;
  noteDate: string;
  tags?: string[];
};

const TYPE_OPTIONS: {
  id: StudentNoteFormData['noteType'];
  label: string;
  active: string;
}[] = [
  {
    id: 'positive',
    label: 'Olumlu',
    active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-500/25 dark:text-emerald-100',
  },
  {
    id: 'negative',
    label: 'Olumsuz',
    active: 'border-rose-500/50 bg-rose-500/15 text-rose-900 ring-1 ring-rose-500/25 dark:text-rose-100',
  },
  {
    id: 'observation',
    label: 'Gözlem',
    active: 'border-teal-500/50 bg-teal-500/15 text-teal-900 ring-1 ring-teal-500/25 dark:text-teal-100',
  },
];

export function StudentNoteFormModal({
  open,
  onOpenChange,
  onSubmit,
  students,
  classes,
  subjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StudentNoteFormData) => Promise<void>;
  students: { id: string; name: string; classId?: string }[];
  classes: { id: string; label: string }[];
  subjects: { id: string; label: string }[];
}) {
  const [studentId, setStudentId] = useState('');
  const [noteType, setNoteType] = useState<StudentNoteFormData['noteType']>('observation');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentId('');
    setNoteType('observation');
    setDescription('');
    setSubjectId('');
    setNoteDate(new Date().toISOString().slice(0, 10));
    setTags('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;
    setLoading(true);
    try {
      await onSubmit({
        studentId,
        noteType,
        description: description.trim() || undefined,
        subjectId: subjectId || undefined,
        noteDate,
        tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Öğrenci Notu Ekle" className={AGENDA_DIALOG_WIDE}>
        <form onSubmit={handleSubmit} className="space-y-2">
          <AgendaStudentPicker
            students={students}
            classes={classes}
            value={studentId}
            onChange={setStudentId}
            required
          />

          <div className={agendaSection}>
            <span className={agendaLabel}>Not türü</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setNoteType(o.id)}
                  className={cn(
                    'rounded-md border border-border/70 px-2.5 py-1 text-[10px] font-semibold transition-colors',
                    noteType === o.id ? o.active : 'bg-background/80 text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={agendaLabel}>Açıklama</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kısa gözlem veya not…"
              rows={3}
              className={agendaTextarea}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {subjects.length > 0 && (
              <div className={cn(agendaSection, 'col-span-2 sm:col-span-1')}>
                <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
                  <BookOpen className="size-3 text-sky-500" aria-hidden />
                  Ders
                </span>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className={cn(agendaInput, 'mt-1 w-full')}
                >
                  <option value="">Seçin</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={cn(agendaSection, subjects.length > 0 ? 'sm:col-span-1' : 'col-span-2')}>
              <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
                <Calendar className="size-3 text-amber-500" aria-hidden />
                Tarih *
              </span>
              <Input
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
                required
                className={cn(agendaInput, 'mt-1')}
              />
            </div>
          </div>

          <div className={agendaSection}>
            <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
              <Tag className="size-3 text-fuchsia-500" aria-hidden />
              Etiketler
            </span>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Virgülle ayırın"
              className={cn(agendaInput, 'mt-1')}
            />
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Sparkles className="size-3 shrink-0 opacity-70" aria-hidden />
              Örn. katılım, ödev, davranış
            </p>
          </div>

          <AgendaFormActions
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel="Kaydet"
            disabled={!studentId}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
