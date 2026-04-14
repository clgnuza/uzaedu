'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type StudentNoteFormData = {
  studentId: string;
  noteType: 'positive' | 'negative' | 'observation';
  description?: string;
  subjectId?: string;
  noteDate: string;
  tags?: string[];
};

export function StudentNoteFormModal({
  open,
  onOpenChange,
  onSubmit,
  students,
  subjects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: StudentNoteFormData) => Promise<void>;
  students: { id: string; name: string }[];
  subjects: { id: string; label: string }[];
}) {
  const [studentId, setStudentId] = useState('');
  const [noteType, setNoteType] = useState<'positive' | 'negative' | 'observation'>('observation');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [noteDate, setNoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

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
        tags: tags.trim() ? tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined as string[] | undefined,
      });
      onOpenChange(false);
      setStudentId('');
      setDescription('');
      setSubjectId('');
      setNoteDate(new Date().toISOString().slice(0, 10));
      setTags('');
    } finally {
      setLoading(false);
    }
  };

  const typeOptions: { id: StudentNoteFormData['noteType']; label: string; on: string; off: string }[] = [
    {
      id: 'positive',
      label: 'Olumlu',
      on: 'border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600',
      off: 'border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted',
    },
    {
      id: 'negative',
      label: 'Olumsuz',
      on: 'border-rose-600 bg-rose-600 text-white shadow-sm dark:border-rose-500 dark:bg-rose-600',
      off: 'border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted',
    },
    {
      id: 'observation',
      label: 'Gözlem',
      on: 'border-teal-600 bg-teal-600 text-white shadow-sm dark:border-teal-500 dark:bg-teal-600',
      off: 'border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Öğrenci Notu Ekle">
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <Label className="text-xs sm:text-sm">Öğrenci *</Label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
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
          <div>
            <Label className="text-xs sm:text-sm">Not türü</Label>
            <div className="mt-1 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
              {typeOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setNoteType(o.id)}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-2 text-center text-[11px] font-bold transition-all sm:py-1.5 sm:text-xs',
                    noteType === o.id ? o.on : o.off,
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Açıklama</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-[80px] sm:py-2.5"
            />
          </div>
          {subjects.length > 0 && (
            <div>
              <Label className="text-xs sm:text-sm">Ders</Label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1 min-h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm sm:min-h-11"
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
          <div>
            <Label className="text-xs sm:text-sm">Tarih *</Label>
            <Input type="date" value={noteDate} onChange={(e) => setNoteDate(e.target.value)} className="mt-1 min-h-10 sm:min-h-11" />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Etiketler</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Virgülle ayırın"
              className="mt-1 min-h-10 sm:min-h-11"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              İptal
            </Button>
            <Button type="submit" disabled={loading || !studentId} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
