'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import type { Device } from '../types';

const DAYS = [
  { value: 1, label: 'Pazartesi' },
  { value: 2, label: 'Salı' },
  { value: 3, label: 'Çarşamba' },
  { value: 4, label: 'Perşembe' },
  { value: 5, label: 'Cuma' },
];

type ScheduleSlot = {
  day_of_week: number;
  lesson_num: number;
  user_id: string;
  teacher_name: string;
  subject: string;
  class_section: string | null;
  source?: 'timetable' | 'manual';
};

export function DeviceScheduleDialog({
  device,
  open,
  onOpenChange,
  token,
  schoolId,
  onSaved,
}: {
  device: Device | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  schoolId: string | null;
  onSaved?: () => void;
}) {
  const [schedule, setSchedule] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; display_name: string | null; email: string }[]>([]);
  const [form, setForm] = useState({ day_of_week: 1, lesson_num: 1, user_id: '', subject: '', class_section: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !device?.id || !token) return;
    setLoading(true);
    Promise.all([
      apiFetch<ScheduleSlot[]>(`/smart-board/devices/${device.id}/schedule`, { token }),
      apiFetch<{ items: { id: string; display_name: string | null; email: string }[] }>(
        `/users?school_id=${schoolId ?? ''}&role=teacher&limit=100`,
        { token }
      ).then((r) => r.items ?? []),
    ])
      .then(([sched, tch]) => {
        setSchedule(sched);
        setTeachers(tch);
        if (tch.length > 0 && !form.user_id) setForm((f) => ({ ...f, user_id: tch[0].id }));
      })
      .catch(() => {
        setSchedule([]);
        setTeachers([]);
      })
      .finally(() => setLoading(false));
  }, [open, device?.id, token, schoolId]);

  const handleAdd = async () => {
    if (!token || !device?.id || !form.user_id.trim() || !form.subject.trim()) {
      toast.error('Öğretmen ve ders adı zorunludur.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/smart-board/devices/${device.id}/schedule`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          day_of_week: form.day_of_week,
          lesson_num: form.lesson_num,
          user_id: form.user_id,
          subject: form.subject.trim(),
          class_section: form.class_section.trim() || undefined,
        }),
      });
      const slot = schedule.find((s) => s.day_of_week === form.day_of_week && s.lesson_num === form.lesson_num);
      const teacher = teachers.find((t) => t.id === form.user_id);
      const newSlot: ScheduleSlot = {
        day_of_week: form.day_of_week,
        lesson_num: form.lesson_num,
        user_id: form.user_id,
        teacher_name: teacher?.display_name ?? teacher?.email ?? '—',
        subject: form.subject.trim(),
        class_section: form.class_section.trim() || null,
        source: 'manual',
      };
      if (slot) {
        setSchedule((s) => s.map((x) => (x.day_of_week === form.day_of_week && x.lesson_num === form.lesson_num ? newSlot : x)));
      } else {
        setSchedule((s) => [...s, newSlot].sort((a, b) => (a.day_of_week - b.day_of_week) || (a.lesson_num - b.lesson_num)));
      }
      toast.success('Program eklendi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (day: number, lesson: number) => {
    if (!token || !device?.id || !confirm('Bu slot silinsin mi?')) return;
    try {
      await apiFetch(`/smart-board/devices/${device.id}/schedule?day_of_week=${day}&lesson_num=${lesson}`, {
        method: 'DELETE',
        token,
      });
      setSchedule((s) => s.filter((x) => !(x.day_of_week === day && x.lesson_num === lesson)));
      toast.success('Slot silindi.');
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    }
  };

  const dayLabel = (d: number) => DAYS.find((x) => x.value === d)?.label ?? `Gün ${d}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{device?.name ?? 'Tahta'} — Haftalık Program</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            {device?.classSection && (
              <Alert variant="info">
                Bu tahta <strong>{device.classSection}</strong> sınıfına bağlı. Öğretmen ve dersler <strong>Ders Programı</strong>ndan otomatik aktarılmaktadır. Manuel eklenen slotlar önceliklidir.
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <div>
                <Label className="text-xs">Gün</Label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm((f) => ({ ...f, day_of_week: parseInt(e.target.value, 10) }))}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ders</Label>
                <select
                  value={form.lesson_num}
                  onChange={(e) => setForm((f) => ({ ...f, lesson_num: parseInt(e.target.value, 10) }))}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}. Ders
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Öğretmen</Label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                  className="mt-1 w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name || t.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Ders Adı</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="Matematik"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Sınıf</Label>
                <Input
                  value={form.class_section}
                  onChange={(e) => setForm((f) => ({ ...f, class_section: e.target.value }))}
                  placeholder="9-A"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleAdd} disabled={saving}>
                  <Plus className="mr-1 size-4" />
                  Ekle
                </Button>
              </div>
            </div>
            <div className="rounded border">
              <div className="max-h-48 overflow-y-auto">
                {schedule.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Henüz program atanmamış.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="py-2 px-3 text-left font-medium">Gün</th>
                        <th className="py-2 px-3 text-left font-medium">Ders</th>
                        <th className="py-2 px-3 text-left font-medium">Öğretmen</th>
                        <th className="py-2 px-3 text-left font-medium">Ders Adı</th>
                        <th className="py-2 px-3 text-left font-medium">Sınıf</th>
                        <th className="py-2 px-3 text-left font-medium">Kaynak</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((s) => (
                        <tr key={`${s.day_of_week}-${s.lesson_num}`} className="border-b">
                          <td className="py-2 px-3">{dayLabel(s.day_of_week)}</td>
                          <td className="py-2 px-3">{s.lesson_num}. Ders</td>
                          <td className="py-2 px-3">{s.teacher_name}</td>
                          <td className="py-2 px-3">{s.subject}</td>
                          <td className="py-2 px-3">{s.class_section || '—'}</td>
                          <td className="py-2 px-3">
                            {s.source === 'timetable' ? (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                                Ders programından
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Manuel</span>
                            )}
                          </td>
                          <td className="py-2">
                            {s.source !== 'timetable' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(s.day_of_week, s.lesson_num)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
