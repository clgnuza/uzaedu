'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export type LessonSlot = { lesson_num: number; start_time: string; end_time: string };

function clampMaxLessons(n: number) {
  return Math.min(12, Math.max(6, n));
}

function buildLessonSlots(maxLessons: number): LessonSlot[] {
  const n = clampMaxLessons(maxLessons);
  return Array.from({ length: n }, (_, i) => ({ lesson_num: i + 1, start_time: '', end_time: '' }));
}

function timeToMinutes(hhmm: string): number {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function autoCalculateLessons(
  schoolStart: string,
  schoolEnd: string,
  lessonDuration: number,
  breakDuration: number,
  lunchActive: boolean,
  lunchStart: string,
  lunchEnd: string,
  maxLessons: number,
): LessonSlot[] {
  const n = clampMaxLessons(maxLessons);
  let curr = timeToMinutes(schoolStart);
  const end = timeToMinutes(schoolEnd);
  const lunchS = timeToMinutes(lunchStart);
  const lunchE = timeToMinutes(lunchEnd);
  const result: LessonSlot[] = [];
  for (let i = 1; i <= n; i++) {
    if (curr >= end) {
      result.push({ lesson_num: i, start_time: '', end_time: '' });
      continue;
    }
    if (lunchActive && lunchS > 0 && lunchE > lunchS && curr < lunchS && curr + lessonDuration > lunchS) {
      curr = lunchE;
    }
    const startTime = minutesToTime(curr);
    curr += lessonDuration;
    const endTime = minutesToTime(curr);
    result.push({ lesson_num: i, start_time: startTime, end_time: endTime });
    curr += breakDuration;
  }
  return result;
}

type SchoolDefaultTimesData = {
  duty_education_mode?: 'single' | 'double' | null;
  duty_max_lessons?: number | null;
  duty_start_time?: string | null;
  duty_end_time?: string | null;
  lesson_schedule?: LessonSlot[];
  duty_start_time_pm?: string | null;
  duty_end_time_pm?: string | null;
  lesson_schedule_pm?: LessonSlot[];
};

const STANDARD_SCHEDULE: LessonSlot[] = [
  { lesson_num: 1, start_time: '08:30', end_time: '09:10' },
  { lesson_num: 2, start_time: '09:20', end_time: '10:00' },
  { lesson_num: 3, start_time: '10:10', end_time: '10:50' },
  { lesson_num: 4, start_time: '11:00', end_time: '11:40' },
  { lesson_num: 5, start_time: '13:40', end_time: '14:20' },
  { lesson_num: 6, start_time: '14:30', end_time: '15:10' },
  { lesson_num: 7, start_time: '15:20', end_time: '16:00' },
  { lesson_num: 8, start_time: '16:10', end_time: '16:50' },
  { lesson_num: 9, start_time: '17:00', end_time: '17:40' },
];

export function ZamanCizelgesiForm() {
  const { token } = useAuth();
  const [educationMode, setEducationMode] = useState<'single' | 'double'>('single');
  const [maxLessons, setMaxLessons] = useState(8);
  const [activeShift, setActiveShift] = useState<'morning' | 'afternoon'>('morning');
  const [dutyStartTime, setDutyStartTime] = useState('');
  const [dutyEndTime, setDutyEndTime] = useState('');
  const [lessonSchedule, setLessonSchedule] = useState<LessonSlot[]>(() => buildLessonSlots(8));
  const [dutyStartTimePm, setDutyStartTimePm] = useState('');
  const [dutyEndTimePm, setDutyEndTimePm] = useState('');
  const [lessonSchedulePm, setLessonSchedulePm] = useState<LessonSlot[]>(() => buildLessonSlots(8));
  const [lessonDuration, setLessonDuration] = useState(40);
  const [breakDuration, setBreakDuration] = useState(10);
  const [lunchActive, setLunchActive] = useState(true);
  const [lunchStart, setLunchStart] = useState('12:30');
  const [lunchEnd, setLunchEnd] = useState('13:30');
  const [useManualLessonTimes, setUseManualLessonTimes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<SchoolDefaultTimesData>('/duty/school-default-times', { token });
      const mode = data?.duty_education_mode === 'double' ? 'double' : 'single';
      setEducationMode(mode);
      const inferredMax =
        typeof data?.duty_max_lessons === 'number' && Number.isFinite(data.duty_max_lessons)
          ? data.duty_max_lessons
          : Math.max(
              8,
              ...(Array.isArray(data?.lesson_schedule) ? data!.lesson_schedule.map((x) => x.lesson_num ?? 0) : [0]),
              ...(Array.isArray(data?.lesson_schedule_pm) ? data!.lesson_schedule_pm.map((x) => x.lesson_num ?? 0) : [0]),
            );
      const max = clampMaxLessons(inferredMax);
      setMaxLessons(max);
      setDutyStartTime(data?.duty_start_time ?? '');
      setDutyEndTime(data?.duty_end_time ?? '');
      setDutyStartTimePm(data?.duty_start_time_pm ?? '');
      setDutyEndTimePm(data?.duty_end_time_pm ?? '');
      const lsAm = Array.isArray(data?.lesson_schedule) ? data!.lesson_schedule : [];
      const byNumAm = new Map(lsAm.map((x) => [x.lesson_num, { ...x }]));
      setLessonSchedule(
        buildLessonSlots(max).map((d) => ({
          lesson_num: d.lesson_num,
          start_time: byNumAm.get(d.lesson_num)?.start_time ?? '',
          end_time: byNumAm.get(d.lesson_num)?.end_time ?? '',
        })),
      );
      const lsPm = Array.isArray(data?.lesson_schedule_pm) ? data!.lesson_schedule_pm : [];
      const byNumPm = new Map(lsPm.map((x) => [x.lesson_num, { ...x }]));
      setLessonSchedulePm(
        buildLessonSlots(max).map((d) => ({
          lesson_num: d.lesson_num,
          start_time: byNumPm.get(d.lesson_num)?.start_time ?? '',
          end_time: byNumPm.get(d.lesson_num)?.end_time ?? '',
        })),
      );
    } catch {
      setEducationMode('single');
      setMaxLessons(8);
      setLessonSchedule(buildLessonSlots(8));
      setLessonSchedulePm(buildLessonSlots(8));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const ls = lessonSchedule.map((l) => ({
        lesson_num: l.lesson_num,
        start_time: (l.start_time || '').trim(),
        end_time: (l.end_time || '').trim(),
      }));
      const lsPm = lessonSchedulePm.map((l) => ({
        lesson_num: l.lesson_num,
        start_time: (l.start_time || '').trim(),
        end_time: (l.end_time || '').trim(),
      }));
      await apiFetch('/duty/school-default-times', {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          duty_education_mode: educationMode,
          duty_max_lessons: maxLessons,
          duty_start_time: dutyStartTime.trim() || null,
          duty_end_time: dutyEndTime.trim() || null,
          lesson_schedule: ls,
          duty_start_time_pm: dutyStartTimePm.trim() || null,
          duty_end_time_pm: dutyEndTimePm.trim() || null,
          lesson_schedule_pm: lsPm,
        }),
      });
      toast.success('Zaman çizelgesi kaydedildi.');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const updateLessonSlot = (shift: 'morning' | 'afternoon', idx: number, field: 'start_time' | 'end_time', value: string) => {
    if (shift === 'morning') {
      setLessonSchedule((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx]!, [field]: value };
        return next;
      });
    } else {
      setLessonSchedulePm((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx]!, [field]: value };
        return next;
      });
    }
  };

  const currentSchedule = activeShift === 'afternoon' ? lessonSchedulePm : lessonSchedule;

  if (loading) {
    return (
      <Card className="rounded-xl border shadow-sm">
        <CardContent className="py-12 text-center text-muted-foreground">Yükleniyor…</CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Zaman çizelgesi</CardTitle>
            <CardDescription className="mt-0.5">
              Okul başlangıç/bitiş, ders süreleri. Ders Programı ve Nöbet modüllerinde kullanılır.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLessonSchedule(STANDARD_SCHEDULE);
              setLessonSchedulePm(buildLessonSlots(9));
              setMaxLessons(9);
              setDutyStartTime('08:30');
              setDutyEndTime('17:40');
              setLessonDuration(40);
              setBreakDuration(10);
              setLunchActive(true);
              setLunchStart('12:30');
              setLunchEnd('13:30');
              toast.success('Standart 2025-2026 programı yüklendi (9 ders, 40 dk, öğle 12:30–13:30).');
            }}
            className="shrink-0"
          >
            Standart Yükle
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Parametreler</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Okul Başlangıç *</Label>
              <Input
                type="text"
                placeholder="08:30"
                value={activeShift === 'afternoon' ? dutyStartTimePm : dutyStartTime}
                onChange={(e) => (activeShift === 'afternoon' ? setDutyStartTimePm(e.target.value) : setDutyStartTime(e.target.value))}
                className="h-10 w-full max-w-[140px] rounded-lg"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Okul Bitiş *</Label>
              <Input
                type="text"
                placeholder="15:30"
                value={activeShift === 'afternoon' ? dutyEndTimePm : dutyEndTime}
                onChange={(e) => (activeShift === 'afternoon' ? setDutyEndTimePm(e.target.value) : setDutyEndTime(e.target.value))}
                className="h-10 w-full max-w-[140px] rounded-lg"
                maxLength={5}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Ders Süresi (dk)</Label>
              <Input
                type="number"
                min={30}
                max={60}
                value={lessonDuration}
                onChange={(e) => setLessonDuration(Math.min(60, Math.max(30, parseInt(e.target.value, 10) || 40)))}
                className="h-10 w-full max-w-[100px] rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Teneffüs (dk)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={breakDuration}
                onChange={(e) => setBreakDuration(Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 10)))}
                className="h-10 w-full max-w-[100px] rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Öğle arası</h4>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={lunchActive}
              onChange={(e) => setLunchActive(e.target.checked)}
              className="size-4 rounded accent-amber-600"
            />
            <span className="font-medium">Öğle tatili ekle</span>
          </label>
          {lunchActive && (
            <div className="flex flex-wrap items-end gap-5 pt-2">
              <div className="space-y-2">
                <Label className="text-xs">Başlangıç</Label>
                <Input type="text" placeholder="12:30" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} className="h-10 w-28 rounded-lg" maxLength={5} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Bitiş</Label>
                <Input type="text" placeholder="13:30" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} className="h-10 w-28 rounded-lg" maxLength={5} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Eğitim tipi</h4>
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <Label>Eğitim tipi</Label>
              <select
                value={educationMode}
                onChange={(e) => {
                  const v = e.target.value === 'double' ? 'double' : 'single';
                  setEducationMode(v);
                  if (v === 'single') setActiveShift('morning');
                }}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="single">Tekli eğitim</option>
                <option value="double">İkili eğitim (sabah + öğle)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Günlük ders sayısı</Label>
              <select
                value={String(maxLessons)}
                onChange={(e) => {
                  const n = clampMaxLessons(parseInt(e.target.value, 10));
                  setMaxLessons(n);
                  setLessonSchedule((prev) => {
                    const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
                    return buildLessonSlots(n).map((d) => ({ lesson_num: d.lesson_num, start_time: byNum.get(d.lesson_num)?.start_time ?? '', end_time: byNum.get(d.lesson_num)?.end_time ?? '' }));
                  });
                  setLessonSchedulePm((prev) => {
                    const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
                    return buildLessonSlots(n).map((d) => ({ lesson_num: d.lesson_num, start_time: byNum.get(d.lesson_num)?.start_time ?? '', end_time: byNum.get(d.lesson_num)?.end_time ?? '' }));
                  });
                }}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm w-24"
              >
                {Array.from({ length: 7 }, (_, i) => 6 + i).map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>
            {educationMode === 'double' && (
              <div className="flex gap-1">
                <Button type="button" variant={activeShift === 'morning' ? 'default' : 'outline'} size="sm" onClick={() => setActiveShift('morning')}>Sabah</Button>
                <Button type="button" variant={activeShift === 'afternoon' ? 'default' : 'outline'} size="sm" onClick={() => setActiveShift('afternoon')}>Öğle</Button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-sm font-medium">Ders saatleri</h4>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={useManualLessonTimes} onChange={(e) => setUseManualLessonTimes(e.target.checked)} className="rounded accent-primary size-4" />
                Manuel ders saatleri kullan
              </label>
              <Button
                variant="outline"
                size="sm"
                disabled={useManualLessonTimes}
                onClick={() => {
                  const schoolStart = activeShift === 'afternoon' ? dutyStartTimePm : dutyStartTime;
                  const schoolEnd = activeShift === 'afternoon' ? dutyEndTimePm : dutyEndTime;
                  if (!schoolStart || !schoolEnd) {
                    toast.error('Önce okul başlangıç ve bitiş saatini girin.');
                    return;
                  }
                  const schedule = autoCalculateLessons(schoolStart, schoolEnd, lessonDuration, breakDuration, lunchActive, lunchStart, lunchEnd, maxLessons);
                  if (activeShift === 'afternoon') setLessonSchedulePm(schedule);
                  else setLessonSchedule(schedule);
                  const lastFilled = schedule.filter((s) => s.end_time).pop();
                  if (lastFilled) {
                    if (activeShift === 'morning') setDutyEndTime(lastFilled.end_time);
                    else setDutyEndTimePm(lastFilled.end_time);
                  }
                  const filled = schedule.filter((s) => s.start_time).length;
                  toast.success(filled === schedule.length ? 'Ders saatleri otomatik hesaplandı.' : `${filled} ders hesaplandı. Son ${schedule.length - filled} ders için okul bitiş saatini uzatın.`);
                }}
              >
                Otomatik Hesapla
              </Button>
              <Button variant="outline" size="sm" onClick={() => { const empty = buildLessonSlots(maxLessons); if (activeShift === 'afternoon') setLessonSchedulePm(empty); else setLessonSchedule(empty); toast.success('Ders saatleri temizlendi.'); }}>
                Temizle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const n = clampMaxLessons(maxLessons + 1);
                  setMaxLessons(n);
                  const sched = activeShift === 'afternoon' ? lessonSchedulePm : lessonSchedule;
                  const byNum = new Map(sched.map((x) => [x.lesson_num, x]));
                  const newSlots = buildLessonSlots(n).map((d) => ({ lesson_num: d.lesson_num, start_time: byNum.get(d.lesson_num)?.start_time ?? '', end_time: byNum.get(d.lesson_num)?.end_time ?? '' }));
                  if (activeShift === 'afternoon') setLessonSchedulePm(newSlots);
                  else setLessonSchedule(newSlots);
                }}
              >
                Ders Ekle
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sıra</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tür</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Başlangıç</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bitiş</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Süre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Teneffüs</th>
                  {useManualLessonTimes && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">İşlem</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {currentSchedule.map((l, idx) => {
                  const startM = l.start_time ? timeToMinutes(l.start_time) : 0;
                  const endM = l.end_time ? timeToMinutes(l.end_time) : 0;
                  const duration = startM && endM ? endM - startM : 0;
                  const nextRow = currentSchedule[idx + 1];
                  const nextStart = nextRow?.start_time ? timeToMinutes(nextRow.start_time) : 0;
                  const breakM = nextStart && endM ? nextStart - endM : 0;
                  return (
                    <tr key={l.lesson_num} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 font-semibold text-primary">{l.lesson_num}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium">Ders</span>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          placeholder="08:30"
                          value={l.start_time}
                          onChange={(e) => updateLessonSlot(activeShift, idx, 'start_time', e.target.value)}
                          maxLength={5}
                          className="h-9 w-20 rounded-lg border-border/80 text-sm disabled:opacity-60"
                          disabled={!useManualLessonTimes}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="text"
                          placeholder="09:10"
                          value={l.end_time}
                          onChange={(e) => updateLessonSlot(activeShift, idx, 'end_time', e.target.value)}
                          maxLength={5}
                          className="h-9 w-20 rounded-lg border-border/80 text-sm disabled:opacity-60"
                          disabled={!useManualLessonTimes}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground tabular-nums">{duration ? `${duration} dk` : '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground tabular-nums">{breakM > 0 ? `${breakM} dk` : '0'}</span>
                      </td>
                      {useManualLessonTimes && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                            onClick={() => {
                              if (currentSchedule.length <= 1) return;
                              const filtered = currentSchedule.filter((x) => x.lesson_num !== l.lesson_num).map((x, i) => ({ ...x, lesson_num: i + 1 }));
                              if (activeShift === 'afternoon') setLessonSchedulePm(filtered);
                              else setLessonSchedule(filtered);
                              setMaxLessons(filtered.length);
                            }}
                            disabled={currentSchedule.length <= 1}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="size-4 mr-2" />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
