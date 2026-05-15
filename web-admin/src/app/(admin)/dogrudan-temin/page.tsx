'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtReadonlyLoadFeedback, type DtReadonlyLoadBanner } from '@/lib/dt-readonly-load-error';
import { dtUrl } from '@/lib/dt-url';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import {
  ClipboardList,
  Plus,
  FileText,
  Users,
  BarChart3,
  LayoutDashboard,
  Archive,
  FolderOpen,
  Building2,
  Receipt,
  Search,
  ListChecks,
  Info,
  Sparkles,
  ExternalLink,
  Trash2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { DT_LEGAL_NOTICE, dtFileStatusBadgeClass, dtFileStatusLabel, dtTeminTypeLabel, DT_INPUT_SM, DT_SELECT_SM } from '@/lib/dt-ui';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { DtModuleWizard } from '@/components/dogrudan-temin/dt-wizard';

type DtFileItem = {
  id: string;
  year: number;
  fileNo: string;
  subject: string;
  teminType: string;
  status: string;
  createdAt: string;
  archivedAt?: string | null;
};

const TEMIN_BG_COLOR: Record<string, string> = {
  '22a_mal': 'bg-emerald-500/8 hover:bg-emerald-500/15',
  '22b_hizmet': 'bg-sky-500/8 hover:bg-sky-500/15',
  '22c_yapim': 'bg-amber-500/8 hover:bg-amber-500/15',
  '22d_dig_isler': 'bg-violet-500/8 hover:bg-violet-500/15',
  '22e_danismanlik': 'bg-fuchsia-500/8 hover:bg-fuchsia-500/15',
  '22f_kirala': 'bg-cyan-500/8 hover:bg-cyan-500/15',
  '22g_isletme': 'bg-teal-500/8 hover:bg-teal-500/15',
};

function teminBgColor(code: string) {
  return TEMIN_BG_COLOR[code] ?? 'bg-slate-500/8 hover:bg-slate-500/15';
}

const TEMIN_CARD_ACCENT: Record<string, string> = {
  '22a_mal': 'border-l-emerald-500/75',
  '22b_hizmet': 'border-l-sky-500/75',
  '22c_yapim': 'border-l-amber-500/75',
  '22d_dig_isler': 'border-l-violet-500/75',
  '22e_danismanlik': 'border-l-fuchsia-500/75',
  '22f_kirala': 'border-l-cyan-500/75',
  '22g_isletme': 'border-l-teal-500/75',
};

function teminCardAccent(code: string) {
  return TEMIN_CARD_ACCENT[code] ?? 'border-l-slate-400/55';
}

export default function DogrudanTeminPage() {
  const { me, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const canFetch = useMemo(() => !!token && (!isSuperadmin || !!schoolId), [token, isSuperadmin, schoolId]);

  const [loading, setLoading] = useState(true);
  const [loadBanner, setLoadBanner] = useState<DtReadonlyLoadBanner | null>(null);
  const [items, setItems] = useState<DtFileItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const [filters, setFilters] = useState({ search: '', listScope: 'active' as 'active' | 'archive' });
  const [form, setForm] = useState({
    year: String(nowYear),
    file_no: '',
    subject: '',
    temin_type: '22a_mal',
  });

  const fetchFiles = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadBanner(null);
    try {
      const q = new URLSearchParams();
      if (filters.search.trim()) q.set('search', filters.search.trim());
      if (filters.listScope === 'archive') q.set('include_archived', '1');
      const path = `/dogrudan-temin/files${q.toString() ? `?${q.toString()}` : ''}`;
      const res = await apiFetch<{ items: DtFileItem[] }>(dtUrl(path, me?.role, schoolId), { token });
      const raw = res.items ?? [];
      const next =
        filters.listScope === 'archive' ? raw.filter((x) => !!x.archivedAt) : raw.filter((x) => !x.archivedAt);
      setItems(next);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setLoading(false);
    }
  }, [filters.listScope, filters.search, isSuperadmin, me?.role, schoolId, token]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const createFile = useCallback(async () => {
    if (!canFetch) return;
    if (!form.file_no.trim() || !form.subject.trim()) {
      toast.error('Dosya numarası ve konu zorunludur.');
      return;
    }
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl('/dogrudan-temin/files', me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          year: Number(form.year),
          file_no: form.file_no,
          subject: form.subject,
          temin_type: form.temin_type,
        }),
      });
      setCreateOpen(false);
      setForm((s) => ({ ...s, file_no: '', subject: '' }));
      toast.success('Dosya oluşturuldu.');
      await fetchFiles();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [canFetch, fetchFiles, form.file_no, form.subject, form.temin_type, form.year, me?.role, schoolId, token]);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin?${u.toString()}`);
    },
    [router, searchParams],
  );

  const deleteFile = useCallback(async (fileId: string) => {
    setBusy(true);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${fileId}`, me?.role, schoolId), {
        token,
        method: 'DELETE',
      });
      toast.success('Dosya silindi.');
      setDeleteConfirm(null);
      await fetchFiles();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [token, me?.role, schoolId, fetchFiles]);

  return (
    <div className="mx-auto w-full space-y-4 px-2 pb-10 pt-1 text-xs sm:px-0 lg:max-w-7xl">
      {!ok ? (
        <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-4">
      <header className="shrink-0 rounded-2xl border border-border/60 bg-linear-to-br from-indigo-50/80 via-background to-blue-50/40 p-3 shadow-sm dark:from-indigo-950/30 dark:via-background dark:to-blue-950/20 sm:p-4">
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">Doğrudan Temin Dosyaları</h1>
              <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                Temin kalemlerini, teklifleri, bütçeleri ve ödemeleri yönetir; durum etiketleri dosyanın aşamasını gösterir.
              </p>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-3">
            <div className="flex gap-1.5 rounded-lg border border-violet-200/40 bg-violet-500/8 p-2 dark:border-violet-500/20 dark:bg-violet-950/25">
              <span className="text-[10px] font-semibold text-violet-700 dark:text-violet-300">📊 Durum etiketleri</span>
            </div>
            <div className="flex gap-1.5 rounded-lg border border-sky-200/40 bg-sky-500/8 p-2 dark:border-sky-500/20 dark:bg-sky-950/25">
              <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-300">🏷️ Temin türü (22/a-22/g)</span>
            </div>
            <div className="flex gap-1.5 rounded-lg border border-amber-200/40 bg-amber-500/8 p-2 dark:border-amber-500/20 dark:bg-amber-950/25">
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300">⚖️ Kamu ihalesi yasası</span>
            </div>
          </div>
        </div>
      </header>

        <div className="grid min-w-0 w-full grid-cols-1 gap-4 lg:grid-cols-3 lg:items-start">
          <div className="min-w-0 space-y-3 lg:col-span-2">
            <Card variant="indigo" soft className="overflow-hidden shadow-sm">
              <CardContent className="space-y-3 p-3 sm:p-4">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[12px] font-semibold text-foreground sm:text-sm">Hızlı Kurulum</h3>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">Tanımlar & Raporlar</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Link
                    href={dtUrl('/dogrudan-temin/okul-bilgileri', me?.role, schoolId)}
                    className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-2.5 text-center transition-all hover:bg-muted/60 hover:border-indigo-300 dark:hover:border-indigo-600"
                  >
                    <Building2 className="mx-auto size-4 text-indigo-600 dark:text-indigo-400" />
                    <div className="text-[10px] font-medium leading-tight text-foreground">Okul Bilgileri</div>
                  </Link>
                  <Link
                    href={dtUrl('/dogrudan-temin/firmalar', me?.role, schoolId)}
                    className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-2.5 text-center transition-all hover:bg-muted/60 hover:border-indigo-300 dark:hover:border-indigo-600"
                  >
                    <Users className="mx-auto size-4 text-indigo-600 dark:text-indigo-400" />
                    <div className="text-[10px] font-medium leading-tight text-foreground">Firmalar</div>
                  </Link>
                  <Link
                    href={dtUrl('/dogrudan-temin/raporlar', me?.role, schoolId)}
                    className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-2.5 text-center transition-all hover:bg-muted/60 hover:border-sky-300 dark:hover:border-sky-600"
                  >
                    <BarChart3 className="mx-auto size-4 text-sky-600 dark:text-sky-400" />
                    <div className="text-[10px] font-medium leading-tight text-foreground">Defter</div>
                  </Link>
                  <Link
                    href={dtUrl('/dogrudan-temin/dashboard', me?.role, schoolId)}
                    className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/60 bg-card p-2.5 text-center transition-all hover:bg-muted/60 hover:border-sky-300 dark:hover:border-sky-600"
                  >
                    <LayoutDashboard className="mx-auto size-4 text-sky-600 dark:text-sky-400" />
                    <div className="text-[10px] font-medium leading-tight text-foreground">Özet</div>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <section className="space-y-2">
              <Card soft className="overflow-hidden shadow-sm">
              <CardContent className="p-0 space-y-0">
                <div className="border-b border-border/40 bg-muted/30 px-3 py-2.5 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[12px] font-semibold text-foreground">Dosya Listesi</h3>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7 px-2 text-[11px]" disabled={!ok || !canFetch}>
                          <Plus className="size-3.5" />
                          Yeni
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <div className="space-y-3">
                          <h2 className="text-sm font-semibold">Yeni dosya</h2>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-medium">Yıl</label>
                              <Input value={form.year} onChange={(e) => setForm((s) => ({ ...s, year: e.target.value }))} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-medium">Dosya no</label>
                              <Input value={form.file_no} onChange={(e) => setForm((s) => ({ ...s, file_no: e.target.value }))} className="h-8 text-xs" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium">Konu</label>
                            <Input value={form.subject} onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-medium">Temin türü</label>
                            <select value={form.temin_type} onChange={(e) => setForm((s) => ({ ...s, temin_type: e.target.value }))} className="h-8 border border-border rounded px-2 text-xs w-full">
                              <option value="22a_mal">Mal alımı (22/a)</option>
                              <option value="22b_hizmet">Hizmet (22/b)</option>
                              <option value="22c_yapim">Yapım (22/c)</option>
                              <option value="22d_dig_isler">Diğer (22/d)</option>
                              <option value="22e_danismanlik">Danışmanlık (22/e)</option>
                              <option value="22f_kirala">Kiralama (22/f)</option>
                              <option value="22g_isletme">İşletme (22/g)</option>
                            </select>
                          </div>
                          <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={busy}>
                              Vazgeç
                            </Button>
                            <Button size="sm" onClick={createFile} disabled={busy || !form.file_no.trim() || !form.subject.trim()}>
                              Oluştur
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:gap-2 sm:px-4 border-b border-border/40">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setFilters((s) => ({ ...s, listScope: 'active' }))}
                      className={cn('h-8 px-2.5 rounded-lg text-[10px] font-medium transition-all', filters.listScope === 'active' ? 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100' : 'text-muted-foreground hover:bg-muted')}
                    >
                      <FolderOpen className="inline size-3 mr-1" />
                      Açık
                    </button>
                    <button
                      onClick={() => setFilters((s) => ({ ...s, listScope: 'archive' }))}
                      className={cn('h-8 px-2.5 rounded-lg text-[10px] font-medium transition-all', filters.listScope === 'archive' ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100' : 'text-muted-foreground hover:bg-muted')}
                    >
                      <Archive className="inline size-3 mr-1" />
                      Arşiv
                    </button>
                  </div>
                  <div className="relative flex-1 flex items-center rounded-lg border border-border/70 bg-background/50 px-2 sm:flex-none sm:min-w-[160px]">
                    <Search className="size-3 text-muted-foreground shrink-0" aria-hidden />
                    <input value={filters.search} onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))} placeholder="Ara…" className="h-8 w-full border-0 bg-transparent pl-1.5 text-[10px] focus:outline-none" />
                  </div>
                </div>

                {loadBanner ? (
                  <div className="px-3 py-2 sm:px-4">
                    <Alert variant={loadBanner.variant} message={loadBanner.message} />
                  </div>
                ) : null}

                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : items.length === 0 ? (
                  <div className="py-8 text-center">
                    <FileText className="mx-auto size-10 text-muted-foreground/30 mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">
                      {filters.listScope === 'archive' ? 'Arşivde dosya yok' : 'Henüz dosya oluşturmadınız'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    <div className="hidden grid-cols-[160px_1fr_140px_120px_92px] gap-2 border-b border-border/40 bg-muted/20 px-3 py-2 text-[10px] font-medium text-muted-foreground sm:grid sm:px-4">
                      <div>Dosya</div>
                      <div>Konu</div>
                      <div>Durum</div>
                      <div>Tarih</div>
                      <div className="text-right">İşlem</div>
                    </div>
                    {items.map((item) => (
                      <div key={item.id} className={cn('transition-colors', teminBgColor(item.teminType))}>
                        <div className="grid min-w-0 grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-[160px_1fr_140px_120px_92px] sm:items-center sm:gap-2 sm:px-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className={cn('shrink-0 h-9 w-1 rounded-full', teminCardAccent(item.teminType))} />
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-[11px] font-semibold tabular-nums text-foreground">{item.year}</span>
                                <span className="text-[11px] font-semibold tabular-nums text-foreground">·</span>
                                <span className="text-[11px] font-semibold tabular-nums text-foreground">#{item.fileNo}</span>
                              </div>
                              <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                                {dtTeminTypeLabel(item.teminType)}
                                {item.archivedAt ? ' · Arşiv' : ''}
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-medium text-foreground">{item.subject}</div>
                            <div className="mt-0.5 flex flex-wrap gap-1.5 sm:hidden">
                              <span
                                className={cn(
                                  'inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium',
                                  dtFileStatusBadgeClass(item.status),
                                )}
                              >
                                {dtFileStatusLabel(item.status)}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                                <Calendar className="size-3" aria-hidden />
                                {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                              </span>
                            </div>
                          </div>

                          <div className="hidden sm:block">
                            <span
                              className={cn(
                                'inline-flex items-center rounded px-2 py-1 text-[10px] font-semibold',
                                dtFileStatusBadgeClass(item.status),
                              )}
                            >
                              {dtFileStatusLabel(item.status)}
                            </span>
                          </div>

                          <div className="hidden text-[10px] text-muted-foreground sm:flex sm:items-center sm:gap-1">
                            <Calendar className="size-3.5" aria-hidden />
                            <span className="tabular-nums">{new Date(item.createdAt).toLocaleDateString('tr-TR')}</span>
                          </div>

                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={
                                isSuperadmin && schoolId
                                  ? `/dogrudan-temin/${item.id}?school_id=${encodeURIComponent(schoolId)}`
                                  : `/dogrudan-temin/${item.id}`
                              }
                              className="inline-flex"
                            >
                              <Button size="sm" variant="outline" className="h-8 px-2 text-[10px]" disabled={busy}>
                                <ExternalLink className="mr-1 size-3.5" />
                                Aç
                              </Button>
                            </Link>
                            <Dialog open={deleteConfirm === item.id} onOpenChange={(open) => setDeleteConfirm(open ? item.id : null)}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:text-rose-300"
                                onClick={() => setDeleteConfirm(item.id)}
                                disabled={busy}
                                title="Dosyayı sil"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                              <DialogContent className="max-w-sm">
                                <div className="space-y-3">
                                  <div className="flex gap-2 rounded-lg border border-rose-200/50 bg-rose-500/8 p-3 dark:border-rose-500/20 dark:bg-rose-950/25">
                                    <Info className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                                    <p className="text-sm text-rose-950/90 dark:text-rose-100/90">
                                      <strong className="font-semibold">Dosya silinecek!</strong> Bu işlem geri alınamaz.
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-foreground">{item.subject}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.year} · #{item.fileNo}
                                    </p>
                                  </div>
                                  <div className="flex justify-end gap-2 border-t pt-3">
                                    <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)} disabled={busy}>
                                      İptal
                                    </Button>
                                    <Button variant="destructive" size="sm" onClick={() => deleteFile(item.id)} disabled={busy}>
                                      Sil
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            </section>
          </div>

          <aside className="hidden min-w-0 space-y-3 lg:col-span-1 lg:block">
            <Card variant="indigo" soft className="shadow-sm">
              <CardContent className="p-3 space-y-2">
                <h3 className="text-[11px] font-semibold text-foreground">Hızlı Kılavuz</h3>
                <div className="space-y-2 text-[10px] leading-relaxed text-muted-foreground">
                  <p><strong className="text-foreground">Sihirbaz:</strong> Tüm adımları gösterir.</p>
                  <p><strong className="text-foreground">Açık/Arşiv:</strong> Dosya durumunu filtreler.</p>
                  <p><strong className="text-foreground">Renkli çizgi:</strong> Temin türünü belirtir.</p>
                </div>
              </CardContent>
            </Card>
            <DtModuleWizard token={token} role={me?.role ?? null} schoolId={schoolId} files={items} />
            {isSuperadmin ? (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground">Okul seçimi</label>
                <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
              </div>
            ) : null}
          </aside>
        </div>
        </div>
      )}
    </div>
  );
}

