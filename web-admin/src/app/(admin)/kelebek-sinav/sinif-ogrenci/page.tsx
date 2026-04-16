'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Plus, Users, X, Trash2, Upload, ClipboardPaste, Lock, UserPlus, UserMinus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ClassRow = { id: string; name: string; grade: number | null; section: string | null; studentCount: number };
type Student = { id: string; name: string; studentNumber: string | null };
type AllStudent = Student & { className: string | null };
type Plan = { id: string; title: string; rules?: Record<string, unknown> };

export default function KelebekSinifOgrenciPage() {
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState('');

  // Student modal
  const [studentModal, setStudentModal] = useState<ClassRow | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentNo, setNewStudentNo] = useState('');

  // Sabit öğrenci modal
  const [pinnedModal, setPinnedModal] = useState(false);
  const [pinnedPlanId, setPinnedPlanId] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [allStudents, setAllStudents] = useState<AllStudent[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [pinnedSearch, setPinnedSearch] = useState('');
  const [pinnedSaving, setPinnedSaving] = useState(false);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  /** Sabit öğrenciler round-robin sıradaki ilk koltukları alsın */
  const [prioritizePinned, setPrioritizePinned] = useState(true);
  /** Yerleştirmeden sonra sabit öğrenci koltukları kilitlensin */
  const [lockPinnedAssignments, setLockPinnedAssignments] = useState(true);

  // E-Okul paste modal
  const [pasteModal, setPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pastePreview, setPastePreview] = useState<{ className: string; classId: string | null; count: number }[] | null>(null);
  const [pasteLoading, setPasteLoading] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiFetch<ClassRow[]>(`/butterfly-exam/classes${schoolQ}`, { token });
      setClasses(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  const openStudentModal = async (cls: ClassRow) => {
    setStudentModal(cls);
    setStudentsLoading(true);
    setStudents([]);
    try {
      const list = await apiFetch<Student[]>(`/butterfly-exam/classes/${cls.id}/students${schoolQ}`, { token: token! });
      setStudents(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setStudentsLoading(false);
    }
  };

  const addStudent = async () => {
    if (!token || !studentModal || !newStudentName.trim()) return;
    try {
      const s = await apiFetch<Student>(`/butterfly-exam/classes/${studentModal.id}/students${schoolQ}`, {
        method: 'POST', token,
        body: JSON.stringify({ name: newStudentName.trim(), studentNumber: newStudentNo.trim() || undefined }),
      });
      setStudents((prev) => [...prev, s]);
      setClasses((prev) => prev.map((c) => c.id === studentModal.id ? { ...c, studentCount: c.studentCount + 1 } : c));
      setNewStudentName('');
      setNewStudentNo('');
      toast.success('Öğrenci eklendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!token || !confirm('Öğrenciyi silmek istiyor musunuz?')) return;
    try {
      await apiFetch(`/butterfly-exam/students/${studentId}${schoolQ}`, { method: 'DELETE', token });
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
      if (studentModal) {
        setClasses((prev) => prev.map((c) => c.id === studentModal.id ? { ...c, studentCount: Math.max(0, c.studentCount - 1) } : c));
      }
      toast.success('Silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  // E-Okul paste preview
  const previewPaste = async () => {
    if (!pasteText.trim() || !token) return;
    setPasteLoading(true);
    setPastePreview(null);
    try {
      const res = await apiFetch<{ created: number; skipped: number; classGroups: { className: string; classId: string | null; count: number }[] }>(
        `/butterfly-exam/import/eokul-text${schoolQ}`,
        { method: 'POST', token, body: JSON.stringify({ text: pasteText }) }
      );
      setPastePreview(res.classGroups);
      toast.success(`Aktarıldı: ${res.created} öğrenci`, { description: `Atlandı: ${res.skipped}` });
      setPasteModal(false);
      setPasteText('');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İçe aktarım başarısız');
    } finally {
      setPasteLoading(false);
    }
  };

  const openPinnedModal = async () => {
    if (!token) return;
    setPinnedModal(true);
    setPinnedLoading(true);
    try {
      const [p, s] = await Promise.all([
        apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token }),
        apiFetch<AllStudent[]>(`/butterfly-exam/students${schoolQ}`, { token }),
      ]);
      setPlans(p);
      setAllStudents(s);
      const firstPlan = p[0];
      if (firstPlan) {
        setPinnedPlanId(firstPlan.id);
        const ids = firstPlan.rules?.pinnedStudentIds;
        setPinnedIds(new Set(Array.isArray(ids) ? (ids as string[]) : []));
        const r = firstPlan.rules as Record<string, unknown> | undefined;
        setPrioritizePinned(r?.prioritizePinned !== false);
        setLockPinnedAssignments(r?.lockPinnedAssignments !== false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setPinnedLoading(false);
    }
  };

  const onPinnedPlanChange = (planId: string) => {
    setPinnedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    const ids = plan?.rules?.pinnedStudentIds;
    setPinnedIds(new Set(Array.isArray(ids) ? (ids as string[]) : []));
    const r = plan?.rules as Record<string, unknown> | undefined;
    setPrioritizePinned(r?.prioritizePinned !== false);
    setLockPinnedAssignments(r?.lockPinnedAssignments !== false);
  };

  const savePinned = async () => {
    if (!token || !pinnedPlanId) return;
    setPinnedSaving(true);
    try {
      await apiFetch(`/butterfly-exam/plans/${pinnedPlanId}${schoolQ}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          rules: {
            pinnedStudentIds: [...pinnedIds],
            prioritizePinned,
            lockPinnedAssignments,
          },
        }),
      });
      // Update local plan rules
      setPlans((ps) =>
        ps.map((p) =>
          p.id === pinnedPlanId
            ? {
                ...p,
                rules: {
                  ...(p.rules ?? {}),
                  pinnedStudentIds: [...pinnedIds],
                  prioritizePinned,
                  lockPinnedAssignments,
                },
              }
            : p,
        ),
      );
      toast.success('Sabit öğrenciler kaydedildi');
      setPinnedModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setPinnedSaving(false);
    }
  };

  const filtered = classes.filter((c) => {
    if (!search.trim()) return true;
    const label = [c.grade, c.section, c.name].filter(Boolean).join(' ').toLowerCase();
    return label.includes(search.toLowerCase());
  });

  const grouped = filtered.reduce<Record<number | string, ClassRow[]>>((acc, c) => {
    const g = c.grade ?? 0;
    if (!acc[g]) acc[g] = [];
    acc[g].push(c);
    return acc;
  }, {});

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);

  const GRADE_COLORS: Record<number, { card: string; badge: string; dot: string; num: string; header: string }> = {
    9:  { card: 'border-sky-200/70 hover:border-sky-400/60 dark:border-sky-900/50',   badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',   dot: 'bg-sky-500',   num: 'text-sky-700 dark:text-sky-300',   header: 'from-sky-500 to-cyan-500' },
    10: { card: 'border-violet-200/70 hover:border-violet-400/60 dark:border-violet-900/50', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300', dot: 'bg-violet-500', num: 'text-violet-700 dark:text-violet-300', header: 'from-violet-500 to-fuchsia-500' },
    11: { card: 'border-emerald-200/70 hover:border-emerald-400/60 dark:border-emerald-900/50', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', dot: 'bg-emerald-500', num: 'text-emerald-700 dark:text-emerald-300', header: 'from-emerald-500 to-teal-500' },
    12: { card: 'border-amber-200/70 hover:border-amber-400/60 dark:border-amber-900/50', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300', dot: 'bg-amber-500', num: 'text-amber-700 dark:text-amber-300', header: 'from-amber-500 to-orange-500' },
  };
  const defaultColor = { card: 'border-slate-200/70 hover:border-slate-400/60 dark:border-zinc-700/50', badge: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300', dot: 'bg-slate-400', num: 'text-slate-700 dark:text-zinc-300', header: 'from-slate-500 to-zinc-500' };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="min-w-0 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            {classes.length} sınıf · {totalStudents} öğrenci
          </p>
        </div>
        {isAdmin && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button size="sm" variant="outline" className="w-full justify-center gap-1.5 border-rose-400/60 bg-rose-500/5 text-rose-700 sm:w-auto dark:text-rose-300"
              onClick={() => void openPinnedModal()}>
              <Lock className="size-4" /> Sabit Öğrenci
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-center gap-1.5 border-emerald-400/60 bg-emerald-500/5 text-emerald-700 sm:w-auto dark:text-emerald-300"
              onClick={() => setPasteModal(true)}>
              <ClipboardPaste className="size-4" /> E-Okul Öğrenci Aktar
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Öğrenci adı, okul no veya sınıf adı ile arama yapın..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-4"
        />
      </div>

      {/* Class Grid */}
      {classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center dark:border-slate-700">
          <Users className="mx-auto size-10 text-slate-400 mb-3" />
          <p className="text-sm text-muted-foreground">Henüz sınıf eklenmemiş</p>
          <p className="text-xs text-muted-foreground mt-1">Sınıf ve öğrenci verilerini <a href="/classes-subjects" className="text-primary underline">Sınıflar ve Dersler</a> sayfasından yönetin.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([grade, grpClasses]) => {
            const g = Number(grade);
            const col = GRADE_COLORS[g] ?? defaultColor;
            const gradeStudents = grpClasses.reduce((s, c) => s + c.studentCount, 0);
            return (
              <div key={grade}>
                {/* Grade header */}
                <div className="mb-3 flex items-center gap-3">
                  <div className={cn('flex size-8 items-center justify-center rounded-xl bg-linear-to-br text-sm font-bold text-white shadow-sm', col.header)}>
                    {grade !== '0' ? grade : '—'}
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-none">
                      {grade !== '0' ? `${grade}. Sınıflar` : 'Diğer Sınıflar'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {grpClasses.length} şube · {gradeStudents} öğrenci
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {grpClasses.map((cls) => (
                    <button key={cls.id} type="button"
                      onClick={() => void openStudentModal(cls)}
                      className={cn(
                        'group flex flex-col rounded-2xl border bg-white/80 p-3.5 text-left shadow-sm transition-all duration-200',
                        'hover:shadow-md hover:-translate-y-0.5',
                        'dark:bg-zinc-900/70',
                        col.card,
                      )}
                    >
                      {/* Top: class name + arrow */}
                      <div className="mb-2 flex items-start justify-between gap-1">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold leading-tight">{cls.name}</p>
                          {cls.section && (
                            <p className="truncate text-[11px] text-muted-foreground">{cls.section}</p>
                          )}
                        </div>
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition group-hover:text-muted-foreground mt-0.5" />
                      </div>

                      {/* Student count */}
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('flex size-5 items-center justify-center rounded-full', col.badge)}>
                            <Users className="size-2.5" />
                          </div>
                          <span className={cn('text-xs font-semibold tabular-nums', col.num)}>
                            {cls.studentCount}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">öğrenci</span>
                      </div>

                      {/* Mini progress bar */}
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                        <div
                          className={cn('h-full rounded-full bg-linear-to-r transition-all', col.header)}
                          style={{ width: `${Math.min(100, (cls.studentCount / 35) * 100)}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Student Modal */}
      {studentModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="flex h-[min(100dvh,90vh)] w-full max-h-[100dvh] max-w-2xl flex-col rounded-t-2xl border border-white/60 bg-white shadow-2xl sm:h-[90vh] sm:rounded-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/50">
                  <Users className="size-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Öğrenci Listesi</p>
                  <p className="text-xs text-muted-foreground">{studentModal.name}</p>
                </div>
              </div>
              <button onClick={() => setStudentModal(null)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>

            {/* Stats */}
            <div className="flex gap-3 border-b border-slate-100 px-5 py-3 dark:border-zinc-800">
              <div className="rounded-lg bg-indigo-50 px-3 py-1.5 dark:bg-indigo-950/40">
                <span className="text-xs text-muted-foreground">Toplam</span>
                <p className="text-lg font-bold tabular-nums text-indigo-700 dark:text-indigo-300">{students.length}</p>
              </div>
            </div>

            {/* Table */}
            <div className="min-h-0 flex-1 overflow-auto">
              {studentsLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : (
                <table className="w-full min-w-[280px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground dark:bg-zinc-800/80">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Öğrenci No</th>
                      <th className="px-4 py-2.5 text-left">Öğrenci Adı Soyadı</th>
                      {isAdmin && <th className="px-4 py-2.5 text-right">İşlemler</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{s.studentNumber ?? '-'}</td>
                        <td className="px-4 py-2 font-medium">{s.name}</td>
                        {isAdmin && (
                          <td className="px-4 py-2 text-right">
                            <button type="button" onClick={() => void deleteStudent(s.id)}
                              className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {students.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 3 : 2} className="py-8 text-center text-sm text-muted-foreground">
                          Bu sınıfa henüz öğrenci eklenmemiş.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Add student */}
            {isAdmin && (
              <div className="border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Yeni Öğrenci Ekle</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input placeholder="Öğrenci No" value={newStudentNo}
                    onChange={(e) => setNewStudentNo(e.target.value)}
                    className="w-full text-sm sm:w-28" />
                  <Input placeholder="Ad Soyad" value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void addStudent()}
                    className="min-w-0 flex-1 text-sm" />
                  <Button size="sm" onClick={() => void addStudent()} disabled={!newStudentName.trim()} className="w-full shrink-0 gap-1 sm:w-auto">
                    <Plus className="size-3.5" /> Ekle
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sabit Öğrenci Yönetimi Modal */}
      {pinnedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[90vh] max-h-[640px] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-rose-100 p-2 dark:bg-rose-950/40">
                  <Lock className="size-4 text-rose-600" />
                </div>
                <div>
                  <p className="font-semibold">Sabit Öğrenci Yönetimi</p>
                  <p className="text-xs text-muted-foreground">Öğrenci sabitleme ve kaldırma işlemleri</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input
                    className="h-8 w-44 rounded-lg border border-input bg-white pl-3 pr-8 text-sm dark:bg-zinc-800"
                    placeholder="Öğrenci ara..."
                    value={pinnedSearch}
                    onChange={(e) => setPinnedSearch(e.target.value)}
                  />
                </div>
                <button type="button" onClick={() => setPinnedModal(false)}
                  className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Plan selector */}
            <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-xs text-muted-foreground">Sınav:</span>
                <select
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-white px-2 text-xs dark:bg-zinc-800"
                  value={pinnedPlanId}
                  onChange={(e) => onPinnedPlanChange(e.target.value)}>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-muted-foreground">{pinnedIds.size} sabit seçildi</span>
            </div>
            <div className="space-y-2 border-b border-slate-100 px-4 py-3 dark:border-zinc-800 sm:px-5">
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-input"
                  checked={prioritizePinned}
                  onChange={(e) => setPrioritizePinned(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Önce yerleştir</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    Sabit öğrenciler, round-robin sıradaki ilk uygun koltukları alır (listedeki sıra korunur). Kapalıysa tüm öğrenciler aynı sıralama kuralına girer.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-input"
                  checked={lockPinnedAssignments}
                  onChange={(e) => setLockPinnedAssignments(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-foreground">Yerleştirmeden sonra kilitle</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    «Yerleştir» sonrası sabit öğrencilerin koltukları kilitlenir; taşımak için önce kilit kaldırılır. Manuel `pinnedSeats` zaten korumalıdır.
                  </span>
                </span>
              </label>
            </div>

            {pinnedLoading ? (
              <div className="flex flex-1 items-center justify-center"><LoadingSpinner /></div>
            ) : (
              <div className="flex flex-1 gap-0 overflow-hidden">
                {/* Left: Tüm Öğrenciler */}
                <div className="flex w-1/2 flex-col border-r border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
                    <Users className="size-4 text-emerald-600" />
                    <p className="text-xs font-semibold">Tüm Öğrenciler</p>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {allStudents.filter((s) => !pinnedIds.has(s.id)).length} öğrenci
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {allStudents
                      .filter((s) => !pinnedIds.has(s.id))
                      .filter((s) => !pinnedSearch || s.name.toLowerCase().includes(pinnedSearch.toLowerCase()) || (s.studentNumber ?? '').includes(pinnedSearch))
                      .map((s) => (
                        <div key={s.id}
                          className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {s.studentNumber ? `${s.studentNumber} · ` : ''}{s.className ?? '—'}
                            </p>
                          </div>
                          <button type="button"
                            onClick={() => setPinnedIds((prev) => new Set([...prev, s.id]))}
                            className="shrink-0 rounded-lg bg-emerald-500 p-1.5 text-white hover:bg-emerald-600 transition">
                            <UserPlus className="size-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Right: Sabit Öğrenciler */}
                <div className="flex w-1/2 flex-col">
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-rose-50/80 px-4 py-2.5 dark:border-zinc-800 dark:bg-rose-950/20">
                    <Lock className="size-4 text-rose-600" />
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Sabit Öğrenciler</p>
                    <span className="ml-auto text-xs text-muted-foreground">{pinnedIds.size} öğrenci</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {allStudents
                      .filter((s) => pinnedIds.has(s.id))
                      .filter((s) => !pinnedSearch || s.name.toLowerCase().includes(pinnedSearch.toLowerCase()) || (s.studentNumber ?? '').includes(pinnedSearch))
                      .map((s) => (
                        <div key={s.id}
                          className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {s.studentNumber ? `${s.studentNumber} · ` : ''}{s.className ?? '—'}
                            </p>
                          </div>
                          <button type="button"
                            onClick={() => setPinnedIds((prev) => { const n = new Set(prev); n.delete(s.id); return n; })}
                            className="shrink-0 rounded-lg bg-rose-500 p-1.5 text-white hover:bg-rose-600 transition">
                            <UserMinus className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    {pinnedIds.size === 0 && (
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                        <Lock className="size-8 text-rose-200" />
                        <p className="text-xs text-muted-foreground">Henüz sabit öğrenci yok</p>
                        <p className="text-[10px] text-muted-foreground">Sol listeden öğrenci ekleyin</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Katılımcı listesine eklenirler; «Önce yerleştir» ile ilk koltuk sırası, «kilitle» ile dağıtım sonrası koruma. Kesin koltuk için plan kurallarında `pinnedSeats` kullanılır.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPinnedModal(false)}>İptal</Button>
                <Button size="sm" disabled={pinnedSaving || !pinnedPlanId}
                  onClick={() => void savePinned()}
                  className="gap-1.5 bg-rose-600 hover:bg-rose-700 text-white">
                  {pinnedSaving ? <LoadingSpinner /> : <><Lock className="size-3.5" /> Kaydet</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E-Okul Paste Modal */}
      {pasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950/50">
                  <Upload className="size-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">E-Okul Öğrenci Sınıf Aktarım</p>
                  <p className="text-xs text-muted-foreground">E-Okuldan toplu öğrenci ve sınıf aktarımı</p>
                </div>
              </div>
              <button onClick={() => setPasteModal(false)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden p-5">
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="size-4 text-blue-600" />
                  <span className="text-sm font-medium">Yapıştırma Alanı (CTRL+V)</span>
                  {pasteText && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {pasteText.length} karakter · {pasteText.split('\n').filter(Boolean).length} satır
                    </span>
                  )}
                </div>
                <textarea
                  className={cn(
                    'flex-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-zinc-700 dark:bg-zinc-800/60'
                  )}
                  placeholder="E-Okul'dan kopyaladığınız öğrenci listesini buraya yapıştırın..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setPasteModal(false)}>Geri</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPasteModal(false)}>İptal</Button>
                <Button size="sm" disabled={!pasteText.trim() || pasteLoading}
                  onClick={() => void previewPaste()} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                  {pasteLoading ? <LoadingSpinner /> : <><Upload className="size-3.5" /> Aktar</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
