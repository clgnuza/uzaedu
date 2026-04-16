'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import Link from 'next/link';
import { BookOpen, GraduationCap, Plus, X, Search, UserPlus, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type Subject = { id: string; name: string; code: string | null };
type Teacher = { id: string; display_name: string | null; email: string };
type ModuleTeacher = { id: string; userId: string; display_name: string | null; email: string };

export default function KelebekDersOgretmenPage() {
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [moduleTeachers, setModuleTeachers] = useState<ModuleTeacher[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const teacherQ = schoolQ.startsWith('?')
        ? `?role=teacher&limit=100&${schoolQ.slice(1)}`
        : `?role=teacher&limit=100`;
      const [subs, teachRes, modTeach] = await Promise.all([
        apiFetch<Subject[]>('/classes-subjects/subjects', { token }),
        apiFetch<{ items?: Teacher[]; data?: Teacher[] } | Teacher[]>(`/users${teacherQ}`, { token }).catch(() => [] as Teacher[]),
        apiFetch<ModuleTeacher[]>(`/butterfly-exam/module-teachers${schoolQ}`, { token }).catch(() => [] as ModuleTeacher[]),
      ]);
      setSubjects(subs);
      const teachList = Array.isArray(teachRes)
        ? teachRes
        : ((teachRes as { items?: Teacher[] }).items ?? (teachRes as { data?: Teacher[] }).data ?? []);
      setAllTeachers(teachList);
      setModuleTeachers(modTeach);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addSubject = async () => {
    if (!token || !newSubject.trim()) return;
    try {
      const s = await apiFetch<Subject>('/classes-subjects/subjects', {
        method: 'POST', token, body: JSON.stringify({ name: newSubject.trim() }),
      });
      setSubjects((prev) => [...prev, s]);
      setNewSubject('');
      toast.success('Ders eklendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    }
  };

  const deleteSubject = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/classes-subjects/subjects/${id}`, { method: 'DELETE', token });
      setSubjects((prev) => prev.filter((s) => s.id !== id));
      toast.success('Silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const addModuleTeacher = async (userId: string) => {
    if (!token) return;
    try {
      const row = await apiFetch<ModuleTeacher>(`/butterfly-exam/module-teachers/${userId}${schoolQ}`, {
        method: 'POST', token,
      });
      setModuleTeachers((prev) => [...prev, row]);
      setPickerOpen(false);
      setPickerSearch('');
      toast.success('Öğretmen modüle eklendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    }
  };

  const removeModuleTeacher = async (userId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/butterfly-exam/module-teachers/${userId}${schoolQ}`, { method: 'DELETE', token });
      setModuleTeachers((prev) => prev.filter((t) => t.userId !== userId));
      toast.success('Öğretmen modülden çıkarıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Çıkarılamadı');
    }
  };

  const moduleUserIds = new Set(moduleTeachers.map((t) => t.userId));
  const filteredSubjects = subjects.filter((s) =>
    !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase())
  );
  const filteredModuleTeachers = moduleTeachers.filter((t) =>
    !teacherSearch ||
    (t.display_name ?? '').toLowerCase().includes(teacherSearch.toLowerCase()) ||
    t.email?.toLowerCase().includes(teacherSearch.toLowerCase())
  );
  const pickerOptions = allTeachers.filter((t) =>
    !moduleUserIds.has(t.id) &&
    (!pickerSearch ||
      (t.display_name ?? '').toLowerCase().includes(pickerSearch.toLowerCase()) ||
      t.email?.toLowerCase().includes(pickerSearch.toLowerCase()))
  );

  const teachersLink = `/teachers${searchParams.get('school_id') ? `?school_id=${searchParams.get('school_id')}` : ''}`;

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-bold sm:text-xl">Ders - Öğretmen İşlemleri</h1>
          <p className="text-sm text-muted-foreground">Sınav derslerini ve modül öğretmenlerini yönetin</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
            <BookOpen className="size-3 shrink-0" /> {subjects.length} Ders
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            <GraduationCap className="size-3 shrink-0" /> {moduleTeachers.length} Öğretmen
          </span>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        {/* ─── Dersler Panel ─── */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" style={{ minHeight: 480 }}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950/40">
                <BookOpen className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold">Dersler</p>
                <p className="text-xs text-muted-foreground">Sınav derslerini yönetin</p>
              </div>
            </div>
            <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
              {subjects.length}
            </span>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-zinc-800">
            {isAdmin && (
              <>
                <Input
                  placeholder="DERS ADI"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void addSubject()}
                  className="h-8 flex-1 border-0 bg-transparent text-xs uppercase tracking-wide placeholder:text-muted-foreground/60 focus-visible:ring-0"
                />
                <button type="button" onClick={() => void addSubject()} disabled={!newSubject.trim()}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 transition">
                  <Plus className="size-3.5" />
                </button>
                <div className="h-5 w-px bg-slate-200 dark:bg-zinc-700" />
              </>
            )}
            <div className="flex flex-1 items-center gap-1.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                placeholder="Ara" value={subjectSearch} onChange={(e) => setSubjectSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {filteredSubjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <BookOpen className="size-8 text-slate-200 dark:text-zinc-700" />
                <p className="text-xs text-muted-foreground">Henüz ders eklenmemiş</p>
              </div>
            ) : (
              <ul>
                {filteredSubjects.map((s) => (
                  <li key={s.id}
                    className="group flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                    <span className="text-sm font-medium uppercase tracking-wide">{s.name}</span>
                    {isAdmin && (
                      <button type="button" onClick={() => void deleteSubject(s.id)}
                        className="rounded p-0.5 text-rose-500 opacity-0 transition hover:bg-rose-50 group-hover:opacity-100 dark:hover:bg-rose-950/30">
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* ─── Modül Öğretmenleri Panel ─── */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900" style={{ minHeight: 480 }}>
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-950/40">
                <GraduationCap className="size-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold">Modül Öğretmenleri</p>
                <p className="text-xs text-muted-foreground">Bu modüle atanan öğretmenler</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                {moduleTeachers.length}
              </span>
              {isAdmin && (
                <Link href={teachersLink}
                  className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  <ExternalLink className="size-3" /> Tüm öğretmenler
                </Link>
              )}
            </div>
          </div>

          {/* Toolbar */}
          <div className="relative flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-zinc-800" ref={pickerRef}>
            {isAdmin && (
              <>
                <button type="button"
                  onClick={() => { setPickerOpen((v) => !v); setPickerSearch(''); }}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200">
                  <span className="text-xs uppercase tracking-wide">Öğretmen Ekle</span>
                  <ChevronDown className={cn('size-3 transition', pickerOpen && 'rotate-180')} />
                </button>
                <button type="button"
                  onClick={() => { setPickerOpen((v) => !v); setPickerSearch(''); }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition">
                  <UserPlus className="size-3.5" />
                </button>
                <div className="h-5 w-px bg-slate-200 dark:bg-zinc-700" />

                {pickerOpen && (
                  <div className="absolute left-0 top-full z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 dark:border-zinc-800">
                      <Search className="size-3.5 text-muted-foreground" />
                      <input autoFocus
                        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                        placeholder="Öğretmen ara..."
                        value={pickerSearch}
                        onChange={(e) => setPickerSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-52 overflow-auto">
                      {pickerOptions.length === 0 ? (
                        <p className="py-5 text-center text-xs text-muted-foreground">
                          {allTeachers.length === 0 ? 'Henüz kayıtlı öğretmen yok' : 'Tüm öğretmenler ekli'}
                        </p>
                      ) : (
                        pickerOptions.map((t) => (
                          <button key={t.id} type="button" onClick={() => void addModuleTeacher(t.id)}
                            className="flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-left hover:bg-emerald-50 dark:border-zinc-800 dark:hover:bg-emerald-950/20 last:border-b-0">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {(t.display_name?.[0] ?? t.email?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">{t.display_name ?? t.email}</p>
                              <p className="truncate text-[10px] text-muted-foreground">{t.email}</p>
                            </div>
                            <Plus className="ml-auto size-3.5 shrink-0 text-emerald-600" />
                          </button>
                        ))
                      )}
                    </div>
                    <Link href={teachersLink}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-3 py-2 text-xs text-emerald-600 hover:bg-emerald-50 dark:border-zinc-800 dark:hover:bg-emerald-950/20">
                      <ExternalLink className="size-3" /> Öğretmenler listesine git
                    </Link>
                  </div>
                )}
              </>
            )}
            <div className="flex flex-1 items-center gap-1.5">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                placeholder="Ara" value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} />
              {teacherSearch && (
                <button type="button" onClick={() => setTeacherSearch('')} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {moduleTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <GraduationCap className="size-8 text-slate-200 dark:text-zinc-700" />
                <p className="text-xs text-muted-foreground">Henüz öğretmen eklenmemiş</p>
                {isAdmin && (
                  <p className="text-[10px] text-muted-foreground">
                    Üstteki <span className="font-semibold text-emerald-600">+</span> butonundan öğretmen ekleyin
                  </p>
                )}
              </div>
            ) : filteredModuleTeachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <p className="text-xs text-muted-foreground">Sonuç bulunamadı</p>
              </div>
            ) : (
              <ul>
                {filteredModuleTeachers.map((t) => (
                  <li key={t.id}
                    className="group flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      {(t.display_name?.[0] ?? t.email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.display_name ?? t.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.email}</p>
                    </div>
                    {isAdmin && (
                      <button type="button" onClick={() => void removeModuleTeacher(t.userId)}
                        className="rounded p-0.5 text-rose-500 opacity-0 transition hover:bg-rose-50 group-hover:opacity-100 dark:hover:bg-rose-950/30">
                        <X className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
