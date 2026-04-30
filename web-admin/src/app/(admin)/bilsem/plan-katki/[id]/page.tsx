'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  ListChecks,
  Upload,
} from 'lucide-react';
import { PlanKatkiExcelPlanUpload } from '@/components/bilsem/plan-katki-excel-upload';
import { cn } from '@/lib/utils';
import { bilsemAnaGrupLabel } from '@/lib/bilsem-groups';
import type { BilsemPlanWeekItem } from '@/lib/parse-yillik-plan-sablon-xlsx';

type Submission = {
  id: string;
  status: string;
  authorUserId: string;
  subjectCode: string;
  subjectLabel: string;
  anaGrup: string;
  altGrup: string | null;
  academicYear: string;
  planGrade: number | null;
  tabloAltiNot: string | null;
  itemsJson: string;
  rewardJetonPerGeneration: string;
  reviewNote: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

function fmtWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

const STATUS_STRIP: Record<string, string> = {
  draft: 'from-amber-500/90 to-amber-600/80 text-white',
  pending_review: 'from-sky-500/90 to-sky-600/80 text-white',
  published: 'from-emerald-500/90 to-emerald-600/80 text-white',
  rejected: 'from-rose-500/90 to-rose-600/80 text-white',
  withdrawn: 'from-slate-500/80 to-slate-600/80 text-white',
};

const STATUS_TR: Record<string, string> = {
  draft: 'Taslak',
  pending_review: 'İncelemede',
  published: 'Yayında',
  rejected: 'Reddedildi',
  withdrawn: 'Geri çekildi',
};

export default function BilsemPlanKatkiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, me } = useAuth();
  const [row, setRow] = useState<Submission | null>(null);
  const [itemsJson, setItemsJson] = useState('');
  const [savedItemsJson, setSavedItemsJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'save' | 'submit' | 'withdraw'>(null);
  const [tab, setTab] = useState<'ozet' | 'plan'>('ozet');
  const initialTabSet = useRef(false);
  const [pubUsage, setPubUsage] = useState<null | { usageCount: number; totalJeton: string }>(null);

  const weekCount = useMemo(() => {
    try {
      const j = JSON.parse(itemsJson) as unknown;
      return Array.isArray(j) ? j.length : 0;
    } catch {
      return 0;
    }
  }, [itemsJson]);

  const planMeta = useMemo(() => {
    if (weekCount === 0) return null;
    try {
      const items = JSON.parse(itemsJson) as BilsemPlanWeekItem[];
      if (!Array.isArray(items) || !items.length) return null;
      const nums = items.map((i) => i.week_order).filter((n) => typeof n === 'number') as number[];
      const unites = new Set(items.map((i) => (i.unite ?? '').trim()).filter(Boolean));
      return {
        min: nums.length ? Math.min(...nums) : 0,
        max: nums.length ? Math.max(...nums) : 0,
        unites: unites.size,
      };
    } catch {
      return null;
    }
  }, [itemsJson, weekCount]);

  const planDirty = row?.status === 'draft' && itemsJson !== savedItemsJson;

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setErr(null);
    try {
      const s = await apiFetch<Submission>(`/bilsem/plan-submissions/${encodeURIComponent(id)}`, { token });
      setRow(s);
      setItemsJson(s.itemsJson);
      setSavedItemsJson(s.itemsJson);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Yüklenemedi');
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !row || row.status !== 'published') {
      setPubUsage(null);
      return;
    }
    let ok = true;
    void (async () => {
      try {
        const u = await apiFetch<{ usageCount: number; totalJeton: string }>(
          `/bilsem/plan-submissions/${encodeURIComponent(id)}/usage`,
          { token },
        );
        if (ok) setPubUsage(u);
      } catch {
        if (ok) setPubUsage(null);
      }
    })();
    return () => {
      ok = false;
    };
  }, [token, id, row?.id, row?.status]);

  useEffect(() => {
    if (row?.status !== 'draft' || initialTabSet.current || loading) return;
    initialTabSet.current = true;
    try {
      const j = JSON.parse(savedItemsJson) as unknown;
      const n = Array.isArray(j) ? j.length : 0;
      setTab(n === 0 ? 'plan' : 'ozet');
    } catch {
      setTab('plan');
    }
  }, [row?.status, savedItemsJson, loading]);

  async function saveDraft() {
    if (!token || !id || !row || row.status !== 'draft') return;
    let items: unknown[];
    try {
      items = JSON.parse(itemsJson) as unknown[];
    } catch {
      setErr('Plan verisi geçersiz.');
      return;
    }
    if (!Array.isArray(items) || items.length === 0) {
      setErr('En az bir hafta gerekir.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const s = await apiFetch<Submission>(`/bilsem/plan-submissions/${encodeURIComponent(id)}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
      setRow(s);
      setItemsJson(s.itemsJson);
      setSavedItemsJson(s.itemsJson);
      toast.success('Taslak kaydedildi');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!token || !id) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/bilsem/plan-submissions/${encodeURIComponent(id)}/submit`, { token, method: 'POST' });
      toast.success('İncelemeye gönderildi');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!token || !id) return;
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/bilsem/plan-submissions/${encodeURIComponent(id)}/withdraw`, { token, method: 'POST' });
      toast.success('Geri çekildi');
      router.push('/bilsem/plan-katki');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function runConfirmed() {
    if (!confirm) return;
    setConfirm(null);
    if (confirm === 'save') await saveDraft();
    else if (confirm === 'submit') await submitReview();
    else await withdraw();
  }

  function requestSubmitReview() {
    if (row?.status === 'draft' && planDirty) {
      setErr('İncelemeye göndermeden önce Kaydet.');
      toast.error('Önce Kaydet');
      return;
    }
    setConfirm('submit');
  }

  if (!me || (me.role !== 'teacher' && me.role !== 'school_admin')) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-2 pb-8 pt-1 sm:space-y-4 sm:px-4 sm:pt-2">
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="sm" asChild className="h-8 gap-0.5 px-2 text-xs sm:h-9 sm:px-2.5 sm:text-sm">
          <Link href="/bilsem/plan-katki">
            <ArrowLeft className="h-3.5 w-3.5" />
            Liste
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12 sm:py-16">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      ) : !row ? (
        <p className="text-sm text-destructive">{err ?? 'Kayıt yok'}</p>
      ) : (
        <>
          <div
            className={cn(
              'flex flex-col gap-2 rounded-2xl bg-gradient-to-r p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4',
              STATUS_STRIP[row.status] ?? STATUS_STRIP.draft!,
            )}
          >
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/90">Gönderim</span>
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                  {STATUS_TR[row.status] ?? row.status}
                </span>
              </div>
              <h1 className="truncate text-base font-bold sm:text-lg">
                {row.subjectLabel}{' '}
                <span className="font-medium opacity-90">({row.subjectCode})</span>
              </h1>
              <p className="mt-0.5 text-[11px] opacity-90 sm:text-xs">
                {bilsemAnaGrupLabel(row.anaGrup)}
                {row.altGrup ? ` · ${row.altGrup}` : ''} · {row.academicYear} · {weekCount} hafta
              </p>
            </div>
            {row.publishedAt && (
              <div
                className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-center text-[10px] sm:text-left sm:text-xs"
                style={{ backdropFilter: 'blur(4px)' }}
              >
                <p>Yayın: {new Date(row.publishedAt).toLocaleString('tr-TR')}</p>
                {pubUsage && pubUsage.usageCount > 0 && (
                  <p className="mt-0.5 text-[9px] opacity-90">
                    Kullanım: {pubUsage.usageCount} üretim — {Number.parseFloat(pubUsage.totalJeton).toLocaleString('tr-TR', { maximumFractionDigits: 4 })}{' '}
                    jtn
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/50 bg-card px-3 py-2.5 text-[10px] shadow-inner sm:px-4 sm:text-xs">
            <p className="mb-1.5 font-semibold text-foreground">Zaman çizelgesi</p>
            <ul className="space-y-1.5 sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1">
              <li className="flex justify-between gap-2">
                <span className="text-muted-foreground">Oluşturulma</span>
                <span className="font-mono text-[9px] sm:text-[10px]">{fmtWhen(row.createdAt)}</span>
              </li>
              {row.submittedAt && (
                <li className="flex justify-between gap-2">
                  <span className="text-muted-foreground">İncelemeye gönderim</span>
                  <span className="font-mono text-[9px] sm:text-[10px]">{fmtWhen(row.submittedAt)}</span>
                </li>
              )}
              {row.decidedAt && (
                <li className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Karar</span>
                  <span className="font-mono text-[9px] sm:text-[10px]">{fmtWhen(row.decidedAt)}</span>
                </li>
              )}
              {row.publishedAt && (
                <li className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Katalog yayını</span>
                  <span className="font-mono text-[9px] sm:text-[10px]">{fmtWhen(row.publishedAt)}</span>
                </li>
              )}
            </ul>
          </div>

          {row.reviewNote && (
            <div className="rounded-xl border border-violet-200/50 bg-violet-500/5 px-2.5 py-2 text-xs sm:px-3 sm:text-sm">
              <span className="font-medium text-violet-900 dark:text-violet-200">Moderatör notu: </span>
              {row.reviewNote}
            </div>
          )}

          {row.status === 'draft' && (
            <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto rounded-full border border-border/50 bg-muted/30 p-1 [scrollbar-width:none] sm:max-w-sm [&::-webkit-scrollbar]:hidden">
              {(
                [
                  { id: 'ozet' as const, label: 'Özet', Icon: ClipboardList },
                  { id: 'plan' as const, label: 'Excel planı', Icon: FileSpreadsheet },
                ] as const
              ).map(({ id: tid, label, Icon }) => (
                <button
                  key={tid}
                  type="button"
                  onClick={() => setTab(tid)}
                  className={cn(
                    'flex min-h-[2.25rem] flex-1 snap-center items-center justify-center gap-1 rounded-full px-2 text-[11px] font-medium sm:text-xs',
                    tab === tid
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-background/60',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {err && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs sm:text-sm">
              {err}
            </div>
          )}

          {row.status === 'draft' && tab === 'ozet' && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-violet-200/50 bg-violet-500/5 p-3 dark:border-violet-800/30 sm:p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ListChecks className="h-4 w-4 text-violet-600" />
                  Akış
                </div>
                <ul className="space-y-2 text-[11px] sm:text-sm">
                  <li className="flex items-start gap-2">
                    {weekCount > 0 ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-[9px] font-bold text-muted-foreground">
                        1
                      </span>
                    )}
                    <span>
                      {weekCount > 0 ? (
                        <strong className="text-foreground">Plan verisi hazır</strong>
                      ) : (
                        <strong>Excel yükleyin</strong>
                      )}{' '}
                      {weekCount > 0
                        ? `(${weekCount} hafta${planMeta ? `, ${planMeta.min}–${planMeta.max}. hafta` : ''})`
                        : '— «Excel planı» sekmesinde .xlsx seçin.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    {weekCount > 0 && !planDirty ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-[9px] font-bold text-muted-foreground">
                        2
                      </span>
                    )}
                    <span>
                      {weekCount === 0 ? (
                        'Önce veri yükleyin'
                      ) : planDirty ? (
                        <>
                          <strong className="text-amber-700 dark:text-amber-300">Kayıt gerekli</strong> — değişiklik var; «Kaydet»
                          düğmesine basın.
                        </>
                      ) : (
                        <>
                          <strong className="text-foreground">Taslak kayıtlı</strong> — sunucuya aktarıldı.
                        </>
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-[9px] font-bold text-muted-foreground">
                      3
                    </span>
                    <span>
                      Hazırsanız <strong>«İncelemeye gönder»</strong> — taslak kilitlenir, moderasyona düşer.
                    </span>
                  </li>
                </ul>
                {weekCount > 0 && planMeta && planMeta.unites > 0 && (
                  <p className="mt-2 rounded-lg bg-background/60 px-2.5 py-1.5 text-[10px] text-muted-foreground sm:text-xs">
                    Özet: en az {planMeta.unites} farklı ünite/tema satırı algılandı.
                  </p>
                )}
                {weekCount === 0 && (
                  <Button
                    type="button"
                    className="mt-3 w-full gap-1.5 sm:w-auto"
                    onClick={() => setTab('plan')}
                  >
                    <Upload className="h-4 w-4" />
                    Excel planına geç
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
                {weekCount > 0 && planDirty && (
                  <p className="mt-2 text-[10px] text-amber-800 dark:text-amber-200">
                    «İncelemeye gönder» gri kalır; önce kaydedin.
                  </p>
                )}
              </div>
            </div>
          )}

          {row.status === 'draft' && tab === 'plan' && (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-fuchsia-200/50 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent p-0.5 dark:border-fuchsia-900/30">
                <div className="rounded-[14px] bg-card p-2.5 sm:p-4">
                  <PlanKatkiExcelPlanUpload
                    itemsJson={itemsJson}
                    onItemsJsonChange={setItemsJson}
                    onParsed={({ weekCount: n, source, fileName }) => {
                      if (n > 0) {
                        toast.success(
                          fileName
                            ? `${n} hafta okundu: ${fileName}`
                            : source === 'template'
                              ? `Örnek: ${n} hafta yüklendi`
                              : `${n} hafta içe aktarıldı`,
                          { duration: 3000 },
                        );
                      }
                    }}
                  />
                </div>
              </div>
              {planDirty && (
                <p className="text-center text-[10px] font-medium text-amber-700 dark:text-amber-300">Kaydedilmemiş değişiklik var</p>
              )}
            </div>
          )}

          {row.status === 'draft' && (
            <div
              className={cn(
                'flex flex-col gap-2 sm:flex-row sm:flex-wrap',
                tab === 'ozet' && 'pt-0',
              )}
            >
              <p className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-100 sm:w-full sm:text-xs">
                Sıra: 1) Taslağı kaydet 2) Moderasyona gönder. Moderasyona gönderince düzenleme kilitlenir.
              </p>
              <Button
                className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                onClick={() => setConfirm('save')}
                disabled={busy}
              >
                Taslağı kaydet
              </Button>
              <Button
                variant="secondary"
                className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm"
                onClick={() => requestSubmitReview()}
                disabled={busy || planDirty || weekCount === 0}
                title={weekCount === 0 ? 'Önce Excel yükleyin' : planDirty ? 'Önce taslağı kaydedin' : undefined}
              >
                Moderasyona gönder
              </Button>
              <Button variant="outline" className="h-9 w-full text-xs sm:h-10 sm:w-auto sm:text-sm" onClick={() => setConfirm('withdraw')} disabled={busy}>
                Gönderimi geri çek
              </Button>
            </div>
          )}

          {row.status === 'pending_review' && (
            <div
              className="space-y-2 rounded-2xl border border-sky-200/50 bg-sky-500/5 p-3 dark:border-sky-800/30 sm:p-4"
            >
              <p className="text-xs text-foreground sm:text-sm">Kuyrukta. Düzenlemek için önce geri çekin.</p>
              <p className="rounded-lg border border-sky-300/40 bg-sky-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-sky-900 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-100 sm:text-xs">
                Bu aşamada düzenleme kapalıdır. Değişiklik için önce gönderimi geri çekin.
              </p>
              <Button variant="outline" size="sm" className="h-9 w-full border-sky-300/40 sm:w-auto" onClick={() => setConfirm('withdraw')} disabled={busy}>
                Gönderimi geri çek (düzenlemeyi aç)
              </Button>
            </div>
          )}

          {row.status === 'published' && (
            <div className="space-y-2 rounded-xl border border-emerald-200/50 bg-emerald-500/8 p-3 text-xs sm:text-sm">
              <p>
                Yayında — yıllık plan kataloğu güncel; Bilsem yıllık plan Word üretiminde bu gönderiyle eşleşen içerik
                kullanılabilir.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    const blob = new Blob([row.itemsJson], { type: 'application/json;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `bilsem-plan-katki-${row.id.slice(0, 8)}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Plan JSON indir
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                  <Link href="/bilsem/yillik-plan">Bilsem yıllık plana git</Link>
                </Button>
              </div>
            </div>
          )}

          {row.status === 'rejected' && (
            <p className="rounded-xl border border-rose-200/50 bg-rose-500/8 px-3 py-2.5 text-xs sm:text-sm">Reddedildi.</p>
          )}

          {row.status === 'withdrawn' && (
            <p className="rounded-xl border border-slate-200/60 bg-slate-500/5 px-3 py-2.5 text-xs sm:text-sm">Geri çekildi.</p>
          )}

          <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
            <DialogContent title="Onay" className="sm:max-w-sm" descriptionId="cfm-desc">
              <p id="cfm-desc" className="text-sm text-muted-foreground">
                {confirm === 'save' && 'Taslak kaydedilsin mi?'}
                {confirm === 'submit' && 'Moderasyona gönderilsin mi? Gönderimden sonra düzenleme kilitlenir.'}
                {confirm === 'withdraw' && 'Gönderim geri çekilsin mi? Durum taslağa döner ve düzenleme açılır.'}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirm(null)} disabled={busy} size="sm">
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant={confirm === 'withdraw' ? 'destructive' : 'default'}
                  disabled={busy}
                  onClick={() => void runConfirmed()}
                  size="sm"
                >
                  Onayla
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
