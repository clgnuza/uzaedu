'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, UserCheck, X, Search, AlertCircle, BookOpen, Info, Wand2, ChevronDown, ChevronUp, Settings2, CalendarDays, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import {
  teacherLessonNumsOverlappingExam,
  turkishDowFromYmd,
  lessonSlotForDay,
} from '@/lib/school-timetable-schedule';

type SessionType = 'yazili' | 'uygulama' | 'mixed';
type UygulamaCompanion = {
  id: string; sessionDate: string; startTime: string; endTime: string; roomName: string | null;
};
type Session = {
  id: string; subjectName: string; sessionDate: string;
  startTime: string; endTime: string; roomName: string | null;
  sessionType?: SessionType; pairedSessionId?: string | null;
  uygulamaCompanion?: UygulamaCompanion | null;
  proctors?: Array<{ userId: string; role: string; displayName: string }>;
};

const SESSION_TYPE_BADGE: Record<SessionType, string> = {
  yazili: 'bg-blue-500/15 text-blue-800 ring-1 ring-blue-500/25 dark:text-blue-200',
  uygulama: 'bg-violet-500/15 text-violet-800 ring-1 ring-violet-500/25 dark:text-violet-200',
  mixed: 'bg-teal-500/15 text-teal-800 ring-1 ring-teal-500/25 dark:text-teal-200',
};

/** Her takvim günü farklı renk (döngüsel) */
const DAY_THEMES = [
  {
    stripe: 'bg-indigo-500',
    panel: 'border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-white/60 dark:border-indigo-800/50 dark:from-indigo-950/35 dark:to-zinc-900/30',
    header: 'text-indigo-900 dark:text-indigo-100',
    sub: 'text-indigo-600/80 dark:text-indigo-300/80',
    badge: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-200',
    card: 'border-indigo-100/80 bg-white/80 hover:border-indigo-300/80 hover:shadow-md hover:shadow-indigo-500/5 dark:border-indigo-900/30 dark:bg-zinc-900/50 dark:hover:border-indigo-700/50',
    cardActive: 'border-indigo-400 bg-indigo-50/90 shadow-md shadow-indigo-500/10 ring-2 ring-indigo-400/30 dark:border-indigo-500 dark:bg-indigo-950/40 dark:ring-indigo-500/25',
  },
  {
    stripe: 'bg-rose-500',
    panel: 'border-rose-200/70 bg-gradient-to-br from-rose-50/90 to-white/60 dark:border-rose-800/50 dark:from-rose-950/35 dark:to-zinc-900/30',
    header: 'text-rose-900 dark:text-rose-100',
    sub: 'text-rose-600/80 dark:text-rose-300/80',
    badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-200',
    card: 'border-rose-100/80 bg-white/80 hover:border-rose-300/80 hover:shadow-md hover:shadow-rose-500/5 dark:border-rose-900/30 dark:bg-zinc-900/50 dark:hover:border-rose-700/50',
    cardActive: 'border-rose-400 bg-rose-50/90 shadow-md shadow-rose-500/10 ring-2 ring-rose-400/30 dark:border-rose-500 dark:bg-rose-950/40 dark:ring-rose-500/25',
  },
  {
    stripe: 'bg-emerald-500',
    panel: 'border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white/60 dark:border-emerald-800/50 dark:from-emerald-950/35 dark:to-zinc-900/30',
    header: 'text-emerald-900 dark:text-emerald-100',
    sub: 'text-emerald-600/80 dark:text-emerald-300/80',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200',
    card: 'border-emerald-100/80 bg-white/80 hover:border-emerald-300/80 hover:shadow-md hover:shadow-emerald-500/5 dark:border-emerald-900/30 dark:bg-zinc-900/50 dark:hover:border-emerald-700/50',
    cardActive: 'border-emerald-400 bg-emerald-50/90 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-400/30 dark:border-emerald-500 dark:bg-emerald-950/40 dark:ring-emerald-500/25',
  },
  {
    stripe: 'bg-amber-500',
    panel: 'border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white/60 dark:border-amber-800/50 dark:from-amber-950/35 dark:to-zinc-900/30',
    header: 'text-amber-900 dark:text-amber-100',
    sub: 'text-amber-700/80 dark:text-amber-300/80',
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
    card: 'border-amber-100/80 bg-white/80 hover:border-amber-300/80 hover:shadow-md hover:shadow-amber-500/5 dark:border-amber-900/30 dark:bg-zinc-900/50 dark:hover:border-amber-700/50',
    cardActive: 'border-amber-400 bg-amber-50/90 shadow-md shadow-amber-500/10 ring-2 ring-amber-400/30 dark:border-amber-500 dark:bg-amber-950/40 dark:ring-amber-500/25',
  },
  {
    stripe: 'bg-sky-500',
    panel: 'border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-white/60 dark:border-sky-800/50 dark:from-sky-950/35 dark:to-zinc-900/30',
    header: 'text-sky-900 dark:text-sky-100',
    sub: 'text-sky-600/80 dark:text-sky-300/80',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-200',
    card: 'border-sky-100/80 bg-white/80 hover:border-sky-300/80 hover:shadow-md hover:shadow-sky-500/5 dark:border-sky-900/30 dark:bg-zinc-900/50 dark:hover:border-sky-700/50',
    cardActive: 'border-sky-400 bg-sky-50/90 shadow-md shadow-sky-500/10 ring-2 ring-sky-400/30 dark:border-sky-500 dark:bg-sky-950/40 dark:ring-sky-500/25',
  },
  {
    stripe: 'bg-violet-500',
    panel: 'border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-white/60 dark:border-violet-800/50 dark:from-violet-950/35 dark:to-zinc-900/30',
    header: 'text-violet-900 dark:text-violet-100',
    sub: 'text-violet-600/80 dark:text-violet-300/80',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-200',
    card: 'border-violet-100/80 bg-white/80 hover:border-violet-300/80 hover:shadow-md hover:shadow-violet-500/5 dark:border-violet-900/30 dark:bg-zinc-900/50 dark:hover:border-violet-700/50',
    cardActive: 'border-violet-400 bg-violet-50/90 shadow-md shadow-violet-500/10 ring-2 ring-violet-400/30 dark:border-violet-500 dark:bg-violet-950/40 dark:ring-violet-500/25',
  },
  {
    stripe: 'bg-orange-500',
    panel: 'border-orange-200/70 bg-gradient-to-br from-orange-50/90 to-white/60 dark:border-orange-800/50 dark:from-orange-950/35 dark:to-zinc-900/30',
    header: 'text-orange-900 dark:text-orange-100',
    sub: 'text-orange-600/80 dark:text-orange-300/80',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-200',
    card: 'border-orange-100/80 bg-white/80 hover:border-orange-300/80 hover:shadow-md hover:shadow-orange-500/5 dark:border-orange-900/30 dark:bg-zinc-900/50 dark:hover:border-orange-700/50',
    cardActive: 'border-orange-400 bg-orange-50/90 shadow-md shadow-orange-500/10 ring-2 ring-orange-400/30 dark:border-orange-500 dark:bg-orange-950/40 dark:ring-orange-500/25',
  },
] as const;

function dayTheme(dayIndex: number) {
  return DAY_THEMES[dayIndex % DAY_THEMES.length];
}

function trimHm(t: string) {
  return t?.slice(0, 5) ?? '';
}

function dayHeaderParts(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { weekday: '—', dayNum: '—', monthYear: ymd };
  return {
    weekday: d.toLocaleDateString('tr-TR', { weekday: 'long' }),
    dayNum: d.toLocaleDateString('tr-TR', { day: 'numeric' }),
    monthYear: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
  };
}

function assignableSessions(list: Session[]) {
  const companionIds = new Set(list.map((s) => s.pairedSessionId).filter((id): id is string => !!id));
  return list
    .filter((s) => !companionIds.has(s.id))
    .map((s) => ({ ...s, startTime: trimHm(s.startTime), endTime: trimHm(s.endTime) }));
}

function groupByDate(sessions: Session[]) {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = s.sessionDate?.slice(0, 10) || 'Tarihsiz';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.subjectName.localeCompare(b.subjectName, 'tr'));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}
type Teacher = { id: string; display_name: string | null; email: string };
type ProctorEntry = { userId: string; role: 'komisyon_uye' | 'gozcu' };
type TimetableByDate = Record<string, Record<number, { class_section: string; subject: string }>>;

function dateLabel(date: string) {
  try { return new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }); }
  catch { return date; }
}

function dateLabelShort(date: string) {
  try { return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); }
  catch { return date; }
}

const NO_GROUP = (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/40 px-3 py-10 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20 sm:gap-3 sm:rounded-2xl sm:py-16">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-10 text-indigo-400" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir sınav grubu seçin veya oluşturun.</p>
  </div>
);

export default function GorevlendirmePage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId  = searchParams.get('group_id') ?? '';
  const schoolQ  = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isSchoolAdmin = me?.role === 'school_admin';
  const { settings: schoolBell } = useSchoolTimetableSettings();

  const [sessions, setSessions]   = useState<Session[]>([]);
  const [teachers, setTeachers]   = useState<Teacher[]>([]);
  const [loading, setLoading]     = useState(!!groupId);
  const [selected, setSelected]   = useState<string | null>(null);
  const [proctors, setProctors]   = useState<ProctorEntry[]>([]);
  const [saving, setSaving]       = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [timetable, setTimetable] = useState<TimetableByDate>({});
  const [timetableLoading, setTimetableLoading] = useState(false);

  const [autoPanel, setAutoPanel]   = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoOpts, setAutoOpts] = useState({
    komisyonPerSession: 1,
    gozcuPerSession: 1,
    preferBranchMatch: true,
    excludeBusy: true,
    balanceLoad: true,
    overwrite: false,
  });

  const load = async () => {
    if (!token || !groupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token }),
        apiFetch<Teacher[]>(`/sorumluluk-exam/teachers${schoolQ}`, { token }),
      ]);
      setSessions(s); setTeachers(t);
    } catch { toast.error('Veri yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSession = async (s: Session) => {
    setSelected(s.id);
    setProctors(s.proctors?.map((p) => ({ userId: p.userId, role: p.role as 'komisyon_uye' | 'gozcu' })) ?? []);
    setTeacherSearch('');
    if (isSchoolAdmin && s.sessionDate) {
      setTimetableLoading(true);
      try {
        const data = await apiFetch<TimetableByDate>(`/teacher-timetable/by-date?date=${s.sessionDate}`, { token });
        setTimetable(data);
      } catch {
        setTimetable({});
      } finally {
        setTimetableLoading(false);
      }
    }
  };

  const addProctor = (userId: string, role: 'komisyon_uye' | 'gozcu') => {
    if (proctors.some((p) => p.userId === userId && p.role === role)) return;
    setProctors((prev) => [...prev, { userId, role }]);
  };

  const removeProctor = (userId: string, role: string) => {
    setProctors((prev) => prev.filter((p) => !(p.userId === userId && p.role === role)));
  };

  const runAutoAssign = async () => {
    setAutoRunning(true);
    try {
      const res = await apiFetch<{ assigned: number; total: number }>(
        `/sorumluluk-exam/groups/${groupId}/auto-assign-proctors${schoolQ}`,
        { method: 'POST', token, body: JSON.stringify(autoOpts) },
      );
      toast.success(`${res.assigned}/${res.total} oturuma görevlendirme yapıldı`);
      void load();
      setAutoPanel(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setAutoRunning(false); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${selected}/proctors${schoolQ}`, {
        method: 'POST', token, body: JSON.stringify({ proctors }),
      });
      toast.success('Görevlendirme kaydedildi');
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSaving(false); }
  };

  const getTeacherLessons = (teacherId: string) => {
    const lessons = timetable[teacherId];
    if (!lessons) return [];
    return Object.entries(lessons).map(([num, info]) => ({ num: parseInt(num, 10), ...info }));
  };

  const filteredTeachers = useMemo(() =>
    teachers.filter((t) => {
      const q = teacherSearch.toLowerCase();
      return !q || (t.display_name ?? t.email).toLowerCase().includes(q);
    }),
    [teachers, teacherSearch]
  );

  const assignable = useMemo(() => assignableSessions(sessions), [sessions]);
  const grouped = useMemo(() => groupByDate(assignable), [assignable]);
  const selectedSes = useMemo(
    () => assignable.find((s) => s.id === selected) ?? sessions.find((s) => s.id === selected),
    [assignable, sessions, selected],
  );

  const examWindow = selectedSes
    ? { start: trimHm(selectedSes.startTime), end: trimHm(selectedSes.endTime), dow: turkishDowFromYmd(selectedSes.sessionDate) }
    : null;

  const selectedDayIndex = selectedSes
    ? grouped.findIndex(([ymd]) => ymd === selectedSes.sessionDate.slice(0, 10))
    : -1;
  const activeDayTheme = selectedDayIndex >= 0 ? dayTheme(selectedDayIndex) : null;

  const getTeacherExamConflictLessons = (teacherId: string) => {
    if (!examWindow) return [];
    const lessonNums = getTeacherLessons(teacherId).map((l) => l.num);
    return teacherLessonNumsOverlappingExam(lessonNums, schoolBell, examWindow.dow, examWindow.start, examWindow.end);
  };

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  const komisyonCount     = proctors.filter((p) => p.role === 'komisyon_uye').length;
  const gozcuCount        = proctors.filter((p) => p.role === 'gozcu').length;
  const noProctorSessions = assignable.filter((s) => !s.proctors?.length).length;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/50">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/5 dark:bg-white/5">
          <Info className="size-4 text-slate-600 dark:text-slate-300" />
        </div>
        <p className="min-w-0 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-slate-100">Görevlendirme</span> — Sol listeden oturum seçin; her gün farklı renkle gösterilir. Sağdan komisyon ve gözcü atayın.
          {isSchoolAdmin && <span className="text-slate-500"> Ders programı çakışması işaretlenir.</span>}
        </p>
      </div>

      {assignable.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Toplam', value: assignable.length, icon: CalendarDays, tone: 'from-slate-500/10 to-slate-500/5 border-slate-200/80 text-slate-700 dark:text-slate-200' },
            { label: 'Atandı', value: assignable.length - noProctorSessions, icon: UserCheck, tone: 'from-teal-500/15 to-teal-500/5 border-teal-200/80 text-teal-700 dark:text-teal-200' },
            { label: 'Bekliyor', value: noProctorSessions, icon: AlertCircle, tone: noProctorSessions ? 'from-amber-500/15 to-amber-500/5 border-amber-200/80 text-amber-700 dark:text-amber-200' : 'from-emerald-500/15 to-emerald-500/5 border-emerald-200/80 text-emerald-700 dark:text-emerald-200' },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-2xl border bg-gradient-to-br p-3 text-center shadow-sm', s.tone)}>
              <s.icon className="mx-auto mb-1 size-4 opacity-70" />
              <p className="text-xl font-bold tabular-nums tracking-tight sm:text-2xl">{s.value}</p>
              <p className="mt-0.5 text-[10px] font-medium opacity-80">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {assignable.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <AlertCircle className="mx-auto mb-2 size-8 text-slate-300 dark:text-zinc-600" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Oturum bulunamadı</p>
          <p className="text-xs mt-1 text-muted-foreground">Önce Oturumlar veya Takvimden oturum oluşturun.</p>
        </div>
      )}

      {/* Otomatik dağıtım */}
      {assignable.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white/50 to-fuchsia-50/40 shadow-sm dark:border-violet-900/40 dark:from-violet-950/30 dark:via-zinc-900/20 dark:to-fuchsia-950/20">
          <button onClick={() => setAutoPanel((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-violet-500/5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/25">
              <Wand2 className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">Otomatik dağıtım</p>
              <p className="text-[11px] text-violet-700/90 dark:text-violet-300/90 truncate">Branş · sınav saatinde boş · yük dengesi</p>
            </div>
            <Settings2 className="size-4 text-violet-500 shrink-0 opacity-60" />
            {autoPanel ? <ChevronUp className="size-4 text-violet-500 shrink-0" /> : <ChevronDown className="size-4 text-violet-500 shrink-0" />}
          </button>

          {autoPanel && (
            <div className="border-t border-violet-200/60 px-4 pb-4 pt-3 space-y-4 dark:border-violet-900/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Komisyon / Oturum</label>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setAutoOpts((o) => ({ ...o, komisyonPerSession: Math.max(1, o.komisyonPerSession - 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">−</button>
                    <span className="w-8 text-center text-sm font-bold">{autoOpts.komisyonPerSession}</span>
                    <button type="button" onClick={() => setAutoOpts((o) => ({ ...o, komisyonPerSession: Math.min(10, o.komisyonPerSession + 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Gözcü / Oturum</label>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setAutoOpts((o) => ({ ...o, gozcuPerSession: Math.max(0, o.gozcuPerSession - 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">−</button>
                    <span className="w-8 text-center text-sm font-bold">{autoOpts.gozcuPerSession}</span>
                    <button type="button" onClick={() => setAutoOpts((o) => ({ ...o, gozcuPerSession: Math.min(10, o.gozcuPerSession + 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">+</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {([
                  { key: 'preferBranchMatch', label: 'Branş önceliği',        desc: 'Dersin branşındaki öğretmenler önce atanır' },
                  { key: 'excludeBusy',       label: 'Sınav saatinde dersi olmayanları ata', desc: 'Yayınlanmış ders programı ve okul ders saatleri çizelgesine göre yalnızca sınav aralığında dersi olmayan öğretmenler seçilir' },
                  { key: 'balanceLoad',       label: 'Yük dengesi',           desc: 'Az görevlendirilen öğretmenlere öncelik verilir' },
                  { key: 'overwrite',         label: 'Mevcut atamaları yaz',  desc: 'Zaten görevlisi olan oturumları da yeniden dağıt' },
                ] as const).map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="mt-0.5 relative">
                      <input type="checkbox" className="sr-only"
                        checked={autoOpts[key]}
                        onChange={(e) => setAutoOpts((o) => ({ ...o, [key]: e.target.checked }))} />
                      <div className={cn('size-4 rounded border-2 transition-colors flex items-center justify-center',
                        autoOpts[key]
                          ? 'bg-violet-600 border-violet-600 dark:bg-violet-500 dark:border-violet-500'
                          : 'border-slate-300 dark:border-zinc-600 group-hover:border-violet-400')}>
                        {autoOpts[key] && <svg className="size-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <Button size="sm" onClick={runAutoAssign} disabled={autoRunning}
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600">
                {autoRunning ? <LoadingSpinner className="size-4" /> : <Wand2 className="size-4" />}
                {autoRunning ? 'Dağıtılıyor...' : `Tüm ${assignable.length} Oturuma Otomatik Dağıt`}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
        <div className="space-y-3 max-h-[min(72vh,680px)] overflow-y-auto pr-1 scroll-smooth">
          <p className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md">
            <span className="flex size-5 items-center justify-center rounded-md bg-slate-900 text-[10px] text-white dark:bg-white dark:text-slate-900">1</span>
            Oturum seç
          </p>
          {grouped.map(([ymd, daySessions], dayIndex) => {
            const { weekday, dayNum, monthYear } = dayHeaderParts(ymd);
            const theme = dayTheme(dayIndex);
            return (
              <div key={ymd} className={cn('relative overflow-hidden rounded-2xl border p-2.5 shadow-sm sm:p-3', theme.panel)}>
                <div className={cn('absolute left-0 top-0 h-full w-1 rounded-l-2xl', theme.stripe)} />
                <div className="mb-2 flex items-center gap-2.5 pl-2">
                  <div className={cn('flex size-10 shrink-0 flex-col items-center justify-center rounded-xl font-bold tabular-nums shadow-sm', theme.badge)}>
                    <span className="text-lg leading-none">{dayNum}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm font-bold capitalize leading-tight', theme.header)}>{weekday}</p>
                    <p className={cn('text-[11px]', theme.sub)}>{monthYear}</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold tabular-nums', theme.badge)}>
                    {daySessions.length}
                  </span>
                </div>
                <div className="space-y-1.5 pl-2">
                {daySessions.map((s) => {
                  const komisyon = s.proctors?.filter((p) => p.role === 'komisyon_uye').length ?? 0;
                  const gozcu = s.proctors?.filter((p) => p.role === 'gozcu').length ?? 0;
                  const st = (s.sessionType ?? 'yazili') as SessionType;
                  const isActive = s.id === selected;
                  return (
                    <button key={s.id} type="button" onClick={() => selectSession(s)}
                      className={cn('w-full text-left rounded-xl border px-3 py-2.5 transition-all duration-200',
                        isActive ? theme.cardActive : theme.card)}>
                      <div className="flex items-start gap-2.5">
                        <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold shrink-0', SESSION_TYPE_BADGE[st])}>
                          {st === 'mixed' ? 'Y+U' : st === 'uygulama' ? 'U' : 'Y'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm leading-tight tracking-tight">{s.subjectName}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                            {s.startTime}–{s.endTime}
                            {s.roomName ? ` · ${s.roomName}` : ''}
                          </p>
                          {s.uygulamaCompanion && (
                            <p className="text-[10px] text-teal-700 dark:text-teal-400 mt-1 flex items-center gap-1">
                              <Link2 className="size-2.5 shrink-0" />
                              Uyg. {dateLabelShort(s.uygulamaCompanion.sessionDate)} {trimHm(s.uygulamaCompanion.startTime)}–{trimHm(s.uygulamaCompanion.endTime)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-1.5 flex-wrap">
                        {komisyon > 0 && (
                          <span className="rounded-full bg-indigo-500/12 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                            {komisyon} komisyon
                          </span>
                        )}
                        {gozcu > 0 && (
                          <span className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                            {gozcu} gözcü
                          </span>
                        )}
                        {komisyon === 0 && gozcu === 0 && (
                          <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Görevli yok
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-300/80 bg-gradient-to-br from-slate-50/80 to-white/40 p-10 text-center dark:border-zinc-700 dark:from-zinc-900/40 dark:to-zinc-950/20">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-zinc-800">
                <UserCheck className="size-7 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Oturum seçin</p>
              <p className="text-xs mt-1.5 max-w-xs mx-auto text-muted-foreground">Renkli gün bloklarından bir oturuma tıklayın.</p>
            </div>
          ) : selectedSes ? (
            <>
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded-md bg-slate-900 text-[10px] text-white dark:bg-white dark:text-slate-900">2</span>
                Görevli ata
              </p>

              <div className={cn(
                'relative overflow-hidden rounded-2xl border px-4 py-3 shadow-sm',
                activeDayTheme
                  ? cn(activeDayTheme.panel, 'border-opacity-100')
                  : 'border-teal-200/70 bg-gradient-to-br from-teal-50/90 to-white/60 dark:border-teal-800/40 dark:from-teal-950/30 dark:to-zinc-900/30',
              )}>
                {activeDayTheme && <div className={cn('absolute left-0 top-0 h-full w-1', activeDayTheme.stripe)} />}
                <p className={cn('text-sm font-bold pl-2', activeDayTheme?.header ?? 'text-teal-900 dark:text-teal-100')}>{selectedSes.subjectName}</p>
                <p className={cn('mt-1 pl-2 wrap-break-word text-xs tabular-nums', activeDayTheme?.sub ?? 'text-teal-700 dark:text-teal-400')}>
                  <span className="sm:hidden">{dateLabelShort(selectedSes.sessionDate)}</span>
                  <span className="hidden sm:inline">{dateLabel(selectedSes.sessionDate)}</span>
                  {' · '}
                  {trimHm(selectedSes.startTime)}–{trimHm(selectedSes.endTime)}
                </p>
                {selectedSes.uygulamaCompanion && (
                  <p className="text-[10px] text-teal-700 dark:text-teal-400 mt-1 flex items-center gap-1">
                    <Link2 className="size-2.5 shrink-0" />
                    Uygulama gününe aynı görevliler kopyalanır ({dateLabelShort(selectedSes.uygulamaCompanion.sessionDate)})
                  </p>
                )}
                {isSchoolAdmin && timetableLoading && (
                  <div className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                    <LoadingSpinner className="size-3" /> Ders programı kontrol ediliyor...
                  </div>
                )}
                {isSchoolAdmin && !timetableLoading && Object.keys(timetable).length > 0 && (
                  <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1">
                    Ders programı çakışmaları listede işaretlenir
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 to-white/50 px-3 py-3 text-center shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/40 dark:to-zinc-900/20">
                  <p className="text-2xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{komisyonCount}</p>
                  <p className="text-[10px] font-semibold text-indigo-600/90 dark:text-indigo-400">Komisyon</p>
                </div>
                <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-white/50 px-3 py-3 text-center shadow-sm dark:border-amber-900/40 dark:from-amber-950/40 dark:to-zinc-900/20">
                  <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{gozcuCount}</p>
                  <p className="text-[10px] font-semibold text-amber-600/90 dark:text-amber-400">Gözcü</p>
                </div>
              </div>

              {proctors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Atanan Görevliler</p>
                  {proctors.map((p, i) => {
                    const t       = teachers.find((t) => t.id === p.userId);
                    const lessons = getTeacherLessons(p.userId);
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2 dark:bg-zinc-900/50">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0',
                          p.role === 'komisyon_uye'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>
                          {p.role === 'komisyon_uye' ? 'Komisyon' : 'Gözcü'}
                        </span>
                        <span className="flex-1 text-sm">{t?.display_name ?? t?.email ?? p.userId}</span>
                        {lessons.length > 0 && (
                          <span title={`Bu gün: ${lessons.map(l => `${l.num}. saat ${l.class_section}`).join(', ')}`}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            {lessons.length} ders
                          </span>
                        )}
                        <button onClick={() => removeProctor(p.userId, p.role)} className="text-muted-foreground hover:text-red-600 shrink-0 ml-1">
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Öğretmen Listesi</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input placeholder="Öğretmen ara..." value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>

                <div className="rounded-2xl border border-slate-200/70 bg-white/80 shadow-inner dark:border-zinc-800/60 dark:bg-zinc-900/50 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {filteredTeachers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center p-4">Öğretmen bulunamadı</p>
                  )}
                  {filteredTeachers.map((t) => {
                    const isKomisyon = proctors.some((p) => p.userId === t.id && p.role === 'komisyon_uye');
                    const isGozcu    = proctors.some((p) => p.userId === t.id && p.role === 'gozcu');
                    const lessons    = getTeacherLessons(t.id);
                    const conflictNums = getTeacherExamConflictLessons(t.id);
                    const hasExamBusy = conflictNums.length > 0;
                    const dayLessonCount = lessons.length;
                    return (
                      <div key={t.id} className={cn('flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60',
                        hasExamBusy && 'bg-amber-50/40 dark:bg-amber-950/10')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight">{t.display_name ?? t.email}</p>
                          {hasExamBusy && examWindow && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <BookOpen className="size-2.5 text-amber-500 shrink-0" />
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                Sınav saatinde dersi var ({examWindow.start}–{examWindow.end}):&nbsp;
                                {conflictNums.slice(0, 3).map((n) => {
                                  const l = lessons.find((x) => x.num === n);
                                  const slot = lessonSlotForDay(schoolBell, examWindow.dow, n);
                                  return `${n}. saat${l?.class_section ? ` ${l.class_section}` : ''}${slot ? ` (${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)})` : ''}`;
                                }).join(', ')}
                                {conflictNums.length > 3 ? ` +${conflictNums.length - 3}` : ''}
                              </p>
                            </div>
                          )}
                          {!hasExamBusy && dayLessonCount > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Bu gün {dayLessonCount} ders (sınav saatiyle çakışmıyor)
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => addProctor(t.id, 'komisyon_uye')} disabled={isKomisyon}
                            className={cn('rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors',
                              isKomisyon
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 cursor-default dark:bg-indigo-950/40 dark:text-indigo-300'
                                : 'text-indigo-700 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-950/40')}>
                            {isKomisyon ? '✓ Komisyon' : 'Komisyon'}
                          </button>
                          <button onClick={() => addProctor(t.id, 'gozcu')} disabled={isGozcu}
                            className={cn('rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors',
                              isGozcu
                                ? 'bg-amber-100 text-amber-700 border-amber-200 cursor-default dark:bg-amber-950/40 dark:text-amber-300'
                                : 'text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/40')}>
                            {isGozcu ? '✓ Gözcü' : 'Gözcü'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button size="sm" className="w-full gap-2 rounded-xl bg-slate-900 py-2.5 text-white shadow-lg shadow-slate-900/20 hover:bg-slate-800 dark:bg-teal-600 dark:shadow-teal-900/30 dark:hover:bg-teal-500" onClick={save} disabled={saving}>
                {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
                Görevlendirmeyi Kaydet
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
