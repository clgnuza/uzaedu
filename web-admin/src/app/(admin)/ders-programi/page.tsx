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
  Star,
  MessageSquare,
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
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { useKazanimPlanMap } from '@/hooks/use-kazanim-plan-map';
import { apiFetch } from '@/lib/api';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LessonCellCard } from '@/components/ders-programi/lesson-cell-card';
import { TEACHER_WEEK_THEME } from '@/components/ders-programi/timetable-pastel-theme';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

type MyProgramSummary = { id: string };

/** API: user_id -> lesson_num -> { class_section, subject } */
type ByDateData = Record<string, Record<number, { class_section: string; subject: string }>>;

const DAYS_FULL = ['PAZARTESİ', 'SALI', 'ÇARŞAMBA', 'PERŞEMBE', 'CUMA', 'CUMARTESİ', 'PAZAR'];
const WEEKDAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** Aylık takvim: güne tıklayınca o gün seçilir; seçilen günün ders listesi altta gösterilir */
function AdminTimetableCalendar({
  selectedDate,
  onSelectDate,
  monthState,
  onMonthChange,
  byDateData,
  getTeacherName,
  todayYMD,
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  monthState: { year: number; month: number };
  onMonthChange: (s: { year: number; month: number }) => void;
  byDateData: ByDateData | null;
  getTeacherName: (id: string) => string;
  todayYMD: string;
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
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/45 bg-linear-to-br from-violet-500/12 via-background to-fuchsia-500/6 p-4 shadow-sm ring-1 ring-violet-500/10 dark:border-violet-800/45 dark:from-violet-950/40 dark:to-fuchsia-950/20">
        <div className="pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-fuchsia-400/15 blur-3xl dark:bg-fuchsia-500/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-10 left-0 size-32 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/15" aria-hidden />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-3 sm:gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/20 text-violet-700 shadow-inner ring-1 ring-violet-500/25 dark:bg-violet-950/60 dark:text-violet-300 dark:ring-violet-500/35">
              <CalendarRange className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Ay görünümü</h3>
              <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Takvimden bir gün seçin; seçilen tarihe göre o günkü ders dağılımı aşağıda listelenir.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center justify-center gap-1 rounded-2xl border border-violet-200/60 bg-background/90 px-1 py-1 shadow-sm backdrop-blur-sm dark:border-violet-800/60 dark:bg-background/50">
              <Button variant="ghost" size="sm" className="h-10 w-10 shrink-0 rounded-xl p-0 hover:bg-violet-500/10" onClick={prevMonth} aria-label="Önceki ay">
                <ChevronLeft className="size-5 text-violet-700 dark:text-violet-300" />
              </Button>
              <span className="min-w-42 px-2 text-center text-sm font-bold capitalize text-foreground sm:min-w-48 sm:text-base">
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
              className="h-10 shrink-0 border-violet-300/70 bg-background/80 text-violet-800 hover:bg-violet-500/10 dark:border-violet-700 dark:text-violet-200"
            >
              <Calendar className="mr-2 size-4" />
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

      <div className="overflow-hidden rounded-2xl border border-violet-200/40 bg-card shadow-lg ring-1 ring-violet-500/10 dark:border-violet-800/50">
        <div className="grid grid-cols-7 gap-px bg-violet-950/10 dark:bg-violet-950/30">
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
        <section className="overflow-hidden rounded-2xl border border-violet-200/40 bg-linear-to-b from-violet-500/7 to-card shadow-md ring-1 ring-violet-500/10 dark:border-violet-900/45 dark:from-violet-950/35">
          <div className="flex flex-col gap-3 border-b border-violet-200/35 bg-linear-to-r from-violet-500/15 to-fuchsia-500/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-violet-900/40">
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
              <h4 className="mt-2 text-lg font-bold capitalize leading-tight text-foreground sm:text-xl">{selectedPretty}</h4>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <GraduationCap className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
              <span className="leading-snug">Okul programına göre o günün dersleri</span>
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
                              <p className="font-semibold text-foreground">{item.teacher}</p>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                <span className="font-medium text-violet-700 dark:text-violet-300">{item.classSection}</span>
                                <span className="mx-1.5 text-border">·</span>
                                <span>{item.subject}</span>
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
  const [entries, setEntries] = useState<TimetableEntry[] | null>(null);
  const [planInfo, setPlanInfo] = useState<{ plan_id?: string; name?: string | null; valid_from: string; valid_until: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [teacherPersonalPrograms, setTeacherPersonalPrograms] = useState<MyProgramSummary[]>([]);

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
        const path = isAdmin ? '/teacher-timetable' : '/teacher-timetable/me';
        const data = await apiFetch<TimetableEntry[]>(path, { token });
        setEntries(Array.isArray(data) ? data : []);
        if (isAdmin) {
          const [info, plansList, teachersList] = await Promise.all([
            apiFetch<{ plan_id?: string; name?: string | null; valid_from: string; valid_until: string | null } | null>('/teacher-timetable/plan-info', { token }).catch(() => null),
            apiFetch<TimetablePlan[]>('/teacher-timetable/plans', { token }).catch(() => []),
            apiFetch<TeacherInfo[]>('/duty/teachers?includeExempt=true', { token }).catch(() => []),
          ]);
          setPlanInfo(info ?? null);
          setAdminPlans(Array.isArray(plansList) ? plansList.filter((p) => p.status === 'published') : []);
          setAdminTeachers(Array.isArray(teachersList) ? teachersList : []);
          setTeacherPersonalPrograms([]);
        } else {
          const myPrograms = await apiFetch<MyProgramSummary[]>('/teacher-timetable/my-programs', { token }).catch(() => []);
          setTeacherPersonalPrograms(Array.isArray(myPrograms) ? myPrograms : []);
        }
      } catch {
        setEntries([]);
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
            'Bu sayfadaki haftalık tabloda geçerli olan okul (idare) programıdır. Kişisel programlarınız Programlarım üzerinden düzenlenir.',
            { duration: 9000 },
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

  const getCellEntry = (day: number, lesson: number) =>
    entries?.find((e) => e.day_of_week === day && e.lesson_num === lesson) ?? null;

  const todayCount = useMemo(() => {
    if (!entries) return 0;
    return entries.filter((e) => e.day_of_week === todayDayOfWeek).length;
  }, [entries, todayDayOfWeek]);

  const totalCount = entries?.length ?? 0;

  const teacherCount = useMemo(() => {
    if (!entries?.length) return 0;
    return new Set(entries.map((e) => e.user_id)).size;
  }, [entries]);

  const isClassTime = useMemo(() => {
    if (!entries?.length || !timeSlots.length) return false;
    const todayEntries = entries.filter((e) => e.day_of_week === todayDayOfWeek);
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
  }, [entries, timeSlots.length, todayDayOfWeek, currentMinutes, getTimeRangeForDay]);

  const programTitle = loading ? 'Yükleniyor…' : `${academicYear} Haftalık Ders Programı`;

  const duzenleHref =
    isAdmin
      ? '/ders-programi/programlarim'
      : teacherPersonalPrograms.length === 1
        ? `/ders-programi/olustur/${teacherPersonalPrograms[0]!.id}`
        : '/ders-programi/programlarim';

  const handleImportFromAdmin = async () => {
    if (!token || !entries?.length || importing) return;
    setImporting(true);
    try {
      const res = await apiFetch<{ id: string }>('/teacher-timetable/import-from-admin', {
        token,
        method: 'POST',
      });
      toast.success('İdare programı kendi programlarınıza aktarıldı. Düzenleyebilirsiniz.');
      router.push(`/ders-programi/olustur/${res.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Aktarılamadı';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleAddToCalendar = () => {
    if (!entries?.length || !timeSlots.length) return;
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    const startYear = month >= 6 ? year + 1 : year;
    const septFirst = new Date(startYear, 8, 1);
    let firstMonday = new Date(septFirst);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    const fmtLocal = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    };
    const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const events: string[] = [];
    for (const e of entries) {
      if (!e.day_of_week || e.day_of_week < 1 || e.day_of_week > 7) continue;
      const range = getTimeRangeForDay(e.day_of_week, e.lesson_num);
      const [startStr, endStr] = range.split(' - ').map((s) => s.trim());
      if (!startStr || !endStr) continue;
      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr.split(':').map(Number);
      const eventDate = new Date(firstMonday);
      eventDate.setDate(firstMonday.getDate() + (e.day_of_week - 1));
      eventDate.setHours(sh || 0, sm || 0, 0, 0);
      const endDate = new Date(eventDate);
      endDate.setHours(eh || 0, em || 0, 0, 0);
      const uid = `ders-${e.day_of_week}-${e.lesson_num}-${e.class_section}-${e.subject}`.replace(/\s/g, '-');
      const summary = `${e.class_section} - ${e.subject}`.replace(/[,;\\]/g, (c) => `\\${c}`);
      const dtstamp = fmtUtc(new Date());
      const dtstart = fmtLocal(eventDate);
      const dtend = fmtLocal(endDate);
      events.push(
        `BEGIN:VEVENT
UID:${uid}@ogretmenpro
DTSTAMP:${dtstamp}Z
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${summary}
RRULE:FREQ=WEEKLY;COUNT=36
END:VEVENT`,
      );
    }
    if (events.length === 0) return;
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//OgretmenPro//DersProgrami//TR
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events.join('\n')}
END:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ders-programi-${academicYear}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Takvim dosyası indirildi.');
    setCalendarModalOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      {/* Tarih, Saat, Durum barı */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/80 bg-linear-to-r from-card to-muted/25 px-3 py-2.5 shadow-sm print:hidden sm:gap-4 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2.5 text-sm">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Calendar className="size-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground">{dateStr}</span>
          <span className="text-muted-foreground">{weekdayStr}</span>
        </div>
        {!isAdmin && (
          <div className="flex items-center gap-2.5 text-sm">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <Clock className="size-4 text-muted-foreground" />
            </div>
            <span className="font-medium">{timeStr}</span>
            <span className="text-muted-foreground text-xs">Güncel</span>
          </div>
        )}
        <div className="flex-1" />
        {!isAdmin && (
          <span className="text-xs font-medium text-muted-foreground rounded-lg border border-border bg-background/80 px-2.5 py-1">
            {educationMode === 'double' ? 'İkili eğitim' : 'Tekli eğitim'}
          </span>
        )}
        {!isAdmin && (
          <span
            className={cn(
              'text-sm font-medium rounded-lg px-2.5 py-1',
              isClassTime ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'text-muted-foreground bg-muted/50',
            )}
          >
            {isClassTime ? 'Şu an ders saati' : 'Şu an ders yok'}
          </span>
        )}
        {isAdmin && (
          <Button size="sm" className="gap-2" asChild>
            <Link href="/ders-programi/olustur">
              <Upload className="size-4" />
              Excel ile Yükle
            </Link>
          </Button>
        )}
        {!isAdmin && (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/kazanim-takip">
              <List className="size-4" />
              Haftalık Kazanımlar
            </Link>
          </Button>
        )}
      </div>

      {/* Özet kartlar: Admin vs Teacher */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {isAdmin ? (
          <>
            <Card className="overflow-hidden rounded-lg border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 shadow-sm">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
                  <Pencil className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Öğretmen</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{loading ? '…' : teacherCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden rounded-lg border-emerald-200/60 bg-linear-to-br from-emerald-50/60 to-emerald-100/30 shadow-sm dark:border-emerald-800/60 dark:from-emerald-950/30 dark:to-emerald-900/20">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100/90 dark:bg-emerald-900/50">
                  <Calendar className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ders Girişi</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{loading ? '…' : totalCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden rounded-lg border-border shadow-sm">
              <CardContent className="p-0">
                <Link href="/ders-programi/olustur" className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12">
                    <Upload className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hızlı</p>
                    <p className="text-sm font-semibold text-primary">Excel ile Yükle</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
            <Card className="overflow-hidden rounded-lg border-amber-200/60 bg-linear-to-br from-amber-50/50 to-amber-100/20 shadow-sm dark:border-amber-800/60 dark:from-amber-950/20 dark:to-amber-900/10">
              <CardContent className="p-0">
                <Link href="/ders-programi/programlarim" className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/40">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100/90 dark:bg-amber-900/50">
                    <Users className="size-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Liste</p>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Öğretmen programları</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="overflow-hidden rounded-lg border-primary/20 bg-linear-to-br from-primary/5 to-primary/10 shadow-sm">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15">
                  <Calendar className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tatil</p>
                  <p className="text-lg font-bold text-foreground">Hafta</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden rounded-lg border-emerald-200/60 bg-linear-to-br from-emerald-50/60 to-emerald-100/30 shadow-sm dark:border-emerald-800/60 dark:from-emerald-950/30 dark:to-emerald-900/20">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100/90 dark:bg-emerald-900/50">
                  <Star className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Özel Gün</p>
                  <p className="text-lg font-bold text-foreground">0 adet</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden rounded-lg border-border shadow-sm">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/12">
                  <Clock className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bugün</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{todayCount} ders</p>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden rounded-lg border-amber-200/60 bg-linear-to-br from-amber-50/50 to-amber-100/20 shadow-sm dark:border-amber-800/60 dark:from-amber-950/20 dark:to-amber-900/10">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-100/90 dark:bg-amber-900/50">
                  <MessageSquare className="size-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Toplam</p>
                  <p className="text-lg font-bold tabular-nums text-foreground">{totalCount} saat</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Haftalık Ders Programı - Öğretmen için grid, admin için özet */}
      <Card className="ders-programi-print-card overflow-hidden rounded-xl border-border shadow-md">
        {isAdmin ? (
          <CardHeader className="print:hidden border-b border-sky-500/15 bg-linear-to-br from-sky-500/8 via-background to-violet-500/6 p-0">
            <div className="relative overflow-hidden p-4 sm:p-5">
              <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-sky-400/15 blur-3xl dark:bg-sky-500/20" aria-hidden />
              <div className="pointer-events-none absolute -bottom-24 -left-10 size-40 rounded-full bg-violet-400/10 blur-3xl dark:bg-violet-500/15" aria-hidden />
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 shadow-inner ring-1 ring-sky-500/25 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-500/30">
                    <CalendarDays className="size-7" strokeWidth={2} aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-sky-400/35 bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:border-sky-600/50 dark:text-sky-200">
                        {academicYear}
                      </span>
                      {!loading && entries && entries.length > 0 && (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {teacherCount} öğretmen · {totalCount} ders kaydı
                        </span>
                      )}
                    </div>
                    <CardTitle className="mt-1.5 text-lg font-bold leading-tight tracking-tight sm:text-xl">{programTitle}</CardTitle>
                    <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      Özet, günlük dağılım veya ay takviminden okul programını yönetin.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
                  <Button size="sm" className="gap-2 shadow-sm" asChild>
                    <Link href="/ders-programi/olustur">
                      <Upload className="size-4" />
                      Excel ile Yükle
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 border-sky-300/50 bg-background/90 hover:bg-sky-500/5 dark:border-sky-800" asChild>
                    <Link href={duzenleHref}>
                      <Pencil className="size-4 text-sky-600 dark:text-sky-400" />
                      Düzenle
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 border-violet-300/40 bg-background/90 hover:bg-violet-500/5 dark:border-violet-800" asChild>
                    <Link href="/ders-programi/olustur">
                      <PlusCircle className="size-4 text-violet-600 dark:text-violet-400" />
                      Yeni Program
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        ) : (
          <CardHeader className="flex flex-col gap-3 border-b border-border/80 bg-linear-to-r from-muted/25 to-transparent print:hidden sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12">
                <Calendar className="size-[18px] text-primary" />
              </div>
              <CardTitle className="text-base font-semibold leading-tight sm:text-lg">{programTitle}</CardTitle>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:justify-end">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Printer className="size-4" />
                Yazdır
              </Button>
              {entries && entries.length > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={handleImportFromAdmin}
                  disabled={importing}
                >
                  <Copy className="size-4" />
                  {importing ? 'Aktarılıyor…' : 'İdare programını aktar'}
                </Button>
              )}
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link href={duzenleHref}>
                  <Pencil className="size-4" />
                  Düzenle
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link href="/ders-programi/olustur">
                  <PlusCircle className="size-4" />
                  Yeni Program
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setCalendarModalOpen(true)}
                disabled={!entries?.length || loading}
              >
                <Calendar className="size-4" />
                Takvime Ekle
              </Button>
            </div>
          </CardHeader>
        )}
        <CardContent className="p-0 table-x-scroll">
          <div className="hidden print:block px-4 pt-2 pb-1 text-sm font-semibold text-foreground">
            {programTitle}
          </div>
          {isAdmin ? (
            <div className="space-y-0">
              <nav
                className="border-b border-border/70 bg-muted/20 px-3 pt-3 sm:px-5"
                aria-label="Okul programı görünümü"
              >
                <ul className="-mb-px flex gap-1 overflow-x-auto pb-px scrollbar-none sm:gap-2">
                  {([
                    {
                      id: 'summary' as const,
                      label: 'Özet',
                      hint: 'Plan ve kısayollar',
                      icon: LayoutDashboard,
                      active: 'border-sky-500 text-sky-900 dark:border-sky-400 dark:text-sky-50',
                      iconActive: 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-600/20',
                      iconIdle: 'bg-sky-100/90 text-sky-600 dark:bg-sky-950/55 dark:text-sky-300',
                      labelIdle: 'text-sky-900/80 dark:text-sky-200/85',
                    },
                    {
                      id: 'daily' as const,
                      label: 'Günlük Tablo',
                      hint: 'Saatlik öğretmen dağılımı',
                      icon: Clock,
                      active: 'border-emerald-500 text-emerald-900 dark:border-emerald-400 dark:text-emerald-50',
                      iconActive: 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-600/20',
                      iconIdle: 'bg-emerald-100/90 text-emerald-600 dark:bg-emerald-950/55 dark:text-emerald-300',
                      labelIdle: 'text-emerald-900/80 dark:text-emerald-200/85',
                    },
                    {
                      id: 'calendar' as const,
                      label: 'Takvim',
                      hint: 'Ay görünümü',
                      icon: CalendarRange,
                      active: 'border-violet-500 text-violet-900 dark:border-violet-400 dark:text-violet-50',
                      iconActive: 'bg-violet-500 text-white shadow-sm ring-1 ring-violet-600/20',
                      iconIdle: 'bg-violet-100/90 text-violet-600 dark:bg-violet-950/55 dark:text-violet-300',
                      labelIdle: 'text-violet-900/80 dark:text-violet-200/85',
                    },
                  ]).map((tab) => {
                    const active = adminViewTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <li key={tab.id} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setAdminViewTabWithCalendarSync(tab.id)}
                          title={tab.hint}
                          className={cn(
                            'group relative flex items-center gap-2 rounded-t-lg px-2 py-2.5 text-left text-[13px] font-medium transition-colors sm:px-3.5',
                            active
                              ? cn('-mb-px border-b-2 bg-background/95', tab.active)
                              : 'border-b-2 border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                          )}
                        >
                          <span
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-lg transition-all',
                              active ? tab.iconActive : tab.iconIdle,
                            )}
                            aria-hidden
                          >
                            <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} />
                          </span>
                          <span className={cn('flex min-w-0 flex-col gap-0', !active && tab.labelIdle)}>
                            <span className="leading-tight">{tab.label}</span>
                            <span
                              className={cn(
                                'hidden max-w-40 truncate text-[10px] font-normal leading-none text-muted-foreground sm:block',
                                active && 'text-current/75',
                              )}
                            >
                              {tab.hint}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="space-y-4 p-4 sm:p-5">
              {/* Özet sekmesi */}
              {adminViewTab === 'summary' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
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
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Yayınlanmış planlar</p>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1">
                        {prevPlan && (
                          <Button variant="outline" size="sm" onClick={() => goToPlan(prevPlan)} className="shrink-0 gap-1">
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
                                'min-w-[168px] max-w-[280px] shrink-0 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all sm:min-w-[180px]',
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
                          <Button variant="outline" size="sm" onClick={() => goToPlan(nextPlan)} className="shrink-0 gap-1">
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
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-2xl border border-emerald-200/60 bg-linear-to-r from-emerald-500/8 to-card shadow-sm ring-1 ring-emerald-500/10 dark:border-emerald-800/50">
                        <Button variant="ghost" size="sm" className="h-11 w-11 shrink-0 rounded-none p-0 hover:bg-emerald-500/10" onClick={() => shiftAdminDate(-1)} aria-label="Önceki gün">
                          <ChevronLeft className="size-4 text-emerald-700 dark:text-emerald-300" />
                        </Button>
                        <input
                          type="date"
                          value={adminSelectedDate}
                          onChange={(e) => setAdminSelectedDate(e.target.value)}
                          className="h-11 w-44 border-0 bg-transparent px-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-0"
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

                  <div className="rounded-2xl border border-emerald-200/50 bg-linear-to-br from-emerald-500/8 to-transparent px-4 py-3.5 dark:border-emerald-900/40">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h3 className="text-base font-bold capitalize text-foreground sm:text-lg">
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
                        <div className={cn('grid gap-3', gridCols)}>
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
                                <div className="flex items-center gap-2 border-b border-emerald-200/40 bg-linear-to-r from-emerald-500/10 to-transparent px-3 py-2.5 dark:border-emerald-900/40">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 text-sm font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-100">
                                    {lessonNum}
                                  </span>
                                  <div>
                                    <span className="block text-sm font-semibold text-foreground">{slot.timeRange}</span>
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
                                            <p className="font-medium text-foreground text-sm truncate">{w.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                              {w.cls} · {w.subj}
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
                />
              )}
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="size-8" />
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
                                    subject={entry.subject}
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
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground rounded-t-xl">
            <h2 className="text-lg font-semibold">Ders Programını Takvime Ekle</h2>
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

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">iPhone / iPad</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>Aşağıdaki &quot;.ics Dosyasını İndir&quot; butonuna dokunun.</li>
                <li>Dosya Safari&apos;de açılır, &quot;Takvim&quot; uygulaması otomatik başlar.</li>
                <li>Çıkan ekranda &quot;Tüm Etkinlikleri Ekle&quot; butonuna dokunun.</li>
                <li>Ders programı takviminizde görünmeye başlar ✓</li>
              </ol>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-semibold">Android</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                <li>Aşağıdaki &quot;.ics Dosyasını İndir&quot; butonuna dokunun.</li>
                <li>İndirme tamamlanınca ekranda beliren bildirime dokunun.</li>
                <li>Google Takvim ile aç seçeneğini seçin.</li>
                <li>Açılan sayfada &quot;İçe Aktar&quot; butonuna dokunun ✓</li>
              </ol>
            </div>

            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/30">
              <Info className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-200">
                Program güncellendiğinde takvim otomatik güncellenmez. Değişiklik yaparsanız dosyayı tekrar indirip içe aktarın.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCalendarModalOpen(false)}>
                Kapat
              </Button>
              <Button onClick={handleAddToCalendar} className="gap-2">
                <Download className="size-4" />
                .ics Dosyasını İndir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
