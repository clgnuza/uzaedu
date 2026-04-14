'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ParentMeetingFormData = {
  studentId: string;
  meetingDate: string;
  meetingType?: string;
  subject?: string;
  description?: string;
  followUpDate?: string;
};

export function ParentMeetingFormModal({
  open,
  onOpenChange,
  onSubmit,
  students,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ParentMeetingFormData) => Promise<void>;
  students: { id: string; name: string }[];
}) {
  const [studentId, setStudentId] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingType, setMeetingType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !meetingDate) return;
    setLoading(true);
    try {
      await onSubmit({
        studentId,
        meetingDate,
        meetingType: meetingType.trim() || undefined,
        subject: subject.trim() || undefined,
        description: description.trim() || undefined,
        followUpDate: followUpDate || undefined,
      });
      onOpenChange(false);
      setStudentId('');
      setMeetingDate(new Date().toISOString().slice(0, 10));
      setMeetingType('');
      setSubject('');
      setDescription('');
      setFollowUpDate('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Veli Toplantısı Ekle">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <Label className="text-xs sm:text-sm">Tarih *</Label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="mt-1 min-h-10 sm:min-h-11" />
            </div>
            <div>
              <Label className="text-xs sm:text-sm">Takip tarihi</Label>
              <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="mt-1 min-h-10 sm:min-h-11" />
            </div>
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Toplantı türü</Label>
            <Input
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              placeholder="Bireysel, genel…"
              className="mt-1 min-h-10 sm:min-h-11"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Konu</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Toplantı konusu"
              className="mt-1 min-h-10 sm:min-h-11"
            />
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
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              İptal
            </Button>
            <Button type="submit" disabled={loading || !studentId || !meetingDate} className="h-10 w-full rounded-xl sm:h-11 sm:w-auto">
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
