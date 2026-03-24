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
            <Label>Tarih *</Label>
            <Input
              type="date"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Toplantı Türü</Label>
            <Input
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              placeholder="örn: bireysel, genel"
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div>
            <Label>Konu</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Toplantı konusu"
              className="mt-1 min-h-[44px]"
            />
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
          <div>
            <Label>Takip Tarihi</Label>
            <Input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="mt-1 min-h-[44px]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={loading || !studentId || !meetingDate}>Kaydet</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
