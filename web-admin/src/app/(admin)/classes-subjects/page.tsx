'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolClassesSubjects } from '@/hooks/use-school-classes-subjects';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Database } from 'lucide-react';
import type { SchoolClass, SchoolSubject } from '@/hooks/use-school-classes-subjects';

/* Modern SVG icons */
const ClassIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 1 2 2 5 2s5-1 5-2v-5" />
  </svg>
);
const SubjectIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M8 7h8M8 11h6" />
  </svg>
);
const ModulesIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

const USED_IN_MODULES = ['Ders Programı', 'Nöbet', 'Kazanım Takip', 'Evrak'];

export default function ClassesSubjectsPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const isBilsem = me?.school?.enabled_modules?.includes('bilsem');
  const { classes, subjects, loading, error, refetch, canManage } = useSchoolClassesSubjects();
  const [classForm, setClassForm] = useState<{ name: string; grade: string; section: string } | null>(null);
  const [subjectForm, setSubjectForm] = useState<{ name: string; code: string } | null>(null);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editingSubject, setEditingSubject] = useState<SchoolSubject | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSaveClass = useCallback(async () => {
    if (!token || !classForm) return;
    const name = classForm.name.trim();
    if (!name) {
      toast.error(isBilsem ? 'Grup adı girin.' : 'Sınıf adı girin.');
      return;
    }
    setSaving(true);
    try {
      if (editingClass) {
        await apiFetch(`/classes-subjects/classes/${editingClass.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            name,
            grade: classForm.grade ? parseInt(classForm.grade, 10) : undefined,
            section: classForm.section.trim() || undefined,
          }),
        });
        toast.success(isBilsem ? 'Grup güncellendi' : 'Sınıf güncellendi');
      } else {
        await apiFetch('/classes-subjects/classes', {
          method: 'POST',
          token,
          body: JSON.stringify({
            name,
            grade: classForm.grade ? parseInt(classForm.grade, 10) : undefined,
            section: classForm.section.trim() || undefined,
          }),
        });
        toast.success(isBilsem ? 'Grup eklendi' : 'Sınıf eklendi');
      }
      setClassForm(null);
      setEditingClass(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }, [token, classForm, editingClass, refetch, isBilsem]);

  const handleDeleteClass = useCallback(async (id: string) => {
    if (!confirm(isBilsem ? 'Bu grubu silmek istediğinize emin misiniz?' : 'Bu sınıfı silmek istediğinize emin misiniz?')) return;
    if (!token) return;
    try {
      await apiFetch(`/classes-subjects/classes/${id}`, { method: 'DELETE', token });
      toast.success(isBilsem ? 'Grup silindi' : 'Sınıf silindi');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  }, [token, refetch, isBilsem]);

  const handleSaveSubject = useCallback(async () => {
    if (!token || !subjectForm) return;
    const name = subjectForm.name.trim();
    if (!name) {
      toast.error('Ders adı girin.');
      return;
    }
    setSaving(true);
    try {
      if (editingSubject) {
        await apiFetch(`/classes-subjects/subjects/${editingSubject.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ name, code: subjectForm.code.trim() || undefined }),
        });
        toast.success('Ders güncellendi');
      } else {
        await apiFetch('/classes-subjects/subjects', {
          method: 'POST',
          token,
          body: JSON.stringify({ name, code: subjectForm.code.trim() || undefined }),
        });
        toast.success('Ders eklendi');
      }
      setSubjectForm(null);
      setEditingSubject(null);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }, [token, subjectForm, editingSubject, refetch]);

  const handleDeleteSubject = useCallback(async (id: string) => {
    if (!confirm('Bu dersi silmek istediğinize emin misiniz?')) return;
    if (!token) return;
    try {
      await apiFetch(`/classes-subjects/subjects/${id}`, { method: 'DELETE', token });
      toast.success('Ders silindi');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  }, [token, refetch]);

  const handleSeedDefaults = useCallback(async () => {
    if (!token || !canManage) return;
    setSeeding(true);
    try {
      const res = await apiFetch<{ ok: boolean; classes_added: number; subjects_added: number }>(
        '/classes-subjects/seed-defaults',
        { method: 'POST', token }
      );
      const { classes_added = 0, subjects_added = 0 } = res;
      toast.success(
        isBilsem
          ? `${classes_added} grup, ${subjects_added} ders eklendi.`
          : `${classes_added} sınıf, ${subjects_added} ders eklendi.`,
      );
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setSeeding(false);
    }
  }, [token, canManage, refetch, isBilsem]);

  if (me?.role !== 'school_admin') {
    router.replace('/403');
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero: tek kaynak açıklaması */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ModulesIcon className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-foreground">
              {isBilsem ? 'Gruplar ve Dersler' : 'Sınıflar ve Dersler'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isBilsem
                ? 'BİLSEM’de öğrenci öbekleri yönergeye uygun olarak gruplar üzerinden yürütülür; burada okulunuzun gruplarını ve alan/ders listesini tanımlayın. Liste ders programı ve diğer modüller için tek kaynaktır.'
                : 'Okulunuzun sınıflarını ve derslerini buradan yönetin. Bu liste tüm modüller tarafından tek kaynak olarak kullanılır.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(isBilsem ? [...USED_IN_MODULES, 'BİLSEM'] : USED_IN_MODULES).map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                >
                  {m}
                </span>
              ))}
              {canManage && (
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  <Database className="size-4" />
                  {seeding
                    ? 'Yükleniyor…'
                    : isBilsem
                      ? 'Tümünü Ekle (36 grup + 23 ders)'
                      : 'Tümünü Ekle (36 sınıf + 23 ders)'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <Alert message={error} />}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Sınıflar / BİLSEM grupları */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClassIcon className="size-5" />
                </span>
                {isBilsem ? 'Gruplar' : 'Sınıflar'}
              </CardTitle>
              {canManage && !classForm && (
                <button
                  type="button"
                  onClick={() => {
                    setClassForm({ name: '', grade: '', section: '' });
                    setEditingClass(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-4" />
                  Ekle
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {classForm && (
              <div className="border-b border-border bg-muted/30 p-4 space-y-3">
                <input
                  type="text"
                  placeholder={isBilsem ? 'Grup adı (örn. BYF-1 / Uyum-A)' : 'Sınıf adı (örn. 7/A)'}
                  value={classForm.name}
                  onChange={(e) => setClassForm((f) => f && { ...f, name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    placeholder={isBilsem ? 'Örgün düzey 1–12' : 'Sınıf (1-12)'}
                    value={classForm.grade}
                    onChange={(e) => setClassForm((f) => f && { ...f, grade: e.target.value })}
                    className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Şube (A, B...)"
                    value={classForm.section}
                    onChange={(e) => setClassForm((f) => f && { ...f, section: e.target.value })}
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveClass}
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setClassForm(null); setEditingClass(null); }}
                    className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border">
              {classes.length === 0 ? (
                <li className="py-8 text-center">
                  <ClassIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">{isBilsem ? 'Henüz grup yok' : 'Henüz sınıf yok'}</p>
                </li>
              ) : (
                classes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{c.name}</span>
                      {(c.grade != null || c.section) && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {c.grade != null && (isBilsem ? `Örgün ${c.grade}` : `Sınıf ${c.grade}`)}
                          {c.section && ` · ${c.section}`}
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClass(c);
                            setClassForm({
                              name: c.name,
                              grade: c.grade?.toString() ?? '',
                              section: c.section ?? '',
                            });
                          }}
                          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Düzenle"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(c.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Sil"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Dersler kartı */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-lg">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <SubjectIcon className="size-5" />
                </span>
                {isBilsem ? 'Alan / dersler' : 'Dersler'}
              </CardTitle>
              {canManage && !subjectForm && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectForm({ name: '', code: '' });
                    setEditingSubject(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-4" />
                  Ekle
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {subjectForm && (
              <div className="border-b border-border bg-muted/30 p-4 space-y-3">
                <input
                  type="text"
                  placeholder={isBilsem ? 'Alan veya ders (örn. Fen ve Teknoloji)' : 'Ders adı (örn. Matematik)'}
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((f) => f && { ...f, name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Kod (örn. MAT)"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm((f) => f && { ...f, code: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveSubject}
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubjectForm(null); setEditingSubject(null); }}
                    className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border">
              {subjects.length === 0 ? (
                <li className="py-8 text-center">
                  <SubjectIcon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Henüz ders yok</p>
                </li>
              ) : (
                subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30">
                    <span className="font-medium">{s.name}</span>
                    <div className="flex items-center gap-2">
                      {s.code && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {s.code}
                        </span>
                      )}
                      {canManage && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubject(s);
                              setSubjectForm({ name: s.name, code: s.code ?? '' });
                            }}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Düzenle"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(s.id)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Sil"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
