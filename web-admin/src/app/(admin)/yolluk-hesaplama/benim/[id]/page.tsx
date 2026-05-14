'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  FileText,
  Landmark,
  ListOrdered,
  Route,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Calc = {
  id: string;
  kind: string;
  status: string;
  title: string | null;
  inputs: Record<string, unknown>;
  result: {
    total_tl?: number;
    lines?: { key: string; label: string; amount_tl: number }[];
    effective_daily_tl?: number;
    gecici_bildirim?: { toplam_gundelik_tl: number; toplam_tasit_tl: number; rows?: unknown[] };
  };
  rules_snapshot: Record<string, unknown>;
  finalized_at: string | null;
  archived_at?: string | null;
};

function kindLabelTr(k: string): string {
  if (k === 'gecici') return 'Geçici görev';
  if (k === 'surekli') return 'Sürekli görev';
  if (k === 'denetim') return 'Denetim';
  return k;
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === 'surekli') return <Briefcase className="size-5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />;
  if (kind === 'denetim') return <Landmark className="size-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />;
  return <Route className="size-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden />;
}

function lineIcon(label: string) {
  const t = label.toLowerCase();
  if (t.includes('gündelik') || t.includes('gundelik')) return <Coins className="size-3.5 text-amber-600/90" aria-hidden />;
  if (t.includes('yol')) return <Route className="size-3.5 text-sky-600/90" aria-hidden />;
  if (t.includes('konak')) return <CalendarDays className="size-3.5 text-emerald-600/90" aria-hidden />;
  if (t.includes('taşıt') || t.includes('tasit') || t.includes('taksi')) return <Wallet className="size-3.5 text-violet-600/90" aria-hidden />;
  return <ListOrdered className="size-3.5 text-muted-foreground" aria-hidden />;
}

export default function YollukBenimDetayPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useAuth();
  const [c, setC] = useState<Calc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (me?.role !== 'teacher') {
      router.replace('/403');
      return;
    }
    if (!id) return;
    (async () => {
      try {
        const row = await apiFetch<Calc>(`/yolluk/calculations/${id}`);
        setC(row);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id, me?.role, router]);

  const fy = useMemo(() => {
    const raw = c?.rules_snapshot?.fiscal_year;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string') {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }, [c?.rules_snapshot]);

  const finalizedStr = useMemo(() => {
    if (!c?.finalized_at) return null;
    const d = new Date(c.finalized_at);
    return Number.isFinite(d.getTime())
      ? d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
      : null;
  }, [c?.finalized_at]);

  if (me?.role !== 'teacher') return null;

  const lines = c?.result?.lines ?? [];
  const total = typeof c?.result?.total_tl === 'number' && Number.isFinite(c.result.total_tl) ? c.result.total_tl : null;
  const eff = c?.result?.effective_daily_tl;
  const gb = c?.result?.gecici_bildirim;

  return (
    <div className="mx-auto max-w-lg space-y-3 px-3 pb-10 sm:max-w-2xl sm:space-y-4 sm:px-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs sm:h-9 sm:px-3" asChild>
          <Link href="/yolluk-hesaplama/benim">
            <ArrowLeft className="size-3.5 sm:size-4" aria-hidden />
            Hesaplarım
          </Link>
        </Button>
      </div>

      {/* Dekoratif üst SVG — düşük opaklık, göz yormaz */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br from-sky-500/7 via-violet-500/6 to-emerald-500/8 p-4 shadow-sm sm:p-5">
        <svg
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 text-sky-400/25 dark:text-sky-300/20"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
        >
          <circle cx="60" cy="40" r="48" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="72" cy="52" r="32" stroke="currentColor" strokeWidth="0.9" opacity="0.65" />
          <path d="M20 95 Q60 55 100 95" stroke="currentColor" strokeWidth="0.9" opacity="0.5" fill="none" />
        </svg>
        <div className="relative flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/40 bg-background/85 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-background/70">
                <KindIcon kind={c?.kind ?? ''} />
              </div>
              <div className="min-w-0">
                <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">Yolluk özeti</p>
                <h1 className="text-base font-bold leading-tight tracking-tight text-foreground sm:text-lg">
                  {c?.title?.trim() || kindLabelTr(c?.kind ?? '—')}
                </h1>
              </div>
            </div>
            {c && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:text-xs',
                    c.status === 'final'
                      ? 'bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-200'
                      : 'bg-amber-500/12 text-amber-900 ring-1 ring-amber-500/20 dark:text-amber-100',
                  )}
                >
                  {c.status === 'final' ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <ClipboardList className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
                  )}
                  {c.status === 'final' ? 'Kesinleşti' : 'Taslak'}
                </span>
                {c.archived_at && c.status === 'final' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-500/25 dark:text-slate-200 sm:text-xs">
                    <Archive className="size-3.5 text-slate-600 dark:text-slate-400" aria-hidden />
                    Arşiv
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
            <span className="rounded-md bg-background/70 px-2 py-0.5 font-medium text-foreground/90 ring-1 ring-border/50 backdrop-blur-sm">
              {kindLabelTr(c?.kind ?? '—')}
            </span>
            {fy != null && (
              <span className="rounded-md bg-background/60 px-2 py-0.5 ring-1 ring-border/40 backdrop-blur-sm">Mali yıl {fy}</span>
            )}
            {finalizedStr && (
              <span className="rounded-md bg-background/60 px-2 py-0.5 ring-1 ring-border/40 backdrop-blur-sm">{finalizedStr}</span>
            )}
          </div>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-xs text-destructive sm:text-sm">{err}</p>
      )}

      {!c && !err && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6 sm:py-8">
            <div className="size-9 animate-pulse rounded-lg bg-muted sm:size-10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-[60%] max-w-[200px] animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-[40%] max-w-[140px] animate-pulse rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      )}

      {c && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <Card className="overflow-hidden border-sky-500/20 bg-linear-to-br from-sky-500/6 to-transparent shadow-sm">
              <CardContent className="flex flex-col gap-0.5 p-3 sm:p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-sky-800/90 dark:text-sky-200/90">
                  <Sparkles className="size-3.5 shrink-0" aria-hidden />
                  Toplam
                </div>
                <p className="font-mono text-lg font-bold tabular-nums leading-none text-foreground sm:text-xl">
                  {total != null ? total.toFixed(2) : '—'} <span className="text-xs font-semibold text-muted-foreground">TL</span>
                </p>
              </CardContent>
            </Card>
            {typeof eff === 'number' && Number.isFinite(eff) && (
              <Card className="overflow-hidden border-amber-500/20 bg-linear-to-br from-amber-500/6 to-transparent shadow-sm">
                <CardContent className="flex flex-col gap-0.5 p-3 sm:p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900/85 dark:text-amber-100/90">
                    <Coins className="size-3.5 shrink-0" aria-hidden />
                    Gündelik
                  </div>
                  <p className="font-mono text-base font-bold tabular-nums leading-none sm:text-lg">
                    {eff.toFixed(2)} <span className="text-[10px] font-semibold text-muted-foreground">TL/gün</span>
                  </p>
                </CardContent>
              </Card>
            )}
            {c.kind === 'gecici' && gb?.rows && gb.rows.length > 0 && (
              <Card className="col-span-2 overflow-hidden border-emerald-500/20 bg-linear-to-br from-emerald-500/5 to-transparent shadow-sm sm:col-span-1">
                <CardContent className="flex flex-col gap-1 p-3 sm:p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/85 dark:text-emerald-100/90">
                    <FileText className="size-3.5 shrink-0" aria-hidden />
                    Bildirim tablosu
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    <span className="font-semibold text-foreground">{gb.rows.length}</span> satır · gündelik{' '}
                    <span className="font-mono font-semibold text-foreground">{gb.toplam_gundelik_tl.toFixed(2)}</span> TL · taşıt + döviz{' '}
                    <span className="font-mono font-semibold text-foreground">{gb.toplam_tasit_tl.toFixed(2)}</span> TL
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border/60 bg-muted/30 px-3 py-2.5 sm:px-4">
              <ListOrdered className="size-4 text-violet-600 dark:text-violet-400" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground sm:text-sm">Kalem özeti</span>
            </div>
            <CardContent className="p-0">
              {lines.length === 0 ? (
                <p className="text-muted-foreground p-3 text-center text-xs sm:p-4 sm:text-sm">Satır özeti yok.</p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {lines.map((l) => (
                    <li key={l.key} className="flex items-start justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
                      <span className="flex min-w-0 items-start gap-2 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                        <span className="mt-0.5 shrink-0 opacity-90">{lineIcon(l.label)}</span>
                        <span className="min-w-0">{l.label}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
                        {l.amount_tl.toFixed(2)} TL
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
