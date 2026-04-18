'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  CalendarDays,
  Bell,
  WifiOff,
  Clock,
  List,
  Minus,
  PlusCircle,
  Printer,
  Pencil,
  Sun,
  Download,
  Upload,
  Info,
  X,
  Copy,
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarRange,
  LayoutDashboard,
  Sparkles,
  GraduationCap,
  FileEdit,
  Building2,
  FolderKanban,
  Share2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { useSchoolClassesSubjects } from '@/hooks/use-school-classes-subjects';
import { useKazanimPlanMap } from '@/hooks/use-kazanim-plan-map';
import { apiFetch } from '@/lib/api';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LessonCellCard } from '@/components/ders-programi/lesson-cell-card';
import { TEACHER_WEEK_THEME } from '@/components/ders-programi/timetable-pastel-theme';
import { DersProgramiTeacherContextCard } from '@/components/ders-programi/ders-programi-teacher-context-card';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { buildDersProgramiIcs, shareOrDownloadIcs } from '@/lib/ders-programi-ics';
import { resolveSchoolSubjectDisplay } from '@/lib/school-subject-display';

type TimetableEntry = {
  user_id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

type TimetablePlan = {
  id: string;
  name: string | null;
  valid_from: string;
  valid_until: string | null;
  status: string;
  entry_count: number;
};

type TeacherInfo = { id: string; display_name: string | null; email: string };

type TeacherPersonalProgramListItem = {
  id: string;
  name: string;
  academic_year: string;
  term: string;
  total_hours: number;
  created_at: string;
  updated_at: string;
};

type PersonalProgramWithEntries = TeacherPersonalProgramListItem & {
  entries: TimetableEntry[];
};

/** API: user_id -> lesson_num -> { class_section, subject } */
type ByDateData = Record<string, Record<number, { class_section: string; subject: string }>>;

const DAYS_FULL = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR'];
const WEEKDAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DP_SELECTED_PERSONAL_KEY = 'dp_teacher_selected_personal_id';

/** Aylık takvim: güne tıklayınca o gün seçilir; seçilen günün ders listesi altta gösterilir */
function AdminTimetableCalendar({
  selectedDate,
  onSelectDate,
  monthState,
  onMonthChange,
  byDateData,
  getTeacherName,
  todayYMD,
  subjectDisplay = (s: string) => s,
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  monthState: { year: number; month: number };
  onMonthChange: (s: { year: number; month: number }) => void;
  byDateData: ByDateData | null;
  getTeacherName: (id: string) => string;
  todayYMD: string;
  subjectDisplay?: (subject: string) => string;
}) {
  const firstDay = new Date(monthState.year, monthState.month, 1);
  const lastDay = new Date(monthState.year, monthState.month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => {
    if (monthState.month === 0) onMonthChange({ year: monthState.year - 1, month: 11 });
    else onMonthChange({ year: monthState.year, month: monthState.month - 1 });
  };
  const nextMonth = () => {
    if (monthState.month === 11) onMonthChange({ year: monthState.year + 1, month: 0 });
    else onMonthChange({ year: monthState.year, month: monthState.month + 1 });
  };

  const monthLabel = new Date(monthState.year, monthState.month).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const dayLabels = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const cells: { dateStr: string | null; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ dateStr: null, isCurrentMonth: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthState.year}-${String(monthState.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ dateStr, isCurrentMonth: true });
  }
  const remainder = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < remainder; i++) cells.push({ dateStr: null, isCurrentMonth: false });

  type CalendarLessonRow = {
    lessonNum: string;
    lessonNumNum: number;
    teacher: string;
    classSection: string;
    subject: string;
  };

  const lessonRows = useMemo((): CalendarLessonRow[] => {
    if (!byDateData || Object.keys(byDateData).length === 0) return [];
    const rows: CalendarLessonRow[] = Object.entries(byDateData).flatMap(([uid, lessons]) =>
      Object.entries(lessons).map(([ln, data]) => ({
        lessonNum: ln,
        lessonNumNum: Number(ln),
        teacher: getTeacherName(uid),
        classSection: data.class_section,
        subject: data.subject,
      })),
    );
    rows.sort((a, b) => {
      if (a.lessonNumNum !== b.lessonNumNum) return a.lessonNumNum - b.lessonNumNum;
      const t = a.teacher.localeCompare(b.teacher, 'tr');
      if (t !== 0) return t;
      const c = String(a.classSection).localeCompare(String(b.classSection), 'tr', { numeric: true });
      if (c !== 0) return c;
      return String(a.subject).localeCompare(String(b.subject), 'tr');
    });
    return rows;
  }, [byDateData, getTeacherName]);

  const { lessonGroups, orderedSlots } = useMemo(() => {
    const m = new Map<number, CalendarLessonRow[]>();
    for (const r of lessonRows) {
      const k = r.lessonNumNum;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    const slots = [...m.keys()].sort((a, b) => a - b);
    return { lessonGroups: m, orderedSlots: slots };
  }, [lessonRows]);

  const selectedPretty = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-w-0 space-y-3 sm:space-y-5">
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-violet-200/45 bg-linear-to-br from-violet-500/12 via-background to-fuchsia-500/6 p-3 shadow-sm ring-1 ring-violet-500/10 dark:border-violet-800/45 dark:from-violet-950/40 dark:to-fuchsia-950/20 sm:rounded-2xl sm:p-4">
        <div className="pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-fuchsia-400/15 blur-3xl dark:bg-fuchsia-500/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-10 left-0 size-32 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/15" aria-hidden />
        <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex min-w-0 gap-2 sm:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 text-violet-700 shadow-inner ring-1 ring-violet-500/25 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-500/35 sm:size-12 sm:rounded-2xl">
              <CalendarRange className="size-5 sm:size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold leading-tight tracking-tight text-foreground sm:text-lg">Ay görünümü</h3>
              <p className="mt-0.5 line-clamp-2 max-w-md text-[11px] leading-snug text-muted-foreground sm:line-clamp-none sm:text-sm sm:leading-relaxed">
                Takvimden bir gün seçin; seçilen tarihe göre o günkü ders dağılımı aşağıda listelenir.
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex max-w-full min-w-0 items-center justify-center gap-1 rounded-2xl border border-violet-200/60 bg-background/90 px-1 py-1 shadow-sm backdrop-blur-sm dark:border-violet-800/60 dark:bg-background/50">
              <Button variant="ghost" size="sm" className="h-10 w-10 shrink-0 rounded-xl p-0 hover:bg-violet-500/10" onClick={prevMonth} aria-label="Önceki ay">
                <ChevronLeft className="size-5 text-violet-700 dark:text-violet-300" />
              </Button>
              <span className="min-w-0 flex-1 truncate px-1 text-center text-sm font-bold capitalize text-foreground sm:px-2 sm:text-base" title={monthLabel}>
                {monthLabel}
              </span>
              <Button variant="ghost" size="sm" className="h-10 w-10 shrink-0 rounded-xl p-0 hover:bg-violet-500/10" onClick={nextMonth} aria-label="Sonraki ay">
                <ChevronRight className="size-5 text-violet-700 dark:text-violet-300" />
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSelectDate(todayYMD)}
              className="h-10 w-full shrink-0 border-violet-300/70 bg-background/80 text-violet-800 hover:bg-violet-500/10 sm:w-auto dark:border-violet-700 dark:text-violet-200"
            >
              <Calendar className="mr-2 size-4 shrink-0" />
              Bugüne git
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground sm:text-xs">
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-violet-500 shadow-sm ring-2 ring-violet-300/50 dark:ring-violet-600/40" aria-hidden />
          Bugün
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-fuchsia-600 shadow-sm ring-2 ring-fuchsia-300/40 dark:ring-fuchsia-700/40" aria-hidden />
          Seçili gün
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-muted-foreground/35" aria-hidden />
          Hafta sonu
        </span>
      </div>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-violet-200/40 bg-card shadow-lg ring-1 ring-violet-500/10 dark:border-violet-800/50">
        <div className="grid min-w-0 grid-cols-7 gap-px bg-violet-950/10 dark:bg-violet-950/30">
          {dayLabels.map((l, idx) => (
            <div
              key={l}
              className={cn(
                'py-3 text-center text-[11px] font-bold uppercase tracking-wider sm:text-xs',
                idx === 5 || idx === 6
                  ? 'bg-violet-100/50 text-violet-600/80 dark:bg-violet-950/50 dark:text-violet-400/90'
                  : 'bg-violet-50/40 text-foreground dark:bg-violet-950/25',
              )}
            >
              {l}
            </div>
          ))}
          {cells.map((c, i) => {
            if (!c.dateStr) return <div key={i} className="min-h-15 bg-muted/5 sm:min-h-16" />;
            const isSelected = c.dateStr === selectedDate;
            const isToday = c.dateStr === todayYMD;
            const day = parseInt(c.dateStr.slice(8), 10);
            const dayOfWeek = new Date(c.dateStr + 'T12:00:00').getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSelectDate(c.dateStr!)}
                className={cn(
                  'group relative flex min-h-15 flex-col items-center justify-center gap-0.5 bg-card transition-all sm:min-h-17',
                  !c.isCurrentMonth && 'opacity-35',
                  isWeekend && c.isCurrentMonth && !isSelected && 'bg-violet-50/30 dark:bg-violet-950/20',
                  isSelected &&
                    'z-1 bg-linear-to-br from-fuchsia-600 to-violet-600 text-white shadow-md ring-2 ring-fuchsia-400/60 dark:from-fuchsia-500 dark:to-violet-600',
                  isToday &&
                    !isSelected &&
                    'ring-2 ring-violet-400/50 ring-offset-2 ring-offset-background dark:ring-violet-500/45 dark:ring-offset-background',
                  !isSelected && !isToday && 'hover:z-1 hover:bg-violet-500/8',
                )}
              >
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums sm:text-base',
                    isSelected && 'drop-shadow-sm',
                  )}
                >
                  {day}
                </span>
                {isToday && !isSelected && (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">Bugün</span>
                )}
                {isSelected && (
                  <span className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-white/90 shadow-sm" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <section className="min-w-0 overflow-hidden rounded-2xl border border-violet-200/40 bg-linear-to-b from-violet-500/7 to-card shadow-md ring-1 ring-violet-500/10 dark:border-violet-900/45 dark:from-violet-950/35">
          <div className="flex min-w-0 flex-col gap-3 border-b border-violet-200/35 bg-linear-to-r from-violet-500/15 to-fuchsia-500/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-violet-900/40">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-violet-300/50 bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 dark:border-violet-700 dark:text-violet-200">
                  Seçilen gün
                </span>
                {lessonRows.length > 0 && (
                  <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-200">
                    {orderedSlots.length} saat · {lessonRows.length} ders
                  </span>
                )}
              </div>
              <h4 className="mt-2 wrap-break-word text-lg font-bold capitalize leading-tight text-foreground sm:text-xl">{selectedPretty}</h4>
            </div>
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <GraduationCap className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
              <span className="min-w-0 leading-snug wrap-break-word">Okul programına göre o günün dersleri</span>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {lessonRows.length > 0 ? (
              <div className="space-y-6">
                <p className="text-[11px] text-muted-foreground sm:text-xs">Sıra: ders saati → öğretmen → sınıf</p>
                {orderedSlots.map((slotNum) => {
                  const items = lessonGroups.get(slotNum) ?? [];
                  return (
                    <section
                      key={slotNum}
                      aria-labelledby={`cal-slot-${slotNum}`}
                      className="overflow-hidden rounded-2xl border border-violet-200/40 bg-violet-500/5 dark:border-violet-800/40 dark:bg-violet-950/20"
                    >
                      <div
                        id={`cal-slot-${slotNum}`}
                        className="flex items-center justify-between gap-2 border-b border-violet-200/35 bg-linear-to-r from-violet-500/12 to-transparent px-3 py-2.5 dark:border-violet-800/50"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-sm font-bold text-white shadow-md dark:from-violet-500 dark:to-fuchsia-600">
                            {slotNum}
                          </span>
                          <div className="min-w-0">
                            <h5 className="text-sm font-bold text-foreground">{slotNum}. ders saati</h5>
                            <p className="text-[11px] text-muted-foreground">{items.length} kayıt</p>
                          </div>
                        </div>
                      </div>
                      <ul className="divide-y divide-violet-200/30 dark:divide-violet-800/40">
                        {items.map((item, idx) => (
                          <li
                            key={`${slotNum}-${item.teacher}-${item.classSection}-${item.subject}-${idx}`}
                            className="flex gap-3 px-3 py-2.5 sm:px-4"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="wrap-break-word font-semibold text-foreground">{item.teacher}</p>
                              <p className="mt-0.5 wrap-break-word text-sm text-muted-foreground">
                                <span className="font-medium text-violet-700 dark:text-violet-300">{item.classSection}</span>
                                <span className="mx-1.5 text-border">·</span>
                                <span>{subjectDisplay(item.subject)}</span>
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-violet-300/50 bg-violet-500/5 px-4 py-12 text-center dark:border-violet-800/50">
                <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
                  <CalendarRange className="size-7 opacity-80" />
                </div>
                <p className="text-base font-medium text-foreground">Bu gün için ders kaydı yok</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Hafta sonu olabilir veya programa henüz eklenmemiş bir gün seçtiniz. Başka bir tarihe tıklayarak deneyin.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function EmptySlotIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 rounded-lg py-2 text-muted-foreground/50',
        'border border-dashed border-muted-foreground/25 bg-muted/30',
        className,
      )}
      aria-hidden
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-muted/60">
        <Minus className="size-3" strokeWidth={2.5} />
      </span>
      <span className="text-[10px]">Boş</span>
    </span>
  );
}

export default function DersProgramiAnaPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const { timeSlots, educationMode, getTimeRangeForDay, getTimeSlotsForDay } = useSchoolTimetableSettings();
  const { subjects: schoolSubjects } = useSchoolClassesSubjects();
  const [entries, setEntries] = useState<TimetableEntry[] | null>(null);
  const [schoolEntries, setSchoolEntries] = useState<TimetableEntry[] | null>(null);
  const [planInfo, setPlanInfo] = useState<{ plan_id?: string; name?: string | null; valid_from: string; valid_until: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [teacherPersonalPrograms, setTeacherPersonalPrograms] = useState<TeacherPersonalProgramListItem[]>([]);
  const [teacherProgramTab, setTeacherProgramTab] = useState<'personal' | 'school'>('personal');
  const [selectedPersonalProgramId, setSelectedPersonalProgramId] = useState<string | null>(null);
  const [personalProgramFull, setPersonalProgramFull] = useState<PersonalProgramWithEntries | null>(null);
  const [personalDetailLoading, setPersonalDetailLoading] = useState(false);

  const isAdmin = me?.role === 'school_admin';
  const isTeacher = me?.role === 'teacher';
  const { getKazanimHref, academicYear } = useKazanimPlanMap(token, !!isTeacher);

  const todayYMD = new Date().toISOString().slice(0, 10);
  const [adminPlans, setAdminPlans] = useState<TimetablePlan[]>([]);
  const [adminSelectedDate, setAdminSelectedDate] = useState(todayYMD);
  const [adminByDateData, setAdminByDateData] = useState<ByDateData | null>(null);
  const [adminByDateLoading, setAdminByDateLoading] = useState(false);
  const [adminTeachers, setAdminTeachers] = useState<TeacherInfo[]>([]);
  const [adminViewTab, setAdminViewTab] = useState<'summary' | 'daily' | 'calendar'>('summary');
  const [adminCalendarMonth, setAdminCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const setAdminViewTabWithCalendarSync = (tab: 'summary' | 'daily' | 'calendar') => {
    setAdminViewTab(tab);
    if (tab === 'calendar') {
      const [y, m] = adminSelectedDate.split('-').map(Number);
      setAdminCalendarMonth({ year: y, month: (m ?? 1) - 1 });
    }
  };

  useEffect(() => {
    if (!token || !me?.school_id) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        if (isAdmin) {
          const data = await apiFetch<TimetableEntry[]>('/teacher-timetable', { token });
          setEntries(Array.isArray(data) ? data : []);
          const [info, plansList, teachersList] = await Promise.all([
            apiFetch<{ plan_id?: string; name?: string | null; valid_from: string; valid_until: string | null } | null>('/teacher-timetable/plan-info', { token }).catch(() => null),
            apiFetch<TimetablePlan[]>('/teacher-timetable/plans', { token }).catch(() => []),
            apiFetch<TeacherInfo[]>('/duty/teachers?includeExempt=true', { token }).catch(() => []),
          ]);
          setPlanInfo(info ?? null);
          setAdminPlans(
            Array.isArray(plansList)
              ? plansList
                  .filter((p) => p.status === 'published' || p.status === 'archived')
                  .sort((a, b) => a.valid_from.localeCompare(b.valid_from))
              : [],
          );
          setAdminTeachers(Array.isArray(teachersList) ? teachersList : []);
          setTeacherPersonalPrograms([]);
        } else {
          const [meData, myPrograms] = await Promise.all([
            apiFetch<TimetableEntry[]>('/teacher-timetable/me', { token }),
            apiFetch<TeacherPersonalProgramListItem[]>('/teacher-timetable/my-programs', { token }).catch(() => []),
          ]);
          setSchoolEntries(Array.isArray(meData) ? meData : []);
          setEntries(null);
          setTeacherPersonalPrograms(Array.isArray(myPrograms) ? myPrograms : []);
        }
      } catch {
        if (isAdmin) {
          setEntries([]);
        } else {
          setSchoolEntries([]);
          setEntries(null);
        }
        setPlanInfo(null);
        setAdminPlans([]);
        setTeacherPersonalPrograms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, isAdmin, me?.school_id]);

  useEffect(() => {
    if (!isTeacher) return;
    if (teacherPersonalPrograms.length === 0) {
      setSelectedPersonalProgramId(null);
      return;
    }
    setSelectedPersonalProgramId((prev) => {
      if (prev && teacherPersonalPrograms.some((p) => p.id === prev)) return prev;
      const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(DP_SELECTED_PERSONAL_KEY) : null;
      if (stored && teacherPersonalPrograms.some((p) => p.id === stored)) return stored;
      const sorted = [...teacherPersonalPrograms].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      return sorted[0]!.id;
    });
  }, [isTeacher, teacherPersonalPrograms]);

  useEffect(() => {
    if (!token || !isTeacher || !selectedPersonalProgramId) {
      setPersonalProgramFull(null);
      setPersonalDetailLoading(false);
      return;
    }
    let cancelled = false;
    setPersonalDetailLoading(true);
    apiFetch<PersonalProgramWithEntries>(`/teacher-timetable/my-programs/${selectedPersonalProgramId}`, { token })
      .then((data) => {
        if (!cancelled) setPersonalProgramFull(data);
      })
      .catch(() => {
        if (!cancelled) setPersonalProgramFull(null);
      })
      .finally(() => {
        if (!cancelled) setPersonalDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, isTeacher, selectedPersonalProgramId]);

  useEffect(() => {
    if (!token || !isTeacher || !me?.school_id) return;
    const key = 'dp_teacher_program_overview_toast';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{
          has_school_and_personal: boolean;
          personal_program_count: number;
          personal_slot_conflicts: Array<{ day_of_week: number; lesson_num: number }>;
        }>('/teacher-timetable/me/program-overview', { token });
        if (cancelled) return;
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
        if (res.has_school_and_personal) {
          toast.info(
            'Haftalık tabloda önce kişisel planınız açılır. Okul (idare) atamanızı üstteki «Okul programı» ile görebilirsiniz.',
            { duration: 8000 },
          );
        }
        if (res.personal_slot_conflicts.length > 0) {
          toast.warning(
            `Kişisel programlarınızda ${res.personal_slot_conflicts.length} saatte çakışma var (aynı gün ve ders saatinde farklı sınıf/ders). Programları düzenleyerek tek tanım bırakın.`,
            { duration: 12000 },
          );
        } else if (res.personal_program_count >= 2) {
          toast.info('Birden fazla kişisel programınız var; her biri ayrı kayıttır.', { duration: 7000 });
        }
      } catch {
        /* sessiz */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isTeacher, me?.school_id]);

  useEffect(() => {
    if (!token || !isAdmin || !me?.school_id) return;
    setAdminByDateData(null);
    setAdminByDateLoading(true);
    apiFetch<ByDateData>(`/teacher-timetable/by-date?date=${adminSelectedDate}`, { token })
      .then((d) => { setAdminByDateData(d); setAdminByDateLoading(false); })
      .catch(() => { setAdminByDateData(null); setAdminByDateLoading(false); });
  }, [token, isAdmin, me?.school_id, adminSelectedDate]);

  const shiftAdminDate = (delta: number) => {
    const d = new Date(adminSelectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setAdminSelectedDate(d.toISOString().slice(0, 10));
  };

  const adminSelectedDayOfWeek = useMemo(() => {
    const d = new Date(adminSelectedDate + 'T12:00:00').getDay();
    return d === 0 ? 7 : d;
  }, [adminSelectedDate]);

  const publishedPlans = adminPlans;
  const currentPlanIndex = publishedPlans.findIndex((p) => {
    const sel = adminSelectedDate;
    return p.valid_from <= sel && (!p.valid_until || p.valid_until >= sel);
  });
  const prevPlan = currentPlanIndex > 0 ? publishedPlans[currentPlanIndex - 1] : null;
  const nextPlan = currentPlanIndex >= 0 && currentPlanIndex < publishedPlans.length - 1 ? publishedPlans[currentPlanIndex + 1] : null;
  const goToPlan = (plan: TimetablePlan) => setAdminSelectedDate(plan.valid_from);

  const getTeacherName = (userId: string) =>
    adminTeachers.find((t) => t.id === userId)?.display_name || adminTeachers.find((t) => t.id === userId)?.email || '—';

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const weekdayStr = WEEKDAY_NAMES[now.getDay()];
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const todayDayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const viewTimetableEntries = useMemo((): TimetableEntry[] | null => {
    if (!isTeacher) return entries;
    if (teacherProgramTab === 'personal') return personalProgramFull?.entries ?? [];
    return schoolEntries ?? [];
  }, [isTeacher, teacherProgramTab, personalProgramFull, schoolEntries, entries]);

  const getCellEntry = (day: number, lesson: number) =>
    viewTimetableEntries?.find((e) => e.day_of_week === day && e.lesson_num === lesson) ?? null;

  const todayCount = useMemo(() => {
    if (!viewTimetableEntries) return 0;
    return viewTimetableEntries.filter((e) => e.day_of_week === todayDayOfWeek).length;
  }, [viewTimetableEntries, todayDayOfWeek]);

  const totalCount = viewTimetableEntries?.length ?? 0;

  const teacherCount = useMemo(() => {
    if (!entries?.length) return 0;
    return new Set(entries.map((e) => e.user_id)).size;
  }, [entries]);

  const isClassTime = useMemo(() => {
    if (!viewTimetableEntries?.length || !timeSlots.length) return false;
    const todayEntries = viewTimetableEntries.filter((e) => e.day_of_week === todayDayOfWeek);
    for (const e of todayEntries) {
      const range = getTimeRangeForDay(todayDayOfWeek, e.lesson_num);
      const [startStr, endStr] = range.split(' - ').map((s) => s?.trim() ?? '');
      if (!startStr || !endStr) continue;
      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr.split(':').map(Number);
      const startM = (sh ?? 0) * 60 + (sm ?? 0);
      const endM = (eh ?? 0) * 60 + (em ?? 0);
      if (currentMinutes >= startM && currentMinutes < endM) return true;
    }
    return false;
  }, [viewTimetableEntries, timeSlots.length, todayDayOfWeek, currentMinutes, getTimeRangeForDay]);

  const programTitle = (() => {
    if (loading) return 'Yükleniyor…';
    if (isTeacher && teacherProgramTab === 'personal') {
      if (personalDetailLoading && teacherPersonalPrograms.length > 0) return 'Yükleniyor…';
      return personalProgramFull?.name?.trim() ? personalProgramFull.name : 'Kişisel program';
    }
    if (isTeacher && teacherProgramTab === 'school') return `${academicYear} Okul (İdare) Programı`;
    return `${academicYear} Haftalık Ders Programı`;
  })();

  const printListTitle =
    isTeacher && teacherProgramTab === 'school'
      ? 'İdare (okul) programı'
      : isTeacher
        ? 'Haftalık ders programı'
        : 'Okul ders programı';

  const printTitleBackupRef = useRef<string | null>(null);
  useEffect(() => {
    const onBefore = () => {
      printTitleBackupRef.current = document.title;
      document.title = `Ders programı — ${programTitle} (${academicYear}) · Uzaedu Öğretmen`;
    };
    const onAfter = () => {
      if (printTitleBackupRef.current != null) document.title = printTitleBackupRef.current;
      printTitleBackupRef.current = null;
    };
    window.addEventListener('beforeprint', onBefore);
    window.addEventListener('afterprint', onAfter);
    return () => {
      window.removeEventListener('beforeprint', onBefore);
      window.removeEventListener('afterprint', onAfter);
    };
  }, [programTitle, academicYear]);

  const duzenleHref =
    isAdmin
      ? '/ders-programi/programlarim'
      : selectedPersonalProgramId
        ? `/ders-programi/olustur/${selectedPersonalProgramId}`
        : teacherPersonalPrograms.length === 1
          ? `/ders-programi/olustur/${teacherPersonalPrograms[0]!.id}`
          : '/ders-programi/programlarim';

  const teacherTabContentLoading =
    isTeacher &&
    teacherProgramTab === 'personal' &&
    teacherPersonalPrograms.length > 0 &&
    !!selectedPersonalProgramId &&
    personalDetailLoading;

  const handleImportFromAdmin = async () => {
    if (!token || !schoolEntries?.length || importing) return;
    setImporting(true);
    try {
      const res = await apiFetch<{ id: string }>('/teacher-timetable/import-from-admin', {
        token,
        method: 'POST',
      });
      toast.success('İdare programı kendi programlarınıza aktarıldı. Düzenleyebilirsiniz.');
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DP_SELECTED_PERSONAL_KEY, res.id);
      router.push(`/ders-programi/olustur/${res.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Aktarılamadı';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const [calendarExporting, setCalendarExporting] = useState(false);

  const handleAddToCalendar = async () => {
    if (!viewTimetableEntries?.length || !timeSlots.length || calendarExporting) return;
    setCalendarExporting(true);
    try {
      const icsCalName =
        programTitle === 'Yükleniyor…' || programTitle.startsWith('Yükleniyor')
          ? `${academicYear} Ders Programı`
          : programTitle;
      const ics = buildDersProgramiIcs(
        viewTimetableEntries.map((e) => ({
          day_of_week: e.day_of_week,
          lesson_num: e.lesson_num,
          class_section: e.class_section,
          subject: e.subject,
        })),
        getTimeRangeForDay,
        { calName: icsCalName, academicYearLabel: academicYear },
      );
      if (!ics.includes('BEGIN:VEVENT')) {
        toast.error('Takvim için uygun ders saati bulunamadı.');
        return;
      }
      const filename = `ders-programi-${academicYear}.ics`;
      const via = await shareOrDownloadIcs(ics, filename);
      toast.success(
        via === 'share'
          ? 'Paylaşım menüsünden Takvim uygulamasını seçin.'
          : 'Takvim dosyası indirildi.',
      );
      setCalendarModalOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setCalendarExporting(false);
    }
  };

  return (
    <div className="ders-programi-print-root mx-auto w-full min-w-0 max-w-6xl space-y-2 sm:space-y-4">
      {/* Üst özet: yönetici şerit / öğretmen tek bilgi kartı */}
      {isAdmin ? (
        <div className="print:hidden">
          <DersProgramiTeacherContextCard
            dateStr={dateStr}
            weekdayStr={weekdayStr}
            timeStr={timeStr}
            educationModeLabel={educationMode === 'double' ? 'İkili eğitim' : 'Tekli eğitim'}
            isClassTime={isClassTime}
            todayLessons={todayCount}
            weekTotalSlots={totalCount}
            academicYear={academicYear}
            extraBadges={
              <>
                <span className="rounded-full border border-violet-300/45 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-900 dark:border-violet-700 dark:text-violet-200">
                  Okul yönetimi
                </span>
                {!loading ? (
                  <span className="rounded-full bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold text-violet-900 dark:text-violet-200">
                    {teacherCount} öğretmen
                  </span>
                ) : null}
              </>
            }
            statsSlot={
              <>
                <p className="text-[11px] leading-tight text-muted-foreground sm:hidden">
                  Bugün <span className="font-semibold tabular-nums text-foreground">{todayCount}</span> saat ·{' '}
                  <span className="font-semibold tabular-nums text-foreground">{totalCount}</span> kayıt
                </p>
                <p className="hidden wrap-break-word text-xs leading-snug text-muted-foreground sm:block sm:text-sm">
                  Bugün <span className="font-semibold tabular-nums text-foreground">{todayCount}</span> ders saati (tüm öğretmenler)
                  {' · '}
                  Toplam <span className="font-semibold tabular-nums text-foreground">{totalCount}</span> program kaydı
                </p>
              </>
            }
          >
            <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-[11px] sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
              <Link href="/ders-programi/olustur" className="justify-center">
                <Upload className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate">Excel</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 px-2 text-[11px] sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
              <Link href="/ders-programi/programlarim" className="justify-center">
                <Users className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate max-sm:hidden">Öğretmen programları</span>
                <span className="truncate sm:hidden">Programlar</span>
              </Link>
            </Button>
          </DersProgramiTeacherContextCard>
        </div>
      ) : (
        <div className="print:hidden">
          <DersProgramiTeacherContextCard
            dateStr={dateStr}
            weekdayStr={weekdayStr}
            timeStr={timeStr}
            educationModeLabel={educationMode === 'double' ? 'İkili eğitim' : 'Tekli eğitim'}
            isClassTime={isClassTime}
            todayLessons={todayCount}
            weekTotalSlots={totalCount}
            academicYear={academicYear}
          >
            <Button variant="outline" size="sm" className="h-8 w-full max-w-full gap-1.5 px-2 text-[11px] sm:h-9 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm" asChild>
              <Link href="/kazanim-takip" className="justify-center">
                <List className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate">Kazanımlar</span>
              </Link>
            </Button>
          </DersProgramiTeacherContextCard>
        </div>
      )}

      {/* Haftalık Ders Programı - Öğretmen için grid, admin için özet */}
      <Card className="ders-programi-print-card ders-programi-print-on-paper min-w-0 max-w-full overflow-hidden rounded-xl border-border shadow-md">
        {isAdmin ? (
          <CardHeader className="min-w-0 space-y-1.5 overflow-hidden border-b border-border/70 bg-linear-to-r from-sky-500/6 via-muted/20 to-transparent px-2.5 py-2 print:hidden sm:space-y-3 sm:px-6 sm:py-4">
            <nav className="w-full min-w-0" aria-label="Okul programı görünümü">
              <div
                role="tablist"
                className="flex w-full min-w-0 gap-1 overflow-x-auto overflow-y-hidden rounded-xl border-2 border-sky-200/90 bg-sky-50/90 p-1 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] dark:border-sky-900/60 dark:bg-sky-950/35 [&::-webkit-scrollbar]:hidden sm:gap-1 sm:overflow-visible"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={adminViewTab === 'summary'}
                  onClick={() => setAdminViewTabWithCalendarSync('summary')}
                  className={cn(
                    'flex min-h-9 min-w-0 flex-1 basis-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-center text-xs font-bold transition-all sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm',
                    adminViewTab === 'summary'
                      ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-500/40 dark:bg-sky-500 dark:ring-sky-300/30'
                      : 'border border-transparent bg-white/70 text-sky-900/75 hover:border-sky-300/80 hover:bg-white dark:bg-sky-950/50 dark:text-sky-100/80 dark:hover:border-sky-700',
                  )}
                >
                  <LayoutDashboard className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  <span className="min-w-0 truncate leading-tight">Özet</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={adminViewTab === 'daily'}
                  onClick={() => setAdminViewTabWithCalendarSync('daily')}
                  className={cn(
                    'flex min-h-9 min-w-0 flex-1 basis-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-center text-xs font-bold transition-all sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm',
                    adminViewTab === 'daily'
                      ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/40 dark:bg-emerald-500 dark:ring-emerald-300/30'
                      : 'border border-transparent bg-white/70 text-emerald-900/75 hover:border-emerald-300/80 hover:bg-white dark:bg-emerald-950/40 dark:text-emerald-100/80 dark:hover:border-emerald-800',
                  )}
                >
                  <Clock className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  <span className="min-w-0 truncate leading-tight">
                    <span className="sm:hidden">Günlük</span>
                    <span className="hidden sm:inline">Günlük tablo</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={adminViewTab === 'calendar'}
                  onClick={() => setAdminViewTabWithCalendarSync('calendar')}
                  className={cn(
                    'flex min-h-9 min-w-0 flex-1 basis-0 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-center text-xs font-bold transition-all sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm',
                    adminViewTab === 'calendar'
                      ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-500/40 dark:bg-violet-500 dark:ring-violet-300/30'
                      : 'border border-transparent bg-white/70 text-violet-900/75 hover:border-violet-300/80 hover:bg-white dark:bg-violet-950/40 dark:text-violet-100/80 dark:hover:border-violet-800',
                  )}
                >
                  <CalendarRange className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  <span className="min-w-0 truncate leading-tight">Takvim</span>
                </button>
              </div>
              <p className="mt-1.5 hidden text-[11px] leading-snug text-muted-foreground sm:block">
                {adminViewTab === 'summary' && 'Yayınlanan planlar ve kısayollar.'}
                {adminViewTab === 'daily' && 'Seçilen gün için saatlik öğretmen dağılımı.'}
                {adminViewTab === 'calendar' && 'Ay görünümü; güne tıklayınca detay aşağıda.'}
              </p>
            </nav>

            <div className="min-w-0">
              <div className="flex items-start gap-2 sm:gap-2.5">
                <div className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 sm:flex dark:text-sky-300">
                  <CalendarDays className="size-[17px]" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:border-sky-600/50 dark:text-sky-200">
                      {academicYear}
                    </span>
                    {!loading && entries && entries.length > 0 ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {teacherCount} öğretmen · {totalCount} kayıt
                      </span>
                    ) : null}
                  </div>
                  <CardTitle className="mt-0.5 wrap-break-word text-sm font-bold leading-tight sm:mt-1 sm:text-lg">{programTitle}</CardTitle>
                  <p className="mt-1 hidden text-xs leading-snug text-muted-foreground sm:line-clamp-2 sm:block">
                    Okul ders programı: özet, günlük saatlik görünüm veya takvim ile tüm öğretmen dağılımını izleyin.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex w-full min-w-0 flex-wrap gap-1 sm:justify-end sm:gap-1.5">
              <Button
                variant="outline"
                size="sm"
                title="Yazdır"
                className="h-8 min-w-0 shrink gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
                onClick={() => window.print()}
              >
                <Printer className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate">Yazdır</span>
              </Button>
              <Button variant="outline" size="sm" title="Excel yükle" className="h-8 min-w-0 shrink gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href="/ders-programi/olustur" className="min-w-0">
                  <Upload className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate max-sm:hidden">Excel</span>
                  <span className="truncate sm:hidden">Yükle</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" title="Düzenle" className="h-8 min-w-0 shrink gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href={duzenleHref} className="min-w-0">
                  <Pencil className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate">Düzenle</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" title="Yeni program" className="h-8 min-w-0 shrink gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href="/ders-programi/olustur" className="min-w-0">
                  <PlusCircle className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate max-sm:hidden">Yeni program</span>
                  <span className="truncate sm:hidden">Yeni</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" title="Öğretmen programları" className="h-8 min-w-0 shrink gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href="/ders-programi/programlarim" className="min-w-0">
                  <FolderKanban className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate max-sm:hidden">Programlarım</span>
                  <span className="truncate sm:hidden">Liste</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Takvime aktar (.ics)"
                className="h-8 min-w-0 shrink gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
                onClick={() => setCalendarModalOpen(true)}
                disabled={!viewTimetableEntries?.length || loading}
              >
                <Calendar className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate max-sm:hidden">Takvime ekle</span>
                <span className="truncate sm:hidden">Takvim</span>
              </Button>
            </div>
          </CardHeader>
        ) : (
          <CardHeader className="space-y-1.5 border-b border-border/70 bg-linear-to-r from-sky-500/6 via-muted/20 to-transparent px-2.5 py-2 print:hidden sm:space-y-3 sm:px-6 sm:py-4">
            <nav className="w-full" aria-label="Tabloda gösterilecek kaynak">
              <div
                role="tablist"
                className="flex w-full gap-1 rounded-xl border-2 border-violet-200/90 bg-violet-50/80 p-1 shadow-sm dark:border-violet-900/55 dark:bg-violet-950/35"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={teacherProgramTab === 'personal'}
                  title="Kayıtlı kişisel planınız (düzenlenebilir)"
                  onClick={() => setTeacherProgramTab('personal')}
                  className={cn(
                    'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-all sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm',
                    teacherProgramTab === 'personal'
                      ? 'bg-violet-600 text-white shadow-md ring-2 ring-violet-500/40 dark:bg-violet-500 dark:ring-violet-300/30'
                      : 'border border-transparent bg-white/75 text-violet-900/75 hover:border-violet-300/80 hover:bg-white dark:bg-violet-950/45 dark:text-violet-100/80 dark:hover:border-violet-800',
                  )}
                >
                  <FileEdit className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  <span className="leading-tight">
                    <span className="sm:hidden">Kişisel</span>
                    <span className="hidden sm:inline">Kişisel program</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={teacherProgramTab === 'school'}
                  title="İdare ataması (salt görüntüleme)"
                  onClick={() => setTeacherProgramTab('school')}
                  className={cn(
                    'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-center text-xs font-bold transition-all sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm',
                    teacherProgramTab === 'school'
                      ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-500/40 dark:bg-sky-500 dark:ring-sky-300/30'
                      : 'border border-transparent bg-white/75 text-sky-900/75 hover:border-sky-300/80 hover:bg-white dark:bg-sky-950/45 dark:text-sky-100/80 dark:hover:border-sky-800',
                  )}
                >
                  <Building2 className="size-3.5 shrink-0 opacity-90 sm:size-4" aria-hidden />
                  <span className="leading-tight">
                    <span className="sm:hidden">Okul</span>
                    <span className="hidden sm:inline">Okul programı</span>
                  </span>
                </button>
              </div>
              <p className="mt-1.5 hidden text-[11px] leading-snug text-muted-foreground sm:block">
                {teacherProgramTab === 'personal'
                  ? 'Sizin kayıtlı planınız (düzenlenebilir).'
                  : 'İdare ataması (salt görüntüleme).'}
              </p>
            </nav>

            {teacherProgramTab === 'personal' && teacherPersonalPrograms.length > 1 && selectedPersonalProgramId ? (
              <div className="flex w-full items-center gap-2">
                <label htmlFor="dp-personal-select" className="sr-only">
                  Program seçin
                </label>
                <select
                  id="dp-personal-select"
                  className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs sm:h-9 sm:text-sm"
                  value={selectedPersonalProgramId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPersonalProgramId(id);
                    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(DP_SELECTED_PERSONAL_KEY, id);
                  }}
                >
                  {teacherPersonalPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Link
                  href="/ders-programi/programlarim"
                  className="shrink-0 rounded-md border border-border/80 bg-background px-2 py-1.5 text-[11px] font-medium text-primary hover:bg-muted/50 sm:px-2.5 sm:py-2 sm:text-xs"
                >
                  Tümü
                </Link>
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-start gap-2 sm:gap-2.5">
                <div className="mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 sm:flex dark:text-sky-300">
                  <Calendar className="size-[17px]" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-sm font-bold leading-tight sm:text-lg">{programTitle}</CardTitle>
                  <p className="mt-1 hidden text-xs leading-snug text-muted-foreground sm:line-clamp-2 sm:block">
                    {teacherProgramTab === 'personal'
                      ? 'Boş program oluşturabilir veya okul programını kopyalayıp üzerinde değişiklik yapabilirsiniz.'
                      : 'Okulun yayınladığı size atanan ders dağılımı (salt görüntüleme).'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid w-full grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:justify-end sm:gap-1.5">
              <Button
                variant="outline"
                size="sm"
                title="Yazdır"
                className="h-8 gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
                onClick={() => window.print()}
              >
                <Printer className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate">Yazdır</span>
              </Button>
              {schoolEntries && schoolEntries.length > 0 ? (
                <Button
                  variant="default"
                  size="sm"
                  title="İdare programını kişisel plana aktar"
                  className="h-8 gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
                  onClick={handleImportFromAdmin}
                  disabled={importing}
                >
                  <Copy className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate sm:hidden">{importing ? '…' : 'Aktar'}</span>
                  <span className="hidden max-w-36 truncate sm:inline">
                    {importing ? 'Aktarılıyor…' : 'İdareyi aktar'}
                  </span>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" title="Düzenle" className="h-8 gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href={duzenleHref}>
                  <Pencil className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate">Düzenle</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" title="Yeni program" className="h-8 gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href="/ders-programi/olustur">
                  <PlusCircle className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate max-sm:hidden">Yeni Program</span>
                  <span className="truncate sm:hidden">Yeni</span>
                </Link>
              </Button>
              <Button variant="outline" size="sm" title="Tüm kişisel programlar" className="h-8 gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm" asChild>
                <Link href="/ders-programi/programlarim">
                  <FolderKanban className="size-3.5 shrink-0 sm:size-4" />
                  <span className="truncate max-sm:hidden">Programlarım</span>
                  <span className="truncate sm:hidden">Liste</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                title="Takvime aktar (.ics)"
                className="h-8 gap-1 px-1.5 text-[10px] font-medium sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
                onClick={() => setCalendarModalOpen(true)}
                disabled={!viewTimetableEntries?.length || loading || teacherTabContentLoading}
              >
                <Calendar className="size-3.5 shrink-0 sm:size-4" />
                <span className="truncate max-sm:hidden">Takvime Ekle</span>
                <span className="truncate sm:hidden">Takvim</span>
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className="min-w-0 p-0 table-x-scroll">
          <div className="ders-programi-print-header hidden print:block px-3 pt-1 pb-3 sm:px-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Uzaedu Öğretmen</p>
            <h1 className="mt-1 text-[15px] font-bold leading-snug text-black">{printListTitle}</h1>
            {me?.school?.name ? (
              <p className="mt-1 text-sm font-semibold text-neutral-900">{me.school.name}</p>
            ) : null}
            <p className="mt-1.5 text-sm font-medium text-neutral-800">{programTitle}</p>
            <p className="mt-0.5 text-xs tabular-nums text-neutral-600">
              {academicYear} · {dateStr}
            </p>
          </div>
          {isAdmin ? (
              <div className="min-w-0 space-y-4 p-4 sm:p-5">
              {/* Özet sekmesi */}
              {adminViewTab === 'summary' && (
                <div className="min-w-0 space-y-4">
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {planInfo && (
                      <div className="rounded-2xl border border-sky-200/60 bg-linear-to-br from-sky-500/10 via-background to-transparent p-4 shadow-sm ring-1 ring-sky-500/10 dark:border-sky-800/50 dark:from-sky-950/40">
                        <div className="flex items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-700 dark:text-sky-300">
                            <Sparkles className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">Geçerli plan</p>
                            {planInfo.name && (
                              <p className="mt-1 text-sm font-semibold leading-snug wrap-break-word text-foreground">
                                {planInfo.name}
                              </p>
                            )}
                            <p className="mt-1.5 text-sm text-foreground">
                              {new Date(planInfo.valid_from + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {' – '}
                              {planInfo.valid_until ? new Date(planInfo.valid_until + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Devam ediyor'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col justify-center rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hızlı erişim</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" className="gap-2" asChild>
                          <Link href="/ders-programi/olustur">
                            <Upload className="size-4" />
                            Excel yükle
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2" asChild>
                          <Link href="/ders-programi/programlarim">
                            <Users className="size-4" />
                            Öğretmen programları
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  {publishedPlans.length > 0 && (
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yayınlanmış planlar</p>
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:overflow-x-auto sm:pb-1">
                        {prevPlan && (
                          <Button variant="outline" size="sm" onClick={() => goToPlan(prevPlan)} className="w-full shrink-0 gap-1 sm:w-auto">
                            <ChevronLeft className="size-3.5" /> Önceki
                          </Button>
                        )}
                        {publishedPlans.map((p) => {
                          const isActive = planInfo?.plan_id === p.id;
                          const dateFrom = new Date(p.valid_from + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' });
                          const dateTo = p.valid_until ? new Date(p.valid_until + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : 'Devam ediyor';
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => goToPlan(p)}
                              title={p.name ? `${p.name} (${dateFrom} – ${dateTo})` : undefined}
                              className={cn(
                                'w-full max-w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all sm:w-auto sm:min-w-[168px] sm:max-w-[280px] sm:shrink-0 md:min-w-[180px]',
                                isActive
                                  ? 'border-primary bg-primary text-primary-foreground shadow-md ring-1 ring-primary/30'
                                  : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/40',
                              )}
                            >
                              <span className="block wrap-break-word">
                                {p.name || 'Plan'}
                              </span>
                              <span className="mt-0.5 block text-xs opacity-90">
                                {dateFrom} – {dateTo}
                              </span>
                            </button>
                          );
                        })}
                        {nextPlan && (
                          <Button variant="outline" size="sm" onClick={() => goToPlan(nextPlan)} className="w-full shrink-0 gap-1 sm:w-auto">
                            Sonraki <ChevronRight className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-3">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {entries && entries.length > 0
                        ? 'Öğretmen bazlı haftalık tabloyu Programlarım üzerinden açın. Günlük Tablo’da seçtiğiniz gün için saatlik dağılımı görün; Takvim’de ise tarih seçerek aynı bilgiye ay görünümünden ulaşın.'
                        : 'Excel ile program yükleyerek başlayın. Yükleme sonrası planlar burada özetlenir.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Günlük Tablo: O gün, şu saatte dersi olanlar */}
              {adminViewTab === 'daily' && (
                <div className="min-w-0 space-y-4">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-3">
                      <div className="flex max-w-full min-w-0 items-center overflow-hidden rounded-2xl border border-emerald-200/60 bg-linear-to-r from-emerald-500/8 to-card shadow-sm ring-1 ring-emerald-500/10 dark:border-emerald-800/50">
                        <Button variant="ghost" size="sm" className="h-11 w-11 shrink-0 rounded-none p-0 hover:bg-emerald-500/10" onClick={() => shiftAdminDate(-1)} aria-label="Önceki gün">
                          <ChevronLeft className="size-4 text-emerald-700 dark:text-emerald-300" />
                        </Button>
                        <input
                          type="date"
                          value={adminSelectedDate}
                          onChange={(e) => setAdminSelectedDate(e.target.value)}
                          className="h-11 min-w-0 max-w-full flex-1 border-0 bg-transparent px-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-0 sm:w-44 sm:flex-none"
                        />
                        <Button variant="ghost" size="sm" className="h-11 w-11 shrink-0 rounded-none p-0 hover:bg-emerald-500/10" onClick={() => shiftAdminDate(1)} aria-label="Sonraki gün">
                          <ChevronRight className="size-4 text-emerald-700 dark:text-emerald-300" />
                        </Button>
                      </div>
                      {adminSelectedDate !== todayYMD && (
                        <Button variant="outline" size="sm" onClick={() => setAdminSelectedDate(todayYMD)} className="border-emerald-400/50 text-emerald-800 hover:bg-emerald-500/10 dark:border-emerald-700 dark:text-emerald-200">
                          Bugüne git
                        </Button>
                      )}
                      {adminSelectedDate === todayYMD && (
                        <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:border-emerald-700 dark:text-emerald-200">
                          Bugün
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-emerald-200/50 bg-linear-to-br from-emerald-500/8 to-transparent px-4 py-3.5 dark:border-emerald-900/40">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                      <h3 className="wrap-break-word text-base font-bold capitalize text-foreground sm:text-lg">
                        {new Date(adminSelectedDate + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Her kart bir ders saatidir; o saatte derste olan öğretmenler listelenir.
                    </p>
                  </div>

                  {adminByDateLoading ? (
                    <div className="py-16 flex justify-center"><LoadingSpinner /></div>
                  ) : !adminByDateData || Object.keys(adminByDateData).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-emerald-300/50 bg-emerald-500/4 py-12 text-center dark:border-emerald-800/50">
                      <Clock className="mx-auto mb-3 size-12 text-emerald-600/35 dark:text-emerald-400/30" />
                      <p className="font-medium text-foreground">Bu gün için ders programı yok</p>
                      <p className="mt-1 text-sm text-muted-foreground">Hafta sonu veya programa eklenmemiş olabilir</p>
                    </div>
                  ) : (
                    (() => {
                      const slots = getTimeSlotsForDay(adminSelectedDayOfWeek).filter((s) => !s.isLunch);
                      const gridCols = slots.length <= 4 ? 'grid-cols-2' : slots.length <= 9 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
                      return (
                        <div className={cn('grid min-w-0 gap-3', gridCols)}>
                          {slots.map((slot) => {
                            const lessonNum = slot.lessonNum ?? 0;
                            const whoHasClass = adminByDateData
                              ? Object.entries(adminByDateData)
                                .filter(([, lessons]) => lessons[lessonNum])
                                .map(([uid, lessons]) => ({
                                  name: getTeacherName(uid),
                                  cls: lessons[lessonNum].class_section,
                                  subj: lessons[lessonNum].subject,
                                }))
                              : [];
                            return (
                              <div
                                key={lessonNum}
                                className="overflow-hidden rounded-2xl border border-emerald-200/45 bg-card shadow-sm ring-1 ring-emerald-500/5 transition-shadow hover:shadow-md dark:border-emerald-900/35"
                              >
                                <div className="flex min-w-0 items-center gap-2 border-b border-emerald-200/40 bg-linear-to-r from-emerald-500/10 to-transparent px-3 py-2.5 dark:border-emerald-900/40">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 text-sm font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100">
                                    {lessonNum}
                                  </span>
                                  <div className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-foreground">{slot.timeRange}</span>
                                    <span className="text-xs text-muted-foreground">ders saati</span>
                                  </div>
                                </div>
                                <div className="p-3 min-h-12">
                                  {whoHasClass.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {whoHasClass.map((w, i) => (
                                        <div
                                          key={i}
                                          className="flex items-start gap-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-2"
                                        >
                                          <Users className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                                          <div className="min-w-0 flex-1">
                                            <p className="wrap-break-word font-medium text-sm text-foreground">{w.name}</p>
                                            <p className="wrap-break-word text-xs text-muted-foreground">
                                              {w.cls} · {resolveSchoolSubjectDisplay(w.subj, schoolSubjects)}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-muted-foreground/60 text-sm italic py-1">— Ders yok</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Takvim görünümü */}
              {adminViewTab === 'calendar' && (
                <AdminTimetableCalendar
                  selectedDate={adminSelectedDate}
                  onSelectDate={setAdminSelectedDate}
                  monthState={adminCalendarMonth}
                  onMonthChange={setAdminCalendarMonth}
                  byDateData={adminByDateData}
                  getTeacherName={getTeacherName}
                  todayYMD={todayYMD}
                  subjectDisplay={(s) => resolveSchoolSubjectDisplay(s, schoolSubjects)}
                />
              )}
              </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="size-8" />
            </div>
          ) : teacherTabContentLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="size-8" />
            </div>
          ) : isTeacher && teacherProgramTab === 'personal' && teacherPersonalPrograms.length === 0 ? (
            <div className="space-y-4 px-4 py-12 text-center sm:px-6">
              <GraduationCap className="mx-auto size-12 text-violet-500/40" aria-hidden />
              <p className="text-sm font-medium text-foreground">Henüz kişisel programınız yok</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Sıfırdan oluşturabilir veya okulun yüklediği programı kopyalayarak başlayıp dilediğiniz gibi düzenleyebilirsiniz.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" asChild>
                  <Link href="/ders-programi/olustur">
                    <PlusCircle className="size-4" />
                    Boş program oluştur
                  </Link>
                </Button>
                {schoolEntries && schoolEntries.length > 0 ? (
                  <Button size="sm" variant="secondary" className="gap-2" onClick={handleImportFromAdmin} disabled={importing}>
                    <Copy className="size-4" />
                    {importing ? 'Aktarılıyor…' : 'İdare programını kopyala'}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="px-1 text-center text-[11px] text-muted-foreground md:hidden">
                Tabloyu yatay kaydırarak tüm günleri görebilirsiniz
              </p>
              <div className="-mx-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/20 pb-1 shadow-inner sm:mx-0">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-30 min-w-[104px] rounded-tl-xl border-b border-r border-border/80 bg-card px-2 py-2.5 text-left text-xs font-semibold text-foreground shadow-[6px_0_14px_-6px_rgba(0,0,0,0.12)] sm:min-w-[120px] sm:px-3 sm:py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Saat</span>
                      </th>
                      {DAYS_FULL.map((d, i) => {
                        const dayNum = i + 1;
                        const isToday = dayNum === todayDayOfWeek;
                        const th = TEACHER_WEEK_THEME[i] ?? TEACHER_WEEK_THEME[0];
                        return (
                          <th
                            key={d}
                            className={cn(
                              'border-b border-r border-border/50 px-1.5 py-2 text-center text-[10px] font-bold uppercase leading-tight sm:px-2 sm:py-2.5 sm:text-[11px]',
                              th.head,
                              isToday && th.headToday,
                              i === 6 && 'rounded-tr-xl border-r-0',
                            )}
                          >
                            <span className="block">{d}</span>
                            {isToday && (
                              <span className="mt-1 inline-block rounded-full bg-white/60 px-1.5 py-0.5 text-[9px] font-semibold text-foreground dark:bg-black/25">
                                Bugün
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((slot, idx) => {
                      const isLast = idx === timeSlots.length - 1;
                      return (
                        <tr
                          key={idx}
                          className={cn(
                            'transition-colors',
                            slot.isLunch ? 'bg-amber-50/40 dark:bg-amber-950/20' : 'hover:bg-muted/15',
                          )}
                        >
                          <td
                            className={cn(
                              'sticky left-0 z-20 border-b border-r border-border/70 bg-card px-2 py-2 align-top shadow-[6px_0_14px_-6px_rgba(0,0,0,0.1)] sm:px-3 sm:py-2.5',
                              slot.isLunch && 'bg-amber-50/90 dark:bg-amber-950/35',
                              isLast && 'rounded-bl-xl',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              {slot.isLunch ? (
                                <>
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
                                    <Sun className="size-4" />
                                  </span>
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-foreground">{slot.label}</span>
                                    <div className="text-[10px] text-muted-foreground">{slot.timeRange}</div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-primary/10 text-xs font-bold text-primary">
                                    {slot.lessonNum}
                                  </span>
                                  <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">{slot.timeRange}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                            const isTodayCol = day === todayDayOfWeek;
                            const toneIdx = day - 1;
                            const th = TEACHER_WEEK_THEME[toneIdx] ?? TEACHER_WEEK_THEME[0];
                            if (slot.isLunch) {
                              return (
                                <td
                                  key={day}
                                  className={cn(
                                    'border-b border-r border-amber-200/50 p-1.5 align-middle text-center last:border-r-0 dark:border-amber-900/30',
                                    'bg-amber-100/50 dark:bg-amber-950/25',
                                    isTodayCol && 'ring-1 ring-amber-400/40 ring-inset',
                                  )}
                                >
                                  <Sun className="mx-auto size-4 text-amber-600 dark:text-amber-400" aria-hidden />
                                </td>
                              );
                            }
                            const entry = getCellEntry(day, slot.lessonNum!);
                            return (
                              <td
                                key={day}
                                className={cn(
                                  'border-b border-r border-border/40 p-1.5 align-top last:border-r-0 sm:min-w-[108px] sm:p-2',
                                  isTodayCol ? th.cellToday : th.cell,
                                )}
                              >
                                {entry ? (
                                  <LessonCellCard
                                    subject={resolveSchoolSubjectDisplay(entry.subject, schoolSubjects)}
                                    classSection={entry.class_section}
                                    timeRange={getTimeRangeForDay(day, slot.lessonNum!)}
                                    kazanimHref={getKazanimHref(entry.subject, entry.class_section)}
                                    compact
                                    dayTone={toneIdx}
                                  />
                                ) : (
                                  <div className="flex min-h-10 items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/40 py-1 dark:bg-background/20">
                                    <EmptySlotIcon className="scale-90" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={calendarModalOpen} onOpenChange={setCalendarModalOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden [&>div]:p-0">
          <div className="flex items-center justify-between rounded-t-xl bg-linear-to-r from-primary to-primary/85 px-4 py-3 text-primary-foreground shadow-inner">
            <h2 className="text-lg font-semibold tracking-tight">Ders Programını Takvime Ekle</h2>
            <button
              type="button"
              onClick={() => setCalendarModalOpen(false)}
              className="rounded p-1.5 hover:bg-white/20 transition-colors"
              aria-label="Kapat"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Ders programınızı telefonunuzun takvim uygulamasına aktarın. Bir kez ekledikten sonra her hafta otomatik olarak takviminizde görünür.
            </p>

            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bell className="size-5" />
                </div>
                <div>
                  <p className="font-medium">Ders öncesi hatırlatma</p>
                  <p className="text-xs text-muted-foreground">Takvim uygulaması dersiniz başlamadan önce sizi bildirimle uyarır.</p>
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <WifiOff className="size-5" />
                </div>
                <div>
                  <p className="font-medium">İnternet olmadan erişim</p>
                  <p className="text-xs text-muted-foreground">Takvim uygulaması çevrimdışı çalışır; siteye girmeden programınıza bakabilirsiniz.</p>
                </div>
              </div>
              <div className="flex gap-3 text-sm">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <p className="font-medium">Haftalık görünüm</p>
                  <p className="text-xs text-muted-foreground">Her gün hangi derste, hangi sınıfta olduğunuzu hızlıca görebilirsiniz.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3 text-sm shadow-sm">
              <p className="font-semibold text-foreground">iPhone / iPad</p>
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                <li>&quot;Takvime aktar&quot; ile paylaşım açılırsa Takvim’i seçin; yoksa dosyayı indirip açın.</li>
                <li>&quot;Tüm etkinlikleri ekle&quot; veya içe aktarmayı onaylayın.</li>
              </ol>
            </div>

            <div className="space-y-2 rounded-xl border border-border/80 bg-card p-3 text-sm shadow-sm">
              <p className="font-semibold text-foreground">Android</p>
              <ol className="list-inside list-decimal space-y-1 text-xs text-muted-foreground">
                <li>Paylaşım menüsünden Google Takvim / Takvim’i seçin veya indirilen .ics’e dokunun.</li>
                <li>Google Takvim web’de &quot;İçe aktar&quot; ile dosyayı yükleyin.</li>
              </ol>
            </div>

            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/30">
              <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                Program güncellendiğinde takvim otomatik güncellenmez. Değişiklik yaparsanız dosyayı tekrar indirip içe aktarın.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCalendarModalOpen(false)} disabled={calendarExporting}>
                Kapat
              </Button>
              <Button onClick={handleAddToCalendar} disabled={calendarExporting} className="gap-2 shadow-sm">
                {calendarExporting ? (
                  <LoadingSpinner className="size-4" />
                ) : (
                  <>
                    <Share2 className="size-4 sm:hidden" />
                    <Download className="size-4 hidden sm:block" />
                  </>
                )}
                Takvime aktar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
