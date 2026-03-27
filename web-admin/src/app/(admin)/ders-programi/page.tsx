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

  const lessonList = byDateData && Object.keys(byDateData).length > 0
    ? Object.entries(byDateData).flatMap(([uid, lessons]) =>
        Object.entries(lessons).map(([ln, data]) => ({ lessonNum: ln, teacher: getTeacherName(uid), classSection: data.class_section, subject: data.subject })),
      ).sort((a, b) => Number(a.lessonNum) - Number(b.lessonNum))
    : [];

  return (
    <div className="space-y-6">
      {/* Takvim üst bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={prevMonth} aria-label="Önceki ay">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="font-semibold text-foreground min-w-[160px] text-center capitalize text-base">{monthLabel}</span>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={nextMonth} aria-label="Sonraki ay">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => onSelectDate(todayYMD)} className="border-primary/40 text-primary hover:bg-primary/10 shrink-0">
          <Calendar className="size-4 mr-1.5" />
          Bugüne git
        </Button>
      </div>

      {/* Takvim grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 gap-px bg-border">
          {dayLabels.map((l, idx) => (
            <div key={l} className={cn(
              'py-2.5 text-center text-xs font-semibold uppercase tracking-wider',
              idx === 5 || idx === 6 ? 'bg-muted/50 text-muted-foreground' : 'bg-muted/30 text-foreground',
            )}>
              {l}
            </div>
          ))}
          {cells.map((c, i) => {
            if (!c.dateStr) return <div key={i} className="min-h-14 bg-muted/10" />;
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
                  'min-h-14 flex flex-col items-center justify-center rounded-md transition-all bg-card',
                  !c.isCurrentMonth && 'opacity-40',
                  isWeekend && c.isCurrentMonth && !isSelected && 'bg-muted/20',
                  isSelected && 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40',
                  isToday && !isSelected && 'ring-2 ring-primary/30 bg-primary/10 font-semibold',
                  !isSelected && !isToday && 'hover:bg-muted/40',
                )}
              >
                <span className={cn('text-sm font-medium', isSelected && 'font-semibold')}>{day}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seçilen günün ders listesi */}
      {selectedDate && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b border-border">
            <h3 className="font-semibold text-foreground">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long' })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {lessonList.length > 0 && ` · ${lessonList.length} ders saati`}
            </p>
          </div>
          <div className="p-4">
            {lessonList.length > 0 ? (
              <div
                className={cn(
                  'grid gap-2',
                  lessonList.length <= 4 ? 'grid-cols-2' : lessonList.length <= 9 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
                )}
              >
                {lessonList.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                      {item.lessonNum}
                    </span>
                    <div className="min-w-0 flex-1 truncate">
                      <p className="font-medium text-foreground truncate">{item.teacher}</p>
                      <p className="text-xs text-muted-foreground truncate">{item.classSection} · {item.subject}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarRange className="size-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Bu gün için ders kaydı yok</p>
                <p className="text-xs text-muted-foreground mt-1">Hafta sonu veya programa eklenmemiş gün olabilir</p>
              </div>
            )}
          </div>
        </div>
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
  const { timeSlots, educationMode } = useSchoolTimetableSettings();
  const [entries, setEntries] = useState<TimetableEntry[] | null>(null);
  const [planInfo, setPlanInfo] = useState<{ plan_id?: string; name?: string | null; valid_from: string; valid_until: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

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
        }
      } catch {
        setEntries([]);
        setPlanInfo(null);
        setAdminPlans([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, isAdmin, me?.school_id]);

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
      const slot = timeSlots.find((s) => !s.isLunch && s.lessonNum === e.lesson_num);
      if (!slot) continue;
      const [startStr, endStr] = slot.timeRange.split(' - ').map((s) => s?.trim() ?? '');
      if (!startStr || !endStr) continue;
      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr.split(':').map(Number);
      const startM = (sh ?? 0) * 60 + (sm ?? 0);
      const endM = (eh ?? 0) * 60 + (em ?? 0);
      if (currentMinutes >= startM && currentMinutes < endM) return true;
    }
    return false;
  }, [entries, timeSlots, todayDayOfWeek, currentMinutes]);

  const programTitle = loading ? 'Yükleniyor…' : `${academicYear} Haftalık Ders Programı`;

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
      const slot = timeSlots.find((s) => !s.isLunch && s.lessonNum === e.lesson_num);
      if (!slot) continue;
      const [startStr, endStr] = slot.timeRange.split(' - ').map((s) => s.trim());
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
    <div className="space-y-6">
      {/* Tarih, Saat, Durum barı */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-gradient-to-r from-card to-muted/30 px-4 py-3.5 shadow-sm print:hidden">
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {isAdmin ? (
          <>
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20 shadow-inner">
                  <Pencil className="size-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Öğretmen</p>
                  <p className="text-xl font-bold text-foreground">{loading ? '…' : teacherCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 dark:border-emerald-800/60 dark:from-emerald-950/30 dark:to-emerald-900/20 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100/80 dark:bg-emerald-900/50 shadow-inner">
                  <Calendar className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ders Girişi</p>
                  <p className="text-xl font-bold text-foreground">{loading ? '…' : totalCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <Link href="/ders-programi/olustur" className="flex items-center gap-4 w-full">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
                    <Upload className="size-6 text-primary" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hızlı Aksiyon</p>
                    <p className="text-base font-bold text-primary">Excel ile Yükle</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-amber-100/20 dark:border-amber-800/60 dark:from-amber-950/20 dark:to-amber-900/10 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <Link href="/ders-programi/programlarim" className="flex items-center gap-4 w-full">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-amber-100/80 dark:bg-amber-900/50 shadow-inner">
                    <List className="size-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tüm Programlar</p>
                    <p className="text-base font-bold text-amber-700 dark:text-amber-300">Programlarım</p>
                  </div>
                </Link>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/20 shadow-inner">
                  <Calendar className="size-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tatil</p>
                  <p className="text-xl font-bold text-foreground">Hafta</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 dark:border-emerald-800/60 dark:from-emerald-950/30 dark:to-emerald-900/20 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-100/80 dark:bg-emerald-900/50 shadow-inner">
                  <Star className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Özel Gün</p>
                  <p className="text-xl font-bold text-foreground">0 adet</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
                  <Clock className="size-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bugün</p>
                  <p className="text-xl font-bold text-foreground">{todayCount} ders</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200/60 bg-gradient-to-br from-amber-50/50 to-amber-100/20 dark:border-amber-800/60 dark:from-amber-950/20 dark:to-amber-900/10 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex size-12 items-center justify-center rounded-xl bg-amber-100/80 dark:bg-amber-900/50 shadow-inner">
                  <MessageSquare className="size-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Toplam</p>
                  <p className="text-xl font-bold text-foreground">{totalCount} saat</p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Haftalık Ders Programı - Öğretmen için grid, admin için özet */}
      <Card className="ders-programi-print-card border-border shadow-md overflow-hidden">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden bg-gradient-to-r from-muted/30 to-transparent border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
              <Calendar className="size-5 text-primary" />
            </div>
            <CardTitle className="text-lg">{programTitle}</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isAdmin && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                <Printer className="size-4" />
                Yazdır
              </Button>
            )}
            {!isAdmin && entries && entries.length > 0 && (
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
              <Link href="/ders-programi/programlarim">
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
            {!isAdmin && (
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
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 table-x-scroll">
          <div className="hidden print:block px-4 pt-2 pb-1 text-sm font-semibold text-foreground">
            {programTitle}
          </div>
          {isAdmin ? (
            <div className="p-5 space-y-6">
              {/* Sekmeler */}
              <div className="flex flex-wrap gap-2">
                {([
                  { id: 'summary' as const, label: 'Özet', icon: List },
                  { id: 'daily' as const, label: 'Günlük Tablo', icon: Clock },
                  { id: 'calendar' as const, label: 'Takvim', icon: CalendarRange },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setAdminViewTabWithCalendarSync(tab.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                      adminViewTab === tab.id
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent',
                    )}
                  >
                    <tab.icon className="size-4 shrink-0" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Özet sekmesi */}
              {adminViewTab === 'summary' && (
                <div className="space-y-5">
                  {planInfo && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                      <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">Geçerli plan</p>
                      {planInfo.name && (
                        <p className="text-sm font-semibold text-foreground mb-1 break-words">
                          {planInfo.name}
                        </p>
                      )}
                      <p className="text-sm text-foreground">
                        {new Date(planInfo.valid_from + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {' – '}
                        {planInfo.valid_until ? new Date(planInfo.valid_until + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Devam ediyor'}
                      </p>
                    </div>
                  )}
                  {publishedPlans.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dönem planları</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {prevPlan && (
                          <Button variant="outline" size="sm" onClick={() => goToPlan(prevPlan)} className="gap-1 shrink-0">
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
                                'rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left min-w-[160px] max-w-[320px]',
                                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-foreground',
                              )}
                            >
                              <span className="block break-words">
                                {p.name || 'Plan'}
                              </span>
                              <span className="block text-xs opacity-90 mt-0.5 whitespace-nowrap">
                                {dateFrom} – {dateTo}
                              </span>
                            </button>
                          );
                        })}
                        {nextPlan && (
                          <Button variant="outline" size="sm" onClick={() => goToPlan(nextPlan)} className="gap-1 shrink-0">
                            Sonraki <ChevronRight className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {entries && entries.length > 0
                      ? 'Öğretmen bazlı haftalık programları Programlarım sayfasından inceleyebilirsiniz. Günlük Tablo sekmesinde belirli bir günde hangi saatte hangi öğretmenin hangi sınıfta dersi olduğunu görebilirsiniz.'
                      : 'Excel dosyanızla ders programını yükleyerek başlayın. Yükleme sonrası tüm programları buradan yönetebilirsiniz.'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" asChild>
                      <Link href="/ders-programi/olustur" className="gap-2">
                        <Upload className="size-4" />
                        Excel ile Yükle
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/ders-programi/programlarim" className="gap-2">
                        <List className="size-4" />
                        Programlarım
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* Günlük Tablo: O gün, şu saatte dersi olanlar */}
              {adminViewTab === 'daily' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                      <Button variant="ghost" size="sm" className="h-10 w-10 p-0 shrink-0" onClick={() => shiftAdminDate(-1)} aria-label="Önceki gün">
                        <ChevronLeft className="size-4" />
                      </Button>
                      <input
                        type="date"
                        value={adminSelectedDate}
                        onChange={(e) => setAdminSelectedDate(e.target.value)}
                        className="w-40 border-0 bg-transparent px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-0"
                      />
                      <Button variant="ghost" size="sm" className="h-10 w-10 p-0 shrink-0" onClick={() => shiftAdminDate(1)} aria-label="Sonraki gün">
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    {adminSelectedDate !== todayYMD && (
                      <Button variant="outline" size="sm" onClick={() => setAdminSelectedDate(todayYMD)} className="border-primary/40 text-primary hover:bg-primary/10">
                        Bugüne git
                      </Button>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                    <h3 className="font-semibold text-foreground">
                      {new Date(adminSelectedDate + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Aşağıdaki tablo, her ders saatinde hangi öğretmenin hangi sınıfta hangi dersi verdiğini gösterir
                    </p>
                  </div>

                  {adminByDateLoading ? (
                    <div className="py-16 flex justify-center"><LoadingSpinner /></div>
                  ) : !adminByDateData || Object.keys(adminByDateData).length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-12 text-center">
                      <Clock className="size-12 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">Bu gün için ders programı yok</p>
                      <p className="text-sm text-muted-foreground mt-1">Hafta sonu veya programa eklenmemiş olabilir</p>
                    </div>
                  ) : (
                    (() => {
                      const slots = timeSlots.filter((s) => !s.isLunch);
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
                                className="rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                              >
                                <div className="px-3 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold text-primary">
                                    {lessonNum}
                                  </span>
                                  <div>
                                    <span className="font-semibold text-foreground text-sm block">{slot.timeRange}</span>
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
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner className="size-8" />
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-3 text-left font-semibold text-foreground border-b border-r border-border min-w-[120px] rounded-tl-lg">Saat</th>
                  {DAYS_FULL.map((d, i) => {
                    const dayNum = i + 1;
                    const isToday = dayNum === todayDayOfWeek;
                    return (
                      <th
                        key={d}
                        className={cn(
                          'px-2 py-3 text-center font-semibold text-foreground border-b border-r last:border-r-0 border-border min-w-[90px]',
                          isToday && 'bg-primary/15 text-primary border-primary/30',
                          i === 4 && 'rounded-tr-lg',
                        )}
                      >
                        <span className="text-xs">{d}</span>
                        {isToday && <span className="block text-[10px] font-normal mt-0.5 opacity-90">Bugün</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot, idx) => (
                  <tr
                    key={idx}
                    className={cn(
                      'hover:bg-muted/20 transition-colors',
                      slot.isLunch && 'bg-amber-50/50 dark:bg-amber-950/15',
                    )}
                  >
                    <td
                      className={cn(
                        'px-3 py-2.5 border-b border-r border-border align-top',
                        slot.isLunch && 'bg-amber-100/40 dark:bg-amber-900/20',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {slot.isLunch ? (
                          <>
                            <Sun className="size-4 text-amber-500 shrink-0" />
                            <div>
                              <span className="font-medium">{slot.label}</span>
                              <div className="text-xs text-muted-foreground">{slot.timeRange}</div>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span
                              className="flex size-7 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary"
                            >
                              {slot.lessonNum}
                            </span>
                            <span className="text-xs text-muted-foreground">{slot.timeRange}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                      const isTodayCol = day === todayDayOfWeek;
                      if (slot.isLunch) {
                        return (
                          <td
                            key={day}
                            className={cn(
                              'p-2 border-b border-r last:border-r-0 border-border align-middle text-center bg-amber-100/30 dark:bg-amber-900/15',
                              isTodayCol && 'border-primary/20 bg-amber-100/50 dark:bg-amber-900/25',
                            )}
                          >
                            <Sun className="size-4 mx-auto text-amber-500" />
                          </td>
                        );
                      }
                      const entry = getCellEntry(day, slot.lessonNum!);
                      return (
                        <td
                          key={day}
                          className={cn(
                            'p-2 border-b border-r last:border-r-0 border-border align-top min-w-[100px]',
                            isTodayCol && 'bg-primary/5',
                          )}
                        >
                          {entry ? (
                            <LessonCellCard
                              subject={entry.subject}
                              classSection={entry.class_section}
                              timeRange={slot.timeRange}
                              kazanimHref={getKazanimHref(entry.subject, entry.class_section)}
                              compact
                            />
                          ) : (
                            <div className="flex justify-center">
                              <EmptySlotIcon />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
