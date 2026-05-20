'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarRange, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  effectiveScheduleForDay,
  jsGetDayToTurkish,
  lessonSlotForDay,
  useSchoolTimetableSettings,
  type SchoolTimetableSettings,
} from '@/hooks/use-school-timetable-settings';

const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Pazartesi', short: 'Pzt' },
  { value: 2, label: 'Salı', short: 'Sal' },
  { value: 3, label: 'Çarşamba', short: 'Çar' },
  { value: 4, label: 'Perşembe', short: 'Per' },
  { value: 5, label: 'Cuma', short: 'Cum' },
  { value: 6, label: 'Cumartesi', short: 'Cmt' },
  { value: 0, label: 'Pazar', short: 'Paz' },
];

const PRESETS: { label: string; weekdays: number[]; lessons: number[] }[] = [
  { label: 'Hafta içi · 1–4. ders', weekdays: [1, 2, 3, 4, 5], lessons: [1, 2, 3, 4] },
  { label: 'Hafta içi · 5–7. ders', weekdays: [1, 2, 3, 4, 5], lessons: [5, 6, 7] },
  { label: 'Cumartesi · 1–6. ders', weekdays: [6], lessons: [1, 2, 3, 4, 5, 6] },
];

function defaultRange() {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 27);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function trimHm(t: string) {
  return t?.slice(0, 5) ?? '';
}

export function countQuickSlots(start: string, end: string, weekdays: number[], lessonNums: number[]) {
  if (!start || !end || !weekdays.length || !lessonNums.length) return 0;
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  if (s > e) return 0;
  let days = 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    if (weekdays.includes(d.getDay())) days++;
  }
  return days * lessonNums.length;
}

export type GeneratedSlot = {
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string | null;
  capacity: number;
  sortOrder: number;
  label: string | null;
};

export function buildSlotsFromQuick(params: {
  startDate: string;
  endDate: string;
  weekdays: number[];
  lessonNums: number[];
  settings: SchoolTimetableSettings | null;
  roomName: string | null;
  capacity: number;
}): GeneratedSlot[] {
  const out: GeneratedSlot[] = [];
  const start = new Date(params.startDate + 'T12:00:00');
  const end = new Date(params.endDate + 'T12:00:00');
  if (start > end) return out;
  let order = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!params.weekdays.includes(d.getDay())) continue;
    const dateStr = d.toISOString().slice(0, 10);
    const tr = jsGetDayToTurkish(d.getDay());
    for (const lessonNum of params.lessonNums) {
      const entry = lessonSlotForDay(params.settings, tr, lessonNum);
      if (!entry) continue;
      out.push({
        sessionDate: dateStr,
        startTime: trimHm(entry.start_time),
        endTime: trimHm(entry.end_time),
        roomName: params.roomName?.trim() || null,
        capacity: params.capacity,
        sortOrder: order++,
        label: `${lessonNum}. Ders`,
      });
    }
  }
  return out;
}

type Props = {
  onApply: (slots: GeneratedSlot[], mode: 'replace' | 'append') => void;
};

export function TakvimQuickBuilder({ onApply }: Props) {
  const { settings, loading, maxLessons } = useSchoolTimetableSettings();
  const range = defaultRange();
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [lessonNums, setLessonNums] = useState<number[]>([1, 2, 3, 4]);
  const [roomName, setRoomName] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [mode, setMode] = useState<'replace' | 'append'>('replace');

  const lessonOptions = useMemo(() => {
    const tr = jsGetDayToTurkish(weekdays[0] ?? 1);
    const sched = effectiveScheduleForDay(settings, tr);
    const nums = new Set<number>();
    for (let i = 1; i <= maxLessons; i++) nums.add(i);
    for (const s of sched) nums.add(s.lesson_num);
    return [...nums].sort((a, b) => a - b);
  }, [settings, maxLessons, weekdays]);

  const preview = useMemo(
    () => countQuickSlots(startDate, endDate, weekdays, lessonNums),
    [startDate, endDate, weekdays, lessonNums],
  );

  const toggleDay = (v: number) => {
    setWeekdays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)));
  };

  const toggleLesson = (n: number) => {
    setLessonNums((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].sort((a, b) => a - b)));
  };

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setWeekdays(p.weekdays);
    setLessonNums(p.lessons);
  };

  const handleGenerate = () => {
    const slots = buildSlotsFromQuick({
      startDate,
      endDate,
      weekdays,
      lessonNums,
      settings,
      roomName: roomName || null,
      capacity: Number(capacity) || 30,
    });
    onApply(slots, mode);
  };

  const sampleTr = jsGetDayToTurkish(weekdays[0] ?? 1);

  return (
    <div className="rounded-xl border border-rose-300/50 bg-linear-to-br from-rose-50/80 to-white dark:from-rose-950/30 dark:to-zinc-900/60 dark:border-rose-800/40 p-3 sm:p-4 space-y-3">
      <div className="flex items-start gap-2">
        <CalendarRange className="size-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-950 dark:text-rose-100">Hızlı takvim oluştur</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Okul ders saatlerine göre slot üretilir.
            {loading ? ' Yükleniyor…' : settings?.lesson_schedule?.length ? '' : ' (varsayılan çizelge)'}
            {' '}
            <Link href="/ders-programi/ayarlar" className="text-rose-700 underline dark:text-rose-300">
              Ders saatleri
            </Link>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPreset(p)}
            className="rounded-lg border border-rose-200/80 bg-white/80 px-2 py-1 text-[10px] font-medium text-rose-800 hover:bg-rose-100 dark:border-rose-800/50 dark:bg-zinc-900/60 dark:text-rose-200 dark:hover:bg-rose-950/40"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground">Başlangıç</label>
          <Input type="date" value={startDate} className="h-8 text-xs mt-0.5" onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground">Bitiş</label>
          <Input type="date" value={endDate} className="h-8 text-xs mt-0.5" onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground">Salon</label>
          <Input placeholder="Spor Salonu" value={roomName} className="h-8 text-xs mt-0.5" onChange={(e) => setRoomName(e.target.value)} />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground">Kapasite</label>
          <Input type="number" min={1} value={capacity} className="h-8 text-xs mt-0.5" onChange={(e) => setCapacity(Number(e.target.value) || 30)} />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-muted-foreground mb-1">Günler</p>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((d) => {
            const on = weekdays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={cn(
                  'min-w-[2.5rem] rounded-md border px-1.5 py-1 text-[11px] font-semibold',
                  on ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-900',
                )}
                title={d.label}
              >
                {d.short}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold text-muted-foreground mb-1">Hangi ders saatleri? (okul çizelgesi)</p>
        <div className="flex flex-wrap gap-1">
          {lessonOptions.map((n) => {
            const on = lessonNums.includes(n);
            const slot = lessonSlotForDay(settings, sampleTr, n);
            const hint = slot ? `${trimHm(slot.start_time)}–${trimHm(slot.end_time)}` : '';
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggleLesson(n)}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-semibold tabular-nums',
                  on ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                )}
                title={hint}
              >
                {n}. Ders
                {hint ? <span className={cn('ml-1 font-normal', on ? 'text-rose-100' : 'text-muted-foreground')}>{hint}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="mt-1 flex gap-2 text-[10px]">
          <button type="button" className="text-rose-700 hover:underline" onClick={() => setLessonNums(lessonOptions.filter((n) => n <= 4))}>
            Sabah (1–4)
          </button>
          <button type="button" className="text-rose-700 hover:underline" onClick={() => setLessonNums(lessonOptions.filter((n) => n >= 5))}>
            Öğleden sonra
          </button>
          <button type="button" className="text-muted-foreground hover:underline" onClick={() => setLessonNums([...lessonOptions])}>
            Tümü
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <input type="radio" name="slotMode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="accent-rose-600" />
          Değiştir
        </label>
        <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <input type="radio" name="slotMode" checked={mode === 'append'} onChange={() => setMode('append')} className="accent-rose-600" />
          Ekle
        </label>
        <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 ml-auto tabular-nums">
          {preview > 0 ? `${preview} slot` : '—'}
        </span>
        <Button size="sm" className="h-8 gap-1 text-xs w-full sm:w-auto" disabled={preview === 0 || preview > 200 || !lessonNums.length} onClick={handleGenerate}>
          <Wand2 className="size-3.5" />
          Oluştur
        </Button>
        {preview > 200 && <p className="text-[10px] text-amber-700 w-full">En fazla 200 slot.</p>}
      </div>
    </div>
  );
}
