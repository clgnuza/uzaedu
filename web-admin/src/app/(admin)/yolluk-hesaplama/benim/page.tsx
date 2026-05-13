'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Coins,
  Download,
  Landmark,
  ListOrdered,
  Receipt,
  Route,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { downloadYollukPdf } from '@/lib/yolluk-pdf-download';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Calc = {
  id: string;
  kind: string;
  status: string;
  title: string | null;
  result: { total_tl?: number; lines?: { key: string; label: string; amount_tl: number }[] };
  finalized_at: string | null;
};

function kindLabelTr(k: string): string {
  if (k === 'gecici') return 'Geçici görev';
  if (k === 'surekli') return 'Sürekli görev';
  if (k === 'denetim') return 'Denetim';
  return k;
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'surekli') return <Briefcase className="size-4 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />;
  if (kind === 'denetim') return <Landmark className="size-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />;
  return <Route className="size-4 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />;
}

function lineIcon(label: string) {
  const t = label.toLowerCase();
  if (t.includes('gündelik') || t.includes('gundelik')) return <Coins className="size-3 text-amber-600/90" aria-hidden />;
  if (t.includes('yol')) return <Route className="size-3 text-sky-600/90" aria-hidden />;
  if (t.includes('konak')) return <CalendarDays className="size-3 text-emerald-600/90" aria-hidden />;
  if (t.includes('taşıt') || t.includes('tasit') || t.includes('taksi')) return <Wallet className="size-3 text-violet-600/90" aria-hidden />;
  return <ListOrdered className="size-3 text-muted-foreground" aria-hidden />;
}

function formatFinalized(at: string | null): string | null {
  if (!at) return null;
  const d = new Date(at);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

/** Kart gövdesi: türe göre sol şerit + üst bant + toplam şeridi */
function kindShell(kind: string) {
  if (kind === 'surekli') {
    return {
      stripe: 'border-l-violet-500',
      header: 'bg-linear-to-br from-violet-500/18 via-violet-500/8 to-transparent',
      iconWrap: 'border-violet-400/35 bg-violet-500/15 shadow-violet-500/10',
      chip: 'bg-violet-500/12 text-violet-950 ring-violet-400/35 dark:text-violet-100',
      totalBand: 'bg-linear-to-r from-violet-500/12 to-fuchsia-500/5',
      totalLabel: 'text-violet-800 dark:text-violet-200',
      footer: 'bg-linear-to-r from-violet-500/8 via-transparent to-fuchsia-500/6',
      pdfBtn: 'border-violet-400/40 hover:bg-violet-500/10',
    };
  }
  if (kind === 'denetim') {
    return {
      stripe: 'border-l-amber-500',
      header: 'bg-linear-to-br from-amber-500/20 via-orange-500/8 to-transparent',
      iconWrap: 'border-amber-400/40 bg-amber-500/15 shadow-amber-500/10',
      chip: 'bg-amber-500/14 text-amber-950 ring-amber-400/40 dark:text-amber-50',
      totalBand: 'bg-linear-to-r from-amber-500/14 to-orange-500/6',
      totalLabel: 'text-amber-900 dark:text-amber-100',
      footer: 'bg-linear-to-r from-amber-500/10 via-transparent to-orange-500/8',
      pdfBtn: 'border-amber-400/45 hover:bg-amber-500/12',
    };
  }
  return {
    stripe: 'border-l-sky-500',
    header: 'bg-linear-to-br from-sky-500/18 via-cyan-500/8 to-transparent',
    iconWrap: 'border-sky-400/35 bg-sky-500/14 shadow-sky-500/10',
    chip: 'bg-sky-500/12 text-sky-950 ring-sky-400/35 dark:text-sky-100',
    totalBand: 'bg-linear-to-r from-sky-500/14 to-cyan-500/5',
    totalLabel: 'text-sky-900 dark:text-sky-100',
    footer: 'bg-linear-to-r from-sky-500/8 via-transparent to-cyan-500/8',
    pdfBtn: 'border-sky-400/40 hover:bg-sky-500/10',
  };
}

export default function YollukBenimPage() {
  const router = useRouter();
  const { me } = useAuth();
  const can = me?.role === 'teacher';
  const [list, setList] = useState<Calc[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!can) {
      router.replace('/403');
      return;
    }
    (async () => {
      try {
        const rows = await apiFetch<Calc[]>('/yolluk/calculations/mine');
        setList(rows);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        toast.error('Liste yüklenemedi', { description: msg });
        setList([]);
      }
    })();
  }, [can, router]);

  const count = list?.length ?? 0;
  const loading = list === null;

  const empty = useMemo(() => !loading && count === 0 && !err, [loading, count, err]);

  if (!can) return null;

  return (
    <div className="mx-auto w-full min-w-0 max-w-lg space-y-3 px-3 pb-12 sm:max-w-2xl sm:space-y-4 sm:px-4 md:max-w-4xl lg:max-w-5xl lg:px-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-sky-500/7 via-violet-500/6 to-emerald-500/8 p-4 shadow-sm sm:p-5">
        <svg
          className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 text-sky-400/22 dark:text-sky-300/18 sm:h-32 sm:w-32"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
        >
          <circle cx="60" cy="40" r="48" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="72" cy="52" r="32" stroke="currentColor" strokeWidth="0.9" opacity="0.65" />
          <path d="M20 95 Q60 55 100 95" stroke="currentColor" strokeWidth="0.9" opacity="0.5" fill="none" />
        </svg>
        <div className="relative flex flex-col gap-1">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">Öğretmen</p>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Yolluk hesaplarım</h1>
          <p className="text-muted-foreground max-w-md text-[11px] leading-snug sm:text-xs">
            Okul tarafından size tanımlanan kesinleşmiş özet kayıtlar. Detay ve PDF için kartı kullanın.
          </p>
          {!loading && (
            <p className="text-muted-foreground pt-1 text-[10px] font-medium sm:text-[11px]">
              <Sparkles className="mr-1 inline size-3 text-sky-600 opacity-80" aria-hidden />
              {count} kayıt
            </p>
          )}
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive sm:text-sm">{err}</p>
      )}

      {loading && (
        <div className="space-y-2 sm:space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="overflow-hidden border-dashed">
              <CardContent className="flex gap-3 p-3 sm:p-4">
                <div className="size-10 shrink-0 animate-pulse rounded-xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-[55%] animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-[35%] animate-pulse rounded bg-muted" />
                  <div className="h-8 w-[45%] animate-pulse rounded-lg bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {empty && (
        <Card className="border-dashed border-violet-500/25 bg-linear-to-br from-violet-500/5 to-transparent">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center sm:py-10">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-background/80 shadow-sm">
              <Receipt className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-sm font-semibold text-foreground">Henüz kayıt yok</p>
            <p className="text-muted-foreground max-w-[260px] text-xs leading-relaxed">
              Okul yönetimi yolluğunuzu kesinleştirdiğinde burada listelenir.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && count > 0 && (
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2 md:items-stretch md:gap-4">
          {list!.map((c) => {
            const shell = kindShell(c.kind);
            const lines = c.result?.lines ?? [];
            const total =
              typeof c.result?.total_tl === 'number' && Number.isFinite(c.result.total_tl) ? c.result.total_tl : null;
            const preview = lines.slice(0, 4);
            const more = lines.length - preview.length;
            const dateStr = formatFinalized(c.finalized_at);

            return (
              <Card
                key={c.id}
                className={cn(
                  'overflow-hidden border border-border/55 border-l-4 shadow-md ring-1 ring-black/5 transition-[box-shadow,transform] hover:shadow-lg dark:ring-white/10',
                  shell.stripe,
                )}
              >
                <CardContent className="flex h-full flex-col p-0">
                  <div className={cn('flex gap-2.5 border-b border-border/40 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3', shell.header)}>
                    <div
                      className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background/90 shadow-sm backdrop-blur-[2px] sm:size-11',
                        shell.iconWrap,
                      )}
                    >
                      <KindIcon kind={c.kind} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                          {c.title?.trim() || kindLabelTr(c.kind)}
                        </p>
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]',
                            c.status === 'final'
                              ? 'bg-emerald-500/20 text-emerald-900 ring-1 ring-emerald-500/30 dark:text-emerald-100'
                              : 'bg-amber-500/18 text-amber-950 ring-1 ring-amber-500/28 dark:text-amber-50',
                          )}
                        >
                          {c.status === 'final' ? (
                            <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
                          ) : (
                            <ClipboardList className="size-3 text-amber-600 dark:text-amber-400" aria-hidden />
                          )}
                          {c.status === 'final' ? 'Kesin' : 'Taslak'}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 sm:text-[11px]',
                            shell.chip,
                          )}
                        >
                          {kindLabelTr(c.kind)}
                        </span>
                        {dateStr && (
                          <span className="rounded-md bg-background/75 px-1.5 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border/45 sm:text-[11px]">
                            {dateStr}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={cn('px-3 py-2.5 sm:px-4 sm:py-3', shell.totalBand)}>
                    <p className={cn('text-[10px] font-bold uppercase tracking-wide sm:text-[11px]', shell.totalLabel)}>Toplam</p>
                    <p className="font-mono text-[1.35rem] font-bold tabular-nums leading-none text-foreground sm:text-2xl">
                      {total != null ? total.toFixed(2) : '—'}{' '}
                      <span className="text-xs font-semibold text-muted-foreground">TL</span>
                    </p>
                  </div>

                  {preview.length > 0 && (
                    <ul className="min-h-0 flex-1 divide-y divide-border/35 border-t border-border/35 bg-muted/10 px-2 py-0.5 sm:px-3">
                      {preview.map((l) => (
                        <li key={l.key} className="flex items-center justify-between gap-2 py-1.5 sm:py-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground sm:text-[11px]">
                            <span className="shrink-0 opacity-90">{lineIcon(l.label)}</span>
                            <span className="truncate">{l.label}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-foreground sm:text-[11px]">
                            {l.amount_tl.toFixed(2)} TL
                          </span>
                        </li>
                      ))}
                      {more > 0 && (
                        <li className="text-muted-foreground py-1.5 text-center text-[10px] font-medium sm:py-2 sm:text-[11px]">
                          +{more} kalem · detayda tamamı
                        </li>
                      )}
                    </ul>
                  )}

                  <div
                    className={cn(
                      'mt-auto flex w-full min-w-0 flex-col gap-2 border-t border-border/45 px-3 py-2.5 sm:flex-row sm:flex-wrap sm:px-4 sm:py-3',
                      shell.footer,
                    )}
                  >
                    <Button
                      size="sm"
                      variant="default"
                      className="h-11 w-full min-h-11 gap-1 text-sm sm:h-10 sm:min-h-0 sm:flex-1 sm:text-xs"
                      asChild
                    >
                      <Link href={`/yolluk-hesaplama/benim/${c.id}`} className="justify-center sm:justify-center">
                        Detay
                        <ChevronRight className="size-4 opacity-80 sm:size-3.5" aria-hidden />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={cn(
                        'h-11 w-full min-h-11 gap-2 text-sm sm:h-10 sm:min-h-0 sm:w-auto sm:flex-1 sm:text-xs',
                        shell.pdfBtn,
                      )}
                      disabled={pdfBusy === c.id}
                      onClick={() => {
                        setPdfBusy(c.id);
                        setErr(null);
                        downloadYollukPdf(c.id)
                          .then(() => toast.success('PDF indirildi'))
                          .catch((e) => {
                            const msg = e instanceof Error ? e.message : String(e);
                            setErr(msg);
                            toast.error('PDF indirilemedi', { description: msg });
                          })
                          .finally(() => setPdfBusy(null));
                      }}
                    >
                      <Download className="size-4 sm:size-3.5" aria-hidden />
                      {pdfBusy === c.id ? '…' : 'PDF indir'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
