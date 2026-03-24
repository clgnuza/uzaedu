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
  FileEdit,
  Calendar,
  Clock,
  Sun,
  Info,
  Zap,
  AlertTriangle,
  Check,
  Eraser,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { useSchoolClassesSubjects } from '@/hooks/use-school-classes-subjects';
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
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const { timeSlots: schoolTimeSlots, maxLessons: schoolMaxLessons, settings: schoolSettings } = useSchoolTimetableSettings();
  const { classes: schoolClasses, subjects: schoolSubjects } = useSchoolClassesSubjects();

  const [program, setProgram] = useState<ProgramWithEntries | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addModal, setAddModal] = useState<{ day: number; lesson: number } | null>(null);
  const [addClassSection, setAddClassSection] = useState('');
  const [addSubject, setAddSubject] = useState('');
  const [schoolStart, setSchoolStart] = useState('08:30');
  const [schoolEnd, setSchoolEnd] = useState('17:30');
  const [lessonMin, setLessonMin] = useState(40);
  const [breakMin, setBreakMin] = useState(10);
  const [lunchStart, setLunchStart] = useState('12:30');
  const [lunchEnd, setLunchEnd] = useState('13:30');
  const [lunchActive, setLunchActive] = useState(true);
  const [manualTimes, setManualTimes] = useState(false);
  const [schoolInitDone, setSchoolInitDone] = useState(false);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
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

  const initScheduleRowsFromSlots = useCallback(
    (slots: Array<{ timeRange: string; lessonNum?: number; isLunch?: boolean }>) => {
      const rows: ScheduleRow[] = [];
      slots.forEach((slot, i) => {
        const [start, end] = slot.timeRange.split(' - ');
        rows.push({
          id: `row-${i}`,
          type: slot.isLunch ? 'ogle' : 'ders',
          startTime: (start ?? '').trim(),
          endTime: (end ?? '').trim(),
          breakMin: slot.isLunch ? 0 : 10,
          lessonNum: slot.lessonNum,
        });
      });
      setScheduleRows(rows);
    },
    [],
  );

  useEffect(() => {
    if (manualTimes && scheduleRows.length === 0) {
      const slots = schoolTimeSlots.map((s) => ({
        timeRange: s.timeRange,
        lessonNum: s.lessonNum,
        isLunch: s.isLunch,
      }));
      initScheduleRowsFromSlots(slots);
    }
  }, [manualTimes, schoolTimeSlots, scheduleRows.length, initScheduleRowsFromSlots]);

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
    if (manualTimes && scheduleRows.length > 0) {
      let lessonNum = 0;
      return scheduleRows.map((row) => {
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
  }, [manualTimes, scheduleRows, schoolStart, lessonMin, breakMin, lunchStart, lunchEnd, lunchActive, schoolTimeSlots, schoolMaxLessons]);

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
    const subject = addSubject.trim().slice(0, 128);
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

  return (
    <div className="space-y-6">
      {/* Sticky header + sekmeler */}
      <div className="sticky top-0 z-20 space-y-2 print:static">
        <div className="flex items-center justify-between rounded-t-xl bg-primary px-4 py-3 text-primary-foreground shadow-md print:shadow-none">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-white/20">
              <FileEdit className="size-5" />
            </div>
            <h1 className="text-lg font-semibold">
              Program Düzenle: {program.name}
            </h1>
          </div>
          <Button size="sm" asChild className="bg-white/90 hover:bg-white text-primary border-0 shadow-sm">
            <Link href="/ders-programi/programlarim" className="gap-2">
              <ArrowLeft className="size-4" />
              Geri Dön
            </Link>
          </Button>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 border border-border/50 print:hidden">
        <button
          type="button"
          onClick={() => scrollToSection('general')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeSection === 'general' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Genel Bilgiler
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('times')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeSection === 'times' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Ders Saatleri
        </button>
        <button
          type="button"
          onClick={() => scrollToSection('weekly')}
          className={cn(
            'flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            activeSection === 'weekly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Haftalık Program
        </button>
        </div>
      </div>

      <div className="space-y-6 rounded-b-xl border border-t-0 border-border p-4">
        {/* Program Bilgileri */}
        <section ref={(el) => { sectionRefs.current.general = el; }} className="space-y-4 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground">Genel Bilgiler</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                Program Adı <span className="text-destructive">*</span>
              </Label>
              <Input
                value={program.name}
                onChange={(e) => setProgram((p) => (p ? { ...p, name: e.target.value } : p))}
                placeholder="2024-2025 Haftalık Ders Programı"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                Akademik Yıl <span className="text-destructive">*</span>
              </Label>
              <Input
                value={program.academic_year}
                onChange={(e) => setProgram((p) => (p ? { ...p, academic_year: e.target.value } : p))}
                placeholder="2025-2026"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                Dönem <span className="text-destructive">*</span>
              </Label>
              <select
                value={program.term}
                onChange={(e) => setProgram((p) => (p ? { ...p, term: e.target.value } : p))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-4 py-2 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {allTermOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Okul Saatleri */}
        <section ref={(el) => { sectionRefs.current.times = el; }} className="space-y-4 scroll-mt-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Okul Saatleri
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label className="text-sm">Okul Başlangıç Saati *</Label>
              <Input type="time" value={schoolStart} onChange={(e) => setSchoolStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Okul Bitiş Saati *</Label>
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

        {/* Öğle Tatili */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sun className="size-4 text-muted-foreground" />
            Öğle Tatili
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* Günlük Ders Saatleri – referans: yeşil bar, sarı uyarı, toggle, tablo */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            Günlük Ders Saatleri
          </h2>
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-foreground flex gap-3 dark:bg-green-950/30 dark:border-green-800">
            <Zap className="size-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
            <span><strong>Otomatik Yerleştirme:</strong> Ders başlangıç/bitiş saatlerini veya teneffüs süresini değiştirdiğinizde, sonraki dersler otomatik olarak yeniden yerleştirilecektir.</span>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-foreground flex gap-3 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span><strong>Önemli:</strong> Günlük ders saatlerinde yaptığınız değişikliklerin haftalık program tablosuna tam olarak yansıması için &quot;Programı Güncelle&quot; butonuna tıklamanız gerekmektedir. Diğer değişiklikler otomatik kaydedilir ancak bu bölümdeki değişiklikler için ana güncelle butonunu kullanmalısınız.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={manualTimes}
              onClick={() => {
                if (manualTimes) setScheduleRows([]);
                setManualTimes(!manualTimes);
              }}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                manualTimes ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn('pointer-events-none block size-5 rounded-full bg-white shadow transition-transform', manualTimes ? 'translate-x-6' : 'translate-x-1')} />
            </button>
            <Label className="text-sm">Manuel ders saatleri kullan</Label>
          </div>
          <p className="text-xs text-muted-foreground">Bu seçenek aktifse, aşağıdaki ders saatlerini kullanacaksınız.</p>

          {manualTimes && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-muted/80 z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-20">Sıra No</th>
                        <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-32">Tür</th>
                        <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-28">Başlangıç</th>
                        <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-28">Bitiş</th>
                        <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-24 bg-green-50 dark:bg-green-950/20">Süre (dk)</th>
                        <th className="px-3 py-2.5 text-left font-semibold border-b border-border w-24">Teneffüs (dk)</th>
                        <th className="px-3 py-2.5 text-center font-semibold border-b border-border w-16">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleRows.map((row, idx) => {
                        const dur = row.startTime && row.endTime
                          ? Math.max(0, parseTime(row.endTime) - parseTime(row.startTime))
                          : 0;
                        return (
                          <tr key={row.id} className="border-b border-border hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center justify-center rounded-lg bg-primary/20 text-primary font-semibold px-2 py-1 text-xs">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={row.type}
                                onChange={(e) =>
                                  setScheduleRows((r) =>
                                    r.map((x) =>
                                      x.id === row.id ? { ...x, type: e.target.value as 'ders' | 'ogle' } : x,
                                    ),
                                  )
                                }
                                className="flex h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                              >
                                <option value="ders">Ders</option>
                                <option value="ogle">Öğle Tatili</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="time"
                                value={row.startTime}
                                onChange={(e) =>
                                  setScheduleRows((r) =>
                                    r.map((x) => (x.id === row.id ? { ...x, startTime: e.target.value } : x)),
                                  )
                                }
                                className="h-9"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="time"
                                value={row.endTime}
                                onChange={(e) =>
                                  setScheduleRows((r) =>
                                    r.map((x) => (x.id === row.id ? { ...x, endTime: e.target.value } : x)),
                                  )
                                }
                                className="h-9"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={dur}
                                  readOnly
                                  className="h-9 bg-green-50 dark:bg-green-950/20 w-16"
                                />
                                <span className="text-xs text-muted-foreground">dk</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                min={0}
                                max={30}
                                value={row.breakMin}
                                onChange={(e) =>
                                  setScheduleRows((r) =>
                                    r.map((x) =>
                                      x.id === row.id ? { ...x, breakMin: Number(e.target.value) || 0 } : x,
                                    ),
                                  )
                                }
                                className="h-9 w-20"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                type="button"
                                onClick={() => setScheduleRows((r) => r.filter((x) => x.id !== row.id))}
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
                <div className="flex flex-wrap gap-2 p-4 border-t border-border bg-muted/20">
                  <Button
                    type="button"
                    variant="default"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      const id = `row-${Date.now()}`;
                      const last = scheduleRows[scheduleRows.length - 1];
                      let start = '08:30';
                      if (last?.endTime) {
                        const endMin = parseTime(last.endTime);
                        const breakMin = last.type === 'ogle' ? 0 : last.breakMin;
                        start = formatTime(endMin + breakMin);
                      }
                      const end = formatTime(parseTime(start) + 40);
                      setScheduleRows((r) => [
                        ...r,
                        { id, type: 'ders', startTime: start, endTime: end, breakMin: 10 },
                      ]);
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
                      setScheduleRows(rows);
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
                      setScheduleRows([]);
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

        <Button onClick={handleSaveMeta} disabled={saving} size="sm">
          <Save className="size-4" />
          {saving ? 'Kaydediliyor…' : 'Programı Güncelle'}
        </Button>
      </div>

      {/* Haftalık Ders Programı Tablosu */}
      <Card ref={(el) => { sectionRefs.current.weekly = el; }} className="scroll-mt-4 border-border shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
              <Calendar className="size-5 text-primary" />
            </div>
            <CardTitle className="text-lg">Haftalık Ders Programı</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-3 text-left font-semibold text-foreground border-b border-r border-border min-w-[140px] rounded-tl-lg">SAAT</th>
                {DAYS_FULL.map((d) => (
                  <th key={d} className="px-2 py-3 text-center font-semibold text-foreground border-b border-r last:border-r-0 border-border min-w-[100px]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, idx) => (
                <tr key={idx} className={cn('hover:bg-muted/15 transition-colors', slot.isLunch && 'bg-amber-50/30 dark:bg-amber-950/10')}>
                  <td className="px-3 py-2.5 border-b border-r border-border align-top">
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">{slot.timeRange}</div>
                      <span
                        className={cn(
                          'inline-block rounded-lg px-2 py-0.5 text-xs font-semibold',
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
                        <td key={day} className="p-2 border-b border-r last:border-r-0 border-border align-top bg-amber-50/20 dark:bg-amber-950/5">
                          <div className="flex items-center justify-center rounded-lg bg-amber-100/50 dark:bg-amber-900/20 py-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                            Öğle Tatili
                          </div>
                        </td>
                      );
                    }
                    const lessonNum = slot.lessonNum!;
                    const entry = getCellEntry(day, lessonNum);
                    return (
                      <td key={day} className="p-2 border-b border-r last:border-r-0 border-border align-top min-h-[56px] min-w-[110px]">
                        {entry ? (
                          <LessonCellCard
                            subject={entry.subject}
                            classSection={entry.class_section}
                            timeRange={slot.timeRange}
                            onRemove={() => handleRemoveLesson(day, lessonNum)}
                            editable
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddModal({ day, lesson: lessonNum })}
                            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all text-xs font-medium"
                          >
                            <Plus className="size-3.5" />
                            Ders Ekle
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

      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <Link href="/ders-programi/programlarim">Programlarım</Link>
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="size-4" />
          {deleting ? 'Siliniyor…' : 'Programı Sil'}
        </Button>
      </div>

      <Dialog open={!!addModal} onOpenChange={(o) => !o && setAddModal(null)}>
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
              onClick={() => setAddModal(null)}
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
                  value={addSubject}
                  onChange={(e) => setAddSubject(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Ders seçiniz…</option>
                  {schoolSubjects.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
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
                      {c.name}
                      {c.grade != null ? ` · Sınıf ${c.grade}` : ''}
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
            <Button variant="outline" onClick={() => setAddModal(null)}>
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
