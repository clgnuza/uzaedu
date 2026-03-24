'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Printer,
  UserX,
  UserCog,
  Calendar,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  CheckCircle2,
  Users,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DutyDistributionChart } from '@/components/duty/duty-distribution-chart';
import { buildColorMap, getTeacherColor } from '@/components/duty/teacher-color';
import { TeacherDetailPanel } from '@/components/duty/teacher-detail-panel';
import LessonCoverageDialog from '@/components/duty/LessonCoverageDialog';

type SummaryItem = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  slot_count: number;
  weighted_count?: number;
  replacement_count?: number;
  regular_count?: number;
};

type DutySlot = {
  id: string;
  date: string;
  shift?: 'morning' | 'afternoon';
  slot_name: string | null;
  area_name: string | null;
  note: string | null;
  user_id: string;
  lesson_num?: number | null;
  lesson_count?: number;
  reassigned_from_user_id?: string | null;
  user?: { id: string; display_name: string | null; email: string; duty_exempt?: boolean };
  absent_marked_at: string | null;
};

type DailyResponse = {
  date: string;
  slots: DutySlot[];
};

type UserItem = {
  id: string;
  display_name: string | null;
  email: string;
  role?: string;
  teacherBranch?: string | null;
  dutyExempt?: boolean;
};
type SlotInput = { user_id: string; area_name: string };

const VIEW_MODE = ['month', 'week', 'day'] as const;
type ViewMode = (typeof VIEW_MODE)[number];

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  return `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'long' })} - ${dayNames[d.getDay()]} Günü Nöbetçileri`;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** TR: Hafta Pazartesi'den başlar */
function getWeekBounds(ymd: string) {
  const d = new Date(ymd + 'T12:00:00');
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toYMD(monday), to: toYMD(sunday) };
}

function getMonthBounds(ymd: string) {
  const d = new Date(ymd + 'T12:00:00');
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { from: toYMD(first), to: toYMD(last) };
}

/** Ay grid'i için: Pzt=0, Paz=6 */
function getDayOfWeek(d: Date) {
  const n = d.getDay();
  return n === 0 ? 6 : n - 1;
}

function groupSlotsByDate(slots: DutySlot[]): Record<string, DutySlot[]> {
  const map: Record<string, DutySlot[]> = {};
  for (const s of slots) {
    if (!map[s.date]) map[s.date] = [];
    map[s.date].push(s);
  }
  return map;
}

type ActivePlan = { id: string; period_start: string | null; period_end: string | null; version: string | null };

export default function DutyPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const isTeacher = me?.role === 'teacher';
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [focusDate, setFocusDate] = useState(() => toYMD(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [data, setData] = useState<DailyResponse | null>(null);
  const [rangeSlots, setRangeSlots] = useState<DutySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestPlan, setLatestPlan] = useState<ActivePlan | null>(null);
  const [autoNavigated, setAutoNavigated] = useState(false);
  const [panelTeacherId, setPanelTeacherId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [createDate, setCreateDate] = useState(() => toYMD(new Date()));
  const [createSlots, setCreateSlots] = useState<SlotInput[]>([{ user_id: '', area_name: '' }]);
  const [creating, setCreating] = useState(false);
  const [reassignSlot, setReassignSlot] = useState<DutySlot | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [markingAbsent, setMarkingAbsent] = useState<string | null>(null);
  const [markAbsentSlot, setMarkAbsentSlot] = useState<DutySlot | null>(null);
  const [coverageSlotId, setCoverageSlotId] = useState<string | null>(null);
  const [summaryItems, setSummaryItems] = useState<SummaryItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [createSummary, setCreateSummary] = useState<SummaryItem[]>([]);
  const [suggestedTeachers, setSuggestedTeachers] = useState<
    { user_id: string; display_name: string | null; email: string; free_lesson_count: number; has_target_free: boolean; slot_lesson_num: number | null }[]
  >([]);
  const [timetableByDate, setTimetableByDate] = useState<Record<string, Record<number, unknown>>>({});

  const displayDate = viewMode === 'day' ? selectedDate : focusDate;

  // Tüm nöbet slotlarındaki benzersiz öğretmen ID'lerinden deterministik renk haritası
  const colorMap = useMemo(() => {
    const ids = [
      ...new Set([
        ...rangeSlots.map((s) => s.user_id),
        ...(data?.slots?.map((s) => s.user_id) ?? []),
        ...teachers.map((t) => t.id),
      ]),
    ];
    return buildColorMap(ids);
  }, [rangeSlots, data?.slots, teachers]);

  const fetchDaily = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DailyResponse>(`/duty/daily?date=${selectedDate}`, { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  const fetchRange = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const { from, to } = viewMode === 'month' ? getMonthBounds(focusDate) : getWeekBounds(focusDate);
    try {
      const slots = await apiFetch<DutySlot[]>(`/duty/daily-range?from=${from}&to=${to}`, { token });
      setRangeSlots(Array.isArray(slots) ? slots : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi.');
      setRangeSlots([]);
    } finally {
      setLoading(false);
    }
  }, [token, focusDate, viewMode]);

  // Aktif plan tespiti: planlar yüklenince en son yayınlanan planı bul
  const fetchLatestPlan = useCallback(async () => {
    if (!token) return;
    try {
      const plans = await apiFetch<ActivePlan[]>('/duty/plans', { token });
      const published = Array.isArray(plans)
        ? plans
            .filter((p) => p.period_start)
            .sort((a, b) => (b.period_start! > a.period_start! ? 1 : -1))
        : [];
      setLatestPlan(published[0] ?? null);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => { fetchLatestPlan(); }, [fetchLatestPlan]);

  // Mevcut ayda veri yoksa en son plana otomatik git (ilk yüklemede bir kez)
  useEffect(() => {
    if (!autoNavigated && !loading && rangeSlots.length === 0 && latestPlan?.period_start) {
      const planYMD = latestPlan.period_start.slice(0, 10);
      const currentBounds = viewMode === 'month' ? getMonthBounds(focusDate) : getWeekBounds(focusDate);
      if (planYMD < currentBounds.from || planYMD > currentBounds.to) {
        setFocusDate(planYMD);
        setAutoNavigated(true);
      }
    }
  }, [loading, rangeSlots.length, latestPlan, autoNavigated, focusDate, viewMode]);

  useEffect(() => {
    if (viewMode === 'day') {
      fetchDaily();
    } else {
      fetchRange();
    }
  }, [viewMode, fetchDaily, fetchRange]);

  const fetchTeachers = useCallback(async () => {
    if (!token) return;
    try {
      const [teachersList, areasList] = await Promise.all([
        apiFetch<UserItem[]>('/duty/teachers', { token }),
        apiFetch<{ id: string; name: string }[]>('/duty/areas', { token }).catch(() => []),
      ]);
      setTeachers(Array.isArray(teachersList) ? teachersList : []);
      setAreas(Array.isArray(areasList) ? areasList : []);
    } catch {
      setTeachers([]);
      setAreas([]);
    }
  }, [token]);

  // Dialog açılırken + sayfa açılışında öğretmen listesini yükle (renk + panel için)
  useEffect(() => {
    if (token) fetchTeachers();
  }, [token, fetchTeachers]);

  useEffect(() => {
    if (createOpen || reassignSlot) fetchTeachers();
  }, [createOpen, reassignSlot, fetchTeachers]);

  const fetchSuggestedReplacement = useCallback(async () => {
    if (!token || !reassignSlot) return;
    try {
      const list = await apiFetch<{ user_id: string; display_name: string | null; email: string; free_lesson_count: number; has_target_free: boolean; slot_lesson_num: number | null }[]>(
        `/duty/suggest-replacement?duty_slot_id=${reassignSlot.id}`,
        { token },
      );
      setSuggestedTeachers(Array.isArray(list) ? list : []);
    } catch {
      setSuggestedTeachers([]);
    }
  }, [token, reassignSlot]);

  useEffect(() => {
    if (reassignSlot && token) fetchSuggestedReplacement();
    else setSuggestedTeachers([]);
  }, [reassignSlot?.id, token, fetchSuggestedReplacement]);

  const fetchTimetableForDate = useCallback(async () => {
    if (!token || !createOpen) return;
    try {
      const data = await apiFetch<Record<string, Record<number, { class_section: string; subject: string }>>>(
        `/teacher-timetable/by-date?date=${createDate}`,
        { token },
      );
      setTimetableByDate(data ?? {});
    } catch {
      setTimetableByDate({});
    }
  }, [token, createDate, createOpen]);

  useEffect(() => {
    if (createOpen && createDate) fetchTimetableForDate();
    else setTimetableByDate({});
  }, [createOpen, createDate, fetchTimetableForDate]);

  const fetchSummaryForReassign = useCallback(async () => {
    if (!token || !reassignSlot) return;
    setSummaryLoading(true);
    const { from, to } = getMonthBounds(reassignSlot.date);
    try {
      const res = await apiFetch<{ items: SummaryItem[] }>(
        `/duty/summary?from=${from}&to=${to}`,
        { token },
      );
      setSummaryItems(res?.items ?? []);
    } catch {
      setSummaryItems([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [token, reassignSlot]);

  useEffect(() => {
    if (reassignSlot) fetchSummaryForReassign();
  }, [reassignSlot?.id, fetchSummaryForReassign]);

  const fetchSummaryForCreate = useCallback(async () => {
    if (!token || !createOpen) return;
    const { from, to } = getMonthBounds(createDate);
    try {
      const res = await apiFetch<{ items: SummaryItem[] }>(`/duty/summary?from=${from}&to=${to}`, { token });
      setCreateSummary(res?.items ?? []);
    } catch {
      setCreateSummary([]);
    }
  }, [token, createOpen, createDate]);

  useEffect(() => {
    if (createOpen) fetchSummaryForCreate();
  }, [createOpen, createDate, fetchSummaryForCreate]);

  const refresh = useCallback(() => {
    if (viewMode === 'day') fetchDaily();
    else fetchRange();
  }, [viewMode, fetchDaily, fetchRange]);

  const addSlotRow = () => setCreateSlots((s) => [...s, { user_id: '', area_name: '' }]);
  const removeSlotRow = (i: number) => setCreateSlots((s) => s.filter((_, j) => j !== i));
  const updateSlot = (i: number, field: 'user_id' | 'area_name', val: string) =>
    setCreateSlots((s) => s.map((x, j) => (j === i ? { ...x, [field]: val } : x)));

  const handleCreatePlan = async () => {
    if (!token) return;
    const valid = createSlots.filter((s) => s.user_id);
    if (valid.length === 0) {
      toast.error('En az bir öğretmen seçin.');
      return;
    }
    setCreating(true);
    try {
      const plan = await apiFetch<{ id: string }>('/duty/plans', {
        token,
        method: 'POST',
        body: JSON.stringify({
          version: createDate,
          period_start: createDate,
          period_end: createDate,
          slots: valid.map((s) => ({
            date: createDate,
            user_id: s.user_id,
            area_name: s.area_name || null,
          })),
        }),
      });
      await apiFetch(`/duty/plans/${plan.id}/publish`, { token, method: 'POST' });
      toast.success('Plan oluşturuldu ve yayınlandı.');
      setCreateOpen(false);
      setCreateSlots([{ user_id: '', area_name: '' }]);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Plan oluşturulamadı.');
    } finally {
      setCreating(false);
    }
  };

  const navPrev = () => {
    const d = new Date(displayDate + 'T12:00:00');
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    const ymd = toYMD(d);
    setFocusDate(ymd);
    if (viewMode === 'day') setSelectedDate(ymd);
  };

  const navNext = () => {
    const d = new Date(displayDate + 'T12:00:00');
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    const ymd = toYMD(d);
    setFocusDate(ymd);
    if (viewMode === 'day') setSelectedDate(ymd);
  };

  const goToday = () => {
    const ymd = toYMD(new Date());
    setFocusDate(ymd);
    setSelectedDate(ymd);
  };

  const handlePrint = () => window.print();

  const handleMarkAbsentClick = (slot: DutySlot) => {
    setMarkAbsentSlot(slot);
  };

  const handleMarkAbsentConfirm = async (absent_type: 'raporlu' | 'izinli' | 'gelmeyen') => {
    const slot = markAbsentSlot;
    if (!token || !slot) return;
    setMarkingAbsent(slot.id);
    try {
      const res = await apiFetch<{ success: boolean; coverage_lessons?: number[] }>('/duty/mark-absent', {
        token,
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: slot.id, absent_type }),
      });
      const labels = { raporlu: 'Raporlu', izinli: 'İzinli', gelmeyen: 'Gelmeyen' };
      const count = res?.coverage_lessons?.length ?? 0;
      toast.success(
        count > 0
          ? `${labels[absent_type]} olarak işaretlendi. ${count} ders boşa çıkacak — Ayarlamaya geçiliyor...`
          : `${labels[absent_type]} olarak işaretlendi.`,
      );
      setMarkAbsentSlot(null);
      refresh();
      setCoverageSlotId(slot.id);
      window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setMarkingAbsent(null);
    }
  };

  const handleReassign = async () => {
    if (!token || !reassignSlot || !reassignUserId) return;
    setReassigning(true);
    try {
      await apiFetch('/duty/reassign', {
        token,
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: reassignSlot.id, new_user_id: reassignUserId }),
      });
      toast.success('Yerine görevlendirme yapıldı.');
      setReassignSlot(null);
      setReassignUserId('');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setReassigning(false);
    }
  };

  const goToDay = (ymd: string) => {
    setSelectedDate(ymd);
    setFocusDate(ymd);
    setViewMode('day');
  };

  const headerTitle = (() => {
    const d = new Date(displayDate + 'T12:00:00');
    if (viewMode === 'month') {
      return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const { from, to } = getWeekBounds(displayDate);
      const fromD = new Date(from + 'T12:00:00');
      const toD = new Date(to + 'T12:00:00');
      return `${fromD.getDate()} ${MONTH_NAMES[fromD.getMonth()]} - ${toD.getDate()} ${MONTH_NAMES[toD.getMonth()]} ${toD.getFullYear()}`;
    }
    return formatDateLabel(displayDate);
  })();

  const slotsByDate = groupSlotsByDate(rangeSlots);
  const todayYMD = toYMD(new Date());

  /** Sadece bugünün devamsız slotları – banner yalnızca bugün için */
  const todayAbsentSlots = useMemo(() => {
    if (viewMode === 'day') {
      if (selectedDate !== todayYMD) return [];
      return (data?.slots ?? []).filter((s) => s.absent_marked_at);
    }
    return rangeSlots.filter((s) => s.date === todayYMD && s.absent_marked_at);
  }, [viewMode, selectedDate, todayYMD, data?.slots, rangeSlots]);
  const firstTodayAbsentSlot = todayAbsentSlots[0] ?? null;

  const [dayCoverages, setDayCoverages] = useState<{ duty_slot_id: string; lesson_num: number; covered_by_user_id: string | null }[]>([]);
  useEffect(() => {
    if (!token || !isAdmin || todayAbsentSlots.length === 0) return;
    apiFetch<{ duty_slot_id: string; lesson_num: number; covered_by_user_id: string | null }[]>(
      `/duty/coverage-by-date?date=${todayYMD}`,
      { token },
    )
      .then((items) => setDayCoverages(Array.isArray(items) ? items : []))
      .catch(() => setDayCoverages([]));
  }, [token, isAdmin, todayYMD, todayAbsentSlots.length, coverageSlotId]);

  const dayPendingCount = useMemo(() => {
    if (todayAbsentSlots.length === 0) return 0;
    const slotIds = new Set(todayAbsentSlots.map((s) => s.id));
    return dayCoverages.filter((c) => slotIds.has(c.duty_slot_id) && !c.covered_by_user_id).length;
  }, [dayCoverages, todayAbsentSlots]);
  const dayAllDone = todayAbsentSlots.length > 0 && dayPendingCount === 0;

  // Öğretmen için bugünün nöbet arkadaşları
  const today = toYMD(new Date());
  const [todayPartners, setTodayPartners] = useState<{ user_id: string; display_name: string | null; email: string; area_name: string | null; shift: string | null }[]>([]);

  useEffect(() => {
    if (!isTeacher || !token) return;
    apiFetch<typeof todayPartners>(`/duty/partners?date=${today}`, { token })
      .then((res) => setTodayPartners(Array.isArray(res) ? res : []))
      .catch(() => setTodayPartners([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher, token, today]);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Devamsız öğretmen banner'ı – sadece bugünün atamaları için */}
      {isAdmin && todayAbsentSlots.length > 0 && (
        <div
          className={cn(
            'sticky top-0 z-40 mb-4 rounded-xl border-2 p-4 shadow-lg flex flex-wrap items-center justify-between gap-4',
            dayAllDone
              ? 'border-emerald-500 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-900/40 ring-2 ring-emerald-400/50'
              : 'border-amber-500 bg-amber-100 dark:border-amber-500 dark:bg-amber-900/50 shadow-amber-500/20 ring-2 ring-amber-400/50',
          )}
        >
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'flex size-14 items-center justify-center rounded-xl shrink-0 shadow-md text-white',
                dayAllDone ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            >
              {dayAllDone ? <CheckCircle2 className="size-7" /> : <span className="text-3xl">⚠</span>}
            </div>
            <div>
              <h3 className={cn('font-bold text-lg', dayAllDone ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-900 dark:text-amber-100')}>
                {dayAllDone ? 'İşlem tamamlandı' : `${todayAbsentSlots.length} devamsız öğretmen · Ayarlama gerekli`}
              </h3>
              <p className={cn('text-sm mt-0.5 font-medium', dayAllDone ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200')}>
                {dayAllDone ? 'Tüm ders atamaları yapıldı.' : 'Boşa çıkacak dersler için görevlendirme yapın.'}
              </p>
            </div>
          </div>
          {!dayAllDone && (
            <Button
              onClick={() => firstTodayAbsentSlot && setCoverageSlotId(firstTodayAbsentSlot.id)}
              size="lg"
              className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg text-base px-6"
            >
              <CalendarCheck className="size-5" />
              Ayarlamaya Git
            </Button>
          )}
        </div>
      )}

      {/* Öğretmen: Bugün Nöbet Arkadaşlarım */}
      {isTeacher && todayPartners.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center size-8 rounded-lg bg-primary/15">
              <Users className="size-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Bugün Nöbet Arkadaşlarım</h3>
              <p className="text-xs text-muted-foreground">{new Date(today + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {todayPartners.map((partner) => (
              <div key={partner.user_id} className="flex items-center gap-2.5 rounded-lg bg-background border border-border px-3 py-2.5">
                <div className="flex items-center justify-center size-7 rounded-full bg-primary/10 shrink-0">
                  <Users className="size-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{partner.display_name || partner.email || '—'}</p>
                  {partner.area_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="size-3" />
                      {partner.area_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:flex-row">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Nöbet Planlaması</h1>
          {!isAdmin && (
            <p className="mt-1 text-sm text-muted-foreground">Sadece size atanan nöbetler gösteriliyor.</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="size-4" />
            Yazdır
          </Button>
        </div>
      </div>

      {/* Mosaic tarzı takvim araç çubuğu */}
      <Card className="overflow-hidden rounded-xl border-primary/20 print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Görünüm seçici */}
            <div className="flex rounded-lg border border-border bg-muted/30 p-1">
              {[
                { id: 'month' as ViewMode, label: 'Ay', icon: Calendar },
                { id: 'week' as ViewMode, label: 'Hafta', icon: CalendarRange },
                { id: 'day' as ViewMode, label: 'Gün', icon: CalendarDays },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    viewMode === id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Başlık + navigasyon */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={navPrev} disabled={loading} className="h-9 w-9 shrink-0">
                <ChevronLeft className="size-4" />
              </Button>
              <h2 className="min-w-[200px] text-center text-base font-semibold text-foreground">
                {headerTitle}
              </h2>
              <Button variant="outline" size="icon" onClick={navNext} disabled={loading} className="h-9 w-9 shrink-0">
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToday}
                className="shrink-0 border-primary/40 text-primary hover:bg-primary/10"
              >
                <CalendarCheck className="size-4" />
                Bugün
              </Button>
              {latestPlan?.period_start && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFocusDate(latestPlan.period_start!.slice(0, 10));
                    setSelectedDate(latestPlan.period_start!.slice(0, 10));
                  }}
                  className="shrink-0 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  title={`Son plan: ${latestPlan.version ?? latestPlan.period_start}`}
                >
                  <CalendarRange className="size-4" />
                  <span className="hidden sm:inline">Son Plan</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="error" title="Hata">
          {error}
        </Alert>
      )}

      {/* Akış rehberi – boş durumda veya admin için */}
      {isAdmin && (viewMode === 'month' || viewMode === 'week') && rangeSlots.length === 0 && (
        <Card className="border-primary/30 bg-primary/5 print:hidden">
          <CardContent className="p-4">
            <h3 className="font-medium text-foreground mb-2">Nöbet yönetimine nasıl başlarım?</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/duty/gelmeyen" className="text-primary hover:underline font-medium">Gelmeyen Ekle</Link>
                {' '}– Raporlu, izinli veya gelmeyen öğretmenleri kaydedin.
              </li>
              <li>
                <Link href="/duty/planlar" className="text-primary hover:underline font-medium">Planlar</Link>
                {' '}– Otomatik görevlendirme veya Excel ile plan oluşturun.
              </li>
              <li>
                Planı <strong>Yayınla</strong> – Taslak planı yayınlayarak okulda görünür hale getirin.
              </li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Ay görünümü */}
      {viewMode === 'month' && (
        <Card className="overflow-hidden rounded-xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-px rounded-xl border border-border bg-muted/30 overflow-hidden">
              {DAY_NAMES.map((name) => (
                <div
                  key={name}
                  className="bg-muted/60 px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {name}
                </div>
              ))}
              {(() => {
                const d = new Date(displayDate + 'T12:00:00');
                const year = d.getFullYear();
                const month = d.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const startOffset = getDayOfWeek(firstDay);
                const totalDays = lastDay.getDate();
                const cells: { ymd: string | null; day: number | null }[] = [];
                for (let i = 0; i < startOffset; i++) cells.push({ ymd: null, day: null });
                for (let day = 1; day <= totalDays; day++) {
                  const date = new Date(year, month, day);
                  cells.push({ ymd: toYMD(date), day });
                }
                const remainder = (7 - (cells.length % 7)) % 7;
                for (let i = 0; i < remainder; i++) cells.push({ ymd: null, day: null });
                return cells.map(({ ymd, day }, idx) => (
                  <div
                    key={idx}
                    onClick={() => ymd && goToDay(ymd)}
                    className={cn(
                      'min-h-[76px] overflow-hidden rounded-md bg-background p-2 transition-colors',
                      ymd
                        ? 'cursor-pointer hover:bg-primary/5 active:bg-primary/10'
                        : 'cursor-default bg-muted/20',
                      ymd && ymd === todayYMD && 'ring-2 ring-primary/40 ring-inset',
                    )}
                  >
                    {day != null && (
                      <>
                        <span
                          className={cn(
                            'inline-flex size-7 items-center justify-center rounded-full text-sm font-medium',
                            ymd === todayYMD ? 'bg-primary text-primary-foreground' : 'text-foreground',
                          )}
                        >
                          {day}
                        </span>
                        {ymd && slotsByDate[ymd] && (
                          <div className="mt-1 space-y-0.5">
                            {slotsByDate[ymd].slice(0, 3).map((s) => {
                              const col = getTeacherColor(s.user_id, colorMap);
                              return (
                                <div
                                  key={s.id}
                                  onClick={(e) => { e.stopPropagation(); setPanelTeacherId(s.user_id); }}
                                  className={cn(
                                    'flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs cursor-pointer transition-opacity hover:opacity-80',
                                    col.bg, col.text,
                                    col.darkBg, col.darkText,
                                    s.absent_marked_at && 'opacity-50 line-through',
                                  )}
                                >
                                  <span className={cn('size-1.5 shrink-0 rounded-full', col.dot)} />
                                  <span className="truncate">
                                    {s.user?.display_name || s.user?.email || '—'}
                                  </span>
                                </div>
                              );
                            })}
                            {slotsByDate[ymd].length > 3 && (
                              <span className="text-xs text-muted-foreground pl-1">+{slotsByDate[ymd].length - 3} daha</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ));
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hafta görünümü */}
      {viewMode === 'week' && (
        <Card className="overflow-hidden rounded-xl">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 divide-x divide-border">
              {(() => {
                const { from } = getWeekBounds(focusDate);
                const days: string[] = [];
                const d = new Date(from + 'T12:00:00');
                for (let i = 0; i < 7; i++) {
                  days.push(toYMD(d));
                  d.setDate(d.getDate() + 1);
                }
                return days.map((ymd) => {
                  const slots = slotsByDate[ymd] ?? [];
                  const isToday = ymd === todayYMD;
                  const date = new Date(ymd + 'T12:00:00');
                  return (
                    <div
                      key={ymd}
                      className={cn(
                        'min-h-[200px] flex flex-col',
                        isToday && 'bg-primary/5',
                      )}
                    >
                      <div
                        className={cn(
                          'border-b px-3 py-3 text-center text-sm font-medium',
                          isToday ? 'border-primary/30 bg-primary/10 text-primary font-semibold' : 'border-border bg-muted/50',
                        )}
                      >
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">{DAY_NAMES[getDayOfWeek(date)]}</div>
                        <div className={cn('text-xl font-bold mt-0.5', isToday && 'text-primary')}>{date.getDate()}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {MONTH_NAMES[date.getMonth()]}
                        </div>
                      </div>
                      <div className="flex-1 space-y-1 p-2">
                        {slots.length === 0 ? (
                          <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 py-6 text-center text-xs text-muted-foreground">
                            Nöbet yok
                          </div>
                        ) : (
                          slots.map((s) => {
                            const col = getTeacherColor(s.user_id, colorMap);
                            return (
                              <div
                                key={s.id}
                                onClick={() => setPanelTeacherId(s.user_id)}
                                className={cn(
                                  'cursor-pointer rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors select-none',
                                  col.bg, col.text, col.border, col.hoverBg,
                                  col.darkBg, col.darkText,
                                  s.absent_marked_at && 'opacity-50',
                                )}
                              >
                                <div className="flex items-center gap-1">
                                  <span
                                    className={cn('size-1.5 shrink-0 rounded-full', col.dot)}
                                  />
                                  <span className="truncate font-semibold">
                                    {s.user?.display_name || s.user?.email || '—'}
                                  </span>
                                </div>
                                <div className="mt-0.5 truncate text-[10px] opacity-75">
                                  {s.lesson_num ? `${s.lesson_num}. ders` : (s.area_name || '—')}
                                  {s.lesson_num && s.area_name ? ` · ${s.area_name}` : ''}
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-1">
                                  {s.absent_marked_at && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setCoverageSlotId(s.id); }}
                                      className="rounded bg-rose-200 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-800 hover:bg-rose-300 dark:bg-rose-900/60 dark:text-rose-200"
                                      title="Ders saati bazlı görevlendirme"
                                    >
                                      Gelmeyen ⚡
                                    </button>
                                  )}
                                  {s.reassigned_from_user_id && (
                                    <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                      Yerine Görev
                                    </span>
                                  )}
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        goToDay(ymd);
                                      }}
                                      className="rounded px-1 py-0.5 text-[9px] opacity-60 hover:opacity-100 hover:underline"
                                      title="Gün görünümüne git"
                                    >
                                      detay
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gün görünümü */}
      {viewMode === 'day' && (
        <>
          <Card className="overflow-hidden rounded-xl border-emerald-600/30 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                {formatDateLabel(selectedDate)}
              </h2>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (
            <Card className="overflow-hidden rounded-xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse duty-print-table">
                    <thead>
                      <tr className="border-b bg-muted/60">
                        <th className="border-b border-r px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Nöbetçi
                        </th>
                        <th className="border-b border-r px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Konum
                        </th>
                        <th className="border-b border-r px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                          Slot
                        </th>
                        {isAdmin && (
                          <th className="border-b px-4 py-3.5 text-left text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 print:hidden">
                            İşlemler
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data?.slots?.length ? (
                        data.slots.map((slot) => {
                          const col = getTeacherColor(slot.user_id, colorMap);
                          return (
                          <tr key={slot.id} className="border-b last:border-b-0 hover:bg-muted/40 transition-colors">
                            <td className="border-r px-4 py-2 text-sm">
                              <button
                                type="button"
                                onClick={() => setPanelTeacherId(slot.user_id)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80',
                                  col.bg, col.text, col.darkBg, col.darkText,
                                  slot.absent_marked_at && 'opacity-50 line-through',
                                )}
                              >
                                <span className={cn('size-1.5 shrink-0 rounded-full', col.dot)} />
                                {slot.user?.display_name || slot.user?.email || '—'}
                              </button>
                              {slot.absent_marked_at && (
                                <span className="ml-2 inline-flex items-center rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                                  Gelmeyen
                                </span>
                              )}
                              {slot.reassigned_from_user_id && (
                                <span className="ml-2 inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  Değiştirildi
                                </span>
                              )}
                            </td>
                            <td className="border-r px-4 py-2 text-sm text-muted-foreground">
                              {slot.area_name || '—'}
                            </td>
                            <td className="border-r px-4 py-2 text-sm text-muted-foreground">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {slot.lesson_num && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 shrink-0">
                                    {slot.lesson_num}. ders
                                  </span>
                                )}
                                <span>{slot.slot_name || slot.note || (slot.lesson_num ? '' : '—')}</span>
                              </div>
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-2 print:hidden">
                                <div className="flex gap-1">
                                  {!slot.absent_marked_at && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                      onClick={() => handleMarkAbsentClick(slot)}
                                      disabled={!!markingAbsent}
                                      title="Gelmeyen işaretle"
                                    >
                                      <UserX className="size-4" />
                                    </Button>
                                  )}
                                  {slot.absent_marked_at && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                      onClick={() => setCoverageSlotId(slot.id)}
                                      title="Ders saati bazlı görevlendirme"
                                    >
                                      <CalendarCheck className="size-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                      setReassignSlot(slot);
                                      setReassignUserId('');
                                    }}
                                    title="Yerine görevlendir (tekli)"
                                  >
                                    <UserCog className="size-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                            Bu tarihte nöbetçi kaydı yok. Plan oluşturup yayınlayabilirsiniz.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Ay/Hafta görünümünde loading */}
      {(viewMode === 'month' || viewMode === 'week') && loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {isAdmin && (
        <Card className="print:hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Plan İşlemleri</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(!createOpen)}>
              <Plus className="size-4" />
              {createOpen ? 'Kapat' : 'Plan Oluştur'}
            </Button>
          </CardHeader>
          {createOpen && (
            <CardContent className="space-y-4 border-t pt-4">
              {createSummary.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Adil dağıt önerisi</p>
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    {Object.keys(timetableByDate).length > 0
                      ? `Bu gün dersi az olanlar (MEB: dersi az günde nöbet): ${teachers
                          .map((t) => ({ t, count: Object.keys(timetableByDate[t.id] ?? {}).length }))
                          .sort((a, b) => a.count - b.count)
                          .slice(0, 5)
                          .map((x) => `${x.t.display_name || x.t.email} (${x.count} ders)`)
                          .join(', ')}`
                      : `Bu ay en az nöbeti olanlar: ${createSummary
                          .filter((s) => s.slot_count >= 0)
                          .sort((a, b) => a.slot_count - b.slot_count)
                          .slice(0, 5)
                          .map((s) => `${s.display_name || s.email} (${s.slot_count})`)
                          .join(', ')}`}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                    onClick={() => {
                      const teacherIds = new Set(teachers.map((t) => t.id));
                      const hasTimetable = Object.keys(timetableByDate).length > 0;
                      const first = hasTimetable
                        ? [...teachers]
                            .filter((t) => teacherIds.has(t.id))
                            .map((t) => ({ t, lessons: Object.keys(timetableByDate[t.id] ?? {}).length }))
                            .sort((a, b) => a.lessons - b.lessons)[0]?.t
                        : [...createSummary]
                            .filter((s) => teacherIds.has(s.user_id))
                            .sort((a, b) => a.slot_count - b.slot_count)[0];
                      const id = first && 'user_id' in first ? first.user_id : (first as { id: string })?.id;
                      if (id && createSlots[0]) updateSlot(0, 'user_id', id);
                    }}
                  >
                    {Object.keys(timetableByDate).length > 0
                      ? 'İlk satıra bu gün en az dersi olanı ekle'
                      : 'İlk satıra en az nöbetliyi ekle'}
                  </Button>
                </div>
              )}
              <div className="grid gap-2">
                <Label>Tarih</Label>
                <Input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nöbetçiler</Label>
                {createSlots.map((slot, i) => (
                  <div key={i} className="flex gap-2">
                    <Select value={slot.user_id} onValueChange={(v) => updateSlot(i, 'user_id', v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Öğretmen seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(() => {
                          const hasTimetable = Object.keys(timetableByDate).length > 0;
                          const sorted = hasTimetable
                            ? [...teachers].sort(
                                (a, b) =>
                                  Object.keys(timetableByDate[a.id] ?? {}).length -
                                  Object.keys(timetableByDate[b.id] ?? {}).length,
                              )
                            : [...teachers].sort(
                                (a, b) =>
                                  (createSummary.find((s) => s.user_id === a.id)?.slot_count ?? 0) -
                                  (createSummary.find((s) => s.user_id === b.id)?.slot_count ?? 0),
                              );
                          return sorted.map((t) => {
                            const lessonCount = Object.keys(timetableByDate[t.id] ?? {}).length;
                            const suffix = hasTimetable ? ` (${lessonCount} ders)` : '';
                            return (
                              <SelectItem key={t.id} value={t.id}>
                                {`${t.display_name || t.email}${suffix}`}
                              </SelectItem>
                            );
                          });
                        })()}
                      </SelectContent>
                    </Select>
                    {areas.length > 0 ? (
                      <Select value={slot.area_name || ''} onValueChange={(v) => updateSlot(i, 'area_name', v)}>
                        <SelectTrigger className="w-44">
                          <SelectValue placeholder="Konum seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {areas.map((a) => (
                            <SelectItem key={a.id} value={a.name}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="Konum (Koridor, Bahçe…)"
                        value={slot.area_name}
                        onChange={(e) => updateSlot(i, 'area_name', e.target.value)}
                        className="w-40"
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlotRow(i)}
                      disabled={createSlots.length <= 1}
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addSlotRow}>
                  <Plus className="size-4" />
                  Satır Ekle
                </Button>
              </div>
              <Button onClick={handleCreatePlan} disabled={creating}>
                {creating ? 'Oluşturuluyor…' : 'Oluştur ve Yayınla'}
              </Button>
            </CardContent>
          )}
        </Card>
      )}

      <Dialog open={!!markAbsentSlot} onOpenChange={(o) => !o && setMarkAbsentSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="size-5" />
              Devamsızlık Tipi
            </DialogTitle>
          </DialogHeader>
          {markAbsentSlot && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{markAbsentSlot.user?.display_name || markAbsentSlot.user?.email}</strong>
                {' '}için devamsızlık tipini seçin:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleMarkAbsentConfirm('raporlu')} disabled={!!markingAbsent}>
                  Raporlu
                </Button>
                <Button variant="outline" onClick={() => handleMarkAbsentConfirm('izinli')} disabled={!!markingAbsent}>
                  İzinli
                </Button>
                <Button variant="outline" onClick={() => handleMarkAbsentConfirm('gelmeyen')} disabled={!!markingAbsent}>
                  Gelmeyen
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMarkAbsentSlot(null)}>
                  İptal
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reassignSlot} onOpenChange={(o) => !o && setReassignSlot(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-5" />
              Yerine Görevlendir – Adil Dağılım
            </DialogTitle>
          </DialogHeader>
          {reassignSlot && (
            <div className="space-y-4">
              {/* Devamsız öğretmen bilgisi */}
              <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-800 px-4 py-3 space-y-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Gelmeyen nöbetçi: </span>
                  <strong className="text-foreground">{reassignSlot.user?.display_name || reassignSlot.user?.email}</strong>
                </p>
                {reassignSlot.lesson_num ? (
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                    Bu nöbet <span className="font-semibold">{reassignSlot.lesson_num}. ders saatini</span> kapsıyor.
                    Aşağıda yalnızca o saatte dersi olmayan nöbetçiler önerilmektedir.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Bu nöbet için ders saati belirlenmemiş. O gün en fazla boş saati olan nöbetçiler önce listeleniyor.
                  </p>
                )}
              </div>

              {/* Önerilen öğretmenler – ders saatinde boş olanlar */}
              {suggestedTeachers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {reassignSlot.lesson_num
                      ? `${reassignSlot.lesson_num}. ders saatinde boş olan nöbetçiler (önerilen)`
                      : 'Bu gün nöbetçi olan ve boş saati bulunanlar (önerilen)'}
                  </p>
                  <div className="grid gap-1.5">
                    {suggestedTeachers.map((s) => {
                      const teacher = teachers.find((t) => t.id === s.user_id);
                      const name = teacher?.display_name || teacher?.email || s.display_name || s.email;
                      const weightedCount = summaryItems.find((x) => x.user_id === s.user_id)?.weighted_count
                        ?? summaryItems.find((x) => x.user_id === s.user_id)?.slot_count ?? 0;
                      const replacementCount = summaryItems.find((x) => x.user_id === s.user_id)?.replacement_count ?? 0;
                      const color = getTeacherColor(s.user_id, colorMap);
                      return (
                        <button
                          key={s.user_id}
                          type="button"
                          onClick={() => setReassignUserId(s.user_id)}
                          className={cn(
                            'flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-all',
                            reassignUserId === s.user_id
                              ? `${color.bg} ${color.border} ${color.text} border-2 font-medium`
                              : 'border-border hover:bg-muted/50',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn('size-2 rounded-full shrink-0', color.dot)} />
                            <span>{name}</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              ✓ {reassignSlot.lesson_num ? `${reassignSlot.lesson_num}. saatte boş` : `${s.free_lesson_count} boş saat`}
                            </span>
                            {replacementCount > 0 && (
                              <span className="text-xs text-muted-foreground">{replacementCount} yerine görev</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Bu ay: <strong className="text-foreground">{weightedCount}</strong> nöbet ağırlığı
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dağılım grafiği */}
              {summaryLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : summaryItems.length > 0 ? (
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Bu ayki dağılım (ağırlıklı)
                  </p>
                  <DutyDistributionChart
                    items={summaryItems.map((s) => ({ ...s, slot_count: s.weighted_count ?? s.slot_count }))}
                    showFairness={true}
                    height={Math.min(220, summaryItems.length * 22 + 60)}
                    maxBars={10}
                  />
                </div>
              ) : null}

              {/* Tüm öğretmenler (manuel seçim) */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Veya manuel seçim (tüm öğretmenler):
                </label>
                <Select value={reassignUserId} onValueChange={setReassignUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Öğretmen seçin…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const summaryMap = new Map(summaryItems.map((s) => [s.user_id, s.weighted_count ?? s.slot_count]));
                      const suggestedIds = new Set(suggestedTeachers.map((s) => s.user_id));
                      const suggested = teachers.filter((t) => t.id !== reassignSlot.user_id && suggestedIds.has(t.id));
                      const others = teachers.filter((t) => t.id !== reassignSlot.user_id && !suggestedIds.has(t.id));
                      const sortBySlots = (a: UserItem, b: UserItem) =>
                        (summaryMap.get(a.id) ?? 0) - (summaryMap.get(b.id) ?? 0);
                      return [
                        suggested.length > 0 && (
                          <div key="__suggested_header" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide pointer-events-none">
                            Önerilen (ders saatinde boş)
                          </div>
                        ),
                        ...suggested.map((t) => {
                          const s = suggestedTeachers.find((x) => x.user_id === t.id);
                          const name = t.display_name || t.email;
                          return (
                            <SelectItem key={t.id} value={t.id}>
                              {`✓ ${name} (${s?.free_lesson_count ?? 0} boş saat)`}
                            </SelectItem>
                          );
                        }),
                        others.length > 0 && (
                          <div key="__others_header" className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide pointer-events-none border-t mt-1 pt-2">
                            Diğer öğretmenler
                          </div>
                        ),
                        ...others.sort(sortBySlots).map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.display_name || t.email} — {summaryMap.get(t.id) ?? 0} nöbet ağırlığı
                          </SelectItem>
                        )),
                      ].filter(Boolean);
                    })()}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignSlot(null)}>
              İptal
            </Button>
            <Button onClick={handleReassign} disabled={!reassignUserId || reassigning}>
              {reassigning ? 'Yapılıyor…' : 'Görevlendir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Öğretmen Detay Paneli */}
      <TeacherDetailPanel
        open={!!panelTeacherId}
        onClose={() => setPanelTeacherId(null)}
        teacherId={panelTeacherId}
        teachers={teachers}
        rangeSlots={rangeSlots}
        daySlots={data?.slots ?? []}
        colorMap={colorMap}
        token={token ?? ''}
        focusDate={focusDate}
      />

      {/* Ders Saati Bazlı Coverage Dialog */}
      {coverageSlotId && (
        <LessonCoverageDialog
          dutySlotId={coverageSlotId}
          onClose={() => setCoverageSlotId(null)}
          onDone={() => {
            refresh();
            setCoverageSlotId(null);
            window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
          }}
        />
      )}
    </div>
  );
}
