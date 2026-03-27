'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Table2,
  PlusCircle,
  Pencil,
  Building2,
  Users,
  CalendarDays,
  Upload,
  Calendar,
  Minus,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { useKazanimPlanMap } from '@/hooks/use-kazanim-plan-map';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { LessonCellCard } from '@/components/ders-programi/lesson-cell-card';
import { TEACHER_WEEK_THEME } from '@/components/ders-programi/timetable-pastel-theme';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type TimetableEntry = {
  user_id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
};

type TeacherInfo = {
  id: string;
  display_name: string | null;
  email: string;
  duty_exempt?: boolean;
};

type PersonalProgram = {
  id: string;
  name: string;
  academic_year: string;
  term: string;
  total_hours: number;
  created_at: string;
  updated_at: string;
};

type PlanInfo = {
  plan_id: string;
  name: string | null;
  valid_from: string;
  valid_until: string | null;
};

type TimetablePlan = {
  id: string;
  name: string | null;
  valid_from: string;
  valid_until: string | null;
  status: string;
  academic_year?: string | null;
  entry_count: number;
};

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** Öğretmen blokları için sol kenar vurgu rengi (border-l) */
const TEACHER_ACCENT = [
  'border-l-primary',
  'border-l-emerald-500',
  'border-l-amber-500',
  'border-l-sky-500',
  'border-l-violet-500',
  'border-l-rose-500',
  'border-l-teal-500',
  'border-l-blue-500',
] as const;

function fmtDate(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtUntil(validUntil: string | null): string {
  return validUntil ? fmtDate(validUntil) : 'açık uçlu';
}

export default function ProgramlarimPage() {
  const { token, me } = useAuth();
  const { maxLessons: schoolMaxLessons, getTimeRangeForDay } = useSchoolTimetableSettings();
  const [entries, setEntries] = useState<TimetableEntry[] | null>(null);
  const [personalPrograms, setPersonalPrograms] = useState<PersonalProgram[]>([]);
  const [teachers, setTeachers] = useState<TeacherInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);
  const [viewMode, setViewMode] = useState<'teacher' | 'day'>('teacher');
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [plans, setPlans] = useState<TimetablePlan[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedView, setSelectedView] = useState<string>(() => 'today');
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editValidFrom, setEditValidFrom] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editOpenEnded, setEditOpenEnded] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [teacherSort, setTeacherSort] = useState<'name_asc' | 'name_desc' | 'lessons_desc' | 'lessons_asc'>('name_asc');
  const [exemptFilter, setExemptFilter] = useState<'all' | 'exempt' | 'not_exempt'>('all');

  const isAdmin = me?.role === 'school_admin';
  const isTeacher = me?.role === 'teacher';
  const { getKazanimHref } = useKazanimPlanMap(token, !!isTeacher);

  const publishedPlans = plans.filter((p) => p.status === 'published');
  const selectedDate =
    selectedView === 'today' ? today : publishedPlans.find((p) => p.id === selectedView)?.valid_from ?? today;

  const todayDayOfWeek = useMemo(() => {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
  }, []);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      try {
        const dateParam = selectedDate ? `?date=${selectedDate}` : '';
        const path = isAdmin ? `/teacher-timetable${dateParam}` : `/teacher-timetable/me${dateParam}`;
        const data = await apiFetch<TimetableEntry[]>(path, { token });
        setEntries(Array.isArray(data) ? data : []);

        if (isAdmin) {
          const [teacherList, info, plansList] = await Promise.all([
            apiFetch<TeacherInfo[]>('/duty/teachers?includeExempt=true', { token }),
            apiFetch<PlanInfo | null>(`/teacher-timetable/plan-info${dateParam}`, { token }).catch(() => null),
            apiFetch<TimetablePlan[]>('/teacher-timetable/plans', { token }).catch(() => []),
          ]);
          setTeachers(Array.isArray(teacherList) ? teacherList : []);
          setPlanInfo(info ?? null);
          setPlans(Array.isArray(plansList) ? plansList : []);
        } else {
          const myPrograms = await apiFetch<PersonalProgram[]>('/teacher-timetable/my-programs', { token });
          setPersonalPrograms(Array.isArray(myPrograms) ? myPrograms : []);
        }
      } catch {
        setEntries([]);
        setPersonalPrograms([]);
        setTeachers([]);
        setPlanInfo(null);
        setPlans([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, isAdmin, selectedDate, refreshTrigger]);

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
            'Haftalık görünümde geçerli olan okul (idare) programıdır. Kişisel programlar aşağıda ayrı listelenir.',
            { duration: 9000 },
          );
        }
        if (res.personal_slot_conflicts.length > 0) {
          toast.warning(
            `Kişisel programlarınızda ${res.personal_slot_conflicts.length} saatte çakışma var (aynı gün ve ders saatinde farklı sınıf/ders).`,
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

  const openEditDialog = () => {
    if (!planInfo) return;
    setEditValidFrom(planInfo.valid_from);
    const currentPlan = publishedPlans.find((p) => p.id === planInfo.plan_id);
    const isOpenEnded = !(currentPlan?.valid_until);
    setEditOpenEnded(isOpenEnded);
    setEditValidUntil(currentPlan?.valid_until ?? (() => {
      const d = new Date();
      return d.getMonth() < 6 ? `${d.getFullYear()}-01-31` : `${d.getFullYear()}-06-30`;
    })());
    setEditPlanOpen(true);
  };

  const handleEditSave = async () => {
    if (!token || !planInfo) return;
    if (!editOpenEnded) {
      if (!editValidUntil.trim()) {
        toast.error('Bitiş tarihi girin veya "açık uçlu" seçin.');
        return;
      }
      if (editValidFrom > editValidUntil) {
        toast.error('Bitiş tarihi başlangıçtan önce olamaz.');
        return;
      }
    }
    setEditSaving(true);
    try {
      await apiFetch(`/teacher-timetable/plans/${planInfo.plan_id}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          valid_from: editValidFrom,
          valid_until: editOpenEnded ? null : editValidUntil,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      toast.success('Geçerlilik tarihleri güncellendi.');
      setEditPlanOpen(false);
      setRefreshTrigger((t) => t + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setEditSaving(false);
    }
  };

  const buildTimetableMap = () => {
    if (!entries) return { map: new Map<string, Map<string, { class_section: string; subject: string }>>(), maxLesson: 8 };
    let maxLesson = 6;
    const map = new Map<string, Map<string, { class_section: string; subject: string }>>();
    for (const e of entries) {
      const key = `${e.user_id}-${e.day_of_week}`;
      if (!map.has(key)) map.set(key, new Map());
      map.get(key)!.set(String(e.lesson_num), { class_section: e.class_section, subject: e.subject });
      if (e.lesson_num > maxLesson) maxLesson = e.lesson_num;
    }
    return { map, maxLesson: Math.max(maxLesson, 6) };
  };

  const teachersWithEntries = entries ? [...new Set(entries.map((e) => e.user_id))] : [];
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));

  const lessonCountByTeacher = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries ?? []) {
      m.set(e.user_id, (m.get(e.user_id) ?? 0) + 1);
    }
    return m;
  }, [entries]);

  const visibleTeacherIds = useMemo(() => {
    let list = [...teachersWithEntries];
    const q = teacherQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((uid) => {
        const t = teacherMap.get(uid);
        const name = (t?.display_name ?? '').toLowerCase();
        const email = (t?.email ?? '').toLowerCase();
        return name.includes(q) || email.includes(q);
      });
    }
    if (exemptFilter !== 'all') {
      list = list.filter((uid) => {
        const ex = teacherMap.get(uid)?.duty_exempt;
        return exemptFilter === 'exempt' ? !!ex : !ex;
      });
    }
    const sortKey = (uid: string) =>
      (teacherMap.get(uid)?.display_name || teacherMap.get(uid)?.email || uid).toLowerCase();
    list.sort((a, b) => {
      if (teacherSort === 'name_asc' || teacherSort === 'name_desc') {
        const cmp = sortKey(a).localeCompare(sortKey(b), 'tr');
        return teacherSort === 'name_asc' ? cmp : -cmp;
      }
      const ca = lessonCountByTeacher.get(a) ?? 0;
      const cb = lessonCountByTeacher.get(b) ?? 0;
      return teacherSort === 'lessons_desc' ? cb - ca : ca - cb;
    });
    return list;
  }, [teachersWithEntries, teacherMap, teacherQuery, exemptFilter, teacherSort, lessonCountByTeacher]);
  const { map } = buildTimetableMap();
  const lessonNums = Array.from({ length: schoolMaxLessons }, (_, i) => i + 1);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="rounded-xl border border-border/70 bg-linear-to-br from-primary/5 via-background to-muted/25 px-3 py-3 sm:px-4">
        <Link
          href="/ders-programi"
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-xs"
        >
          <ArrowLeft className="size-3.5 shrink-0" />
          Ders Programı
        </Link>
        <h1 className="mt-2 text-base font-semibold tracking-tight text-foreground sm:text-lg">Programlarım</h1>
        <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Okul programınız ve kişisel programlarınız</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner className="size-8" />
        </div>
      ) : isAdmin && publishedPlans.length === 0 && (!entries || entries.length === 0) ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Table2 className="size-10" />}
              title="Program bulunamadı"
              description="Excel ile ders programı yükleyerek başlayın."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/ders-programi/olustur"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Excel ile Yükle
                  </Link>
                  <Link
                    href="/ders-programi"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                  >
                    Ders Programına Dön
                  </Link>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : !isAdmin && (!entries || entries.length === 0) && personalPrograms.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Table2 className="size-10" />}
              title="Henüz programınız yok"
              description="Kendi programınızı oluşturabilir veya okul yöneticisi tarafından yüklenen programı bekleyebilirsiniz."
              action={
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/ders-programi/olustur"
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <PlusCircle className="size-4" />
                    Yeni Program Oluştur
                  </Link>
                  <Link
                    href="/ders-programi"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                  >
                    Ders Programına Dön
                  </Link>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Admin: Geçerlilik tarihleri + Plan seçici */}
          {isAdmin && publishedPlans.length > 0 && (
            <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-transparent">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-5 text-primary" />
                    <span className="text-sm font-medium">Geçerlilik:</span>
                    {planInfo ? (
                      <>
                        <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
                          {fmtDate(planInfo.valid_from)} – {fmtUntil(planInfo.valid_until)}
                        </span>
                        <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-1.5">
                          <Pencil className="size-3.5" />
                          Düzenle
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Bu tarih için aktif program yok
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="plan-select" className="text-sm text-muted-foreground whitespace-nowrap">
                      Görüntüle:
                    </Label>
                    <select
                      id="plan-select"
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      value={selectedView}
                      onChange={(e) => setSelectedView(e.target.value)}
                    >
                      <option value="today">Mevcut (bugün)</option>
                      {publishedPlans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || p.academic_year || 'Plan'} ({fmtDate(p.valid_from)} – {fmtUntil(p.valid_until)})
                          {p.valid_until && new Date(p.valid_until) < new Date() ? ' · Geçmiş' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(!planInfo || (planInfo.valid_until && new Date(planInfo.valid_until) < new Date())) && (
                    <Link
                      href="/ders-programi/olustur"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
                    >
                      <Upload className="size-4" />
                      Yeni program yükle
                    </Link>
                  )}
                </div>
                {planInfo && planInfo.valid_until && new Date(planInfo.valid_until) < new Date() && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Bilgi amaçlı görüntüleme. Bitiş tarihi geçmiş programlar arşivde kalır.
                  </p>
                )}
                {!planInfo && selectedView !== 'today' && selectedDate && new Date(selectedDate) > new Date() && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Seçilen tarih için henüz program tanımlı değil. Geçmiş programlardan birini seçebilirsiniz.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Geçerlilik tarihi düzenleme modal */}
          <Dialog open={editPlanOpen} onOpenChange={setEditPlanOpen}>
            <DialogContent title="Geçerlilik Tarihlerini Düzenle">
              <div className="space-y-4 p-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-valid-from">Başlangıç tarihi</Label>
                  <Input
                    id="edit-valid-from"
                    type="date"
                    value={editValidFrom}
                    onChange={(e) => setEditValidFrom(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editOpenEnded}
                      onChange={(e) => setEditOpenEnded(e.target.checked)}
                      className="rounded border-border"
                    />
                    Bitiş tarihi belirsiz (açık uçlu)
                  </label>
                  {!editOpenEnded && (
                    <>
                      <Label htmlFor="edit-valid-until">Bitiş tarihi</Label>
                      <Input
                        id="edit-valid-until"
                        type="date"
                        value={editValidUntil}
                        onChange={(e) => setEditValidUntil(e.target.value)}
                        className="w-full"
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditPlanOpen(false)}>
                    İptal
                  </Button>
                  <Button onClick={handleEditSave} disabled={editSaving}>
                    {editSaving ? 'Kaydediliyor…' : 'Kaydet'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Admin: Bu tarih için program yok - Yeni yükle önerisi */}
          {isAdmin && publishedPlans.length > 0 && (!entries || entries.length === 0) && !loading && (
            <Card className="border-amber-200/60 dark:border-amber-800/60">
              <CardContent className="py-8">
                <p className="text-center text-sm text-muted-foreground mb-4">
                  Bu tarih için aktif program bulunmuyor. Bitiş tarihinden sonra yeni program yükleyebilirsiniz.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link href="/ders-programi/olustur">
                    <Button className="gap-2">
                      <Upload className="size-4" />
                      Excel ile Yeni Program Yükle
                    </Button>
                  </Link>
                  <Link href="/ders-programi">
                    <Button variant="outline">Ders Programına Dön</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Öğretmen: Okul programı (admin yüklediyse) */}
          {!isAdmin && entries && entries.length > 0 && (
            <Card className="overflow-hidden rounded-xl border-border/80 shadow-md">
              <CardHeader className="border-b border-border/70 bg-linear-to-r from-muted/25 to-transparent px-3 py-3 sm:px-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <Building2 className="size-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold leading-tight">Okul programı</CardTitle>
                    <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Resmi program · {entries.length} ders</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <p className="px-3 pt-2 text-center text-[11px] text-muted-foreground md:hidden">
                  Tabloyu yatay kaydırarak tüm günleri görebilirsiniz
                </p>
                <div className="overflow-x-auto border-t border-border/50 bg-muted/10 pb-1">
                  <table className="w-full min-w-[880px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-20 min-w-[72px] border-b border-r border-border/70 bg-card px-2 py-2 text-left shadow-[6px_0_12px_-6px_rgba(0,0,0,0.1)] sm:min-w-[88px] sm:px-3 sm:py-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ders</span>
                        </th>
                        {DAY_SHORT.map((d, i) => {
                          const dayNum = i + 1;
                          const isToday = dayNum === todayDayOfWeek;
                          const th = TEACHER_WEEK_THEME[i] ?? TEACHER_WEEK_THEME[0];
                          return (
                            <th
                              key={d}
                              className={cn(
                                'border-b border-r border-border/50 px-1 py-2 text-center text-[10px] font-bold uppercase leading-tight sm:px-2 sm:text-[11px]',
                                th.head,
                                isToday && th.headToday,
                                i === 6 && 'border-r-0',
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
                      {lessonNums.map((ln, idx) => {
                        const isLast = idx === lessonNums.length - 1;
                        return (
                          <tr key={ln} className="transition-colors hover:bg-muted/20">
                            <td
                              className={cn(
                                'sticky left-0 z-10 border-b border-r border-border/60 bg-card px-2 py-1.5 align-middle shadow-[6px_0_12px_-6px_rgba(0,0,0,0.08)] sm:px-3 sm:py-2',
                                isLast && 'rounded-bl-xl',
                              )}
                            >
                              <span className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-primary/20 to-primary/10 text-xs font-bold text-primary">
                                {ln}
                              </span>
                            </td>
                            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                              const key = `${me?.id ?? ''}-${day}`;
                              const entry = map.get(key)?.get(String(ln));
                              const isTodayCol = day === todayDayOfWeek;
                              const th = TEACHER_WEEK_THEME[day - 1] ?? TEACHER_WEEK_THEME[0];
                              const timeRange = getTimeRangeForDay(day, ln);
                              return (
                                <td
                                  key={day}
                                  className={cn(
                                    'border-b border-r border-border/40 p-1.5 align-top sm:min-w-[100px] sm:p-2',
                                    day === 7 && 'border-r-0',
                                    isTodayCol ? th.cellToday : th.cell,
                                  )}
                                >
                                  {entry ? (
                                    <LessonCellCard
                                      subject={entry.subject}
                                      classSection={entry.class_section}
                                      timeRange={timeRange}
                                      kazanimHref={getKazanimHref(entry.subject, entry.class_section)}
                                      compact
                                      dayTone={day - 1}
                                    />
                                  ) : (
                                    <div className="flex min-h-10 items-center justify-center rounded-lg border border-dashed border-border/50 bg-background/40 py-1 dark:bg-background/20">
                                      <Minus className="size-3 text-muted-foreground/35" aria-hidden />
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
              </CardContent>
            </Card>
          )}

          {/* Öğretmen: Kendi programları */}
          {!isAdmin && (
            <Card className="overflow-hidden rounded-xl border-border/80 shadow-md">
              <CardHeader className="border-b border-border/70 bg-linear-to-r from-violet-500/8 via-background to-sky-500/8 px-3 py-3 sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                      <Table2 className="size-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold leading-tight">Kendi programlarım</CardTitle>
                      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                        {personalPrograms.length === 0
                          ? 'Excel veya el ile oluşturduğunuz programlar'
                          : `${personalPrograms.length} program`}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="h-9 w-full shrink-0 rounded-lg sm:w-auto">
                    <Link href="/ders-programi/olustur" className="gap-1.5">
                      <PlusCircle className="size-4" />
                      Yeni program
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              {personalPrograms.length > 0 ? (
                <CardContent className="p-0">
                  <div className="space-y-2 p-3 md:hidden">
                    {personalPrograms.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-border/70 bg-linear-to-br from-card to-muted/20 p-3 shadow-sm"
                      >
                        <p className="font-semibold leading-snug text-foreground">{p.name}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-muted-foreground">Akademik yıl</span>
                            <p className="font-medium text-foreground">{p.academic_year}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Dönem</span>
                            <p className="font-medium text-foreground">{p.term}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ders saati</span>
                            <p>
                              <span className="inline-flex rounded-md bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
                                {p.total_hours} saat
                              </span>
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Oluşturulma</span>
                            <p className="font-medium text-foreground">
                              {new Date(p.created_at).toLocaleDateString('tr-TR')}
                            </p>
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" className="mt-3 h-9 w-full rounded-lg" asChild>
                          <Link href={`/ders-programi/olustur/${p.id}`} className="gap-1.5">
                            <Pencil className="size-3.5" />
                            Düzenle
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
                      <thead>
                        <tr className="bg-linear-to-r from-sky-50/90 to-violet-50/90 dark:from-sky-950/25 dark:to-violet-950/25">
                          <th className="border-b border-border/60 px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Program
                          </th>
                          <th className="border-b border-border/60 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Yıl
                          </th>
                          <th className="border-b border-border/60 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Dönem
                          </th>
                          <th className="border-b border-border/60 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Saat
                          </th>
                          <th className="border-b border-border/60 px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            Tarih
                          </th>
                          <th className="border-b border-border/60 px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            İşlem
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {personalPrograms.map((p, idx) => (
                          <tr
                            key={p.id}
                            className={cn(
                              'border-b border-border/40 transition-colors hover:bg-muted/30',
                              idx % 2 === 1 && 'bg-muted/15',
                            )}
                          >
                            <td className="max-w-[220px] px-4 py-2.5 font-medium leading-snug text-foreground">
                              {p.name}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.academic_year}</td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{p.term}</td>
                            <td className="px-3 py-2.5">
                              <span className="inline-flex rounded-lg bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                                {p.total_hours} saat
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
                                <Link href={`/ders-programi/olustur/${p.id}`} className="gap-1">
                                  <Pencil className="size-3.5" />
                                  Düzenle
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="px-4 py-8 sm:py-10">
                  <p className="text-center text-sm text-muted-foreground">
                    Henüz kendi programınız yok. Yeni program oluşturabilirsiniz.
                  </p>
                  <Button asChild className="mx-auto mt-4 flex h-10 rounded-lg">
                    <Link href="/ders-programi/olustur" className="gap-2">
                      <PlusCircle className="size-4" />
                      Yeni program oluştur
                    </Link>
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          {/* Admin: Tüm öğretmenler tablosu (veri varken) */}
          {isAdmin && entries && entries.length > 0 && (
            <Card className="border-border shadow-md overflow-hidden rounded-xl">
              <CardHeader className="pb-4 pt-5 px-5 bg-muted/30 border-b border-border">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
                      <Table2 className="size-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Tüm Öğretmenler</CardTitle>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                          <Users className="size-3.5" />
                          {visibleTeacherIds.length}
                          {visibleTeacherIds.length !== teachersWithEntries.length
                            ? ` / ${teachersWithEntries.length}`
                            : ''}{' '}
                          öğretmen
                        </span>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          <CalendarDays className="size-3.5" />
                          {entries?.length ?? 0} ders
                        </span>
                        {planInfo && (
                          <span className="text-muted-foreground">
                            Geçerlilik: <span className="font-medium text-foreground">{fmtDate(planInfo.valid_from)} – {fmtUntil(planInfo.valid_until)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div
                    role="tablist"
                    aria-label="Görünüm modu"
                    className="flex rounded-lg bg-muted/60 p-1 border border-border shadow-inner"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'teacher'}
                      onClick={() => setViewMode('teacher')}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                        viewMode === 'teacher'
                          ? 'bg-background shadow-sm text-foreground ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                      )}
                    >
                      <Users className="size-4" />
                      Öğretmen Bazlı
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewMode === 'day'}
                      onClick={() => setViewMode('day')}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
                        viewMode === 'day'
                          ? 'bg-background shadow-sm text-foreground ring-1 ring-border'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
                      )}
                    >
                      <CalendarDays className="size-4" />
                      Gün Bazlı
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative min-w-0 flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={teacherQuery}
                      onChange={(e) => setTeacherQuery(e.target.value)}
                      placeholder="Öğretmen ara (ad veya e-posta)…"
                      className="h-9 pl-8 text-sm"
                      aria-label="Öğretmen ara"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="teacher-sort" className="sr-only">
                      Sıralama
                    </Label>
                    <select
                      id="teacher-sort"
                      className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
                      value={teacherSort}
                      onChange={(e) => setTeacherSort(e.target.value as typeof teacherSort)}
                    >
                      <option value="name_asc">Ad (A → Z)</option>
                      <option value="name_desc">Ad (Z → A)</option>
                      <option value="lessons_desc">Ders sayısı (çoğa)</option>
                      <option value="lessons_asc">Ders sayısı (aza)</option>
                    </select>
                    <Label htmlFor="exempt-filter" className="sr-only">
                      Muafiyet
                    </Label>
                    <select
                      id="exempt-filter"
                      className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
                      value={exemptFilter}
                      onChange={(e) => setExemptFilter(e.target.value as typeof exemptFilter)}
                    >
                      <option value="all">Tümü</option>
                      <option value="exempt">Muaf</option>
                      <option value="not_exempt">Muaf değil</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {visibleTeacherIds.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                    Filtreye uyan öğretmen yok. Aramayı veya muafiyet seçimini değiştirin.
                  </div>
                ) : viewMode === 'teacher' ? (
                  <div className="table-x-scroll bg-zinc-100/60 dark:bg-zinc-900/40">
                    <table className="w-full min-w-[900px] text-xs">
                      <thead>
                        <tr className="bg-zinc-200/80 dark:bg-zinc-800/80">
                          <th className="sticky left-0 z-10 bg-zinc-200/80 dark:bg-zinc-800/80 px-3 py-2 text-left font-semibold text-zinc-600 dark:text-zinc-400 border-b border-r border-zinc-300 dark:border-zinc-700 min-w-[100px]">
                            Öğretmen
                          </th>
                          <th className="w-8 px-1 py-2 text-center font-semibold text-zinc-600 dark:text-zinc-400 border-b border-r border-zinc-300 dark:border-zinc-700">
                            #
                          </th>
                          {DAY_SHORT.map((d, i) => (
                            <th
                              key={d}
                              className={cn(
                                'px-2 py-2 text-center font-semibold text-zinc-600 dark:text-zinc-400 border-b border-r border-zinc-300 dark:border-zinc-700 min-w-[88px]',
                                i % 2 === 1 && 'bg-zinc-300/50 dark:bg-zinc-700/50',
                                i === 6 && 'border-r-0',
                              )}
                            >
                              {d}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTeacherIds.flatMap((uid, teacherIdx) => {
                          const t = teacherMap.get(uid);
                          const name = t?.display_name || t?.email || uid.slice(0, 8);
                          const isExempt = t?.duty_exempt;
                          const accent = TEACHER_ACCENT[teacherIdx % TEACHER_ACCENT.length];
                          const rowBg = teacherIdx % 2 === 0 ? 'bg-white dark:bg-zinc-900/60' : 'bg-zinc-50 dark:bg-zinc-800/40';
                          return lessonNums.map((ln, lessonIdx) => (
                            <tr
                              key={`${uid}-${ln}`}
                              className={cn(
                                lessonIdx === 0 && teacherIdx > 0 && 'border-t-2 border-t-zinc-300 dark:border-t-zinc-600',
                                rowBg,
                              )}
                            >
                              <td
                                className={cn(
                                  'sticky left-0 z-10 px-3 py-1.5 border-b border-r border-zinc-200 dark:border-zinc-700 border-l-4',
                                  accent,
                                  lessonIdx === 0 ? 'font-medium bg-inherit' : 'pl-4 text-zinc-500 dark:text-zinc-400 bg-inherit',
                                  rowBg,
                                )}
                              >
                                {lessonIdx === 0 ? (
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate max-w-[88px]" title={name}>{name}</span>
                                    {isExempt && (
                                      <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium bg-amber-200/80 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                                        Muaf
                                      </span>
                                    )}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-1 py-1.5 text-center border-b border-r border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                                {ln}
                              </td>
                              {[1, 2, 3, 4, 5, 6, 7].map((dayNum, dayIdx) => {
                                const key = `${uid}-${dayNum}`;
                                const dayLessons = map.get(key);
                                const entry = dayLessons?.get(String(ln));
                                return (
                                  <td
                                    key={dayNum}
                                    className={cn(
                                      'px-1.5 py-1.5 border-b border-r border-zinc-200 dark:border-zinc-700 align-top min-w-[88px]',
                                      dayIdx === 6 && 'border-r-0',
                                    )}
                                  >
                                    {entry ? (
                                      <div className="rounded bg-primary/15 dark:bg-primary/20 px-1.5 py-1 text-[11px] border border-primary/20">
                                        {entry.class_section} · {entry.subject}
                                      </div>
                                    ) : (
                                      <div className="h-7 rounded border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-800/30">
                                        <span className="text-[10px] text-zinc-400">—</span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    <div className="flex border-b border-zinc-200 dark:border-zinc-700 bg-zinc-100/60 dark:bg-zinc-800/60">
                      {DAYS.map((day, i) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(i + 1)}
                          className={cn(
                            'flex-1 px-3 py-2 text-xs font-medium whitespace-nowrap',
                            selectedDay === i + 1
                              ? 'border-b-2 border-primary text-primary bg-white dark:bg-zinc-900'
                              : 'text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60',
                          )}
                          title={day}
                        >
                          {DAY_SHORT[i]}
                        </button>
                      ))}
                    </div>
                    <div className="table-x-scroll bg-zinc-100/60 dark:bg-zinc-900/40">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-zinc-200/80 dark:bg-zinc-800/80">
                            <th className="sticky left-0 z-10 bg-zinc-200/80 dark:bg-zinc-800/80 w-8 px-2 py-2 text-center font-semibold text-zinc-600 dark:text-zinc-400 border-b border-r border-zinc-300 dark:border-zinc-700">
                              #
                            </th>
                            {visibleTeacherIds.map((uid, colIdx) => {
                              const t = teacherMap.get(uid);
                              const name = t?.display_name || t?.email || uid.slice(0, 8);
                              const isExempt = t?.duty_exempt;
                              const accent = TEACHER_ACCENT[colIdx % TEACHER_ACCENT.length];
                              return (
                                <th
                                  key={uid}
                                  className={cn(
                                    'px-2 py-2 text-center border-b border-r border-zinc-300 dark:border-zinc-700 min-w-[88px]',
                                    colIdx > 0 && 'border-l-2',
                                    colIdx > 0 && accent,
                                    colIdx === visibleTeacherIds.length - 1 && 'border-r-0',
                                    colIdx % 2 === 1 ? 'bg-zinc-300/50 dark:bg-zinc-700/50' : 'bg-zinc-200/80 dark:bg-zinc-800/80',
                                  )}
                                >
                                  <span className="block truncate max-w-[76px] mx-auto font-medium text-zinc-700 dark:text-zinc-300" title={name}>{name}</span>
                                  {isExempt && (
                                    <span className="block text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">Muaf</span>
                                  )}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {lessonNums.map((ln, rowIdx) => (
                            <tr key={ln} className={rowIdx % 2 === 0 ? 'bg-white dark:bg-zinc-900/60' : 'bg-zinc-50 dark:bg-zinc-800/40'}>
                              <td className="sticky left-0 z-10 px-2 py-1.5 border-b border-r border-zinc-200 dark:border-zinc-700 text-center text-zinc-500 dark:text-zinc-400 bg-inherit">
                                {ln}
                              </td>
                              {visibleTeacherIds.map((uid, colIdx) => {
                                const key = `${uid}-${selectedDay}`;
                                const entry = map.get(key)?.get(String(ln));
                                const accent = TEACHER_ACCENT[colIdx % TEACHER_ACCENT.length];
                                return (
                                  <td
                                    key={uid}
                                    className={cn(
                                      'px-1.5 py-1.5 border-b border-r border-zinc-200 dark:border-zinc-700 align-top min-w-[88px] bg-inherit',
                                      colIdx > 0 && 'border-l-2',
                                      colIdx > 0 && accent,
                                      colIdx === visibleTeacherIds.length - 1 && 'border-r-0',
                                    )}
                                  >
                                    {entry ? (
                                      <div className="rounded bg-primary/15 dark:bg-primary/20 px-1.5 py-1 text-[11px] border border-primary/20">
                                        {entry.class_section} · {entry.subject}
                                      </div>
                                    ) : (
                                      <div className="h-7 rounded border border-dashed border-zinc-300 dark:border-zinc-600 flex items-center justify-center bg-zinc-50/50 dark:bg-zinc-800/30">
                                        <span className="text-[10px] text-zinc-400">—</span>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
