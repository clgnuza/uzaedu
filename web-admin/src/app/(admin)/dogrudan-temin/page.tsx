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
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DtFileItem[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
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
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Hata');
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-2 pb-10 pt-1 text-xs sm:px-0">
      {!ok ? (
        <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-6">
      <header className="shrink-0 rounded-2xl border border-border/60 bg-gradient-to-br from-slate-50/90 via-background to-indigo-50/40 p-4 shadow-sm dark:from-slate-950/40 dark:via-background dark:to-indigo-950/25 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modül</p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Doğrudan temin</h1>
              <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                Her satır bir temin dosyasıdır: kalemler, teklifler, bütçe ve ödemeleri tek yerden yönetirsiniz. Aşağıdaki etiketler
                dosyanın hangi aşamada olduğunu ve 4734 sayılı Kanun 22. madde kapsamındaki türünü gösterir.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="flex gap-2 rounded-xl border border-violet-200/50 bg-violet-500/[0.07] p-2.5 dark:border-violet-500/25 dark:bg-violet-950/30">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
                  <p className="text-[11px] leading-snug text-violet-950/90 dark:text-violet-100/90">
                    <span className="font-semibold text-foreground">Durum</span> etiketi dosyanın süreçteki yerini (ör. taslak, kararlandı) gösterir.
                    <DtInfoHint
                      className="ml-0.5 align-middle"
                      title="Taslak: kayıt açık. Karar aşaması: onay öncesi. Kararlandı: sonuç netleşti. Arşiv: dosya kapatıldı."
                    />
                  </p>
                </div>
                <div className="flex gap-2 rounded-xl border border-sky-200/50 bg-sky-500/[0.07] p-2.5 dark:border-sky-500/25 dark:bg-sky-950/30">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
                  <p className="text-[11px] leading-snug text-sky-950/90 dark:text-sky-100/90">
                    <span className="font-semibold text-foreground">Temin türü</span> 22/a–22/g arası alt kırılımı belirtir; belgelerde kullanılır.
                    <DtInfoHint title="Kurumunuzun seçtiği KİK 22. madde alt başlığıdır; yanlış seçim belge tutarsızlığına yol açabilir." />
                  </p>
                </div>
                <div className="flex gap-2 rounded-xl border border-amber-200/50 bg-amber-500/[0.08] p-2.5 dark:border-amber-500/25 dark:bg-amber-950/25">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
                  <p className="text-[11px] leading-snug text-amber-950/90 dark:text-amber-50/90">
                    <span className="font-semibold text-foreground">Mevzuat</span> uyarısı: ekranlar kayıt kolaylığı sağlar; resmi uygunluk okul sorumluluğundadır.
                    <DtInfoHint title={DT_LEGAL_NOTICE} />
                  </p>
                </div>
              </div>
            </div>
          </div>
          <ToolbarIconHints
            compact
            className="shrink-0"
            summary="Açık dosya listesi ve arşiv görünümü"
            items={[
              { label: 'Açık dosyalar', icon: FolderOpen },
              { label: 'Arşiv', icon: Archive },
            ]}
          />
        </div>
      </header>

        <div className="grid min-w-0 w-full grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-5 lg:col-span-8">
            <section aria-labelledby="dt-quick-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="dt-quick-heading" className="text-sm font-semibold tracking-tight text-foreground sm:text-base">
                    Kurulum ve çıktılar
                  </h2>
                  <p className="mt-1 flex max-w-xl flex-wrap items-center gap-1 text-[11px] leading-relaxed text-muted-foreground">
                    Okul bilgileri ile firmaları önce tanımlayın; defter ve özet raporlarını buradan açın.
                    <DtInfoHint title="Eksik okul anteni veya firma listesi, teklif ve belge üretiminde uyarılara neden olabilir." />
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5" aria-hidden>
                  <span className="rounded-full border border-emerald-400/35 bg-emerald-500/12 px-2.5 py-1 text-[10px] font-semibold text-emerald-900 shadow-sm dark:text-emerald-100">
                    1 · Tanımlar
                  </span>
                  <span className="rounded-full border border-sky-400/35 bg-sky-500/12 px-2.5 py-1 text-[10px] font-semibold text-sky-900 shadow-sm dark:text-sky-100">
                    2 · Raporlar
                  </span>
                </div>
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:items-stretch">
                <Card variant="teal" soft className="flex min-h-0 min-w-0 flex-col overflow-hidden shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-border/40 bg-gradient-to-r from-teal-500/10 to-transparent px-4 py-2.5 dark:from-teal-500/15">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-foreground">
                        <Building2 className="size-4 text-teal-600 dark:text-teal-300" />
                        Okul ve tanımlar
                        <DtInfoHint title="Resmî yazışma kodu, adres, logo ve imza yetkilileri belge üst bilgisinde yer alır." />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Belgelerde kullanılacak kurum bilgileri.</p>
                    </div>
                    <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <Link
                        href={dtUrl('/dogrudan-temin/okul-bilgileri', me?.role, schoolId)}
                        className="group flex gap-3 p-4 transition-colors hover:bg-muted/40"
                      >
                        <FileText className="mt-0.5 size-4 shrink-0 text-teal-600 opacity-80 group-hover:opacity-100 dark:text-teal-300" />
                        <div>
                          <div className="text-[13px] font-medium text-foreground">Okul bilgileri</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Ünvan, adres, logo ve imza yetkilileri (antet)</div>
                        </div>
                      </Link>
                      <Link
                        href={dtUrl('/dogrudan-temin/firmalar', me?.role, schoolId)}
                        className="group flex gap-3 p-4 transition-colors hover:bg-muted/40"
                      >
                        <Users className="mt-0.5 size-4 shrink-0 text-teal-600 opacity-80 group-hover:opacity-100 dark:text-teal-300" />
                        <div>
                          <div className="text-[13px] font-medium text-foreground">Tedarikçi firmalar</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">İstekli / teklif veren firma kayıtları</div>
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card variant="sky" soft className="flex min-h-0 min-w-0 flex-col overflow-hidden shadow-sm">
                  <CardContent className="p-0">
                    <div className="border-b border-border/40 bg-gradient-to-r from-sky-500/10 to-transparent px-4 py-2.5 dark:from-sky-500/15">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-foreground">
                        <Receipt className="size-4 text-sky-600 dark:text-sky-300" />
                        Raporlar
                        <DtInfoHint title="Excel defteri muhasebe / denetim için; özet panel yıllık tutar ve durum dağılımını gösterir." />
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Defter çıktısı ve yönetim özeti.</p>
                    </div>
                    <div className="grid divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                      <Link
                        href={dtUrl('/dogrudan-temin/raporlar', me?.role, schoolId)}
                        className="group flex gap-3 p-4 transition-colors hover:bg-muted/40"
                      >
                        <BarChart3 className="mt-0.5 size-4 shrink-0 text-sky-600 opacity-80 group-hover:opacity-100" />
                        <div>
                          <div className="text-[13px] font-medium text-foreground">Kayıt ve ödeme defteri</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Excel (XLSX) liste</div>
                        </div>
                      </Link>
                      <Link
                        href={dtUrl('/dogrudan-temin/dashboard', me?.role, schoolId)}
                        className="group flex gap-3 p-4 transition-colors hover:bg-muted/40"
                      >
                        <LayoutDashboard className="mt-0.5 size-4 shrink-0 text-sky-600 opacity-80 group-hover:opacity-100" />
                        <div>
                          <div className="text-[13px] font-medium text-foreground">Özet panel</div>
                          <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">Durumlar ve tutar toplamları</div>
                        </div>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <Card variant="indigo" soft className="min-w-0 overflow-hidden shadow-sm">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <ToolbarHeading>
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ToolbarPageTitle className="text-base sm:text-lg">Temin dosyaları</ToolbarPageTitle>
                      <span className="inline-flex items-center gap-1 rounded-full border border-indigo-300/40 bg-indigo-500/12 px-2 py-0.5 text-[10px] font-semibold text-indigo-900 dark:text-indigo-100">
                        <ListChecks className="size-3" />
                        Liste
                      </span>
                      {!loading ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {items.length} kayıt
                          <DtInfoHint title="Sayı, seçili sekmede (açık veya arşiv) ve arama filtresine göre listelenen dosya adedidir." />
                        </span>
                      ) : null}
                    </div>
                    <ToolbarDescription>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <Sparkles className="size-3.5 shrink-0 text-amber-500" aria-hidden />
                        Süreç boyunca adım adım ilerlemek için <strong className="font-medium text-foreground">Akış sihirbazı</strong>nı açın; burada
                        dosya kartlarına tıklayarak detaya gidersiniz.
                        <DtInfoHint title="Sihirbaz okul formu, firmalar ve en az bir dosya adımlarını kontrol eder; tamamlananlar işaretlenir." />
                      </span>
                    </ToolbarDescription>
                    <p className="mt-1 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground sm:hidden">
                      <Sparkles className="mt-0.5 size-3 shrink-0 text-amber-500" aria-hidden />
                      Sihirbaz ile adımları takip edin; dosya satırından detaya gidin.
                    </p>
                  </div>
                  </ToolbarHeading>
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                  <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <DtModuleWizard token={token} role={me?.role ?? null} schoolId={schoolId} files={items} />
                      {isSuperadmin ? (
                        <div className="min-w-0 w-full space-y-1 sm:w-[min(280px,100%)]">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                            <span>Okul seçimi</span>
                            <DtInfoHint title="Süper yönetici olarak hangi okulun doğrudan temin dosyalarını göreceğinizi buradan seçin." />
                          </div>
                          <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch xl:w-auto xl:max-w-full">
                      <div
                        className="flex w-full flex-col gap-1 rounded-2xl border border-border/60 bg-muted/20 p-1 shadow-inner sm:w-auto sm:min-w-[220px]"
                        role="tablist"
                        aria-label="Liste görünümü"
                      >
                        <p className="px-2 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Görünüm</p>
                        <div className="flex flex-col gap-1 sm:flex-row">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={filters.listScope === 'active'}
                          onClick={() => setFilters((s) => ({ ...s, listScope: 'active' }))}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold transition-all sm:min-w-[140px]',
                            filters.listScope === 'active'
                              ? 'bg-sky-500/15 text-sky-950 ring-1 ring-sky-400/35 dark:bg-sky-950/40 dark:text-sky-50'
                              : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                          )}
                        >
                          <FolderOpen className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block leading-tight">Açık dosyalar</span>
                            <span className="mt-0.5 block text-[10px] font-normal opacity-90">Üzerinde çalışılan kayıtlar</span>
                          </span>
                          <DtInfoHint
                            className="ml-auto shrink-0"
                            title="Henüz arşivlenmemiş dosyalar. Yeni oluşturduğunuz dosyalar burada görünür."
                          />
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={filters.listScope === 'archive'}
                          onClick={() => setFilters((s) => ({ ...s, listScope: 'archive' }))}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold transition-all sm:min-w-[140px]',
                            filters.listScope === 'archive'
                              ? 'bg-rose-500/12 text-rose-950 ring-1 ring-rose-400/35 dark:bg-rose-950/35 dark:text-rose-50'
                              : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                          )}
                        >
                          <Archive className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block leading-tight">Arşiv</span>
                            <span className="mt-0.5 block text-[10px] font-normal opacity-90">Kapatılmış / arşivlenmiş</span>
                          </span>
                          <DtInfoHint
                            className="ml-auto shrink-0"
                            title="Arşivlenmiş dosyalar ayrı tutulur; tekrar açmak için dosya detayındaki arşiv bölümünü kullanın."
                          />
                        </button>
                        </div>
                      </div>
                      <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-border/70 bg-background px-3 shadow-sm sm:min-w-[200px] sm:max-w-xs">
                        <Search className="pointer-events-none absolute left-3 size-3.5 text-muted-foreground" aria-hidden />
                        <input
                          value={filters.search}
                          onChange={(e) => setFilters((s) => ({ ...s, search: e.target.value }))}
                          placeholder="Dosya no veya konuda ara…"
                          className="h-10 w-full min-w-0 border-0 bg-transparent pl-8 text-xs focus:outline-none focus:ring-0"
                          aria-label="Dosya no veya konuda ara"
                        />
                      </div>
                      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                          <Button className="h-10 w-full shrink-0 sm:w-auto" disabled={!ok || !canFetch}>
                            <Plus className="size-4" />
                            Yeni dosya
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <div className="space-y-4">
                            <div className="flex gap-2 rounded-xl border border-indigo-200/40 bg-indigo-500/8 p-2.5 dark:border-indigo-500/25 dark:bg-indigo-950/30">
                              <Info className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
                              <p className="text-[11px] leading-relaxed text-muted-foreground">
                                Dosya numarası okul içinde yıl bazında tekil olmalıdır. Konu, listede ve belgelerde görünür.
                                <DtInfoHint title="Sonradan dosya detayından kalem, teklif ve ödemeleri ekleyebilirsiniz." />
                              </p>
                            </div>
                            <div>
                              <h2 className="text-base font-semibold">Yeni temin dosyası</h2>
                              <p className="mt-0.5 text-[12px] text-muted-foreground">
                                Sonra kalemler, teklifler ve ödemeleri bu dosyanın içinden ekleyebilirsiniz.
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-muted-foreground">Yıl *</label>
                                <Input value={form.year} onChange={(e) => setForm((s) => ({ ...s, year: e.target.value }))} className={DT_INPUT_SM} />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-muted-foreground">Dosya numarası *</label>
                                <Input
                                  value={form.file_no}
                                  onChange={(e) => setForm((s) => ({ ...s, file_no: e.target.value }))}
                                  className={DT_INPUT_SM}
                                  placeholder="Örn. 1, 0588"
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground">Konu *</label>
                              <Input
                                value={form.subject}
                                onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}
                                className={DT_INPUT_SM}
                                placeholder="Alımın kısa tanımı"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                                Temin türü (4734, 22. madde)
                                <DtInfoHint title="Kurumunuzun seçtiği alt tür; belgelerde ve raporlarda kullanılır." />
                              </label>
                              <select
                                value={form.temin_type}
                                onChange={(e) => setForm((s) => ({ ...s, temin_type: e.target.value }))}
                                className={DT_SELECT_SM}
                              >
                                <option value="22a_mal">Mal alımı (22/a)</option>
                                <option value="22b_hizmet">Hizmet alımı (22/b)</option>
                                <option value="22c_yapim">Yapım işleri (22/c)</option>
                                <option value="22d_dig_isler">Diğer işler (22/d)</option>
                                <option value="22e_danismanlik">Danışmanlık (22/e)</option>
                                <option value="22f_kirala">Kiralama (22/f)</option>
                                <option value="22g_isletme">İşletme ve diğer (22/g)</option>
                              </select>
                            </div>
                            <div className="flex justify-end gap-2 border-t pt-3">
                              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
                                Vazgeç
                              </Button>
                              <Button onClick={createFile} disabled={busy || !form.file_no.trim() || !form.subject.trim()}>
                                Dosyayı oluştur
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  <div className="flex gap-2 rounded-xl border border-amber-200/45 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-3 py-2.5 dark:border-amber-500/20 dark:from-amber-950/30">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <p className="text-[11px] leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                      <span className="font-semibold text-foreground">Arama:</span> Dosya numarası veya konu metnine göre süzer.
                      {filters.listScope === 'archive'
                        ? ' Şu an yalnızca arşivlenmiş dosyalar listelenir.'
                        : ' Arşivdekileri görmek için «Arşiv» sekmesine geçin.'}
                      <DtInfoHint title="Arama sunucuya gider; yazmayı bitirdikten sonra liste kısa sürede güncellenir." />
                    </p>
                  </div>
                </div>

                {error ? <Alert message={error} /> : null}
                {loading ? (
                  <LoadingSpinner label="Dosyalar yükleniyor…" className="py-10 text-xs" />
                ) : items.length ? (
                  <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    {items.map((x) => (
                      <li key={x.id} className="min-w-0">
                        <Link
                          href={
                            isSuperadmin && schoolId
                              ? `/dogrudan-temin/${x.id}?school_id=${encodeURIComponent(schoolId)}`
                              : `/dogrudan-temin/${x.id}`
                          }
                          className="block h-full min-w-0"
                        >
                          <div
                            className={cn(
                              'group flex h-full min-w-0 flex-col rounded-2xl border border-border/70 border-l-4 bg-card p-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md',
                              teminCardAccent(x.teminType),
                            )}
                          >
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary sm:text-base">
                                  {x.subject}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  <span className="font-medium text-foreground/80">{x.year}</span>
                                  {' · '}
                                  <span>Dosya no: #{x.fileNo}</span>
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1.5">
                                {x.archivedAt ? (
                                  <span className="whitespace-nowrap rounded-full border border-rose-300/50 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-900 dark:text-rose-100">
                                    Arşivlendi
                                  </span>
                                ) : null}
                                <span
                                  className={cn(
                                    'whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                    dtFileStatusBadgeClass(x.status),
                                  )}
                                >
                                  {dtFileStatusLabel(x.status)}
                                </span>
                              </div>
                            </div>
                            <div className="mt-auto border-t border-border/40 pt-2.5 text-[11px] font-medium text-muted-foreground">
                              {dtTeminTypeLabel(x.teminType)}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-indigo-300/50 bg-gradient-to-br from-indigo-500/5 via-muted/20 to-violet-500/5 py-12 text-center dark:border-indigo-500/25">
                    <ClipboardList className="mx-auto mb-3 size-12 text-muted-foreground/25" aria-hidden />
                    <p className="text-sm font-medium text-foreground">
                      {filters.listScope === 'archive' ? 'Arşivde kayıt yok' : 'Henüz temin dosyası yok'}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12px] text-muted-foreground">
                      {filters.listScope === 'archive'
                        ? 'Arşivlenmiş bir dosya oluşturduğunuzda burada görünür.'
                        : 'İlk kaydı açmak için «Yeni dosya» ile dosya oluşturun; ardından dosya kartına tıklayıp kalemleri ve belgeleri doldurun.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="hidden min-w-0 self-start lg:col-span-4 lg:block">
            <Card variant="violet" soft className="sticky top-4 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bu ekranda</p>
                  <DtInfoHint title="Kısa hatırlatmalar; ayrıntılı işlemler dosya kartına tıklayınca açılır." />
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl border border-sky-200/50 bg-sky-500/8 p-3 dark:border-sky-500/20 dark:bg-sky-950/25">
                    <div className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        <strong className="font-medium text-foreground">Akış sihirbazı</strong> eksik adımları gösterir; dosya detayına gitmeden yönlendirme verir.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-violet-200/50 bg-violet-500/8 p-3 dark:border-violet-500/20 dark:bg-violet-950/25">
                    <div className="flex items-start gap-2">
                      <FolderOpen className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        <strong className="font-medium text-foreground">Görünüm sekmeleri</strong> ile açık veya arşiv listesini seçersiniz; arama bu listeyi daraltır.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200/50 bg-emerald-500/8 p-3 dark:border-emerald-500/20 dark:bg-emerald-950/25">
                    <div className="flex items-start gap-2">
                      <ListChecks className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden />
                      <p className="text-[12px] leading-relaxed text-muted-foreground">
                        Kartlardaki <strong className="font-medium text-foreground">durum</strong> ve <strong className="font-medium text-foreground">temin türü</strong> etiketleri Türkçedir; sol renk çizgisi türe göre ayırt eder.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
        </div>
      )}
    </div>
  );
}

