'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Öğrenci Notu Ekle">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Öğrenci *</Label>
            <select
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 min-h-[44px]"
            >
              <option value="">Seçin</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Not Türü</Label>
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value as StudentNoteFormData['noteType'])}
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 min-h-[44px]"
            >
              <option value="positive">Olumlu</option>
              <option value="negative">Olumsuz</option>
              <option value="observation">Gözlem</option>
            </select>
          </div>
          <div>
            <Label>Açıklama</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 min-h-[80px]"
            />
          </div>
          {subjects.length > 0 && (
            <div>
              <Label>Ders</Label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-3 min-h-[44px]"
              >
                <option value="">Seçin</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label>Tarih *</Label>
            <Input
              type="date"
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Etiketler (virgülle ayırın)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="örn: davranış, ders"
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={loading || !studentId}>Kaydet</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
