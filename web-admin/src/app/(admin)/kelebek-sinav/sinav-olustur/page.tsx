'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  CheckCircle2, BookOpen, Settings2, Building2, Wand2, Eye,
  ChevronLeft, ChevronRight, LogOut, Info, X, Lock,
  LayoutGrid, Users, AlertTriangle, Shuffle, Check, GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const LESSON_PERIODS = ['1. Ders', '2. Ders', '3. Ders', '4. Ders', '5. Ders', '6. Ders', '7. Ders', '8. Ders', 'Normal Saat'];
const STEPS = [
  { label: 'Sınav Bilgileri', shortLabel: 'Bilgiler', icon: BookOpen },
  { label: 'Ders Seçimi', shortLabel: 'Dersler', icon: BookOpen },
  { label: 'Dağıtım Kriterleri', shortLabel: 'Kriterler', icon: Settings2 },
  { label: 'Salon Belirleme', shortLabel: 'Salonlar', icon: Building2 },
  { label: 'Yerleştirme', shortLabel: 'Yerleştir', icon: Wand2 },
  { label: 'Yerleştirme Önizleme', shortLabel: 'Önizleme', icon: Eye },
];

type RoomRow = { id: string; name: string; buildingName?: string; capacity: number; seatLayout?: string };
type ClassRow = { id: string; name: string; grade: number | null; section: string | null; studentCount?: number };
type Subject = { id: string; name: string };
type AssignmentRow = { studentName: string; classLabel: string; roomName: string; buildingName: string; seatLabel: string };
type GenRes = { assignments: AssignmentRow[]; violations: { adjacent: number; skipOne: number } };

export default function SinavOlusturPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';
  const editPlanId = searchParams.get('plan_id');

  const [step, setStep] = useState(1);
  const [planId, setPlanId] = useState<string | null>(editPlanId ?? null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // Step 1: Sınav Bilgileri
  const [examName, setExamName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [lessonPeriod, setLessonPeriod] = useState('5. Ders');
  const [normalTime, setNormalTime] = useState('');
  const [footerLines, setFooterLines] = useState<string[]>([]);

  // Step 2: Ders Seçimi
  const [classSubjectMap, setClassSubjectMap] = useState<Record<string, string>>({});
  const [sabitSinifIds, setSabitSinifIds] = useState<Set<string>>(new Set());
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Step 3: Dağıtım Kriterleri
  const [fillMode, setFillMode] = useState<'balanced' | 'sequential'>('balanced');
  const [genderRule, setGenderRule] = useState<'can_sit_adjacent' | 'cannot_sit_adjacent'>('can_sit_adjacent');
  const [sameClassAdj, setSameClassAdj] = useState<'forbid' | 'allow'>('forbid');
  const [sameClassSkipOne, setSameClassSkipOne] = useState<'forbid' | 'allow'>('forbid');
  const [classMix, setClassMix] = useState<'can_mix' | 'cannot_mix'>('can_mix');
  const [constraints, setConstraints] = useState<Set<string>>(new Set(['no_back_to_back']));
  const [studentSortOrder, setStudentSortOrder] = useState<'student_number' | 'alphabetical' | 'random'>('student_number');
  const [fillDirection, setFillDirection] = useState<'ltr' | 'rtl' | 'alternating'>('ltr');
  const [prioritizePinned, setPrioritizePinned] = useState(true);
  const [specialNeedsInFront, setSpecialNeedsInFront] = useState(false);
  const [proctorMode, setProctorMode] = useState<'auto' | 'manual'>('auto');
  const [proctorsPerRoom, setProctorsPerRoom] = useState(2);

  // Step 4: Salon Belirleme
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [roomPick, setRoomPick] = useState<Record<string, boolean>>({});

  // Step 5 / 6
  const [preview, setPreview] = useState<GenRes | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, c, s] = await Promise.all([
        apiFetch<RoomRow[]>(`/butterfly-exam/rooms${schoolQ}`, { token }),
        apiFetch<ClassRow[]>(`/butterfly-exam/classes${schoolQ}`, { token }).catch(() => [] as ClassRow[]),
        apiFetch<Subject[]>('/classes-subjects/subjects', { token }).catch(() => [] as Subject[]),
      ]);
      setRooms(r);
      setRoomPick(Object.fromEntries(r.map((x) => [x.id, true])));
      setClasses(c);
      setSubjects(s);
      const m: Record<string, string> = {};
      for (const cl of c) m[cl.id] = '';
      setClassSubjectMap(m);
    } catch {
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  // Load existing plan when editing
  useEffect(() => {
    if (!editPlanId || !token || loading) return;
    void (async () => {
      try {
        const p = await apiFetch<{
          id: string; title: string; examStartsAt: string; status: string;
          rules: Record<string, unknown>;
        }>(`/butterfly-exam/plans/${editPlanId}${schoolQ}`, { token });
        setPlanId(p.id);
        setExamName(p.title);
        const d = new Date(p.examStartsAt);
        setExamDate(d.toISOString().slice(0, 10));
        const r = p.rules ?? {};
        if (typeof r.lessonPeriodLabel === 'string') setLessonPeriod(r.lessonPeriodLabel);
        if (Array.isArray(r.reportFooterLines)) setFooterLines(r.reportFooterLines as string[]);
        if (r.fillMode === 'balanced' || r.fillMode === 'sequential') setFillMode(r.fillMode);
        if (r.genderRule === 'can_sit_adjacent' || r.genderRule === 'cannot_sit_adjacent') setGenderRule(r.genderRule);
        if (r.sameClassAdjacent === 'allow' || r.sameClassAdjacent === 'forbid') setSameClassAdj(r.sameClassAdjacent);
        if (r.sameClassSkipOne === 'allow' || r.sameClassSkipOne === 'forbid') setSameClassSkipOne(r.sameClassSkipOne);
        if (r.classMix === 'can_mix' || r.classMix === 'cannot_mix') setClassMix(r.classMix);
        if (Array.isArray(r.constraints)) setConstraints(new Set(r.constraints as string[]));
        if (r.studentSortOrder === 'student_number' || r.studentSortOrder === 'alphabetical' || r.studentSortOrder === 'random') setStudentSortOrder(r.studentSortOrder);
        if (r.fillDirection === 'ltr' || r.fillDirection === 'rtl' || r.fillDirection === 'alternating') setFillDirection(r.fillDirection);
        if (r.prioritizePinned === true || r.prioritizePinned === false) setPrioritizePinned(r.prioritizePinned as boolean);
        if (r.specialNeedsInFront === true || r.specialNeedsInFront === false) setSpecialNeedsInFront(r.specialNeedsInFront as boolean);
        if (r.proctorMode === 'auto' || r.proctorMode === 'manual') setProctorMode(r.proctorMode);
        if (typeof r.proctorsPerRoom === 'number') setProctorsPerRoom(r.proctorsPerRoom);
        if (Array.isArray(r.classSubjectAssignments)) {
          const map: Record<string, string> = {};
          for (const a of r.classSubjectAssignments as Array<{ classId: string; subjectName: string }>) {
            map[a.classId] = a.subjectName;
          }
          setClassSubjectMap((prev) => ({ ...prev, ...map }));
        }
        if (Array.isArray(r.fixedClassIds)) setSabitSinifIds(new Set(r.fixedClassIds as string[]));
        setStep(2);
      } catch {
        toast.error('Plan yüklenemedi');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPlanId, token, loading]);

  useEffect(() => {
    if (editPlanId) return;
    const d = new Date();
    setExamDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }, [editPlanId]);

  const participatingClassIds = useMemo(
    () => Object.entries(classSubjectMap).filter(([, v]) => v !== '').map(([k]) => k),
    [classSubjectMap],
  );
  const participatingStudentCount = useMemo(
    () => classes.filter((c) => participatingClassIds.includes(c.id)).reduce((s, c) => s + (c.studentCount ?? 0), 0),
    [classes, participatingClassIds],
  );
  const selectedRooms = rooms.filter((r) => roomPick[r.id]);
  const totalCapacity = selectedRooms.reduce((s, r) => s + r.capacity, 0);

  const buildRules = () => {
    const lessonLabel = lessonPeriod === 'Normal Saat' ? normalTime || 'Normal Saat' : lessonPeriod;
    const csa = Object.entries(classSubjectMap)
      .filter(([, v]) => v !== '')
      .map(([classId, subjectName]) => ({ classId, subjectName }));
    const selectedRoomIds = rooms.filter((r) => roomPick[r.id]).map((r) => r.id);
    const isAllRooms = selectedRoomIds.length === rooms.length;
    return {
      participantMode: participatingClassIds.length > 0 ? 'classes' : 'all',
      participantClassIds: participatingClassIds.length > 0 ? participatingClassIds : undefined,
      lessonPeriodLabel: lessonLabel,
      reportFooterLines: footerLines.filter(Boolean),
      fillMode,
      genderRule,
      sameClassAdjacent: sameClassAdj,
      classMix,
      distributionMode: 'constraint_greedy',
      constraints: [...constraints],
      classSubjectAssignments: csa.length > 0 ? csa : undefined,
      roomIds: !isAllRooms ? selectedRoomIds : undefined,
      fixedClassIds: sabitSinifIds.size > 0 ? [...sabitSinifIds] : undefined,
      studentSortOrder,
      fillDirection,
      sameClassSkipOne,
      prioritizePinned,
      specialNeedsInFront,
      proctorMode,
      proctorsPerRoom: proctorMode === 'auto' ? proctorsPerRoom : undefined,
    };
  };

  const createPlan = async () => {
    if (!token || !examName.trim() || !examDate) {
      toast.error('Sınav adı ve tarihi gerekli');
      return;
    }
    setBusy(true);
    try {
      const dateTime = normalTime ? `${examDate}T${normalTime}` : `${examDate}T09:00`;
      const created = await apiFetch<{ id: string }>(`/butterfly-exam/plans${schoolQ}`, {
        method: 'POST', token,
        body: JSON.stringify({
          title: examName.trim(),
          exam_starts_at: new Date(dateTime).toISOString(),
          rules: { lessonPeriodLabel: lessonPeriod, reportFooterLines: footerLines.filter(Boolean) },
        }),
      });
      setPlanId(created.id);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setBusy(false);
    }
  };

  const saveAndNext = async (nextStep: number) => {
    if (!planId || !token) return;
    setBusy(true);
    try {
      await apiFetch(`/butterfly-exam/plans/${planId}${schoolQ}`, {
        method: 'PATCH', token,
        body: JSON.stringify({ rules: buildRules() }),
      });
      setStep(nextStep);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const runGenerate = async () => {
    if (!planId || !token) return;
    setBusy(true);
    try {
      await apiFetch(`/butterfly-exam/plans/${planId}${schoolQ}`, {
        method: 'PATCH', token, body: JSON.stringify({ rules: buildRules() }),
      });
      const data = await apiFetch<GenRes>(`/butterfly-exam/plans/${planId}/generate-seats${schoolQ}`, {
        method: 'POST', token,
      });
      setPreview(data);
      setStep(6);
      const v = data.violations;
      if (v.adjacent > 0 || v.skipOne > 0) {
        toast.success('Yerleştirme tamamlandı', { description: `Kural ihlali: yan yana ${v.adjacent}, arada bir ${v.skipOne}` });
      } else {
        toast.success('Yerleştirme başarıyla tamamlandı');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yerleştirme başarısız');
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    if (step === 1) { void createPlan(); return; }
    if (step === 2) {
      if (participatingClassIds.length === 0) {
        toast.error('En az bir sınıf için ders seçin');
        return;
      }
      void saveAndNext(3);
      return;
    }
    if (step === 3) { void saveAndNext(4); return; }
    if (step === 4) {
      if (!selectedRooms.length) { toast.error('En az bir salon seçin'); return; }
      void saveAndNext(5);
      return;
    }
    if (step === 5) { void runGenerate(); return; }
  };

  const goBack = () => {
    if (step <= 1) { router.push(`/kelebek-sinav/sinav-islemleri${schoolQ}`); return; }
    setStep((s) => s - 1);
  };

  const gradeGroups = useMemo(() => {
    const m = new Map<number | null, ClassRow[]>();
    for (const c of classes) {
      const g = c.grade;
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return [...m.entries()].sort(([a], [b]) => (a ?? 999) - (b ?? 999));
  }, [classes]);

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Yalnızca okul yöneticisi kullanabilir.{' '}
        <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`} className="text-primary underline">Geri dön</Link>
      </p>
    );
  }
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-xl font-bold">{step < 6 ? 'Yeni Sınav Oluştur' : `Sınav Düzenle: ${examDate} / ${examName}`}</h1>
      </div>

      {/* Step Progress */}
      <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = step > n;
            const cur = step === n;
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div className={cn(
                  'flex size-9 items-center justify-center rounded-full border-2 transition-all',
                  done && 'border-emerald-500 bg-emerald-500 text-white',
                  cur && 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-500/30',
                  !done && !cur && 'border-slate-200 bg-white text-slate-400 dark:border-zinc-700 dark:bg-zinc-900',
                )}>
                  {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                </div>
                <div className="text-center">
                  <p className={cn('hidden text-[11px] font-semibold sm:block', cur ? 'text-indigo-700 dark:text-indigo-300' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {s.label}
                  </p>
                  <p className={cn('text-[10px] sm:hidden', cur ? 'text-indigo-600 font-semibold' : 'text-muted-foreground')}>
                    Adım {n}
                  </p>
                  {cur && <p className="text-[9px] text-muted-foreground">Adım {n}</p>}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('absolute hidden sm:block h-0.5 w-8 translate-y-[-22px] translate-x-[4.5rem]',
                    done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-zinc-700')} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
        {/* Step 1 */}
        {step === 1 && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Sınav Bilgileri</h2>
              <p className="text-sm text-muted-foreground">Sınavın temel bilgilerini girin</p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <BookOpen className="size-3.5 text-indigo-600" /> Sınav Adı
                  <span className="text-rose-500">*</span>
                </p>
                <p className="mb-1 text-[11px] text-muted-foreground">Sınav adını girin</p>
                <Input
                  placeholder="Sınav Adı *"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  className="bg-white dark:bg-zinc-900"
                />
                {examDate && examName && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{examDate} / {examName}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                    <span className="flex size-4 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-600">📅</span>
                    Sınav Tarihi <span className="text-rose-500">*</span>
                  </p>
                  <p className="mb-1 text-[11px] text-muted-foreground">Sınavın yapılacağı tarihi seçin</p>
                  <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)}
                    className="bg-white dark:bg-zinc-900" />
                </div>
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                    <span className="text-amber-500">⏰</span> Sınav Saati
                  </p>
                  <p className="mb-1 text-[11px] text-muted-foreground">Ders saati veya normal saat seçin</p>
                  <div className="flex gap-2">
                    <select
                      className="h-10 flex-1 rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900"
                      value={lessonPeriod}
                      onChange={(e) => setLessonPeriod(e.target.value)}>
                      {LESSON_PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {lessonPeriod === 'Normal Saat' && (
                      <Input type="time" value={normalTime} onChange={(e) => setNormalTime(e.target.value)}
                        className="w-28 bg-white dark:bg-zinc-900" />
                    )}
                  </div>
                </div>
              </div>

              {/* Footer notes */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold">Plan Açıklaması</p>
                  <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => setFooterLines((l) => [...l, ''])}>
                    + Yeni Madde Ekle
                  </Button>
                </div>
                <div className="max-h-48 space-y-1.5 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/30">
                  {footerLines.length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">Madde eklemek için yukarıdaki butonu kullanın</p>
                  )}
                  {footerLines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{idx + 1}</span>
                      <Input value={line} onChange={(e) => setFooterLines((fl) => fl.map((l, j) => j === idx ? e.target.value : l))}
                        placeholder={`Madde ${idx + 1}`} className="flex-1 h-8 text-xs bg-white dark:bg-zinc-900" />
                      <button type="button" onClick={() => setFooterLines((fl) => fl.filter((_, j) => j !== idx))}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50">
                        <span className="text-sm">🗑</span>
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Her madde raporun altında bir satır olarak görüntülenecektir. Boş maddeler otomatik olarak kaldırılır.</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Ders Seçimi */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Ders Seçimi</h2>
              <p className="text-sm text-muted-foreground">Sınava katılacak öğrencileri belirlemek için her sınıf için ders seçin</p>
            </div>
            {gradeGroups.map(([grade, grpClasses]) => {
              const selected = grpClasses.filter((c) => (classSubjectMap[c.id] ?? '') !== '');
              const isAllSame = grpClasses.every((c) => (classSubjectMap[c.id] ?? '') === (classSubjectMap[grpClasses[0].id] ?? ''));
              const bulkVal = isAllSame ? (classSubjectMap[grpClasses[0].id] ?? '') : '';

              const setBulk = (val: string) =>
                setClassSubjectMap((m) => { const n = { ...m }; for (const c of grpClasses) n[c.id] = val; return n; });

              return (
                <div key={grade ?? 'other'} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                  {/* Grade header */}
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-zinc-700 dark:bg-zinc-800/60">
                    <div className="flex items-center gap-2">
                      <div className="size-2.5 rounded-sm bg-cyan-500" />
                      <p className="text-sm font-bold">{grade ? `${grade}. Sınıflar` : 'Diğer'}</p>
                      <span className="text-xs text-muted-foreground">
                        ({grpClasses.length} sınıf · {selected.length} seçili
                        {grpClasses.filter((c) => sabitSinifIds.has(c.id)).length > 0 &&
                          ` · ${grpClasses.filter((c) => sabitSinifIds.has(c.id)).length} sabit`})
                      </span>
                    </div>
                    {/* Toplu Seçim */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Toplu Seçim:</span>
                      <div className="relative flex items-center">
                        <select
                          className="h-7 rounded-lg border border-input bg-white pr-6 pl-2 text-xs dark:bg-zinc-900"
                          value={bulkVal}
                          onChange={(e) => setBulk(e.target.value)}>
                          <option value="">Sınav Yapılmayacak</option>
                          {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                        {bulkVal && (
                          <button type="button"
                            onClick={() => setBulk('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grpClasses.map((c) => {
                      const sub = classSubjectMap[c.id] ?? '';
                      const hasSubject = sub !== '';
                      const isSabit = sabitSinifIds.has(c.id);
                      return (
                        <div key={c.id} className={cn(
                          'rounded-xl border p-3 transition',
                          isSabit
                            ? 'border-amber-300/60 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-950/20'
                            : hasSubject
                              ? 'border-blue-300/60 bg-blue-50/60 dark:border-blue-800/50 dark:bg-blue-950/25'
                              : 'border-rose-200/60 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/20'
                        )}>
                          {/* Card top row */}
                          <div className="mb-2 flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{c.name}</p>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {/* Info tooltip */}
                              <span title={`${c.studentCount ?? 0} öğrenci`}
                                className="flex size-4 cursor-default items-center justify-center rounded-full border border-slate-300 text-[9px] font-bold text-slate-500 hover:border-blue-400 hover:text-blue-600">
                                i
                              </span>
                              {/* Sabit Sınıf toggle */}
                              <label className="flex cursor-pointer items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 transition hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300"
                                title="Sınıfı sabit tut — yerleştirmede özel işlem">
                                <input type="checkbox" className="sr-only"
                                  checked={isSabit}
                                  onChange={() => setSabitSinifIds((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(c.id)) n.delete(c.id); else n.add(c.id);
                                    return n;
                                  })} />
                                <Lock className="size-2.5" />
                                Sabit Sınıf
                                {isSabit && <span className="ml-0.5 size-1.5 rounded-full bg-amber-500" />}
                              </label>
                            </div>
                          </div>

                          {/* Subject select with clear X */}
                          <div className="relative">
                            <select
                              className={cn(
                                'w-full h-8 rounded-lg border pl-2 pr-7 text-xs font-medium appearance-none',
                                hasSubject
                                  ? 'border-blue-300/60 bg-white text-blue-800 dark:border-blue-700 dark:bg-zinc-900 dark:text-blue-200'
                                  : 'border-rose-300/60 bg-white text-slate-700 dark:border-rose-900/40 dark:bg-zinc-900'
                              )}
                              value={sub}
                              onChange={(e) => setClassSubjectMap((m) => ({ ...m, [c.id]: e.target.value }))}>
                              <option value="">Sınav Yapılmayacak</option>
                              {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                            {hasSubject && (
                              <button type="button"
                                onClick={() => setClassSubjectMap((m) => ({ ...m, [c.id]: '' }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                                <X className="size-3" />
                              </button>
                            )}
                          </div>

                          {/* Badge */}
                          {hasSubject ? (
                            <span className="mt-1.5 inline-flex items-center rounded-full bg-blue-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                              {sub}
                            </span>
                          ) : (
                            <span className="mt-1.5 inline-flex items-center rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                              Sınav Yapılmayacak
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {participatingClassIds.length > 0 && (
              <div className="rounded-xl border border-emerald-200/60 bg-emerald-50 px-4 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-300">
                {participatingClassIds.length} sınıf, tahminen {participatingStudentCount} öğrenci sınava girecek.
                {sabitSinifIds.size > 0 && (
                  <span className="ml-2 font-semibold text-amber-700 dark:text-amber-300">
                    · {sabitSinifIds.size} sabit sınıf
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Dağıtım Kriterleri */}
        {step === 3 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Dağıtım Kriterleri</h2>
              <p className="text-sm text-muted-foreground">Öğrenci yerleştirme kurallarını belirleyin</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {/* 1 — Salon Dağıtım Stratejisi */}
              <CriteriaCard title="Salon Dağıtım Stratejisi" subtitle="Öğrencileri salonlara dağıtım yöntemi"
                icon={<LayoutGrid className="size-4 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-950/40">
                <div className="flex gap-2">
                  <BigRadio checked={fillMode === 'balanced'} onClick={() => setFillMode('balanced')}
                    label="Dengeli Dağıtım" desc="Salonlara eşit dağıtılır" color="blue" />
                  <BigRadio checked={fillMode === 'sequential'} onClick={() => setFillMode('sequential')}
                    label="Dolduran Dağıtım" desc="Salonlar sırayla doldurulur" color="blue" />
                </div>
              </CriteriaCard>

              {/* 2 — Cinsiyet Kuralları */}
              <CriteriaCard title="Cinsiyet Kuralları" subtitle="Kız/erkek yan yana oturma"
                icon={<Users className="size-4 text-pink-600" />} iconBg="bg-pink-100 dark:bg-pink-950/40">
                <div className="flex gap-2">
                  <BigRadio checked={genderRule === 'can_sit_adjacent'} onClick={() => setGenderRule('can_sit_adjacent')}
                    label="Yan Yana Oturabilir" desc="Kız-erkek yan yana olabilir" color="emerald" />
                  <BigRadio checked={genderRule === 'cannot_sit_adjacent'} onClick={() => setGenderRule('cannot_sit_adjacent')}
                    label="Yan Yana Oturamaz" desc="Kız-erkek yan yana olamaz" color="rose" />
                </div>
              </CriteriaCard>

              {/* 3 — Kısıt Seviyeleri */}
              <CriteriaCard title="Kısıt Seviyeleri" subtitle="Aynı sınıf seviyesi oturma kuralları"
                icon={<AlertTriangle className="size-4 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-950/40">
                <div className="space-y-2">
                  <BigCheckbox checked={constraints.has('no_back_to_back')}
                    onClick={() => setConstraints((s) => { const n = new Set(s); n.has('no_back_to_back') ? n.delete('no_back_to_back') : n.add('no_back_to_back'); return n; })}
                    label="Arka Arkaya Oturamaz" desc="Aynı sınıf arka arkaya sıra alamaz" />
                  <BigCheckbox checked={constraints.has('no_cross')}
                    onClick={() => setConstraints((s) => { const n = new Set(s); n.has('no_cross') ? n.delete('no_cross') : n.add('no_cross'); return n; })}
                    label="Çapraz Oturamaz" desc="Aynı sınıf çapraz konuma gelemez" />
                  <BigCheckbox checked={constraints.has('single_in_pair_row')}
                    onClick={() => setConstraints((s) => { const n = new Set(s); n.has('single_in_pair_row') ? n.delete('single_in_pair_row') : n.add('single_in_pair_row'); return n; })}
                    label="İkili Sıra Tekil Dağıtım" desc="İkili sıranın tek tarafına öğrenci" />
                </div>
              </CriteriaCard>

              {/* 4 — Sınıf Karışımı */}
              <CriteriaCard title="Sınıf Karışımı" subtitle="Farklı sınıfları aynı salona alma"
                icon={<Shuffle className="size-4 text-emerald-600" />} iconBg="bg-emerald-100 dark:bg-emerald-950/40">
                <div className="flex gap-2">
                  <BigRadio checked={classMix === 'can_mix'} onClick={() => { setClassMix('can_mix'); setSameClassAdj('allow'); }}
                    label="Karışabilir" desc="Farklı sınıflar aynı salonda olabilir" color="emerald" />
                  <BigRadio checked={classMix === 'cannot_mix'} onClick={() => { setClassMix('cannot_mix'); setSameClassAdj('forbid'); }}
                    label="Karışamaz" desc="Her sınıf ayrı salonda sınava girer" color="rose" />
                </div>
              </CriteriaCard>

              {/* 5 — Aynı Sınıf Mesafe Kuralı */}
              <CriteriaCard title="Aynı Sınıf Mesafe Kuralı" subtitle="Aynı sınıftan öğrenciler arası boşluk"
                icon={<Settings2 className="size-4 text-violet-600" />} iconBg="bg-violet-100 dark:bg-violet-950/40">
                <div className="space-y-2">
                  <BigCheckbox checked={sameClassAdj === 'forbid'}
                    onClick={() => setSameClassAdj(sameClassAdj === 'forbid' ? 'allow' : 'forbid')}
                    label="Yan Yana Oturamaz" desc="Aynı sınıftan öğrenciler bitişik olamaz" />
                  <BigCheckbox checked={sameClassSkipOne === 'forbid'}
                    onClick={() => setSameClassSkipOne(sameClassSkipOne === 'forbid' ? 'allow' : 'forbid')}
                    label="Arada Bir Sıra Boş" desc="Aynı sınıftan ardışık sıralara gelemez" />
                </div>
              </CriteriaCard>

              {/* 6 — Öğrenci Sıralama */}
              <CriteriaCard title="Öğrenci Sıralama Kriteri" subtitle="Yerleştirme öncesi öğrenci sıralaması"
                icon={<BookOpen className="size-4 text-indigo-600" />} iconBg="bg-indigo-100 dark:bg-indigo-950/40">
                <div className="space-y-2">
                  {([
                    ['student_number', 'Öğrenci Numarasına Göre', 'Küçükten büyüğe numara sırasıyla'],
                    ['alphabetical', 'Alfabetik Sıralama', 'Ad soyada göre A→Z sıralama'],
                    ['random', 'Rastgele', 'Her yerleştirmede farklı sıralama'],
                  ] as const).map(([val, label, desc]) => (
                    <BigCheckbox key={val} checked={studentSortOrder === val}
                      onClick={() => setStudentSortOrder(val)}
                      label={label} desc={desc} />
                  ))}
                </div>
              </CriteriaCard>

              {/* 7 — Salon Dolum Yönü */}
              <CriteriaCard title="Salon Dolum Yönü" subtitle="Koltukların hangi yönden doldurulacağı"
                icon={<LayoutGrid className="size-4 text-cyan-600" />} iconBg="bg-cyan-100 dark:bg-cyan-950/40">
                <div className="flex gap-2">
                  <BigRadio checked={fillDirection === 'ltr'} onClick={() => setFillDirection('ltr')}
                    label="Soldan Sağa" desc="Sıralar soldan sağa doldurulur" color="blue" />
                  <BigRadio checked={fillDirection === 'rtl'} onClick={() => setFillDirection('rtl')}
                    label="Sağdan Sola" desc="Sıralar sağdan sola doldurulur" color="blue" />
                  <BigRadio checked={fillDirection === 'alternating'} onClick={() => setFillDirection('alternating')}
                    label="Alternatif" desc="Sırayla sol-sağ-sol doldurulur" color="blue" />
                </div>
              </CriteriaCard>

              {/* 8 — Özel Yerleştirme */}
              <CriteriaCard title="Özel Yerleştirme Kuralları" subtitle="Öncelikli öğrenci işlemleri"
                icon={<Lock className="size-4 text-rose-600" />} iconBg="bg-rose-100 dark:bg-rose-950/40">
                <div className="space-y-2">
                  <BigCheckbox checked={prioritizePinned}
                    onClick={() => setPrioritizePinned((v) => !v)}
                    label="Sabit Öğrenciler Önce" desc="Sabit olarak işaretlenen öğrenciler öncelikli yerleştirilir" />
                  <BigCheckbox checked={specialNeedsInFront}
                    onClick={() => setSpecialNeedsInFront((v) => !v)}
                    label="Özel İhtiyaç Öğrencisi Ön Sıra" desc="İşaretlenmiş öğrenciler birinci sıraya alınır" />
                </div>
              </CriteriaCard>

              {/* 9 — Gözetmen Ayarları */}
              <CriteriaCard title="Gözetmen Ayarları" subtitle="Sınav gözetmenlerinin atanma şekli"
                icon={<GraduationCap className="size-4 text-teal-600" />} iconBg="bg-teal-100 dark:bg-teal-950/40">
                <div className="flex gap-2 mb-2">
                  <BigRadio checked={proctorMode === 'auto'} onClick={() => setProctorMode('auto')}
                    label="Otomatik Atama" desc="Sistem gözetmenleri otomatik atar" color="blue" />
                  <BigRadio checked={proctorMode === 'manual'} onClick={() => setProctorMode('manual')}
                    label="Manuel Atama" desc="Gözetmenler elle belirtilir" color="blue" />
                </div>
                {proctorMode === 'auto' && (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/40">
                    <span className="text-xs text-muted-foreground">Salon başına gözetmen:</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setProctorsPerRoom((v) => Math.max(1, v - 1))}
                        className="flex size-6 items-center justify-center rounded-full border bg-white text-sm font-bold hover:bg-slate-100 dark:bg-zinc-800">−</button>
                      <span className="w-6 text-center text-sm font-bold tabular-nums">{proctorsPerRoom}</span>
                      <button type="button" onClick={() => setProctorsPerRoom((v) => Math.min(10, v + 1))}
                        className="flex size-6 items-center justify-center rounded-full border bg-white text-sm font-bold hover:bg-slate-100 dark:bg-zinc-800">+</button>
                    </div>
                    <span className="text-xs text-muted-foreground">gözetmen</span>
                  </div>
                )}
              </CriteriaCard>
            </div>

            {/* İpucu */}
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
              <Info className="size-4 shrink-0 text-amber-500" />
              <span><strong>İpucu:</strong> Kısıt seviyeleri dağıtım olmazsa otomatik olarak esnetilir. Sabit öğrenciler her zaman kendi sıra tercihine göre yerleştirilir.</span>
            </div>
          </div>
        )}

        {/* Step 4: Salon Belirleme */}
        {step === 4 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Sınav Salonu Belirleme</h2>
              <p className="text-sm text-muted-foreground">Sınava girecek öğrencilerin yerleştirileceği salonları seçin</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border-l-4 border-l-blue-500 bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sınav Salonları</p>
                <p className="text-2xl font-bold tabular-nums text-blue-600">{selectedRooms.length}</p>
              </div>
              <div className="rounded-xl border-l-4 border-l-violet-500 bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sınava Girecek Öğrenci</p>
                <p className="text-2xl font-bold tabular-nums text-violet-600">{participatingStudentCount}</p>
              </div>
              <div className="rounded-xl border-l-4 border-l-amber-500 bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Toplam Kapasite</p>
                <p className={cn('text-2xl font-bold tabular-nums', totalCapacity >= participatingStudentCount ? 'text-emerald-600' : 'text-rose-600')}>
                  {totalCapacity}
                </p>
              </div>
            </div>

            {/* Room table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground dark:bg-zinc-800/80">
                  <tr>
                    <th className="px-4 py-2.5 text-left w-8">
                      <input type="checkbox"
                        checked={rooms.every((r) => roomPick[r.id])}
                        onChange={(e) => setRoomPick(Object.fromEntries(rooms.map((r) => [r.id, e.target.checked])))} />
                    </th>
                    <th className="px-4 py-2.5 text-left">Ad</th>
                    <th className="px-4 py-2.5 text-left">Tip</th>
                    <th className="px-4 py-2.5 text-right">Kapasite</th>
                    <th className="px-4 py-2.5 text-right">Öğrenci</th>
                    <th className="px-4 py-2.5 text-left">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => {
                    const picked = !!roomPick[r.id];
                    return (
                      <tr key={r.id}
                        className={cn('border-t border-slate-100 cursor-pointer hover:bg-slate-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/30',
                          picked && 'bg-indigo-50/60 dark:bg-indigo-950/20')}
                        onClick={() => setRoomPick((m) => ({ ...m, [r.id]: !m[r.id] }))}>
                        <td className="px-4 py-2.5">
                          <input type="checkbox" checked={picked} onChange={() => {}} onClick={(e) => e.stopPropagation()} />
                        </td>
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium dark:bg-zinc-700">
                            {r.seatLayout === 'single' ? 'Tekli' : 'İkili'} Sıra
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{r.capacity}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">-</td>
                        <td className="px-4 py-2.5">
                          {picked ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Sınava dahil</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-zinc-700">Sınava dahil değil</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalCapacity < participatingStudentCount && totalCapacity > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50 px-4 py-2.5 text-xs text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-300">
                <Info className="size-3.5" />
                Kapasite öğrenci sayısından az! Daha fazla salon seçin veya katılımcı sınıfları azaltın.
              </div>
            )}
          </div>
        )}

        {/* Step 5: Yerleştirme */}
        {step === 5 && (
          <div className="p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Otomatik Yerleştirme</h2>
              <p className="text-sm text-muted-foreground">
                Öğrenciler seçilen salonlara Dağıtım Kriterlerine göre otomatik olarak yerleştirilecek
              </p>
            </div>

            <div className="rounded-xl border border-blue-200/60 bg-blue-50/50 px-4 py-3 text-xs text-blue-700 flex items-center gap-2 dark:border-blue-900/40 dark:bg-blue-950/25 dark:text-blue-300">
              <Info className="size-3.5 shrink-0" />
              Öğrenciler seçilen kriterlere göre salonlara otomatik yerleştirilecektir.
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-white/60 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="text-muted-foreground">📊</span> Özet
                <span className="text-xs font-normal text-muted-foreground">Sınav özet bilgileri</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <InfoField icon="📋" label="Sınav Adı" value={examName} />
                <InfoField icon="📅" label="Sınav Tarihi" value={examDate} />
                <InfoField icon="🏫" label="Sınav Salonları" value={String(selectedRooms.length)} />
                <InfoField icon="👨‍🎓" label="Sınava Katılacak Sınıflar" value={String(participatingClassIds.length)} />
              </div>
            </div>

            <Button type="button" className="w-full h-12 gap-2 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => void runGenerate()} disabled={busy}>
              {busy ? <LoadingSpinner /> : <><Wand2 className="size-5" /> Yerleştirmeyi Yap</>}
            </Button>
          </div>
        )}

        {/* Step 6: Önizleme */}
        {step === 6 && preview && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Yerleştirme Önizleme</h2>
              <p className="text-sm text-muted-foreground">
                {preview.assignments.length} öğrenci yerleştirildi.
                {preview.violations.adjacent + preview.violations.skipOne > 0 && (
                  <span className="text-amber-600 ml-1">Kural ihlali: yan yana {preview.violations.adjacent}, arada bir {preview.violations.skipOne}</span>
                )}
              </p>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 dark:border-zinc-700 max-h-80">
              <table className="w-full min-w-[500px] text-xs">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide dark:bg-zinc-800/80">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Öğrenci</th>
                    <th className="px-3 py-2.5 text-left">Sınıf</th>
                    <th className="px-3 py-2.5 text-left">Salon</th>
                    <th className="px-3 py-2.5 text-left">Sıra</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.assignments.slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
                      <td className="px-3 py-1.5 font-medium">{r.studentName}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.classLabel}</td>
                      <td className="px-3 py-1.5">{r.roomName}</td>
                      <td className="px-3 py-1.5 font-bold text-indigo-600 dark:text-indigo-400">{r.seatLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.assignments.length > 100 && (
              <p className="text-xs text-center text-muted-foreground">+ {preview.assignments.length - 100} daha...</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          onClick={() => router.push(`/kelebek-sinav/sinav-islemleri${schoolQ}`)}>
          <LogOut className="size-4" /> Çıkış
        </Button>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1" onClick={goBack}>
            <ChevronLeft className="size-4" /> {step === 1 ? 'İptal' : 'Geri'}
          </Button>
          {step < 6 ? (
            <Button type="button" size="sm" disabled={busy} onClick={goNext} className="gap-1">
              {busy ? <LoadingSpinner /> : step === 5 ? <><Wand2 className="size-4" /> Yerleştirmeyi Yap</> : <>Sonraki Adım <ChevronRight className="size-4" /></>}
            </Button>
          ) : (
            <Button type="button" size="sm" asChild>
              <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}>Sınav İşlemlerine Dön</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CriteriaCard({
  title, subtitle, icon, iconBg, children,
}: {
  title: string; subtitle: string; icon: React.ReactNode; iconBg: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className={cn('rounded-lg p-2', iconBg)}>{icon}</div>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function BigRadio({ checked, onClick, label, desc, color }: {
  checked: boolean; onClick: () => void; label: string; desc: string; color: 'blue' | 'emerald' | 'rose';
}) {
  const active: Record<string, string> = {
    blue: 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30',
    emerald: 'border-emerald-400 bg-emerald-50 dark:border-emerald-600 dark:bg-emerald-950/30',
    rose: 'border-rose-400 bg-rose-50 dark:border-rose-600 dark:bg-rose-950/30',
  };
  const dot: Record<string, string> = {
    blue: 'bg-blue-600', emerald: 'bg-emerald-600', rose: 'bg-rose-600',
  };
  return (
    <button type="button" onClick={onClick}
      className={cn('flex flex-1 cursor-pointer items-start gap-2.5 rounded-xl border-2 p-3 text-left transition',
        checked ? active[color] : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/30')}>
      <div className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition',
        checked ? `border-${color}-500 bg-white` : 'border-slate-300 bg-white dark:border-zinc-600')}>
        {checked && <div className={cn('size-2 rounded-full', dot[color])} />}
      </div>
      <div>
        <p className={cn('text-sm font-semibold', checked ? `text-${color}-800 dark:text-${color}-200` : '')}>{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function BigCheckbox({ checked, onClick, label, desc }: {
  checked: boolean; onClick: () => void; label: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={cn('flex w-full cursor-pointer items-start gap-2.5 rounded-xl border-2 p-3 text-left transition',
        checked
          ? 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-950/30'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/30')}>
      <div className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2 transition',
        checked ? 'border-blue-500 bg-blue-600' : 'border-slate-300 bg-white dark:border-zinc-600')}>
        {checked && <Check className="size-2.5 text-white" />}
      </div>
      <div>
        <p className={cn('text-sm font-semibold', checked ? 'text-blue-800 dark:text-blue-200' : '')}>{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function InfoField({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 dark:border-zinc-700/60 dark:bg-zinc-800/40">
      <span className="text-sm">{icon}</span>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}
