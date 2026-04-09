'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { InfoHintDialog } from '@/components/market/info-hint-dialog';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Coins,
  ExternalLink,
  Play,
  RefreshCw,
  Smartphone,
  Sparkles,
} from 'lucide-react';

type RewardedCfg = {
  enabled: boolean;
  jeton_per_reward: number;
  max_rewards_per_day: number;
  cooldown_seconds: number;
  allowed_ad_unit_ids: string[];
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n);
}

export default function MarketRewardedAdPage() {
  const { token, me } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState<RewardedCfg | null>(null);
  const [storeIos, setStoreIos] = useState<string | null>(null);
  const [storeAndroid, setStoreAndroid] = useState<string | null>(null);
  const [jeton, setJeton] = useState<number | null>(null);
  const [history, setHistory] = useState<{
    total: number;
    items: { id: string; jeton_credit: string; created_at: string | null; ad_unit_key: string | null }[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [pol, mob, w, hist] = await Promise.all([
        apiFetch<{ rewarded_ad_jeton?: RewardedCfg }>('content/market-policy').catch(
          () => ({}) as { rewarded_ad_jeton?: RewardedCfg },
        ),
        apiFetch<{ app_store_url: string | null; play_store_url: string | null }>('content/mobile-config').catch(
          () => null,
        ),
        apiFetch<{ user: { jeton: number } }>('/market/wallet', { token }).catch(() => null),
        apiFetch<{
          total: number;
          items: { id: string; jeton_credit: string; created_at: string | null; ad_unit_key: string | null }[];
        }>('/market/wallet/rewarded-ad-credits?limit=30', { token }).catch(() => null),
      ]);
      setCfg(pol?.rewarded_ad_jeton ?? null);
      setStoreIos(mob?.app_store_url?.trim() || null);
      setStoreAndroid(mob?.play_store_url?.trim() || null);
      setJeton(w?.user?.jeton ?? null);
      setHistory(hist ? { total: hist.total, items: hist.items ?? [] } : null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (me?.role !== 'teacher') {
      router.replace('/403');
      return;
    }
    void load();
  }, [token, me, router, load]);

  if (!me || me.role !== 'teacher') {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const apiRoot = getApiUrl('').replace(/\/$/, '');
  const ssvUrl = `${apiRoot}/market/rewarded-ad/ssv`;

  return (
    <div className="market-page space-y-5 pb-6 sm:space-y-8 sm:pb-10">
      <div className="relative overflow-hidden rounded-xl border border-violet-400/30 bg-linear-to-br from-violet-500/12 via-fuchsia-500/8 to-violet-600/10 p-2.5 shadow-md ring-1 ring-violet-500/15 dark:border-violet-500/20 dark:from-violet-950/50 dark:via-fuchsia-950/25 dark:to-violet-950/40 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-500/10"
          aria-hidden
        />
        <p className="sr-only">
          Ödüllü reklam: mobil uygulamada reklam izleyerek jeton kazanımı. Bu sayfada bakiye, son kazanımlar ve geçerli
          kurallar yer alır.
        </p>
        <div className="relative flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:min-w-0 sm:flex-1 sm:gap-3">
            <Button variant="ghost" size="sm" className="-ml-1 h-9 shrink-0 px-2 text-muted-foreground sm:-ml-2" asChild>
              <Link href="/market">
                <ArrowLeft className="mr-1 size-4" />
                <span className="hidden sm:inline">Cüzdan</span>
                <span className="sm:hidden">Geri</span>
              </Link>
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-md ring-2 ring-white/25 dark:ring-white/10 sm:size-11">
                <Play className="size-[1.15rem] sm:size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold leading-tight tracking-tight text-foreground sm:text-lg">
                  Ödüllü reklam
                </h1>
                <p className="text-[11px] leading-tight text-muted-foreground sm:text-xs">
                  Mobilde izle · jeton kazan
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:ml-auto">
            <div
              className="mr-1 hidden items-center gap-1 sm:flex"
              role="group"
              aria-label="Özet"
            >
              <span
                className="inline-flex size-8 items-center justify-center rounded-lg border border-amber-400/40 bg-amber-500/20 text-amber-800 shadow-sm dark:text-amber-200"
                title="Jeton"
              >
                <Coins className="size-3.5" aria-hidden />
              </span>
              <span
                className="inline-flex size-8 items-center justify-center rounded-lg border border-violet-400/40 bg-violet-500/20 text-violet-800 shadow-sm dark:text-violet-200"
                title="Mobil uygulama"
              >
                <Smartphone className="size-3.5" aria-hidden />
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 border-violet-500/35"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('size-4 sm:mr-1.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Yenile</span>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {!cfg?.enabled ? (
            <Alert
              variant="warning"
              message="Ödüllü reklam şu an kapalı. Yönetim açtığında jeton kazanımını mobil uygulamada Market üzerinden kullanabilirsiniz."
            />
          ) : null}

          <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden border-2 border-amber-400/35 bg-linear-to-br from-amber-500/12 via-card to-orange-500/8 shadow-md ring-1 ring-amber-500/15 dark:border-amber-800/45">
              <CardHeader className="border-b border-amber-500/20 bg-amber-500/8 pb-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/25 text-amber-900 dark:text-amber-100">
                    <Coins className="size-5" aria-hidden />
                  </span>
                  Jeton bakiyesi
                </CardTitle>
                <p className="text-xs text-muted-foreground">Bireysel cüzdan</p>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {jeton != null ? fmtNum(jeton) : '—'}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Ödüller sunucu doğrulaması (SSV) ile kısa sürede cüzdana işlenir.
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-2 border-violet-400/35 bg-linear-to-br from-violet-500/10 via-card to-fuchsia-500/8 shadow-md ring-1 ring-violet-500/15 dark:border-violet-800/45">
              <CardHeader className="border-b border-violet-500/20 bg-violet-500/8 pb-3 dark:border-violet-900/40 dark:bg-violet-950/35">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/25 text-violet-900 dark:text-violet-100">
                      <Smartphone className="size-5" aria-hidden />
                    </span>
                    Nasıl kazanılır?
                  </CardTitle>
                  <InfoHintDialog label="Ödüllü reklam" title="Nasıl kazanılır?">
                    <p>Reklamlar yalnızca mobil uygulamada oynatılır; tarayıcıdan izlenmez.</p>
                    <p className="mt-2">Ödül, reklamı tamamladığınızda sunucuya bildirilir ve jeton eklenir.</p>
                  </InfoHintDialog>
                </div>
                <p className="text-xs text-muted-foreground">Öğretmen Pro iOS veya Android</p>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 text-sm text-muted-foreground">
                <ol className="list-decimal space-y-2 pl-5 text-foreground/90">
                  <li>Uygulamayı açın (bu hesapla giriş yapın).</li>
                  <li>Market veya jeton bölümünden ödüllü reklamı seçin.</li>
                  <li>Reklamı sonuna kadar izleyin; jeton kısa sürede eklenir.</li>
                </ol>
                <div className="flex flex-wrap gap-2 pt-1">
                  {storeIos ? (
                    <Button variant="outline" size="sm" className="border-violet-500/30" asChild>
                      <a href={storeIos} target="_blank" rel="noreferrer">
                        App Store <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {storeAndroid ? (
                    <Button variant="outline" size="sm" className="border-violet-500/30" asChild>
                      <a href={storeAndroid} target="_blank" rel="noreferrer">
                        Google Play <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {!storeIos && !storeAndroid ? (
                    <p className="text-xs">Mağaza bağlantıları ayarlı değil; uygulama mağazasından «Öğretmen Pro» arayın.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {history && history.items.length > 0 ? (
            <Card
              id="rewarded-ad-history"
              className="scroll-mt-4 overflow-hidden border-2 border-fuchsia-400/30 bg-card shadow-md ring-1 ring-fuchsia-500/10 dark:border-fuchsia-900/40"
            >
              <CardHeader className="border-b border-fuchsia-500/20 bg-linear-to-r from-fuchsia-500/10 to-transparent pb-3 dark:from-fuchsia-950/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-5 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden />
                    Son kazanımlar
                  </CardTitle>
                  <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {history.total} kayıt
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Ödüllü reklamdan eklenen jetonlar</p>
              </CardHeader>
              <CardContent className="table-x-scroll p-0">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className="border-b border-fuchsia-500/20 bg-fuchsia-500/10 text-left text-[11px] font-semibold uppercase tracking-wide text-fuchsia-950 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-100">
                      <th className="px-3 py-2.5 sm:px-4">Tarih</th>
                      <th className="px-2 py-2.5 text-right">Jeton</th>
                      <th className="px-3 py-2.5 sm:px-4">Birim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {history.items.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-fuchsia-500/5">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground sm:px-4">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString('tr-TR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="px-2 py-2 text-right text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          +{fmtNum(parseFloat(row.jeton_credit || '0'))}
                        </td>
                        <td className="max-w-[min(12rem,40vw)] truncate px-3 py-2 font-mono text-xs text-muted-foreground sm:max-w-xs sm:px-4">
                          {row.ad_unit_key || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}

          {cfg?.enabled ? (
            <Card className="overflow-hidden border-2 border-emerald-400/35 bg-linear-to-br from-emerald-500/8 via-card to-teal-500/6 shadow-md ring-1 ring-emerald-500/15 dark:border-emerald-800/45">
              <CardHeader className="border-b border-emerald-500/20 bg-emerald-500/8 pb-3 dark:border-emerald-900/40 dark:bg-emerald-950/30">
                <CardTitle className="text-base sm:text-lg">Geçerli kurallar</CardTitle>
                <p className="text-xs text-muted-foreground">Politikada tanımlı üst sınırlar ve ödül tutarı</p>
              </CardHeader>
              <CardContent className="grid gap-2 pt-4 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 px-3 py-2.5 dark:border-amber-800/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ödül başına</span>
                  <p className="mt-0.5 font-bold tabular-nums text-foreground">{fmtNum(cfg.jeton_per_reward)} jeton</p>
                </div>
                <div className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-2.5 dark:border-sky-800/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Günlük üst sınır</span>
                  <p className="mt-0.5 font-bold tabular-nums text-foreground">{cfg.max_rewards_per_day} ödül</p>
                </div>
                <div className="rounded-xl border border-violet-400/35 bg-violet-500/10 px-3 py-2.5 dark:border-violet-800/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bekleme süresi</span>
                  <p className="mt-0.5 font-bold tabular-nums text-foreground">{cfg.cooldown_seconds} sn</p>
                </div>
                <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2.5 dark:border-emerald-800/50 sm:col-span-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">İzinli reklam birimi</span>
                  <p className="mt-1 break-all font-medium text-sm text-foreground">
                    {cfg.allowed_ad_unit_ids?.length ? cfg.allowed_ad_unit_ids.join(', ') : 'Kısıt yok (tüm birimler)'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 via-card to-violet-500/5 shadow-sm dark:border-primary/25">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="size-4 text-primary" aria-hidden />
                Geliştirici notu
              </CardTitle>
              <p className="text-xs text-muted-foreground">AdMob SSV geri çağrı adresi</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              <code className="block break-all rounded-lg border border-border/60 bg-muted/40 px-2 py-2 text-[11px] leading-relaxed sm:text-xs">
                {ssvUrl}
              </code>
              <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                İstemci: ödül doğrulamasında kullanıcı olarak{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">öğretmen kullanıcı ID</code> gönderilir.
                Yerleşim anahtarı örneği:{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">market_rewarded_jeton</code>.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
