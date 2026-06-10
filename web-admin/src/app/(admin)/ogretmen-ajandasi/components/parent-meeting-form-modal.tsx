'use client';

import { useEffect, useState } from 'react';
import { Calendar, CalendarClock, MessageSquare, Users } from 'lucide-react';
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
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ParentMeetingFormData) => Promise<void>;
  students: { id: string; name: string; classId?: string }[];
  classes: { id: string; label: string }[];
}) {
  const [studentId, setStudentId] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetingType, setMeetingType] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStudentId('');
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setMeetingType('');
    setSubject('');
    setDescription('');
    setFollowUpDate('');
  }, [open]);

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
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Veli Toplantısı Ekle" className={AGENDA_DIALOG_WIDE}>
        <form onSubmit={handleSubmit} className="space-y-2">
          <AgendaStudentPicker
            students={students}
            classes={classes}
            value={studentId}
            onChange={setStudentId}
            required
          />

          <div className="grid grid-cols-2 gap-2">
            <div className={agendaSection}>
              <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
                <Calendar className="size-3 text-rose-500" aria-hidden />
                Tarih *
              </span>
              <Input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                required
                className={cn(agendaInput, 'mt-1')}
              />
            </div>
            <div className={agendaSection}>
              <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
                <CalendarClock className="size-3 text-amber-500" aria-hidden />
                Takip tarihi
              </span>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className={cn(agendaInput, 'mt-1')}
              />
            </div>
          </div>

          <div className={agendaSection}>
            <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
              <Users className="size-3 text-violet-500" aria-hidden />
              Toplantı türü
            </span>
            <Input
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              placeholder="Bireysel, sınıf, telefon…"
              className={cn(agendaInput, 'mt-1')}
            />
          </div>

          <div>
            <span className={cn(agendaLabel, 'inline-flex items-center gap-1')}>
              <MessageSquare className="size-3 text-sky-500" aria-hidden />
              Konu
            </span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Görüşme konusu"
              className={agendaInput}
            />
          </div>

          <div>
            <span className={agendaLabel}>Açıklama</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Özet, kararlar, notlar…"
              rows={3}
              className={agendaTextarea}
            />
          </div>

          <AgendaFormActions
            onCancel={() => onOpenChange(false)}
            loading={loading}
            submitLabel="Kaydet"
            disabled={!studentId || !meetingDate}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
