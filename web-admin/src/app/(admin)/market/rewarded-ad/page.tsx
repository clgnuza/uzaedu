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
    <div className="market-page space-y-3 pb-4 sm:space-y-8 sm:pb-10">
      <div className="relative overflow-hidden rounded-lg border border-violet-400/30 bg-linear-to-br from-violet-500/12 via-fuchsia-500/8 to-violet-600/10 p-2 shadow-md ring-1 ring-violet-500/15 dark:border-violet-500/20 dark:from-violet-950/50 dark:via-fuchsia-950/25 dark:to-violet-950/40 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-fuchsia-400/20 blur-3xl dark:bg-fuchsia-500/10"
          aria-hidden
        />
        <p className="sr-only">
          Reklam izleyerek jeton kazanma: mobil uygulamada geçerli. Bu sayfada bakiye, son kazanımlar ve kurallar yer alır.
        </p>
        <div className="relative flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:min-w-0 sm:flex-1 sm:gap-3">
            <Button variant="ghost" size="sm" className="-ml-1 h-8 shrink-0 px-1.5 text-muted-foreground sm:-ml-2 sm:h-9 sm:px-2" asChild>
              <Link href="/market">
                <ArrowLeft className="mr-0.5 size-3.5 sm:mr-1 sm:size-4" />
                <span className="hidden sm:inline">Cüzdan</span>
                <span className="sm:hidden">Geri</span>
              </Link>
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-md ring-2 ring-white/25 dark:ring-white/10 sm:size-11 sm:rounded-xl">
                <Play className="size-[1.05rem] sm:size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-[13px] font-bold leading-snug tracking-tight text-foreground sm:text-lg sm:leading-tight">
                  Reklam izle · Jeton kazan
                </h1>
                <p className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
                  Mobil uygulama · anında bakiyeye
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-1 sm:ml-auto sm:gap-1.5">
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
              className="h-8 shrink-0 border-violet-500/35 px-2 sm:h-9 sm:px-3"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCw className={cn('size-3.5 sm:mr-1.5 sm:size-4', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Yenile</span>
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 sm:py-16">
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

          <div className="grid gap-2 sm:gap-4 lg:grid-cols-2">
            <Card className="overflow-hidden border-2 border-amber-400/35 bg-linear-to-br from-amber-500/12 via-card to-orange-500/8 shadow-md ring-1 ring-amber-500/15 dark:border-amber-800/45">
              <CardHeader className="border-b border-amber-500/20 bg-amber-500/8 px-3 py-2 sm:px-6 sm:pb-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                <CardTitle className="flex items-center gap-1.5 text-sm sm:gap-2 sm:text-lg">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/25 text-amber-900 sm:size-9 dark:text-amber-100">
                    <Coins className="size-4 sm:size-5" aria-hidden />
                  </span>
                  Jeton bakiyesi
                </CardTitle>
                <p className="text-[10px] text-muted-foreground sm:text-xs">Bireysel cüzdan</p>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
                <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                  {jeton != null ? fmtNum(jeton) : '—'}
                </p>
                <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground sm:mt-2 sm:text-xs sm:leading-relaxed">
                  Ödüller sunucu doğrulaması (SSV) ile kısa sürede cüzdana işlenir.
                </p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-2 border-violet-400/35 bg-linear-to-br from-violet-500/10 via-card to-fuchsia-500/8 shadow-md ring-1 ring-violet-500/15 dark:border-violet-800/45">
              <CardHeader className="border-b border-violet-500/20 bg-violet-500/8 px-3 py-2 sm:px-6 sm:pb-3 dark:border-violet-900/40 dark:bg-violet-950/35">
                <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                  <CardTitle className="flex min-w-0 items-center gap-1.5 text-sm sm:gap-2 sm:text-lg">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-violet-500/25 text-violet-900 sm:size-9 dark:text-violet-100">
                      <Smartphone className="size-4 sm:size-5" aria-hidden />
                    </span>
                    Nasıl kazanılır?
                  </CardTitle>
                  <InfoHintDialog label="Reklam izle · Jeton kazan" title="Nasıl kazanılır?">
                    <p>Reklamlar yalnızca mobil uygulamada oynatılır; tarayıcıdan izlenmez.</p>
                    <p className="mt-2">Ödül, reklamı tamamladığınızda sunucuya bildirilir ve jeton eklenir.</p>
                  </InfoHintDialog>
                </div>
                <p className="text-[10px] text-muted-foreground sm:text-xs">Uzaedu Öğretmen iOS veya Android</p>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3 pt-3 text-xs text-muted-foreground sm:space-y-3 sm:px-6 sm:pb-6 sm:pt-4 sm:text-sm">
                <ol className="list-decimal space-y-1 pl-4 text-foreground/90 sm:space-y-2 sm:pl-5">
                  <li>Uygulamayı açın (bu hesapla giriş yapın).</li>
                  <li>Market veya jeton bölümünden ödüllü reklamı seçin.</li>
                  <li>Reklamı sonuna kadar izleyin; jeton kısa sürede eklenir.</li>
                </ol>
                <div className="flex flex-wrap gap-1.5 pt-0.5 sm:gap-2 sm:pt-1">
                  {storeIos ? (
                    <Button variant="outline" size="sm" className="h-8 border-violet-500/30 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" asChild>
                      <a href={storeIos} target="_blank" rel="noreferrer">
                        App Store <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {storeAndroid ? (
                    <Button variant="outline" size="sm" className="h-8 border-violet-500/30 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" asChild>
                      <a href={storeAndroid} target="_blank" rel="noreferrer">
                        Google Play <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {!storeIos && !storeAndroid ? (
                    <p className="text-xs">Mağaza bağlantıları ayarlı değil; uygulama mağazasından «Uzaedu Öğretmen» arayın.</p>
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
              <CardHeader className="border-b border-fuchsia-500/20 bg-linear-to-r from-fuchsia-500/10 to-transparent px-3 py-2 pb-2 dark:from-fuchsia-950/40 sm:px-6 sm:pb-3">
                <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm sm:gap-2 sm:text-base">
                    <Sparkles className="size-4 text-fuchsia-600 sm:size-5 dark:text-fuchsia-400" aria-hidden />
                    Son kazanımlar
                  </CardTitle>
                  <span className="rounded-full border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2 sm:text-[10px]">
                    {history.total} kayıt
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground sm:text-xs">Reklamdan eklenen jetonlar</p>
              </CardHeader>
              <CardContent className="table-x-scroll p-0">
                <table className="w-full min-w-[260px] text-xs sm:min-w-[280px] sm:text-sm">
                  <thead>
                    <tr className="border-b border-fuchsia-500/20 bg-fuchsia-500/10 text-left text-[9px] font-semibold uppercase tracking-wide text-fuchsia-950 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-100 sm:text-[11px]">
                      <th className="px-2 py-1.5 sm:px-4 sm:py-2.5">Tarih</th>
                      <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2.5">Jeton</th>
                      <th className="px-2 py-1.5 sm:px-4 sm:py-2.5">Birim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50 bg-card">
                    {history.items.map((row) => (
                      <tr key={row.id} className="transition-colors hover:bg-fuchsia-500/5">
                        <td className="whitespace-nowrap px-2 py-1.5 text-[10px] text-muted-foreground sm:px-4 sm:py-2 sm:text-sm">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString('tr-TR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="px-1.5 py-1.5 text-right text-sm font-semibold tabular-nums text-emerald-700 sm:px-2 sm:py-2 sm:text-base dark:text-emerald-400">
                          +{fmtNum(parseFloat(row.jeton_credit || '0'))}
                        </td>
                        <td className="max-w-[min(11rem,38vw)] truncate px-2 py-1.5 font-mono text-[10px] text-muted-foreground sm:max-w-xs sm:px-4 sm:py-2 sm:text-xs">
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
              <CardHeader className="border-b border-emerald-500/20 bg-emerald-500/8 px-3 py-2 pb-2 dark:border-emerald-900/40 dark:bg-emerald-950/30 sm:px-6 sm:pb-3">
                <CardTitle className="text-sm sm:text-lg">Geçerli kurallar</CardTitle>
                <p className="text-[10px] text-muted-foreground sm:text-xs">Üst sınırlar ve ödül tutarı</p>
              </CardHeader>
              <CardContent className="grid gap-1.5 px-3 pb-3 pt-3 sm:grid-cols-2 sm:gap-2 sm:px-6 sm:pb-6 sm:pt-4">
                <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-2 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-amber-800/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ödül başına</span>
                  <p className="mt-0.5 font-bold tabular-nums text-foreground">{fmtNum(cfg.jeton_per_reward)} jeton</p>
                </div>
                <div className="rounded-lg border border-sky-400/35 bg-sky-500/10 px-2.5 py-2 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-sky-800/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Günlük üst sınır</span>
                  <p className="mt-0.5 font-bold tabular-nums text-foreground">{cfg.max_rewards_per_day} ödül</p>
                </div>
                <div className="rounded-lg border border-violet-400/35 bg-violet-500/10 px-2.5 py-2 sm:rounded-xl sm:px-3 sm:py-2.5 dark:border-violet-800/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bekleme süresi</span>
                  <p className="mt-0.5 font-bold tabular-nums text-foreground">{cfg.cooldown_seconds} sn</p>
                </div>
                <div className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-2 dark:border-emerald-800/50 sm:col-span-2 sm:rounded-xl sm:px-3 sm:py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">İzinli reklam birimi</span>
                  <p className="mt-1 break-all font-medium text-sm text-foreground">
                    {cfg.allowed_ad_unit_ids?.length ? cfg.allowed_ad_unit_ids.join(', ') : 'Kısıt yok (tüm birimler)'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="overflow-hidden border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 via-card to-violet-500/5 shadow-sm dark:border-primary/25">
            <CardHeader className="border-b border-border/50 px-3 py-2 pb-2 sm:px-6 sm:pb-3">
              <CardTitle className="flex items-center gap-1.5 text-sm sm:gap-2 sm:text-base">
                <Play className="size-3.5 text-primary sm:size-4" aria-hidden />
                Geliştirici notu
              </CardTitle>
              <p className="text-[10px] text-muted-foreground sm:text-xs">AdMob SSV geri çağrı adresi</p>
            </CardHeader>
            <CardContent className="space-y-1.5 px-3 pb-3 pt-2 sm:space-y-2 sm:px-6 sm:pb-6">
              <code className="block break-all rounded-md border border-border/60 bg-muted/40 px-1.5 py-1.5 text-[10px] leading-snug sm:rounded-lg sm:px-2 sm:py-2 sm:text-xs sm:leading-relaxed">
                {ssvUrl}
              </code>
              <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">
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
