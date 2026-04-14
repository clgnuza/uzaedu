'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Trash2,
  Plus,
  X,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  Sun,
  Info,
  Check,
  Eraser,
  Table2,
  Tag,
  GraduationCap,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { isWeekendDow, useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { useSchoolClassesSubjects, type SchoolClass } from '@/hooks/use-school-classes-subjects';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LessonCellCard } from '@/components/ders-programi/lesson-cell-card';
import { DersProgramiWeekIllustration } from '@/components/ders-programi/ders-programi-week-illustration';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatSchoolSubjectOptionLabel, resolveSchoolSubjectDisplay } from '@/lib/school-subject-display';

const SECTION_PANEL = 'rounded-xl border border-border/70 bg-card/50 p-3 shadow-sm sm:p-4';
const SECTION_TITLE = 'flex items-center gap-2 text-sm font-bold text-foreground sm:text-base';
const SECTION_HELP = 'hidden text-xs leading-snug text-muted-foreground sm:block';
const MOBILE_HINT = 'text-[11px] leading-snug text-muted-foreground sm:hidden';

type TimetableEntry = {
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

type ProgramWithEntries = {
  id: string;
  name: string;
  academic_year: string;
  term: string;
  total_hours: number;
  entries: (TimetableEntry & { user_id?: string })[];
};

const DAYS_FULL = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR'];
const DAY_NAMES = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const LUNCH_AFTER_LESSON = 4;

type ScheduleRow = {
  id: string;
  type: 'ders' | 'ogle';
  startTime: string;
  endTime: string;
  breakMin: number;
  lessonNum?: number;
};

function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatClassOptionLabel(c: SchoolClass): string {
  const name = c.name.trim();
  if (c.grade == null) return name;
  const g = c.grade;
  if (new RegExp(`^${g}(?:[-\\s./]|$)`).test(name)) return name;
  const low = name.toLocaleLowerCase('tr');
  if (low.includes('sınıf') && low.includes(String(g))) return name;
  return `${name} · Sınıf ${g}`;
}

type SlotDisplay = {
  label: string;
  timeRange: string;
  lessonNum?: number;
  isLunch?: boolean;
};

function buildScheduleRowsFromSlots(
  slots: Array<{ timeRange: string; lessonNum?: number; isLunch?: boolean }>,
  idPrefix: string,
): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  slots.forEach((slot, i) => {
    const [start, end] = slot.timeRange.split(' - ');
    rows.push({
      id: `${idPrefix}-${i}`,
      type: slot.isLunch ? 'ogle' : 'ders',
      startTime: (start ?? '').trim(),
      endTime: (end ?? '').trim(),
      breakMin: slot.isLunch ? 0 : 10,
      lessonNum: slot.lessonNum,
    });
  });
  return rows;
}

function slotsFromScheduleRows(rows: ScheduleRow[]): SlotDisplay[] {
  let lessonNum = 0;
  return rows.map((row) => {
    if (row.type === 'ogle') {
      return { label: 'Öğle Tatili', timeRange: `${row.startTime} - ${row.endTime}`, isLunch: true };
    }
    lessonNum += 1;
    const num = lessonNum;
    return {
      label: `${num}. Ders`,
      timeRange: `${row.startTime} - ${row.endTime}`,
      lessonNum: num,
      isLunch: false,
    };
  });
}

function maxLessonFromSlots(slots: SlotDisplay[]) {
  return Math.max(0, ...slots.filter((s) => s.lessonNum != null).map((s) => s.lessonNum!), 0);
}

function getLessonRangeFromRows(rows: ScheduleRow[], lessonNum: number): string | null {
  let ln = 0;
  for (const row of rows) {
    if (row.type === 'ogle') continue;
    ln += 1;
    if (ln === lessonNum) return `${row.startTime} - ${row.endTime}`;
  }
  return null;
}

function computeTimeSlotsLocal(config: {
  schoolStart: string;
  lessonMin: number;
  breakMin: number;
  lunchStart: string;
  lunchEnd: string;
  lunchActive: boolean;
  maxLessons: number;
}): Array<{ label: string; timeRange: string; lessonNum?: number; isLunch?: boolean }> {
  const { schoolStart, lessonMin, breakMin, lunchStart, lunchEnd, lunchActive, maxLessons } = config;
  const slots: Array<{ label: string; timeRange: string; lessonNum?: number; isLunch?: boolean }> = [];
  let cur = parseTime(schoolStart);
  for (let i = 1; i <= maxLessons; i++) {
    if (lunchActive && i === LUNCH_AFTER_LESSON + 1) {
      slots.push({ label: 'Öğle Tatili', timeRange: `${lunchStart} - ${lunchEnd}`, isLunch: true });
      cur = parseTime(lunchEnd) + breakMin;
    }
    const end = cur + lessonMin;
    slots.push({ label: `${i}. Ders`, timeRange: `${formatTime(cur)} - ${formatTime(end)}`, lessonNum: i });
    cur = end + breakMin;
  }
  return slots;
}

export default function ProgramEditPage() {
  const params = useParams();
  const router = useRouter();
  const { token, me } = useAuth();
  const id = params.id as string;
  const {
    timeSlots: schoolTimeSlots,
    maxLessons: schoolMaxLessons,
    settings: schoolSettings,
    getTimeRangeForDay,
    getTimeSlotsForDay,
  } = useSchoolTimetableSettings();
  const { classes: schoolClasses, subjects: schoolSubjects } = useSchoolClassesSubjects();

  const [program, setProgram] = useState<ProgramWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addModal, setAddModal] = useState<{ day: number; lesson: number } | null>(null);
  const [addClassSection, setAddClassSection] = useState('');
  const [addSubject, setAddSubject] = useState('');
  const [addSubjectId, setAddSubjectId] = useState('');
  const [schoolStart, setSchoolStart] = useState('08:30');
  const [schoolEnd, setSchoolEnd] = useState('17:30');
  const [lessonMin, setLessonMin] = useState(40);
  const [breakMin, setBreakMin] = useState(10);
  const [lunchStart, setLunchStart] = useState('12:30');
  const [lunchEnd, setLunchEnd] = useState('13:30');
  const [lunchActive, setLunchActive] = useState(true);
  const [manualTimes, setManualTimes] = useState(false);
  const [schoolInitDone, setSchoolInitDone] = useState(false);
  const [manualScheduleTab, setManualScheduleTab] = useState<'weekday' | 'weekend'>('weekday');
  const [scheduleRowsWeekday, setScheduleRowsWeekday] = useState<ScheduleRow[]>([]);
  const [scheduleRowsWeekend, setScheduleRowsWeekend] = useState<ScheduleRow[]>([]);
  const [activeSection, setActiveSection] = useState<'general' | 'times' | 'weekly'>('general');
  const sectionRefs = useRef<{ general: HTMLElement | null; times: HTMLElement | null; weekly: HTMLElement | null }>({
    general: null,
    times: null,
    weekly: null,
  });

  const isAdmin = me?.role === 'school_admin';

  const scrollToSection = (key: 'general' | 'times' | 'weekly') => {
    setActiveSection(key);
    const el = sectionRefs.current[key];
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!manualTimes) return;
    if (scheduleRowsWeekday.length > 0 || scheduleRowsWeekend.length > 0) return;
    const slotsWd = schoolTimeSlots.map((s) => ({
      timeRange: s.timeRange,
      lessonNum: s.lessonNum,
      isLunch: s.isLunch,
    }));
    setScheduleRowsWeekday(buildScheduleRowsFromSlots(slotsWd, 'wd'));
    const we = getTimeSlotsForDay(6);
    const slotsWe = we.map((s) => ({
      timeRange: s.timeRange,
      lessonNum: s.lessonNum,
      isLunch: s.isLunch,
    }));
    setScheduleRowsWeekend(buildScheduleRowsFromSlots(slotsWe, 'we'));
  }, [manualTimes, schoolTimeSlots, getTimeSlotsForDay, scheduleRowsWeekday.length, scheduleRowsWeekend.length]);

  useEffect(() => {
    if (schoolInitDone || !schoolSettings?.lesson_schedule?.length || manualTimes) return;
    const s = schoolSettings.lesson_schedule;
    const first = s.find((e) => e.lesson_num === 1);
    const fourth = s.find((e) => e.lesson_num === 4);
    const fifth = s.find((e) => e.lesson_num === 5);
    if (first) setSchoolStart(first.start_time);
    if (fourth) setSchoolEnd(fourth.end_time);
    if (fourth && fifth) {
      setLunchStart(fourth.end_time);
      setLunchEnd(fifth.start_time);
    }
    setSchoolInitDone(true);
  }, [schoolSettings, manualTimes, schoolInitDone]);

  const timeSlots = useMemo(() => {
    if (manualTimes && (scheduleRowsWeekday.length > 0 || scheduleRowsWeekend.length > 0)) {
      const ws = slotsFromScheduleRows(scheduleRowsWeekday);
      const wes = slotsFromScheduleRows(scheduleRowsWeekend);
      const maxW = maxLessonFromSlots(ws);
      const maxWe = maxLessonFromSlots(wes);
      if (maxWe > maxW) {
        const extra = wes.filter((s) => s.lessonNum != null && s.lessonNum > maxW);
        return [...ws, ...extra];
      }
      if (ws.length > 0) return ws;
      return wes;
    }
    if (manualTimes) {
      return computeTimeSlotsLocal({
        schoolStart,
        lessonMin,
        breakMin,
        lunchStart,
        lunchEnd,
        lunchActive,
        maxLessons: schoolMaxLessons,
      });
    }
    return schoolTimeSlots.map((slot) =>
      slot.isLunch ? { ...slot, label: 'Öğle Tatili' } : { ...slot, label: `${slot.lessonNum}. Ders` },
    );
  }, [
    manualTimes,
    scheduleRowsWeekday,
    scheduleRowsWeekend,
    schoolStart,
    lessonMin,
    breakMin,
    lunchStart,
    lunchEnd,
    lunchActive,
    schoolTimeSlots,
    schoolMaxLessons,
  ]);

  const getCellTimeRange = useCallback(
    (day: number, lessonNum: number) => {
      if (!manualTimes) return getTimeRangeForDay(day, lessonNum);
      const rows = isWeekendDow(day) ? scheduleRowsWeekend : scheduleRowsWeekday;
      const r = getLessonRangeFromRows(rows, lessonNum);
      return r ?? '—';
    },
    [manualTimes, getTimeRangeForDay, scheduleRowsWeekday, scheduleRowsWeekend],
  );

  const setActiveScheduleRows = useCallback(
    (updater: (prev: ScheduleRow[]) => ScheduleRow[]) => {
      if (manualScheduleTab === 'weekday') setScheduleRowsWeekday(updater);
      else setScheduleRowsWeekend(updater);
    },
    [manualScheduleTab],
  );

  const activeScheduleRows = manualScheduleTab === 'weekday' ? scheduleRowsWeekday : scheduleRowsWeekend;

  const lunchDurationMins = useMemo(() => {
    const s = parseTime(lunchStart);
    const e = parseTime(lunchEnd);
    return Math.max(0, e - s);
  }, [lunchStart, lunchEnd]);

  const loadProgram = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    try {
      const data = await apiFetch<ProgramWithEntries>(`/teacher-timetable/my-programs/${id}`, { token });
      setProgram(data);
    } catch {
      setProgram(null);
      toast.error('Program yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  const getCellEntry = (day: number, lesson: number) => {
    if (!program?.entries) return null;
    return program.entries.find((e) => e.day_of_week === day && e.lesson_num === lesson);
  };

  const handleAddLesson = async () => {
    if (!addModal || !token || !program) return;
    const classSection = addClassSection.trim().slice(0, 32);
    const picked = schoolSubjects.find((s) => s.id === addSubjectId);
    const subject = (
      schoolSubjects.length > 0
        ? picked
          ? formatSchoolSubjectOptionLabel(picked)
          : ''
        : addSubject.trim()
    ).slice(0, 128);
    if (!classSection || !subject) {
      toast.error('Sınıf ve ders gerekli.');
      return;
    }
    const newEntries = [...(program.entries ?? []), {
      day_of_week: addModal.day,
      lesson_num: addModal.lesson,
      class_section: classSection,
      subject,
      user_id: me?.id,
    }];
    setSaving(true);
    try {
      const updated = await apiFetch<ProgramWithEntries>(`/teacher-timetable/my-programs/${id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          entries: newEntries.map((e) => ({
            day_of_week: e.day_of_week,
            lesson_num: e.lesson_num,
            class_section: e.class_section,
            subject: e.subject,
          })),
        }),
      });
      setProgram(updated);
      setAddModal(null);
      setAddClassSection('');
      setAddSubject('');
      setAddSubjectId('');
      toast.success('Ders eklendi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLesson = async (day: number, lesson: number) => {
    if (!token || !program) return;
    const newEntries = (program.entries ?? []).filter(
      (e) => !(e.day_of_week === day && e.lesson_num === lesson),
    );
    setSaving(true);
    try {
      const updated = await apiFetch<ProgramWithEntries>(`/teacher-timetable/my-programs/${id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          entries: newEntries.map((e) => ({
            day_of_week: e.day_of_week,
            lesson_num: e.lesson_num,
            class_section: e.class_section,
            subject: e.subject,
          })),
        }),
      });
      setProgram(updated);
      toast.success('Ders kaldırıldı.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaldırılamadı.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeta = async () => {
    if (!token || !program) return;
    setSaving(true);
    try {
      const updated = await apiFetch<ProgramWithEntries>(`/teacher-timetable/my-programs/${id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          name: program.name,
          academic_year: program.academic_year,
          term: program.term,
        }),
      });
      setProgram(updated);
      toast.success('Program güncellendi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !program || !confirm('Bu programı silmek istediğinize emin misiniz?')) return;
    setDeleting(true);
    try {
      await apiFetch(`/teacher-timetable/my-programs/${id}`, { token, method: 'DELETE' });
      toast.success('Program silindi.');
      router.push('/ders-programi/programlarim');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Silinemedi.');
    } finally {
      setDeleting(false);
    }
  };

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Bu sayfa öğretmenler içindir.</p>
        <Button asChild variant="outline">
          <Link href="/ders-programi/olustur">Excel ile Yükle</Link>
        </Button>
      </div>
    );
  }

  if (loading || !program) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  const termOptions = ['Tüm Yıl', '1. Dönem', '2. Dönem'];
  const allTermOptions = [...new Set([...termOptions, program.term].filter(Boolean))];

  const entryCount = program.entries?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-0 sm:space-y-5 sm:px-1">
      <div className="sticky top-0 z-20 space-y-2 border-b border-border/50 bg-background/95 pb-2 pt-1 shadow-sm backdrop-blur-md print:static print:border-0 print:bg-transparent print:pb-0 print:shadow-none sm:rounded-t-xl">
        <div className="relative overflow-hidden rounded-xl border border-violet-200/45 bg-linear-to-br from-violet-500/12 via-background to-sky-500/10 p-3 ring-1 ring-violet-500/10 dark:border-violet-900/40 dark:from-violet-950/35 dark:to-sky-950/20 dark:ring-violet-900/25 sm:p-3.5">
          <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-500/20" aria-hidden />
          <div className="relative flex gap-2.5 sm:gap-3">
            <DersProgramiWeekIllustration className="size-[52px] shrink-0 sm:size-16" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300 sm:text-[10px]">
                    Program düzenle
                  </p>
                  <h1 className="mt-0.5 truncate text-sm font-bold leading-tight text-foreground sm:text-base" title={program.name}>
                    {program.name}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:gap-1.5">
                    <span className="rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground sm:text-xs">
                      {program.academic_year}
                    </span>
                    <span className="rounded-md border border-border/60 bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:text-xs">
                      {program.term}
                    </span>
                    <span className="rounded-md border border-emerald-200/60 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-200 sm:text-xs">
                      {entryCount} ders kaydı
                    </span>
                  </div>
                  <p className={cn(SECTION_HELP, 'mt-2 max-w-xl')}>
                    Ad, dönem ve saatleri bu sayfada düzenleyin; haftalık tabloda ders ekleyip kaldırın. Kayıt için alttaki «Programı Güncelle» ve tabloda eklediğiniz dersler otomatik kaydolur.
                  </p>
                  <p className={cn(MOBILE_HINT, 'mt-1.5')}>Aşağıdaki sekmelerle bölümler arasında geçin.</p>
                </div>
                <Button size="sm" variant="secondary" asChild className="h-8 shrink-0 gap-1.5 px-2.5 text-xs shadow-sm sm:h-9 sm:px-3">
                  <Link href="/ders-programi/programlarim" title="Programlarım listesine dön">
                    <ArrowLeft className="size-3.5 sm:size-4" />
                    <span className="hidden sm:inline">Geri</span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <nav className="w-full print:hidden" aria-label="Sayfa bölümleri">
          <div
            role="tablist"
            className="grid w-full grid-cols-3 gap-1 rounded-xl border-2 border-violet-200/85 bg-violet-50/80 p-1 shadow-sm dark:border-violet-900/55 dark:bg-violet-950/35 sm:gap-1.5 sm:p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'general'}
              id="tab-program-general"
              title="Ad, yıl, dönem"
              onClick={() => scrollToSection('general')}
              className={cn(
                'flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[10px] font-bold transition-all sm:min-h-11 sm:flex-row sm:gap-2 sm:px-2 sm:py-2 sm:text-xs',
                activeSection === 'general'
                  ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-500/40 dark:bg-violet-500 dark:ring-violet-300/30'
                  : 'border border-transparent bg-white/75 text-violet-900/75 hover:border-violet-300/80 hover:bg-white dark:bg-violet-950/45 dark:text-violet-100/80 dark:hover:border-violet-800',
              )}
            >
              <Calendar className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
              <span className="leading-tight">Genel</span>
              <span
                className={cn(
                  'hidden text-[10px] sm:inline',
                  activeSection === 'general' ? 'font-normal text-white/85' : 'font-normal text-muted-foreground',
                )}
              >
                Bilgiler
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'times'}
              id="tab-program-times"
              title="Günlük çizelge ve saatler"
              onClick={() => scrollToSection('times')}
              className={cn(
                'flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[10px] font-bold transition-all sm:min-h-11 sm:flex-row sm:gap-2 sm:px-2 sm:py-2 sm:text-xs',
                activeSection === 'times'
                  ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/40 dark:bg-emerald-500 dark:ring-emerald-300/30'
                  : 'border border-transparent bg-white/75 text-emerald-900/75 hover:border-emerald-300/80 hover:bg-white dark:bg-emerald-950/40 dark:text-emerald-100/80 dark:hover:border-emerald-800',
              )}
            >
              <Clock className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
              <span className="leading-tight">Saatler</span>
              <span
                className={cn(
                  'hidden text-[10px] sm:inline',
                  activeSection === 'times' ? 'font-normal text-white/85' : 'font-normal text-muted-foreground',
                )}
              >
                Çizelge
              </span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'weekly'}
              id="tab-program-weekly"
              title="Haftalık ders yerleşimi"
              onClick={() => scrollToSection('weekly')}
              className={cn(
                'flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[10px] font-bold transition-all sm:min-h-11 sm:flex-row sm:gap-2 sm:px-2 sm:py-2 sm:text-xs',
                activeSection === 'weekly'
                  ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-500/40 dark:bg-sky-500 dark:ring-sky-300/30'
                  : 'border border-transparent bg-white/75 text-sky-900/75 hover:border-sky-300/80 hover:bg-white dark:bg-sky-950/45 dark:text-sky-100/80 dark:hover:border-sky-800',
              )}
            >
              <Table2 className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
              <span className="leading-tight">Haftalık</span>
              <span
                className={cn(
                  'hidden text-[10px] sm:inline',
                  activeSection === 'weekly' ? 'font-normal text-white/85' : 'font-normal text-muted-foreground',
                )}
              >
                Tablo
              </span>
            </button>
          </div>
        </nav>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-muted/10 p-3 sm:space-y-5 sm:p-4 md:p-5">
        {/* Program Bilgileri */}
        <section
          ref={(el) => {
            sectionRefs.current.general = el;
          }}
          className="scroll-mt-36 space-y-3 sm:scroll-mt-40 sm:space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-violet-200/50 pb-2 dark:border-violet-900/40">
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
              <Calendar className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className={SECTION_TITLE}>Genel bilgiler</h2>
              <p className={SECTION_HELP}>Program adı, yıl ve dönem — listelerde birlikte görünür.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <div className={cn('flex flex-col gap-2', SECTION_PANEL)}>
              <Label htmlFor="program-name" className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <Tag className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <span>
                  Program adı <span className="text-destructive">*</span>
                </span>
              </Label>
              <p className={SECTION_HELP}>Kısa, ayırt edici ad (sınıf / branş).</p>
              <Input
                id="program-name"
                value={program.name}
                onChange={(e) => setProgram((p) => (p ? { ...p, name: e.target.value } : p))}
                placeholder="Örn. İdare Programı (Aktarılan), 10-A haftalık planı"
                className="h-11"
                autoComplete="off"
              />
            </div>
            <div className={cn('flex flex-col gap-2', SECTION_PANEL)}>
              <Label htmlFor="program-academic-year" className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <GraduationCap className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <span>
                  Akademik yıl <span className="text-destructive">*</span>
                </span>
              </Label>
              <p className={SECTION_HELP}>
                İki yıl tire ile: <span className="font-mono font-medium">2026-2027</span>
              </p>
              <Input
                id="program-academic-year"
                value={program.academic_year}
                onChange={(e) => setProgram((p) => (p ? { ...p, academic_year: e.target.value } : p))}
                placeholder="2026-2027"
                inputMode="numeric"
                className="h-11 font-mono tabular-nums"
                autoComplete="off"
              />
            </div>
            <div className={cn('flex flex-col gap-2', SECTION_PANEL)}>
              <Label htmlFor="program-term" className="flex items-start gap-2 text-sm font-semibold text-foreground">
                <Layers className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                <span>
                  Dönem <span className="text-destructive">*</span>
                </span>
              </Label>
              <p className={SECTION_HELP}>Tüm yıl veya dönem.</p>
              <select
                id="program-term"
                value={program.term}
                onChange={(e) => setProgram((p) => (p ? { ...p, term: e.target.value } : p))}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {allTermOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <div
          ref={(el) => {
            sectionRefs.current.times = el;
          }}
          className="scroll-mt-36 space-y-4 sm:scroll-mt-40 sm:space-y-5"
        >
        <div className="flex items-center gap-2 border-b border-emerald-200/50 pb-2 dark:border-emerald-900/40">
          <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <Clock className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className={SECTION_TITLE}>Program saatleri</h2>
            <p className={SECTION_HELP}>
              Sadece bu programınızın önizlemesi; okul genel ayarları ve diğer öğretmenler değişmez.
            </p>
            <p className={MOBILE_HINT}>Bu bölüm yalnızca sizin planınız içindir.</p>
          </div>
        </div>

        {/* Kişisel program için temel çizelge (okul genel ayarını değiştirmez) */}
        <section className={cn('space-y-3', SECTION_PANEL, 'sm:space-y-4')}>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
            Temel saatler
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm">İlk ders başlangıcı *</Label>
              <Input type="time" value={schoolStart} onChange={(e) => setSchoolStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Referans bitiş (4. ders sonu) *</Label>
              <Input type="time" value={schoolEnd} onChange={(e) => setSchoolEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Ders Süresi (dk) *</Label>
              <Input
                type="number"
                min={5}
                max={90}
                value={lessonMin}
                onChange={(e) => setLessonMin(Number(e.target.value) || 40)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Teneffüs Süresi (dk) *</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={breakMin}
                onChange={(e) => setBreakMin(Number(e.target.value) || 10)}
              />
            </div>
          </div>
        </section>

        <section className={cn('space-y-3', SECTION_PANEL, 'sm:space-y-4')}>
          <h3 className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200 sm:text-sm">
            <Sun className="size-4 shrink-0" aria-hidden />
            Öğle arası
          </h3>
          <p className={SECTION_HELP}>Tabloda öğle satırı; yalnızca bu programda.</p>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm">Öğle Tatili Başlangıç *</Label>
              <Input type="time" value={lunchStart} onChange={(e) => setLunchStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Öğle Tatili Bitiş *</Label>
              <Input type="time" value={lunchEnd} onChange={(e) => setLunchEnd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Öğle Tatili Süresi (dk)</Label>
              <Input type="number" value={lunchDurationMins} readOnly className="bg-muted" />
              <p className="text-xs text-muted-foreground">Otomatik hesaplanır</p>
            </div>
            <div className="flex items-end gap-3 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={lunchActive}
                  onClick={() => setLunchActive(!lunchActive)}
                  className={cn(
                    'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                    lunchActive ? 'bg-primary' : 'bg-muted',
                  )}
                >
                  <span
                    className={cn(
                      'pointer-events-none block size-5 rounded-full bg-white shadow transition-transform',
                      lunchActive ? 'translate-x-6' : 'translate-x-1',
                    )}
                  />
                </button>
                <Label className="text-sm">Öğle tatili ekle</Label>
              </div>
            </div>
          </div>
        </section>

        <section className={cn('space-y-3', SECTION_PANEL, 'sm:space-y-4')}>
          <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200 sm:text-sm">
            <Layers className="size-4 shrink-0" aria-hidden />
            Günlük çizelge
          </h3>
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200/60 bg-emerald-500/5 p-2.5 dark:border-emerald-900/50 sm:flex-row sm:items-start sm:gap-3 sm:p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div className="min-w-0 space-y-1.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
              <p>
                <span className="font-semibold text-foreground">Otomatik:</span> Saat değişince sıradaki dersler yeniden hesaplanır.
              </p>
              <p className="hidden sm:block">
                <span className="font-semibold text-amber-800 dark:text-amber-200">Kayıt:</span> Haftalık tabloya yansıması için «Programı Güncelle» kullanın; okul genel programı etkilenmez.
              </p>
              <p className="sm:hidden">
                <span className="font-semibold text-amber-800 dark:text-amber-200">Kayıt:</span> «Programı Güncelle» ile kaydedin.
              </p>
            </div>
          </div>
          <div className="flex max-w-full flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={manualTimes}
              onClick={() => {
                if (manualTimes) {
                  setScheduleRowsWeekday([]);
                  setScheduleRowsWeekend([]);
                }
                setManualTimes(!manualTimes);
              }}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                manualTimes ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn('pointer-events-none block size-5 rounded-full bg-white shadow transition-transform', manualTimes ? 'translate-x-6' : 'translate-x-1')} />
            </button>
            <div className="min-w-0 flex-1">
              <Label className="text-sm font-medium leading-snug">Manuel ders saatleri kullan</Label>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                Açıkken hafta içi ve hafta sonu için ayrı saat tabloları düzenlenir; okulun resmi çizelgesini değiştirmez.
              </p>
            </div>
          </div>

          {manualTimes && (
            <Card className="overflow-hidden border-emerald-200/40 shadow-sm dark:border-emerald-900/35">
              <CardContent className="space-y-2 p-2.5 sm:space-y-3 sm:p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200 sm:text-xs sm:normal-case sm:tracking-normal">
                  Hangi günlerin saatleri?
                </p>
                <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-border/70 bg-muted/30 p-0.5 dark:bg-muted/20 sm:gap-1.5 sm:p-1">
                  <button
                    type="button"
                    onClick={() => setManualScheduleTab('weekday')}
                    className={cn(
                      'flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition-all sm:min-h-10 sm:text-sm',
                      manualScheduleTab === 'weekday'
                        ? 'bg-background text-emerald-800 shadow-sm ring-1 ring-black/5 dark:text-emerald-200 dark:ring-white/10'
                        : 'text-muted-foreground hover:bg-background/70',
                    )}
                  >
                    <CalendarDays className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                    <span>
                      <span className="sm:hidden">İçi</span>
                      <span className="hidden sm:inline">Hafta içi</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualScheduleTab('weekend')}
                    className={cn(
                      'flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition-all sm:min-h-10 sm:text-sm',
                      manualScheduleTab === 'weekend'
                        ? 'bg-background text-sky-800 shadow-sm ring-1 ring-black/5 dark:text-sky-200 dark:ring-white/10'
                        : 'text-muted-foreground hover:bg-background/70',
                    )}
                  >
                    <CalendarRange className="size-3.5 shrink-0 sm:size-4" aria-hidden />
                    <span>
                      <span className="sm:hidden">Sonu</span>
                      <span className="hidden sm:inline">Hafta sonu</span>
                    </span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] sm:h-9 sm:text-sm"
                    onClick={() => {
                      const copy = scheduleRowsWeekday.map((r, i) => ({
                        ...r,
                        id: `we-copy-${i}-${Date.now()}`,
                      }));
                      setScheduleRowsWeekend(copy);
                      setManualScheduleTab('weekend');
                      toast.success('Hafta içi saatleri hafta sonuna kopyalandı; düzenleyebilirsiniz.');
                    }}
                  >
                    <span className="sm:hidden">İçi → sonu</span>
                    <span className="hidden sm:inline">Hafta içini hafta sonuna kopyala</span>
                  </Button>
                  <p className="text-[10px] text-muted-foreground sm:text-xs">
                    Düzenlenen:{' '}
                    <strong className="text-foreground">
                      {manualScheduleTab === 'weekday' ? 'Pzt–Cuma' : 'Cmt–Paz'}
                    </strong>
                  </p>
                </div>
              </CardContent>
              <CardContent className="border-t border-border/60 p-0">
                <div className="max-h-[min(50vh,24rem)] overflow-auto overscroll-x-contain">
                  <div className="min-w-0 overflow-x-auto">
                  <table className="w-full min-w-xl table-fixed border-collapse text-sm">
                    <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-sm">
                      <tr>
                        <th className="w-13 px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-tight text-muted-foreground sm:w-14 sm:px-2 sm:text-xs" title="Sıra">
                          Sıra
                        </th>
                        <th className="w-18 px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-tight text-muted-foreground sm:w-24 sm:px-2 sm:text-xs" title="Tür">
                          Tür
                        </th>
                        <th className="w-22 px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-tight text-muted-foreground sm:w-28 sm:px-2 sm:text-xs" title="Başlangıç">
                          Başl.
                        </th>
                        <th className="w-22 px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-tight text-muted-foreground sm:w-28 sm:px-2 sm:text-xs" title="Bitiş">
                          Bitiş
                        </th>
                        <th className="w-17 bg-green-50 px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-tight text-muted-foreground dark:bg-green-950/25 sm:w-24 sm:px-2 sm:text-xs" title="Süre (dakika)">
                          Süre
                        </th>
                        <th className="w-17 px-1.5 py-2 text-left text-[10px] font-semibold uppercase leading-tight text-muted-foreground sm:w-24 sm:px-2 sm:text-xs" title="Teneffüs (dakika)">
                          Tnf.
                        </th>
                        <th className="w-12 px-1 py-2 text-center text-[10px] font-semibold uppercase leading-tight text-muted-foreground sm:w-14 sm:px-2 sm:text-xs" title="Sil">
                          Sil
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeScheduleRows.map((row, idx) => {
                        const dur = row.startTime && row.endTime
                          ? Math.max(0, parseTime(row.endTime) - parseTime(row.startTime))
                          : 0;
                        return (
                          <tr key={row.id} className="border-b border-border hover:bg-muted/30">
                            <td className="px-1.5 py-1.5 align-middle sm:px-2">
                              <span className="inline-flex min-w-7 items-center justify-center rounded-md bg-primary/20 px-1.5 py-0.5 text-[11px] font-semibold text-primary sm:text-xs">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="min-w-0 px-1.5 py-1.5 align-middle sm:px-2">
                              <select
                                value={row.type}
                                onChange={(e) =>
                                  setActiveScheduleRows((r) =>
                                    r.map((x) =>
                                      x.id === row.id ? { ...x, type: e.target.value as 'ders' | 'ogle' } : x,
                                    ),
                                  )
                                }
                                className="h-9 w-full min-w-0 max-w-full truncate rounded-md border border-input bg-background px-1 text-xs sm:px-2 sm:text-sm"
                              >
                                <option value="ders">Ders</option>
                                <option value="ogle">Öğle</option>
                              </select>
                            </td>
                            <td className="min-w-0 px-1.5 py-1.5 align-middle sm:px-2">
                              <Input
                                type="time"
                                value={row.startTime}
                                onChange={(e) =>
                                  setActiveScheduleRows((r) =>
                                    r.map((x) => (x.id === row.id ? { ...x, startTime: e.target.value } : x)),
                                  )
                                }
                                className="h-9 w-full min-w-0 max-w-full px-1 text-xs sm:text-sm"
                              />
                            </td>
                            <td className="min-w-0 px-1.5 py-1.5 align-middle sm:px-2">
                              <Input
                                type="time"
                                value={row.endTime}
                                onChange={(e) =>
                                  setActiveScheduleRows((r) =>
                                    r.map((x) => (x.id === row.id ? { ...x, endTime: e.target.value } : x)),
                                  )
                                }
                                className="h-9 w-full min-w-0 max-w-full px-1 text-xs sm:text-sm"
                              />
                            </td>
                            <td className="min-w-0 px-1.5 py-1.5 align-middle sm:px-2">
                              <div className="flex min-w-0 items-center gap-0.5">
                                <Input
                                  type="number"
                                  value={dur}
                                  readOnly
                                  className="h-9 min-w-0 flex-1 bg-green-50 px-1 text-xs tabular-nums dark:bg-green-950/20 sm:max-w-14"
                                />
                                <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">dk</span>
                              </div>
                            </td>
                            <td className="min-w-0 px-1.5 py-1.5 align-middle sm:px-2">
                              <Input
                                type="number"
                                min={0}
                                max={30}
                                value={row.breakMin}
                                onChange={(e) =>
                                  setActiveScheduleRows((r) =>
                                    r.map((x) =>
                                      x.id === row.id ? { ...x, breakMin: Number(e.target.value) || 0 } : x,
                                    ),
                                  )
                                }
                                className="h-9 w-full min-w-0 max-w-16 px-1 text-xs tabular-nums sm:text-sm"
                              />
                            </td>
                            <td className="px-1 py-1.5 text-center align-middle sm:px-2">
                              <button
                                type="button"
                                onClick={() => setActiveScheduleRows((r) => r.filter((x) => x.id !== row.id))}
                                className="rounded-full p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                                title="Sil"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border bg-muted/20 p-3 sm:p-4">
                  <Button
                    type="button"
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      const id = `row-${Date.now()}`;
                      setActiveScheduleRows((r) => {
                        const last = r[r.length - 1];
                        let start = '08:30';
                        if (last?.endTime) {
                          const endMin = parseTime(last.endTime);
                          const br = last.type === 'ogle' ? 0 : last.breakMin;
                          start = formatTime(endMin + br);
                        }
                        const end = formatTime(parseTime(start) + 40);
                        return [...r, { id, type: 'ders' as const, startTime: start, endTime: end, breakMin: 10 }];
                      });
                    }}
                  >
                    <Plus className="size-4" />
                    Ders Ekle
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => {
                      let cur = parseTime(schoolStart);
                      const rows: ScheduleRow[] = [];
                      for (let i = 1; i <= schoolMaxLessons; i++) {
                        if (lunchActive && i === LUNCH_AFTER_LESSON + 1) {
                          rows.push({
                            id: `row-${i}-lunch`,
                            type: 'ogle',
                            startTime: lunchStart,
                            endTime: lunchEnd,
                            breakMin: 0,
                          });
                          cur = parseTime(lunchEnd) + breakMin;
                        } else {
                          const end = cur + lessonMin;
                          rows.push({
                            id: `row-${i}`,
                            type: 'ders',
                            startTime: formatTime(cur),
                            endTime: formatTime(end),
                            breakMin,
                            lessonNum: i,
                          });
                          cur = end + breakMin;
                        }
                      }
                      setActiveScheduleRows(() => rows);
                      toast.success('Otomatik hesaplandı.');
                    }}
                  >
                    <Clock className="size-4" />
                    Otomatik Hesapla
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    onClick={() => {
                      setActiveScheduleRows(() => []);
                      toast.success('Temizlendi.');
                    }}
                  >
                    <Eraser className="size-4" />
                    Temizle
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Button onClick={handleSaveMeta} disabled={saving} size="sm" className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
            <Save className="size-4" />
            {saving ? 'Kaydediliyor…' : 'Programı Güncelle'}
          </Button>
          <p className="text-[11px] leading-snug text-muted-foreground sm:hidden">
            Ad, yıl, dönem ve saat çizelgesi bu düğmeyle kaydedilir.
          </p>
          <p className="hidden max-w-xl text-xs text-muted-foreground sm:block">
            Üst bilgiler ve saat çizelgesi bu düğmeyle kaydedilir; tablodan eklenen veya kaldırılan dersler hücre işlemiyle anında sunucuya yazılır.
          </p>
        </div>
      </div>

      {/* Haftalık Ders Programı Tablosu */}
      <Card
        ref={(el) => {
          sectionRefs.current.weekly = el;
        }}
        className="scroll-mt-36 overflow-hidden border-border shadow-md sm:scroll-mt-40"
      >
        <CardHeader className="border-b border-sky-200/50 bg-linear-to-r from-sky-500/8 via-card to-transparent px-3 py-3 dark:border-sky-900/40 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-700 shadow-inner dark:text-sky-300 sm:size-10">
              <Table2 className="size-[18px] sm:size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base font-bold sm:text-lg">Haftalık program</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Hücrelere dokunarak ders ekleyin veya kaldırın.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 table-x-scroll">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="min-w-32 rounded-tl-lg border-b border-r border-border px-2 py-2 text-left text-[11px] font-semibold text-foreground sm:min-w-36 sm:px-2.5 sm:py-2.5 sm:text-xs">SAAT</th>
                {DAYS_FULL.map((d) => (
                  <th key={d} className="min-w-21 border-b border-r border-border px-1.5 py-2 text-center text-[11px] font-semibold text-foreground last:border-r-0 sm:min-w-20 sm:px-2 sm:py-2.5 sm:text-xs">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, idx) => (
                <tr key={idx} className={cn('hover:bg-muted/15 transition-colors', slot.isLunch && 'bg-amber-50/30 dark:bg-amber-950/10')}>
                  <td className="border-b border-r border-border px-2 py-1.5 align-top sm:px-2.5 sm:py-2">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-medium text-muted-foreground sm:text-xs">{slot.timeRange}</div>
                      {!slot.isLunch &&
                        slot.lessonNum != null &&
                        (manualTimes
                          ? (() => {
                              const wd = getLessonRangeFromRows(scheduleRowsWeekday, slot.lessonNum);
                              const we = getLessonRangeFromRows(scheduleRowsWeekend, slot.lessonNum);
                              if (wd && we && wd !== we) {
                                return (
                                  <div className="text-[9px] leading-tight text-muted-foreground/90 sm:text-[10px]">
                                    Hafta sonu: {we}
                                  </div>
                                );
                              }
                              return null;
                            })()
                          : getTimeRangeForDay(6, slot.lessonNum) !== getTimeRangeForDay(1, slot.lessonNum) && (
                              <div className="text-[9px] leading-tight text-muted-foreground/90 sm:text-[10px]">
                                Hafta sonu: {getTimeRangeForDay(6, slot.lessonNum)}
                              </div>
                            ))}
                      <span
                        className={cn(
                          'inline-block rounded-md px-1.5 py-px text-[10px] font-semibold sm:px-2 sm:py-0.5 sm:text-xs',
                          slot.isLunch ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' : 'bg-primary/10 text-primary',
                        )}
                      >
                        {slot.label}
                      </span>
                    </div>
                  </td>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    if (slot.isLunch) {
                      return (
                        <td key={day} className="border-b border-r border-border bg-amber-50/20 p-1 align-top last:border-r-0 dark:bg-amber-950/5">
                          <div className="flex items-center justify-center rounded-md bg-amber-100/50 py-1.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 sm:py-2 sm:text-xs">
                            Öğle Tatili
                          </div>
                        </td>
                      );
                    }
                    const lessonNum = slot.lessonNum!;
                    const entry = getCellEntry(day, lessonNum);
                    return (
                      <td
                        key={day}
                        className="w-[min(100%,6rem)] min-w-21 border-b border-r border-border align-middle p-1 last:border-r-0 sm:min-w-20 sm:p-1.5"
                      >
                        {entry ? (
                          <div className="flex h-full min-h-14 w-full items-stretch justify-center sm:min-h-16">
                            <LessonCellCard
                              subject={resolveSchoolSubjectDisplay(entry.subject, schoolSubjects)}
                              classSection={entry.class_section}
                              timeRange={getCellTimeRange(day, lessonNum)}
                              onRemove={() => handleRemoveLesson(day, lessonNum)}
                              editable
                              teacherCell
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddModal({ day, lesson: lessonNum })}
                            className="flex h-full min-h-14 w-full max-w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/35 bg-muted/5 px-1.5 py-1.5 text-center text-muted-foreground transition-all hover:border-primary/45 hover:bg-primary/5 hover:text-primary touch-manipulation active:bg-primary/10 sm:min-h-16 sm:gap-1"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground ring-1 ring-border/50 sm:size-8">
                              <Plus className="size-3.5 sm:size-4" />
                            </span>
                            <span className="text-[9px] font-semibold uppercase leading-tight tracking-wide sm:text-[10px]">Ders ekle</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button variant="outline" size="sm" className="h-9" asChild>
          <Link href="/ders-programi/programlarim">Programlarım</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="size-4" />
          {deleting ? 'Siliniyor…' : 'Sil'}
        </Button>
      </div>

      <Dialog
        open={!!addModal}
        onOpenChange={(o) => {
          if (!o) {
            setAddModal(null);
            setAddSubjectId('');
          }
        }}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden [&>div:last-child]:p-0">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
                <Plus className="size-4" />
              </div>
              <h2 className="text-lg font-semibold">Ders Ekle</h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddModal(null);
                setAddSubjectId('');
              }}
              className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-2">
              <Label>Ders Seçin</Label>
              {schoolSubjects.length > 0 ? (
                <select
                  value={addSubjectId}
                  onChange={(e) => setAddSubjectId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Ders seçiniz…</option>
                  {schoolSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSchoolSubjectOptionLabel(s)}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={addSubject}
                  onChange={(e) => setAddSubject(e.target.value)}
                  placeholder="Ders adı (örn: Matematik, Türkçe)"
                />
              )}
            </div>
            <div className="space-y-2">
              <Label>Sınıf</Label>
              {schoolClasses.length > 0 ? (
                <select
                  value={addClassSection}
                  onChange={(e) => setAddClassSection(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Sınıf seçiniz…</option>
                  {schoolClasses.map((c) => (
                    <option key={c.id} value={c.name}>
                      {formatClassOptionLabel(c)}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={addClassSection}
                  onChange={(e) => setAddClassSection(e.target.value)}
                  placeholder="Sınıf (örn: 5-A, 10-B)"
                />
              )}
            </div>
            {addModal && (() => {
              const slot = timeSlots.find((s) => !s.isLunch && s.lessonNum === addModal.lesson);
              const dayName = DAY_NAMES[addModal.day] ?? '';
              return (
                <>
                  <div className="space-y-2">
                    <Label>Seçilen Zaman</Label>
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-foreground">
                      {dayName} - {slot?.label ?? addModal.lesson + '. Ders'} ({slot?.timeRange ?? '—'})
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Clock className="size-4 text-green-600" />
                        Başlangıç Saati
                      </Label>
                      <Input
                        type="time"
                        value={slot?.timeRange?.split(' - ')[0] ?? '08:30'}
                        className="h-9"
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground">Program ayarlarından otomatik doldurulur, değiştirebilirsiniz</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Clock className="size-4 text-destructive" />
                        Bitiş Saati
                      </Label>
                      <Input
                        type="time"
                        value={slot?.timeRange?.split(' - ')[1] ?? '09:10'}
                        className="h-9"
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground">Program ayarlarından otomatik doldurulur, değiştirebilirsiniz</p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="flex justify-end gap-2 px-4 pb-4">
            <Button
              variant="outline"
              onClick={() => {
                setAddModal(null);
                setAddSubjectId('');
              }}
            >
              İptal
            </Button>
            <Button onClick={handleAddLesson} disabled={saving} className="gap-2">
              <Check className="size-4" />
              {saving ? 'Ekleniyor…' : 'Dersi Ekle'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
