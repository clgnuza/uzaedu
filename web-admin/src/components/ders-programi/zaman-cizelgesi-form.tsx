'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Save, Trash2, Sun, Moon, UtensilsCrossed, Sparkles, CalendarDays, CalendarRange } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
  lesson_schedule_weekend?: LessonSlot[];
  lesson_schedule_weekend_pm?: LessonSlot[];
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
  const [lessonScheduleWeekend, setLessonScheduleWeekend] = useState<LessonSlot[]>(() => buildLessonSlots(8));
  const [lessonScheduleWeekendPm, setLessonScheduleWeekendPm] = useState<LessonSlot[]>(() => buildLessonSlots(8));
  const [weekPartTab, setWeekPartTab] = useState<'weekday' | 'weekend'>('weekday');
  const [weekendOverride, setWeekendOverride] = useState(false);
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
              ...(Array.isArray(data?.lesson_schedule_weekend) ? data!.lesson_schedule_weekend.map((x) => x.lesson_num ?? 0) : [0]),
              ...(Array.isArray(data?.lesson_schedule_weekend_pm) ? data!.lesson_schedule_weekend_pm.map((x) => x.lesson_num ?? 0) : [0]),
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
      const lsWkAm = Array.isArray(data?.lesson_schedule_weekend) ? data!.lesson_schedule_weekend : [];
      const lsWkPm = Array.isArray(data?.lesson_schedule_weekend_pm) ? data!.lesson_schedule_weekend_pm : [];
      setWeekendOverride(lsWkAm.length > 0);
      const byNumWk = new Map(lsWkAm.map((x) => [x.lesson_num, { ...x }]));
      setLessonScheduleWeekend(
        buildLessonSlots(max).map((d) => ({
          lesson_num: d.lesson_num,
          start_time: byNumWk.get(d.lesson_num)?.start_time ?? '',
          end_time: byNumWk.get(d.lesson_num)?.end_time ?? '',
        })),
      );
      const byNumWkPm = new Map(lsWkPm.map((x) => [x.lesson_num, { ...x }]));
      setLessonScheduleWeekendPm(
        buildLessonSlots(max).map((d) => ({
          lesson_num: d.lesson_num,
          start_time: byNumWkPm.get(d.lesson_num)?.start_time ?? '',
          end_time: byNumWkPm.get(d.lesson_num)?.end_time ?? '',
        })),
      );
    } catch {
      setEducationMode('single');
      setMaxLessons(8);
      setLessonSchedule(buildLessonSlots(8));
      setLessonSchedulePm(buildLessonSlots(8));
      setLessonScheduleWeekend(buildLessonSlots(8));
      setLessonScheduleWeekendPm(buildLessonSlots(8));
      setWeekendOverride(false);
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
      const lsWk = lessonScheduleWeekend.map((l) => ({
        lesson_num: l.lesson_num,
        start_time: (l.start_time || '').trim(),
        end_time: (l.end_time || '').trim(),
      }));
      const lsWkPm = lessonScheduleWeekendPm.map((l) => ({
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
          lesson_schedule_weekend: weekendOverride ? lsWk : null,
          lesson_schedule_weekend_pm: weekendOverride ? lsWkPm : null,
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
    const wknd = weekPartTab === 'weekend';
    if (shift === 'morning') {
      if (wknd) {
        setLessonScheduleWeekend((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx]!, [field]: value };
          return next;
        });
      } else {
        setLessonSchedule((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx]!, [field]: value };
          return next;
        });
      }
    } else if (wknd) {
      setLessonScheduleWeekendPm((prev) => {
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

  const isWeekendPanel = weekPartTab === 'weekend';
  const currentSchedule = activeShift === 'afternoon'
    ? isWeekendPanel
      ? lessonScheduleWeekendPm
      : lessonSchedulePm
    : isWeekendPanel
      ? lessonScheduleWeekend
      : lessonSchedule;

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const runAutoCalc = () => {
    const schoolStart = activeShift === 'afternoon' ? dutyStartTimePm : dutyStartTime;
    const schoolEnd = activeShift === 'afternoon' ? dutyEndTimePm : dutyEndTime;
    if (!schoolStart || !schoolEnd) {
      toast.error('Önce okul başlangıç ve bitiş saatini girin.');
      return;
    }
    const schedule = autoCalculateLessons(schoolStart, schoolEnd, lessonDuration, breakDuration, lunchActive, lunchStart, lunchEnd, maxLessons);
    if (activeShift === 'afternoon') {
      if (isWeekendPanel) setLessonScheduleWeekendPm(schedule);
      else setLessonSchedulePm(schedule);
    } else if (isWeekendPanel) {
      setLessonScheduleWeekend(schedule);
    } else {
      setLessonSchedule(schedule);
    }
    const lastFilled = schedule.filter((s) => s.end_time).pop();
    if (lastFilled && !isWeekendPanel) {
      if (activeShift === 'morning') setDutyEndTime(lastFilled.end_time);
      else setDutyEndTimePm(lastFilled.end_time);
    }
    const filled = schedule.filter((s) => s.start_time).length;
    toast.success(filled === schedule.length ? 'Ders saatleri otomatik hesaplandı.' : `${filled} ders hesaplandı. Son ${schedule.length - filled} ders için okul bitiş saatini uzatın.`);
  };

  const runClearSlots = () => {
    const empty = buildLessonSlots(maxLessons);
    if (activeShift === 'afternoon') {
      if (isWeekendPanel) setLessonScheduleWeekendPm(empty);
      else setLessonSchedulePm(empty);
    } else if (isWeekendPanel) {
      setLessonScheduleWeekend(empty);
    } else {
      setLessonSchedule(empty);
    }
    toast.success('Ders saatleri temizlendi.');
  };

  const runAddLessonSlot = () => {
    const n = clampMaxLessons(maxLessons + 1);
    setMaxLessons(n);
    const extend = (prev: LessonSlot[]) => {
      const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
      return buildLessonSlots(n).map((d) => ({
        lesson_num: d.lesson_num,
        start_time: byNum.get(d.lesson_num)?.start_time ?? '',
        end_time: byNum.get(d.lesson_num)?.end_time ?? '',
      }));
    };
    setLessonSchedule((prev) => extend(prev));
    setLessonSchedulePm((prev) => extend(prev));
    setLessonScheduleWeekend((prev) => extend(prev));
    setLessonScheduleWeekendPm((prev) => extend(prev));
  };

  const loadStandard = () => {
    setLessonSchedule(STANDARD_SCHEDULE);
    setLessonSchedulePm(buildLessonSlots(9));
    setLessonScheduleWeekend(buildLessonSlots(9));
    setLessonScheduleWeekendPm(buildLessonSlots(9));
    setWeekendOverride(false);
    setWeekPartTab('weekday');
    setMaxLessons(9);
    setDutyStartTime('08:30');
    setDutyEndTime('17:40');
    setLessonDuration(40);
    setBreakDuration(10);
    setLunchActive(true);
    setLunchStart('12:30');
    setLunchEnd('13:30');
    toast.success('Standart 2025-2026 programı yüklendi (9 ders, 40 dk, öğle 12:30–13:30).');
  };

  const removeLessonRow = (lessonNum: number) => {
    if (currentSchedule.length <= 1) return;
    const filtered = currentSchedule
      .filter((x) => x.lesson_num !== lessonNum)
      .map((x, i) => ({ ...x, lesson_num: i + 1 }));
    if (activeShift === 'afternoon') {
      if (isWeekendPanel) setLessonScheduleWeekendPm(filtered);
      else setLessonSchedulePm(filtered);
    } else if (isWeekendPanel) {
      setLessonScheduleWeekend(filtered);
    } else {
      setLessonSchedule(filtered);
    }
    setMaxLessons(filtered.length);
  };

  const copyWeekdayToWeekend = () => {
    setLessonScheduleWeekend(lessonSchedule.map((l) => ({ ...l })));
    setLessonScheduleWeekendPm(lessonSchedulePm.map((l) => ({ ...l })));
    setWeekendOverride(true);
    toast.success('Hafta içi saatleri hafta sonuna kopyalandı; düzenleyebilirsiniz.');
  };

  const clearWeekendOverride = () => {
    setWeekendOverride(false);
    setLessonScheduleWeekend(buildLessonSlots(maxLessons));
    setLessonScheduleWeekendPm(buildLessonSlots(maxLessons));
    setWeekPartTab('weekday');
    toast.success('Hafta sonu artık hafta içi saatleriyle aynı.');
  };

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 px-3 py-2.5 sm:px-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <CardTitle className="text-sm font-semibold sm:text-base">Zaman çizelgesi</CardTitle>
              <CardDescription className="text-xs leading-snug sm:text-[13px]">
                Otomatik hesaplama ve ders listesi için kullanılır.
              </CardDescription>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={loadStandard} className="h-8 w-full shrink-0 gap-1 sm:w-auto">
              <Sparkles className="size-4" aria-hidden />
              Standart yükle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <section className="rounded-lg border border-border/70 bg-background p-3 sm:p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground sm:text-sm">
              <Clock className="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden />
              Okul günü
            </div>
            <p className="mb-2.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
              {educationMode === 'double' ? (
                <>
                  <span className="font-medium text-foreground">
                    {activeShift === 'morning' ? 'Sabah' : 'Öğle'} öğretimi
                  </span>{' '}
                  için giriş–çıkış ve süreleri ayarlayın.
                </>
              ) : (
                <>Giriş–çıkış ve ders sürelerini buradan tanımlayın.</>
              )}
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="dp-school-start" className="text-[11px] font-medium sm:text-xs">
                  Okul başlangıcı <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dp-school-start"
                  type="text"
                  inputMode="numeric"
                  placeholder="08:30"
                  value={activeShift === 'afternoon' ? dutyStartTimePm : dutyStartTime}
                  onChange={(e) => (activeShift === 'afternoon' ? setDutyStartTimePm(e.target.value) : setDutyStartTime(e.target.value))}
                  className="h-9 rounded-lg text-sm"
                  maxLength={5}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dp-school-end" className="text-[11px] font-medium sm:text-xs">
                  Okul bitişi <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="dp-school-end"
                  type="text"
                  inputMode="numeric"
                  placeholder="15:30"
                  value={activeShift === 'afternoon' ? dutyEndTimePm : dutyEndTime}
                  onChange={(e) => (activeShift === 'afternoon' ? setDutyEndTimePm(e.target.value) : setDutyEndTime(e.target.value))}
                  className="h-9 rounded-lg text-sm"
                  maxLength={5}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dp-lesson-dur" className="text-[11px] font-medium sm:text-xs">
                  Ders süresi (dk)
                </Label>
                <Input
                  id="dp-lesson-dur"
                  type="number"
                  min={30}
                  max={60}
                  value={lessonDuration}
                  onChange={(e) => setLessonDuration(Math.min(60, Math.max(30, parseInt(e.target.value, 10) || 40)))}
                  className="h-9 max-w-[100px] rounded-lg text-sm sm:max-w-[100px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dp-break-dur" className="text-[11px] font-medium sm:text-xs">
                  Teneffüs (dk)
                </Label>
                <Input
                  id="dp-break-dur"
                  type="number"
                  min={0}
                  max={30}
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 10)))}
                  className="h-9 max-w-[100px] rounded-lg text-sm sm:max-w-[100px]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-amber-500/20 bg-amber-500/6 p-3 dark:bg-amber-950/20">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground sm:text-sm">
              <UtensilsCrossed className="size-3.5 text-amber-700 dark:text-amber-400 sm:size-4" aria-hidden />
              Öğle arası
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md p-0.5">
              <input
                type="checkbox"
                checked={lunchActive}
                onChange={(e) => setLunchActive(e.target.checked)}
                className="mt-1 size-4 shrink-0 rounded border-input accent-amber-600"
              />
              <span className="text-xs leading-snug sm:text-sm">
                <span className="font-medium">Öğle tatilini hesaba kat</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground sm:text-xs">Otomatik hesaplamada bu aralık atlanır.</span>
              </span>
            </label>
            {lunchActive && (
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:max-w-xs">
                <div className="space-y-1">
                  <Label htmlFor="dp-lunch-start" className="text-[11px] sm:text-xs">
                    Başlangıç
                  </Label>
                  <Input
                    id="dp-lunch-start"
                    type="text"
                    inputMode="numeric"
                    placeholder="12:30"
                    value={lunchStart}
                    onChange={(e) => setLunchStart(e.target.value)}
                    className="h-9 rounded-lg text-sm"
                    maxLength={5}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dp-lunch-end" className="text-[11px] sm:text-xs">
                    Bitiş
                  </Label>
                  <Input
                    id="dp-lunch-end"
                    type="text"
                    inputMode="numeric"
                    placeholder="13:30"
                    value={lunchEnd}
                    onChange={(e) => setLunchEnd(e.target.value)}
                    className="h-9 rounded-lg text-sm"
                    maxLength={5}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-border/70 bg-muted/15 p-3 sm:p-3.5">
            <div className="mb-2 text-xs font-semibold sm:text-sm">Eğitim yapısı</div>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 space-y-1 sm:max-w-xs">
                <Label htmlFor="dp-edu-mode" className="text-[11px] font-medium sm:text-xs">
                  Eğitim tipi
                </Label>
                <select
                  id="dp-edu-mode"
                  value={educationMode}
                  onChange={(e) => {
                    const v = e.target.value === 'double' ? 'double' : 'single';
                    setEducationMode(v);
                    if (v === 'single') setActiveShift('morning');
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  <option value="single">Tekli eğitim (tek öğretim)</option>
                  <option value="double">İkili eğitim (sabah + öğle)</option>
                </select>
              </div>
              <div className="min-w-0 space-y-1 sm:w-32">
                <Label htmlFor="dp-max-lessons" className="text-[11px] font-medium sm:text-xs">
                  Günlük ders sayısı
                </Label>
                <select
                  id="dp-max-lessons"
                  value={String(maxLessons)}
                  onChange={(e) => {
                    const n = clampMaxLessons(parseInt(e.target.value, 10));
                    setMaxLessons(n);
                    setLessonSchedule((prev) => {
                      const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
                      return buildLessonSlots(n).map((d) => ({
                        lesson_num: d.lesson_num,
                        start_time: byNum.get(d.lesson_num)?.start_time ?? '',
                        end_time: byNum.get(d.lesson_num)?.end_time ?? '',
                      }));
                    });
                    setLessonSchedulePm((prev) => {
                      const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
                      return buildLessonSlots(n).map((d) => ({
                        lesson_num: d.lesson_num,
                        start_time: byNum.get(d.lesson_num)?.start_time ?? '',
                        end_time: byNum.get(d.lesson_num)?.end_time ?? '',
                      }));
                    });
                    setLessonScheduleWeekend((prev) => {
                      const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
                      return buildLessonSlots(n).map((d) => ({
                        lesson_num: d.lesson_num,
                        start_time: byNum.get(d.lesson_num)?.start_time ?? '',
                        end_time: byNum.get(d.lesson_num)?.end_time ?? '',
                      }));
                    });
                    setLessonScheduleWeekendPm((prev) => {
                      const byNum = new Map(prev.map((x) => [x.lesson_num, x]));
                      return buildLessonSlots(n).map((d) => ({
                        lesson_num: d.lesson_num,
                        start_time: byNum.get(d.lesson_num)?.start_time ?? '',
                        end_time: byNum.get(d.lesson_num)?.end_time ?? '',
                      }));
                    });
                  }}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                >
                  {Array.from({ length: 7 }, (_, i) => 6 + i).map((n) => (
                    <option key={n} value={String(n)}>
                      {n} ders
                    </option>
                  ))}
                </select>
              </div>
              {educationMode === 'double' && (
                <div className="grid w-full grid-cols-2 gap-1.5 sm:w-auto sm:min-w-[200px]">
                  <Button
                    type="button"
                    variant={activeShift === 'morning' ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 gap-1 rounded-lg"
                    onClick={() => setActiveShift('morning')}
                  >
                    <Sun className="size-3.5" aria-hidden />
                    Sabah
                  </Button>
                  <Button
                    type="button"
                    variant={activeShift === 'afternoon' ? 'default' : 'outline'}
                    size="sm"
                    className="h-9 gap-1 rounded-lg"
                    onClick={() => setActiveShift('afternoon')}
                  >
                    <Moon className="size-3.5" aria-hidden />
                    Öğle
                  </Button>
                </div>
              )}
            </div>
          </section>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 px-3 py-2.5 sm:px-4">
          <CardTitle className="text-sm font-semibold sm:text-base">Ders saatleri</CardTitle>
          <CardDescription className="text-xs leading-snug sm:text-[13px]">Otomatik doldurun veya manuel düzenleyin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 rounded-xl border-2 border-primary/30 bg-linear-to-br from-primary/8 via-muted/40 to-muted/20 p-2 shadow-md ring-1 ring-primary/10 dark:border-primary/35 dark:from-primary/12 dark:ring-primary/15">
              <p className="mb-2 px-0.5 text-center text-[11px] font-bold uppercase tracking-wider text-primary sm:text-left">
                Hangi günlerin saatleri?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => setWeekPartTab('weekday')}
                  className={cn(
                    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-3 py-2 text-center transition-all sm:min-h-[56px] sm:min-w-[160px] sm:flex-1',
                    weekPartTab === 'weekday'
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30'
                      : 'border-border/70 bg-background/80 text-foreground hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <CalendarDays className="size-5 shrink-0 opacity-90 sm:size-5" aria-hidden />
                  <span className="text-sm font-bold leading-tight">Hafta içi</span>
                  <span className="text-[10px] font-medium opacity-90 sm:text-[11px]">Pzt – Cuma</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWeekPartTab('weekend')}
                  className={cn(
                    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-3 py-2 text-center transition-all sm:min-h-[56px] sm:min-w-[160px] sm:flex-1',
                    weekPartTab === 'weekend'
                      ? 'border-primary bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/30'
                      : 'border-border/70 bg-background/80 text-foreground hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <CalendarRange className="size-5 shrink-0 opacity-90 sm:size-5" aria-hidden />
                  <span className="text-sm font-bold leading-tight">Hafta sonu</span>
                  <span className="text-[10px] font-medium opacity-90 sm:text-[11px]">Cmt – Paz</span>
                </button>
              </div>
            </div>
            {weekPartTab === 'weekend' && weekendOverride && (
              <div className="flex shrink-0 items-center sm:items-end">
                <Button type="button" variant="outline" size="sm" className="h-10 w-full border-2 sm:w-auto" onClick={clearWeekendOverride}>
                  Hafta içiyle aynı yap
                </Button>
              </div>
            )}
          </div>
          {weekPartTab === 'weekend' && !weekendOverride && (
            <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground sm:text-sm">Cumartesi–Pazar için hafta içi saatleri kullanılıyor.</p>
              <Button type="button" className="mt-2 h-9" size="sm" onClick={copyWeekdayToWeekend}>
                Hafta sonu için ayrı saat tanımla
              </Button>
            </div>
          )}
          {!(weekPartTab === 'weekend' && !weekendOverride) && (
          <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2">
              <input
                type="checkbox"
                checked={useManualLessonTimes}
                onChange={(e) => setUseManualLessonTimes(e.target.checked)}
                className="size-3.5 shrink-0 rounded border-input accent-primary sm:size-4"
              />
              <span className="text-xs font-medium leading-snug sm:text-sm">Elle saat girişi (otomatik kapalı)</span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="secondary" size="sm" className="h-9 w-full rounded-lg sm:w-auto" disabled={useManualLessonTimes} onClick={runAutoCalc}>
              Otomatik hesapla
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 w-full rounded-lg sm:w-auto" onClick={runClearSlots}>
              Temizle
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9 w-full rounded-lg sm:w-auto" onClick={runAddLessonSlot}>
              Ders ekle
            </Button>
          </div>

          <div className="space-y-2 md:hidden">
            {currentSchedule.map((l, idx) => {
              const startM = l.start_time ? timeToMinutes(l.start_time) : 0;
              const endM = l.end_time ? timeToMinutes(l.end_time) : 0;
              const duration = startM && endM ? endM - startM : 0;
              const nextRow = currentSchedule[idx + 1];
              const nextStart = nextRow?.start_time ? timeToMinutes(nextRow.start_time) : 0;
              const breakM = nextStart && endM ? nextStart - endM : 0;
              return (
                <div
                  key={l.lesson_num}
                  className="rounded-lg border border-border/70 bg-card p-2.5 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/12 text-sm font-bold text-primary">{l.lesson_num}. ders</span>
                    {useManualLessonTimes && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeLessonRow(l.lesson_num)}
                        disabled={currentSchedule.length <= 1}
                        aria-label={`${l.lesson_num}. dersi sil`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Başlangıç</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="08:30"
                        value={l.start_time}
                        onChange={(e) => updateLessonSlot(activeShift, idx, 'start_time', e.target.value)}
                        maxLength={5}
                        className="h-9 rounded-lg text-sm"
                        disabled={!useManualLessonTimes}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Bitiş</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="09:10"
                        value={l.end_time}
                        onChange={(e) => updateLessonSlot(activeShift, idx, 'end_time', e.target.value)}
                        maxLength={5}
                        className="h-9 rounded-lg text-sm"
                        disabled={!useManualLessonTimes}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                    <span>
                      Süre: <span className="font-medium tabular-nums text-foreground">{duration ? `${duration} dk` : '—'}</span>
                    </span>
                    <span>
                      Sonrası teneffüs: <span className="font-medium tabular-nums text-foreground">{breakM > 0 ? `${breakM} dk` : '0'}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sıra</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tür</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Başlangıç</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bitiş</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Süre</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Teneffüs</th>
                  {useManualLessonTimes && (
                    <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">İşlem</th>
                  )}
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
                    <tr key={l.lesson_num} className="transition-colors hover:bg-muted/25">
                      <td className="px-2 py-1.5">
                        <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">{l.lesson_num}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">Ders</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="text"
                          placeholder="08:30"
                          value={l.start_time}
                          onChange={(e) => updateLessonSlot(activeShift, idx, 'start_time', e.target.value)}
                          maxLength={5}
                          className="h-8 w-20 rounded-md border-border/80 text-xs disabled:opacity-60"
                          disabled={!useManualLessonTimes}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="text"
                          placeholder="09:10"
                          value={l.end_time}
                          onChange={(e) => updateLessonSlot(activeShift, idx, 'end_time', e.target.value)}
                          maxLength={5}
                          className="h-8 w-20 rounded-md border-border/80 text-xs disabled:opacity-60"
                          disabled={!useManualLessonTimes}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-muted-foreground tabular-nums">{duration ? `${duration} dk` : '—'}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="text-xs text-muted-foreground tabular-nums">{breakM > 0 ? `${breakM} dk` : '0'}</span>
                      </td>
                      {useManualLessonTimes && (
                        <td className="px-2 py-1.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                            onClick={() => removeLessonRow(l.lesson_num)}
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

          <div className="hidden pt-1 md:flex">
            <Button type="button" size="sm" className="h-9 rounded-lg px-6" onClick={handleSave} disabled={saving}>
              <Save className="mr-1.5 size-3.5" aria-hidden />
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 p-2 shadow-[0_-2px_16px_rgba(0,0,0,0.05)] backdrop-blur-md md:hidden',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        <Button type="button" className="h-10 w-full rounded-lg text-sm font-semibold shadow-sm" onClick={handleSave} disabled={saving}>
          <Save className="mr-1.5 size-3.5" aria-hidden />
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </div>
  );
}
