'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileDown, RefreshCw, Table2, ChevronLeft, Info, BarChart3, Layers, FolderOpen, Wallet } from 'lucide-react';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { Label } from '@/components/ui/label';
import { ToolbarHeading, ToolbarPageTitle, ToolbarDescription } from '@/components/layout/toolbar';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DT_INPUT_SM, DT_LEGAL_NOTICE } from '@/lib/dt-ui';
import { dtReadonlyLoadFeedback, type DtReadonlyLoadBanner } from '@/lib/dt-readonly-load-error';
import { cn } from '@/lib/utils';

type RegistrySummaryRow = {
  temin_type: string;
  temin_label: string;
  count: number;
  approx_total: number;
  decision_total: number;
  payment_total: number;
};

type RegistryFileRow = {
  school_name: string;
  year: number;
  file_no: string;
  subject: string;
  temin_code: string;
  temin_label: string;
  status_code: string;
  status_label: string;
  approx_total: number;
  decision_total: number;
  payment_total: number;
  budget_code: string | null;
  budget_label: string | null;
  created_at: string;
  archived_at: string | null;
};

type RegistryPaymentRow = {
  school_name: string;
  year: number;
  file_no: string;
  file_subject: string;
  paid_at: string;
  amount: number;
  reference_no: string | null;
  note: string | null;
  vendor_title: string | null;
};

type RegistryPayload = {
  year: number;
  month: number | null;
  include_archived: boolean;
  summary: RegistrySummaryRow[];
  files: RegistryFileRow[];
  payments: RegistryPaymentRow[];
};

const trMoney = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(n);

const previewTh = 'border-b border-border/60 bg-muted/50 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground first:rounded-tl last:rounded-tr';
const previewTd = 'border-b border-border/40 px-2 py-1.5 align-top text-[11px] leading-snug';
const previewMoney = 'text-right tabular-nums tracking-tight text-[11px] font-medium text-foreground';

function statusChipClass(code: string) {
  const k = String(code ?? '')
    .trim()
    .toLowerCase();
  if (k === 'draft')
    return 'border border-slate-300/50 bg-slate-100/90 text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100';
  if (k === 'decision')
    return 'border border-sky-300/50 bg-sky-100/90 text-sky-950 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-50';
  if (k === 'awarded')
    return 'border border-emerald-300/50 bg-emerald-100/90 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-50';
  return 'border border-border/60 bg-muted/50 text-foreground';
}

export default function DtReportsPage() {
  const { me, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [loadBanner, setLoadBanner] = useState<DtReadonlyLoadBanner | null>(null);
  const [data, setData] = useState<RegistryPayload | null>(null);

  useEffect(() => {
    const el = document.createElement('style');
    el.setAttribute('data-dt-registry-rapor-print', '');
    el.textContent = '@page { size: A4 landscape; margin: 10mm; }';
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin/raporlar?${u.toString()}`);
    },
    [router, searchParams],
  );

  const buildQs = () => {
    const q = new URLSearchParams();
    q.set('year', String(Number(year)));
    if (month.trim()) q.set('month', String(Number(month)));
    if (includeArchived) q.set('include_archived', '1');
    return q;
  };

  const loadPreview = async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setPreviewBusy(true);
    setLoadBanner(null);
    try {
      const path = `/dogrudan-temin/reports/registry?${buildQs().toString()}`;
      const res = await apiFetch<RegistryPayload>(dtUrl(path, me?.role, schoolId), { token });
      setData(res);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
      setData(null);
    } finally {
      setPreviewBusy(false);
    }
  };

  const downloadRegistry = async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      const path = `/dogrudan-temin/reports/registry.xlsx?${buildQs().toString()}`;
      const res = await apiFetch<{ download_url: string }>(dtUrl(path, me?.role, schoolId), { token });
      if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || previewBusy || (isSuperadmin && !schoolId);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-2 pb-10 pt-1 text-xs sm:px-0">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link
          href={dtUrl('/dogrudan-temin', me?.role, schoolId)}
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" />
          Doğrudan temin
        </Link>
        <span aria-hidden>/</span>
        <span className="text-foreground">Kayıt ve ödeme defteri</span>
      </div>

      <header className="rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-50/85 via-background to-sky-50/50 p-4 shadow-sm dark:from-emerald-950/20 dark:via-background dark:to-sky-950/20 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <BarChart3 className="size-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <ToolbarHeading>
                <ToolbarPageTitle className="text-lg sm:text-xl">Kayıt ve ödeme defteri</ToolbarPageTitle>
                <ToolbarDescription>
                  Seçtiğiniz yıl (ve isteğe bağlı ay) için özet ve satır önizlemesi alın; tam veri setini Excel (XLSX) ile indirin.
                  Ekonomik kod eşlemesini kurumunuzun HMB / harcama kılavuzuna göre yaparsınız.
                </ToolbarDescription>
              </ToolbarHeading>
            </div>
          </div>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,100%)]">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                Okul
                <DtInfoHint title="Hangi okulun defter çıktısını alacağınızı seçin." />
              </div>
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-2 rounded-xl border border-sky-200/45 bg-sky-500/8 p-3 dark:border-sky-500/20 dark:bg-sky-950/25">
        <Table2 className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />
        <p className="text-[11px] leading-relaxed text-sky-950/90 dark:text-sky-50/90">
          <span className="font-semibold text-foreground">XLSX yapısı:</span> Ozet, Dosya_satirlari, Odeme_satirlari, Aciklama
          sayfaları. HMB Harcama Yönetim Sistemi ile uyum için ekonomik kodları kurum kılavuzunuza göre eşleyin.
          <DtInfoHint title={DT_LEGAL_NOTICE} className="ml-0.5 align-middle" />
        </p>
      </div>

      <Card variant="teal" soft className="min-w-0 overflow-hidden shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3">
            <FileDown className="size-4 text-teal-600 dark:text-teal-300" />
            <h2 className="text-sm font-semibold text-foreground sm:text-base">Filtreler ve indirme</h2>
            <DtInfoHint title="Önce önizleme ile rakamları kontrol edin; ardından XLSX indirin." />
          </div>

          {loadBanner ? <Alert variant={loadBanner.variant} message={loadBanner.message} /> : null}

          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
              <div className="grid min-w-0 gap-1.5 sm:w-[100px]">
                <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Yıl *
                  <DtInfoHint title="Defterin kapsayacağı takvim yılı." />
                </Label>
                <Input value={year} onChange={(e) => setYear(e.target.value)} className={DT_INPUT_SM} inputMode="numeric" />
              </div>
              <div className="grid min-w-0 gap-1.5 sm:w-[110px]">
                <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  Ay
                  <DtInfoHint title="Boş bırakılırsa tüm yıl; 1–12 girilirse yalnızca o ay." />
                </Label>
                <Input
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="1–12"
                  className={DT_INPUT_SM}
                  inputMode="numeric"
                />
              </div>
              <div className="col-span-2 flex min-w-0 items-center gap-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2 sm:col-span-1 sm:max-w-xs">
                <input
                  id="arch"
                  type="checkbox"
                  checked={includeArchived}
                  onChange={(e) => setIncludeArchived(e.target.checked)}
                  className="size-4 shrink-0 rounded border border-input accent-primary"
                />
                <Label htmlFor="arch" className="min-w-0 cursor-pointer text-[11px] font-normal leading-snug text-foreground">
                  Arşivlenmiş dosyaları da dahil et
                  <DtInfoHint
                    className="ml-1 align-middle"
                    title="İşaretliyse arşivlenmiş dosya ve ödemeler de rapora girer; aksi halde yalnızca açık kayıtlar."
                  />
                </Label>
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-wrap gap-2 lg:ml-auto lg:w-auto">
              <Button variant="secondary" className="h-10 gap-1.5" disabled={disabled} onClick={loadPreview}>
                <RefreshCw className={cn('size-4', previewBusy && 'animate-spin')} />
                Önizleme
              </Button>
              <Button className="h-10 gap-1.5" disabled={disabled} onClick={downloadRegistry}>
                <FileDown className="size-4" />
                XLSX indir
              </Button>
            </div>
          </div>

          {previewBusy ? (
            <LoadingSpinner label="Önizleme yükleniyor…" className="py-6 text-xs" />
          ) : data ? (
            <div className="min-w-0 space-y-3">
              <section className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-gradient-to-r from-muted/60 to-transparent px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Layers className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <h3 className="text-xs font-semibold tracking-tight text-foreground">Özet</h3>
                    <span className="text-[10px] text-muted-foreground">
                      {data.year}
                      {data.month != null ? ` · ay ${data.month}` : ' · tüm yıl'}
                      {data.include_archived ? ' · arşiv dahil' : ''}
                    </span>
                  </div>
                  <DtInfoHint title="Temin türüne göre dosya sayısı ve yaklaşık / karar / ödenen tutar toplamları." />
                </div>
                <div className="min-w-0 overflow-x-auto">
                  <table className="w-full min-w-[520px] table-fixed border-collapse text-[11px]">
                    <colgroup>
                      <col style={{ width: '34%' }} />
                      <col style={{ width: '11%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '19%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={previewTh}>Temin türü</th>
                        <th className={cn(previewTh, 'text-right')}>Adet</th>
                        <th className={cn(previewTh, 'text-right')}>Yaklaşık</th>
                        <th className={cn(previewTh, 'text-right')}>Karar</th>
                        <th className={cn(previewTh, 'text-right')}>Ödenen</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background/80">
                      {data.summary?.length ? (
                        data.summary.map((r, i) => (
                          <tr key={r.temin_type} className={cn(i % 2 === 1 && 'bg-muted/20')}>
                            <td className={previewTd}>
                              <div className="font-medium leading-tight text-foreground">{r.temin_label}</div>
                              <code className="mt-0.5 inline-block rounded bg-muted/80 px-1 py-px font-mono text-[9px] text-muted-foreground">
                                {r.temin_type}
                              </code>
                            </td>
                            <td className={cn(previewTd, previewMoney)}>{r.count}</td>
                            <td className={cn(previewTd, previewMoney)}>{trMoney(r.approx_total)}</td>
                            <td className={cn(previewTd, previewMoney)}>{trMoney(r.decision_total)}</td>
                            <td className={cn(previewTd, previewMoney)}>{trMoney(r.payment_total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className={cn(previewTd, 'text-muted-foreground')} colSpan={5}>
                            Bu dönem için özet satırı yok.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-gradient-to-r from-muted/60 to-transparent px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FolderOpen className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                    <h3 className="text-xs font-semibold tracking-tight text-foreground">Dosyalar</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {data.files?.length ?? 0}
                    </span>
                  </div>
                  <DtInfoHint title="Dosya numarası, konu, durum, ödenen tutar ve bütçe satırı. En fazla 200 satır; tamamı XLSX Dosya_satirlari sayfasında." />
                </div>
                <div className="max-h-[min(320px,48vh)] min-w-0 overflow-auto">
                  <table className="w-full min-w-[580px] table-fixed border-collapse text-[11px]">
                    <colgroup>
                      <col style={{ width: '42%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '22%' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-muted/90 backdrop-blur-sm">
                        <th className={previewTh}>Dosya no · konu</th>
                        <th className={previewTh}>Durum</th>
                        <th className={cn(previewTh, 'text-right')}>Ödenen</th>
                        <th className={previewTh}>Bütçe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.files ?? []).slice(0, 200).map((r, i) => (
                        <tr key={`${r.file_no}-${i}`} className={cn('transition-colors hover:bg-muted/25', i % 2 === 1 && 'bg-muted/15')}>
                          <td className={previewTd}>
                            <div className="tabular-nums text-[10px] font-medium text-muted-foreground">
                              {r.year} · #{r.file_no}
                            </div>
                            <div className="break-words font-medium leading-snug text-foreground" title={r.subject}>
                              {r.subject}
                            </div>
                          </td>
                          <td className={previewTd}>
                            <span
                              className={cn(
                                'inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                                statusChipClass(r.status_code),
                              )}
                              title={r.status_label}
                            >
                              <span className="truncate">{r.status_label}</span>
                            </span>
                          </td>
                          <td className={cn(previewTd, previewMoney)}>{trMoney(r.payment_total)}</td>
                          <td className={cn(previewTd, 'text-muted-foreground')}>
                            <div className="break-words leading-snug" title={[r.budget_code, r.budget_label].filter(Boolean).join(' — ')}>
                              {[r.budget_code, r.budget_label].filter(Boolean).join(' — ') || '—'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(data.files?.length ?? 0) > 200 ? (
                  <p className="border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                    Önizlemede ilk 200 satır gösterilir; tam liste XLSX içindedir.
                  </p>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-gradient-to-r from-muted/60 to-transparent px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Wallet className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                    <h3 className="text-xs font-semibold tracking-tight text-foreground">Ödemeler</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {data.payments?.length ?? 0}
                    </span>
                  </div>
                  <DtInfoHint title="Ödeme tarihi, tutar ve firma. En fazla 150 satır; tamamı XLSX Odeme_satirlari sayfasında." />
                </div>
                <div className="max-h-[min(260px,42vh)] min-w-0 overflow-auto">
                  <table className="w-full min-w-[560px] table-fixed border-collapse text-[11px]">
                    <colgroup>
                      <col style={{ width: '38%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '28%' }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="bg-muted/90 backdrop-blur-sm">
                        <th className={previewTh}>Dosya · konu</th>
                        <th className={previewTh}>Tarih</th>
                        <th className={cn(previewTh, 'text-right')}>Tutar</th>
                        <th className={previewTh}>Firma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.payments ?? []).slice(0, 150).map((r, i) => (
                        <tr key={`${r.file_no}-${r.paid_at}-${i}`} className={cn('transition-colors hover:bg-muted/25', i % 2 === 1 && 'bg-muted/15')}>
                          <td className={previewTd}>
                            <div className="tabular-nums text-[10px] font-medium text-muted-foreground">
                              {r.year} · #{r.file_no}
                            </div>
                            <div className="break-words leading-snug text-foreground" title={r.file_subject}>
                              {r.file_subject}
                            </div>
                          </td>
                          <td className={cn(previewTd, 'whitespace-nowrap text-muted-foreground')}>
                            {r.paid_at ? new Date(r.paid_at).toLocaleDateString('tr-TR') : '—'}
                          </td>
                          <td className={cn(previewTd, previewMoney)}>{trMoney(r.amount)}</td>
                          <td className={cn(previewTd, 'text-muted-foreground')}>
                            <div className="break-words leading-snug" title={r.vendor_title ?? undefined}>
                              {r.vendor_title ?? '—'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(data.payments?.length ?? 0) > 150 ? (
                  <p className="border-t border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                    Önizlemede ilk 150 satır gösterilir; tam liste XLSX içindedir.
                  </p>
                ) : null}
              </section>
            </div>
          ) : (
            <div className="flex gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Filtreleri seçip <strong className="font-medium text-foreground">Önizleme</strong> ile tabloları burada görün; ardından{' '}
                <strong className="font-medium text-foreground">XLSX indir</strong> ile tam defteri alın.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
