'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Table2, ShieldOff, PlusCircle, Pencil, Building2, Users, CalendarDays, Upload, Calendar } from 'lucide-react';
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

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma'];
const DAY_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];

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
  const { maxLessons: schoolMaxLessons, timeSlots } = useSchoolTimetableSettings();
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

  const isAdmin = me?.role === 'school_admin';
  const isTeacher = me?.role === 'teacher';
  const { getKazanimHref } = useKazanimPlanMap(token, !!isTeacher);

  const publishedPlans = plans.filter((p) => p.status === 'published');
  const selectedDate =
    selectedView === 'today' ? today : publishedPlans.find((p) => p.id === selectedView)?.valid_from ?? today;

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
  const { map } = buildTimetableMap();
  const lessonNums = Array.from({ length: schoolMaxLessons }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/ders-programi"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Ders Programı
          </Link>
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Programlarım</h1>
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
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
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
            <Card className="border-border shadow-md overflow-hidden rounded-xl">
              <CardHeader className="pb-4 pt-5 px-5 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
                    <Building2 className="size-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">Okul Programı</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Resmi program · {entries.length} ders
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll bg-zinc-100/60 dark:bg-zinc-900/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-200/80 dark:bg-zinc-800/80">
                        <th className="w-10 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border-b border-r border-zinc-300 dark:border-zinc-700">
                          Ders
                        </th>
                        {DAY_SHORT.map((d, i) => (
                          <th
                            key={d}
                            className={cn(
                              'px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 border-b border-r last:border-r-0 border-zinc-300 dark:border-zinc-700 min-w-[88px]',
                              i % 2 === 1 && 'bg-zinc-300/50 dark:bg-zinc-700/50',
                            )}
                          >
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lessonNums.map((ln, idx) => (
                        <tr
                          key={ln}
                          className={cn(
                            'transition-colors hover:bg-zinc-200/40 dark:hover:bg-zinc-700/30',
                            idx % 2 === 0 ? 'bg-white dark:bg-zinc-900/60' : 'bg-zinc-50 dark:bg-zinc-800/40',
                          )}
                        >
                          <td className="px-2 py-1.5 border-b border-r border-zinc-200 dark:border-zinc-700">
                            <div className="flex size-7 items-center justify-center rounded bg-primary/15 text-xs font-bold text-primary">
                              {ln}
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5].map((day) => {
                            const key = `${me?.id ?? ''}-${day}`;
                            const entry = map.get(key)?.get(String(ln));
                            const slot = timeSlots.find((s) => !s.isLunch && s.lessonNum === ln);
                            return (
                              <td key={day} className="px-1.5 py-1.5 border-b border-r last:border-r-0 border-zinc-200 dark:border-zinc-700 align-top min-w-[88px]">
                                {entry ? (
                                  <LessonCellCard
                                    subject={entry.subject}
                                    classSection={entry.class_section}
                                    timeRange={slot?.timeRange ?? '—'}
                                    kazanimHref={getKazanimHref(entry.subject, entry.class_section)}
                                    compact
                                  />
                                ) : (
                                  <div className="flex h-7 items-center justify-center rounded border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-800/30">
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
              </CardContent>
            </Card>
          )}

          {/* Öğretmen: Kendi programları tablosu */}
          {!isAdmin && (
            <Card className="border-border shadow-md overflow-hidden rounded-xl">
              <CardHeader className="pb-4 pt-5 px-5 bg-muted/30 border-b border-border">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 shadow-inner">
                      <Table2 className="size-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold">Kendi Programlarım</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {personalPrograms.length === 0
                          ? 'Kendi oluşturduğunuz programlar burada listelenir.'
                          : `${personalPrograms.length} program`}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" className="shadow-sm">
                    <Link href="/ders-programi/olustur" className="gap-2">
                      <PlusCircle className="size-4" />
                      Yeni Program
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              {personalPrograms.length > 0 ? (
                <CardContent className="p-0">
                  <div className="table-x-scroll">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                            Program Adı
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                            Akademik Yıl
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                            Dönem
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                            Ders Saati
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                            Oluşturulma
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                            İşlemler
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {personalPrograms.map((p, idx) => (
                          <tr
                            key={p.id}
                            className={cn(
                              'transition-colors hover:bg-muted/25',
                              idx % 2 === 1 && 'bg-muted/5',
                            )}
                          >
                            <td className="px-5 py-3 font-medium">{p.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.academic_year}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.term}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                                {p.total_hours} saat
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button variant="outline" size="sm" asChild className="shadow-sm">
                                <Link href={`/ders-programi/olustur/${p.id}`} className="gap-1.5">
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
                <CardContent className="py-10">
                  <p className="text-center text-sm text-muted-foreground">
                    Henüz kendi programınız yok. Yeni program oluşturabilirsiniz.
                  </p>
                  <Button asChild className="mt-5 mx-auto flex">
                    <Link href="/ders-programi/olustur" className="gap-2">
                      <PlusCircle className="size-4" />
                      Yeni Program Oluştur
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
                          {teachersWithEntries.length} öğretmen
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
              </CardHeader>
              <CardContent className="p-0">
                {viewMode === 'teacher' ? (
                  <div className="table-x-scroll bg-zinc-100/60 dark:bg-zinc-900/40">
                    <table className="w-full text-xs">
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
                                i === 4 && 'border-r-0',
                              )}
                            >
                              {d}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {teachersWithEntries.flatMap((uid, teacherIdx) => {
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
                              {[1, 2, 3, 4, 5].map((dayNum, dayIdx) => {
                                const key = `${uid}-${dayNum}`;
                                const dayLessons = map.get(key);
                                const entry = dayLessons?.get(String(ln));
                                return (
                                  <td
                                    key={dayNum}
                                    className={cn(
                                      'px-1.5 py-1.5 border-b border-r border-zinc-200 dark:border-zinc-700 align-top min-w-[88px]',
                                      dayIdx === 4 && 'border-r-0',
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
                            {teachersWithEntries.map((uid, colIdx) => {
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
                                    colIdx === teachersWithEntries.length - 1 && 'border-r-0',
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
                              {teachersWithEntries.map((uid, colIdx) => {
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
                                      colIdx === teachersWithEntries.length - 1 && 'border-r-0',
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
