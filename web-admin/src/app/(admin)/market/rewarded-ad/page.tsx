'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { ArrowLeft, Coins, ExternalLink, Play, Smartphone, Wallet } from 'lucide-react';

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
    <div className="space-y-6 pb-10">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2 h-8 px-2" asChild>
              <Link href="/market">
                <ArrowLeft className="mr-1 size-4" />
                Market
              </Link>
            </Button>
            <span className="text-muted-foreground">/</span>
            <span>Ödüllü reklamla jeton</span>
          </ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Mobil ödüllü reklam', icon: Smartphone },
              { label: 'Jeton', icon: Coins },
              { label: 'Bakiye / kılavuz', icon: Wallet },
            ]}
            summary="Jeton kazanımı mobil uygulamada AdMob ödüllü reklam ile yapılır; bu sayfa kuralları ve bakiyenizi gösterir."
          />
        </ToolbarHeading>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          Yenile
        </Button>
      </Toolbar>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {!cfg?.enabled ? (
            <Alert variant="warning" message="Ödüllü reklamla jeton şu an kapalı. Yönetim etkinleştirdiğinde mobil uygulamada Market bölümünden kullanılabilir." />
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/[0.08] to-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Coins className="size-5 text-amber-600" />
                  Jeton bakiyeniz
                </CardTitle>
                <CardDescription>Bireysel market cüzdanı (öğretmen)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-foreground">{jeton != null ? fmtNum(jeton) : '—'}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Ödüllü reklam ödülleri sunucu doğrulaması (SSV) ile birkaç saniye içinde eklenir.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Smartphone className="size-5 text-primary" />
                  Nasıl kazanılır?
                </CardTitle>
                <CardDescription>Mobil uygulama gerekir (tarayıcıdan reklam izlenmez)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <ol className="list-decimal space-y-2 pl-5">
                  <li>iOS veya Android Öğretmen Pro uygulamasını açın.</li>
                  <li>Giriş yapın (bu hesapla aynı).</li>
                  <li>Market veya jeton bölümünde ödüllü reklam seçeneğini kullanın.</li>
                  <li>Reklamı sonuna kadar izleyin; ödül sunucuya bildirilir ve jeton eklenir.</li>
                </ol>
                <div className="flex flex-wrap gap-2 pt-2">
                  {storeIos ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={storeIos} target="_blank" rel="noreferrer">
                        App Store <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {storeAndroid ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={storeAndroid} target="_blank" rel="noreferrer">
                        Google Play <ExternalLink className="ml-1 size-3" />
                      </a>
                    </Button>
                  ) : null}
                  {!storeIos && !storeAndroid ? (
                    <p className="text-xs">Mağaza bağlantıları yapılandırılmamış; uygulama mağazasından arayın.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {history && history.items.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Son ödüllü reklam kazanımları</CardTitle>
                <CardDescription>Toplam kayıt: {history.total}</CardDescription>
              </CardHeader>
              <CardContent className="table-x-scroll p-0">
                <table className="w-full min-w-[360px] text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30 text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2">Tarih</th>
                      <th className="px-2 py-2 text-right">Jeton</th>
                      <th className="px-4 py-2">Ad unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {history.items.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString('tr-TR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">
                          {fmtNum(parseFloat(row.jeton_credit || '0'))}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2 font-mono text-xs text-muted-foreground">
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Geçerli kurallar</CardTitle>
                <CardDescription>Kamu politika: GET /api/content/market-policy → rewarded_ad_jeton</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Ödül başına jeton</span>
                  <p className="font-semibold tabular-nums">{fmtNum(cfg.jeton_per_reward)}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Günlük üst sınır</span>
                  <p className="font-semibold tabular-nums">{cfg.max_rewards_per_day} ödül</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-xs text-muted-foreground">İki ödül arası minimum süre</span>
                  <p className="font-semibold tabular-nums">{cfg.cooldown_seconds} sn</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Kısıtlı ad unit</span>
                  <p className="font-medium break-all">
                    {cfg.allowed_ad_unit_ids?.length ? cfg.allowed_ad_unit_ids.join(', ') : 'Tümü (kısıt yok)'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Play className="size-4" />
                Teknik (geliştirici)
              </CardTitle>
              <CardDescription>AdMob konsolda SSV callback URL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <code className="block break-all rounded bg-muted px-2 py-2 text-xs">{ssvUrl}</code>
              <p className="text-xs text-muted-foreground">
                Mobil istemci: RewardedAd yüklenirken{' '}
                <code className="rounded bg-muted px-1">ServerSideVerificationOptions.setUserId(öğretmen UUID)</code>.
                Reklam kaydı için admin reklamlarda placement örneği:{' '}
                <code className="rounded bg-muted px-1">market_rewarded_jeton</code>.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
