'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useSchoolClassesSubjects } from '@/hooks/use-school-classes-subjects';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Database, Layers3, Library, Upload } from 'lucide-react';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { cn } from '@/lib/utils';
import type { SchoolClass, SchoolSubject } from '@/hooks/use-school-classes-subjects';

type TabId = 'classes' | 'subjects';

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

const USED_IN_MODULES = ['Ders Programı', 'Nöbet', 'Kazanım Takip', 'Evrak'];

function BulkImportSettingsPanel({ variant, isBilsem }: { variant: TabId; isBilsem: boolean }) {
  const title = variant === 'classes' ? (isBilsem ? 'Grup listesi' : 'Sınıf listesi') : isBilsem ? 'Alan / ders listesi' : 'Ders listesi';
  return (
    <div className="border-t border-border/70 bg-muted/15 px-2 py-2.5 sm:px-3 sm:py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        <Upload className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Toplu yükleme — {title}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-xs sm:leading-relaxed">
        {variant === 'classes'
          ? isBilsem
            ? 'Şablon ve dosya ile toplu grup aktarımı; mükerrer ad ve düzey kuralları burada ayarlanacak.'
            : 'Excel/şablon ile sınıf–şube toplu içe aktarma; çakışma ve güncelleme seçenekleri bu alanda olacak.'
          : 'Ders adı ve kod eşlemesi için toplu içe aktarma; mevcut kayıtlarla birleştirme tercihleri burada yapılandırılacak.'}
      </p>
      <div className="mt-2 flex min-h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-border/80 bg-background/50 px-2 py-2 text-center text-[10px] text-muted-foreground sm:min-h-[5.5rem] sm:text-xs">
        Yükleme sihirbazı ve eşleştirme ayarları bir sonraki adımda burada açılacak.
      </div>
    </div>
  );
}

export default function ClassesSubjectsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const isBilsem = me?.school?.enabled_modules?.includes('bilsem') ?? false;
  const { classes, subjects, loading, error, refetch, canManage } = useSchoolClassesSubjects();
  const [classForm, setClassForm] = useState<{ name: string; grade: string; section: string } | null>(null);
  const [subjectForm, setSubjectForm] = useState<{ name: string; code: string } | null>(null);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editingSubject, setEditingSubject] = useState<SchoolSubject | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const tabParam = searchParams.get('tab');
  const tab: TabId = tabParam === 'subjects' ? 'subjects' : 'classes';

  const setTab = useCallback(
    (next: TabId) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set('tab', next);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (tabParam !== 'subjects' && tabParam !== 'classes' && tabParam !== null) {
      const p = new URLSearchParams(searchParams.toString());
      p.set('tab', 'classes');
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    }
  }, [tabParam, pathname, router, searchParams]);

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

  const handleDeleteClass = useCallback(
    async (id: string) => {
      if (!confirm(isBilsem ? 'Bu grubu silmek istediğinize emin misiniz?' : 'Bu sınıfı silmek istediğinize emin misiniz?')) return;
      if (!token) return;
      try {
        await apiFetch(`/classes-subjects/classes/${id}`, { method: 'DELETE', token });
        toast.success(isBilsem ? 'Grup silindi' : 'Sınıf silindi');
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      }
    },
    [token, refetch, isBilsem],
  );

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

  const handleDeleteSubject = useCallback(
    async (id: string) => {
      if (!confirm('Bu dersi silmek istediğinize emin misiniz?')) return;
      if (!token) return;
      try {
        await apiFetch(`/classes-subjects/subjects/${id}`, { method: 'DELETE', token });
        toast.success('Ders silindi');
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      }
    },
    [token, refetch],
  );

  const handleSeedDefaults = useCallback(async () => {
    if (!token || !canManage) return;
    setSeeding(true);
    try {
      const res = await apiFetch<{ ok: boolean; classes_added: number; subjects_added: number }>('/classes-subjects/seed-defaults', {
        method: 'POST',
        token,
      });
      const { classes_added = 0, subjects_added = 0 } = res;
      toast.success(
        isBilsem ? `${classes_added} grup, ${subjects_added} ders eklendi.` : `${classes_added} sınıf, ${subjects_added} ders eklendi.`,
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

  const tabDefs: { id: TabId; label: string; short: string; count: number; Icon: typeof Layers3 }[] = [
    { id: 'classes', label: isBilsem ? 'Gruplar' : 'Sınıflar', short: isBilsem ? 'Grup' : 'Sınıf', count: classes.length, Icon: Layers3 },
    { id: 'subjects', label: isBilsem ? 'Alan / dersler' : 'Dersler', short: 'Ders', count: subjects.length, Icon: Library },
  ];

  const inp = 'w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs sm:px-2.5 sm:py-2 sm:text-sm';

  return (
    <div className="support-page space-y-2 pb-3 sm:space-y-3 sm:pb-5">
      <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-2.5">
        <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-cyan-400/15 blur-2xl dark:bg-cyan-500/10 sm:size-28" aria-hidden />
        <div className="relative flex flex-col gap-1.5 sm:gap-2">
          <div className="flex min-w-0 items-start gap-2 sm:gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-9">
              <Layers3 className="size-4 sm:size-[1.05rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold leading-tight tracking-tight text-foreground sm:text-base">
                {isBilsem ? 'Gruplar ve Dersler' : 'Sınıflar ve Dersler'}
              </h1>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">
                {isBilsem
                  ? 'BİLSEM öbekleri ve alan/ders listesi; tek kaynak.'
                  : 'Sınıf ve ders listesi ders programı ile diğer modüllerde ortak kullanılır.'}
              </p>
              <ToolbarIconHints
                compact
                showOnMobile
                className="mt-1 text-[10px] sm:text-[11px]"
                items={[
                  { label: isBilsem ? 'Gruplar' : 'Sınıflar', icon: Layers3 },
                  { label: 'Dersler', icon: Library },
                ]}
                summary="Sekmelerden yönetin; toplu içe aktarma altta."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 border-t border-border/40 pt-1.5 sm:gap-1.5 sm:pt-2">
            <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">Kullanıldığı:</span>
            {(isBilsem ? [...USED_IN_MODULES, 'BİLSEM'] : USED_IN_MODULES).map((m) => (
              <span
                key={m}
                className="inline-flex max-w-[9.5rem] truncate rounded-md border border-border/50 bg-background/90 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground sm:max-w-none sm:rounded-full sm:px-2 sm:text-[10px]"
                title={m}
              >
                {m}
              </span>
            ))}
            {canManage && (
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-900 hover:bg-emerald-500/16 disabled:opacity-50 dark:text-emerald-100 sm:text-xs"
              >
                <Database className="size-3 sm:size-3.5" aria-hidden />
                {seeding ? '…' : 'Varsayılan 36+23'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <Alert message={error} className="py-1.5 text-xs sm:text-sm" />}

      <div
        role="tablist"
        aria-label="Liste sekmeleri"
        className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/25 p-1 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06] sm:max-w-md"
      >
        {tabDefs.map(({ id, label, short, count, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-center transition-colors sm:min-h-11 sm:gap-2 sm:px-2',
                active
                  ? 'bg-background font-semibold text-foreground shadow-sm ring-1 ring-border/60'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5 shrink-0 opacity-80 sm:size-4" aria-hidden />
              <span className="min-w-0 truncate text-[11px] leading-tight sm:hidden">{short}</span>
              <span className="hidden min-w-0 truncate text-xs leading-tight sm:inline sm:text-sm">{label}</span>
              <span
                className={cn(
                  'shrink-0 rounded-md px-1 py-px text-[9px] font-bold tabular-nums sm:text-[10px]',
                  active ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'classes' && (
        <Card className="overflow-hidden rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/5 via-card to-card shadow-sm ring-1 ring-emerald-500/10 dark:from-emerald-950/20 sm:rounded-2xl">
          <CardHeader className="border-b border-emerald-200/35 bg-linear-to-r from-emerald-500/10 via-transparent to-sky-500/5 px-2.5 py-2 dark:border-emerald-900/40 sm:px-3 sm:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-base">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300 sm:size-9 sm:rounded-lg">
                  <ClassIcon className="size-3.5 sm:size-4" />
                </span>
                <span className="truncate">{isBilsem ? 'Gruplar' : 'Sınıflar'}</span>
              </CardTitle>
              {canManage && !classForm && (
                <button
                  type="button"
                  onClick={() => {
                    setClassForm({ name: '', grade: '', section: '' });
                    setEditingClass(null);
                  }}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-emerald-700 sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  <Plus className="size-3 sm:size-3.5" />
                  Ekle
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {classForm && (
              <div className="space-y-1.5 border-b border-border/60 bg-muted/20 p-2 sm:space-y-2 sm:p-2.5">
                <input
                  type="text"
                  placeholder={isBilsem ? 'Grup adı' : 'Sınıf adı (örn. 7/A)'}
                  value={classForm.name}
                  onChange={(e) => setClassForm((f) => f && { ...f, name: e.target.value })}
                  className={inp}
                />
                <div className="flex gap-1 sm:gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    placeholder={isBilsem ? 'Düzey' : 'Sınıf'}
                    value={classForm.grade}
                    onChange={(e) => setClassForm((f) => f && { ...f, grade: e.target.value })}
                    className="w-[4.25rem] shrink-0 rounded-lg border border-input bg-background px-1.5 py-1.5 text-xs sm:w-24 sm:px-2 sm:py-2 sm:text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Şube"
                    value={classForm.section}
                    onChange={(e) => setClassForm((f) => f && { ...f, section: e.target.value })}
                    className={cn(inp, 'min-w-0 flex-1')}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={handleSaveClass}
                    disabled={saving}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setClassForm(null);
                      setEditingClass(null);
                    }}
                    className="rounded-lg border border-input px-2.5 py-1 text-[10px] hover:bg-muted sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border/60">
              {classes.length === 0 ? (
                <li className="py-5 text-center sm:py-6">
                  <ClassIcon className="mx-auto mb-1.5 size-6 text-muted-foreground/45 sm:size-7" />
                  <p className="text-[11px] text-muted-foreground sm:text-xs">{isBilsem ? 'Henüz grup yok' : 'Henüz sınıf yok'}</p>
                </li>
              ) : (
                classes.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-1.5 px-2 py-1.5 hover:bg-emerald-500/5 sm:gap-2 sm:px-2.5 sm:py-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium leading-tight sm:text-[0.9375rem]">{c.name}</span>
                      {(c.grade != null || c.section) && (
                        <span className="mt-0.5 block text-[10px] text-muted-foreground sm:inline sm:ml-2 sm:text-xs">
                          {c.grade != null && (isBilsem ? `Örgün ${c.grade}` : `Sınıf ${c.grade}`)}
                          {c.section && ` · ${c.section}`}
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-0.5">
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
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Düzenle"
                        >
                          <Pencil className="size-3.5 sm:size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClass(c.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Sil"
                        >
                          <Trash2 className="size-3.5 sm:size-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
            <BulkImportSettingsPanel variant="classes" isBilsem={isBilsem} />
          </CardContent>
        </Card>
      )}

      {tab === 'subjects' && (
        <Card className="overflow-hidden rounded-xl border border-sky-500/20 bg-linear-to-br from-sky-500/5 via-card to-violet-500/5 shadow-sm ring-1 ring-sky-500/10 dark:from-sky-950/20 dark:to-violet-950/15 sm:rounded-2xl">
          <CardHeader className="border-b border-sky-200/35 bg-linear-to-r from-sky-500/10 via-transparent to-violet-500/6 px-2.5 py-2 dark:border-sky-900/40 sm:px-3 sm:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex min-w-0 items-center gap-1.5 text-xs font-bold sm:gap-2 sm:text-base">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-300 sm:size-9 sm:rounded-lg">
                  <SubjectIcon className="size-3.5 sm:size-4" />
                </span>
                <span className="truncate">{isBilsem ? 'Alan / dersler' : 'Dersler'}</span>
              </CardTitle>
              {canManage && !subjectForm && (
                <button
                  type="button"
                  onClick={() => {
                    setSubjectForm({ name: '', code: '' });
                    setEditingSubject(null);
                  }}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white shadow-sm hover:bg-sky-700 sm:gap-1 sm:px-2.5 sm:py-1.5 sm:text-xs"
                >
                  <Plus className="size-3 sm:size-3.5" />
                  Ekle
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {subjectForm && (
              <div className="space-y-1.5 border-b border-border/60 bg-muted/20 p-2 sm:space-y-2 sm:p-2.5">
                <input
                  type="text"
                  placeholder={isBilsem ? 'Alan veya ders' : 'Ders adı'}
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm((f) => f && { ...f, name: e.target.value })}
                  className={inp}
                />
                <input
                  type="text"
                  placeholder="Kod"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm((f) => f && { ...f, code: e.target.value })}
                  className={inp}
                />
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={handleSaveSubject}
                    disabled={saving}
                    className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectForm(null);
                      setEditingSubject(null);
                    }}
                    className="rounded-lg border border-input px-2.5 py-1 text-[10px] hover:bg-muted sm:px-3 sm:py-1.5 sm:text-xs"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border/60">
              {subjects.length === 0 ? (
                <li className="py-5 text-center sm:py-6">
                  <SubjectIcon className="mx-auto mb-1.5 size-6 text-muted-foreground/45 sm:size-7" />
                  <p className="text-[11px] text-muted-foreground sm:text-xs">Henüz ders yok</p>
                </li>
              ) : (
                subjects.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-1.5 px-2 py-1.5 hover:bg-sky-500/5 sm:gap-2 sm:px-2.5 sm:py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight sm:text-[0.9375rem]">{s.name}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.code && (
                        <span className="rounded bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground sm:px-2 sm:py-0.5 sm:text-xs">
                          {s.code}
                        </span>
                      )}
                      {canManage && (
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubject(s);
                              setSubjectForm({ name: s.name, code: s.code ?? '' });
                            }}
                            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Düzenle"
                          >
                            <Pencil className="size-3.5 sm:size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(s.id)}
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Sil"
                          >
                            <Trash2 className="size-3.5 sm:size-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
            <BulkImportSettingsPanel variant="subjects" isBilsem={isBilsem} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
