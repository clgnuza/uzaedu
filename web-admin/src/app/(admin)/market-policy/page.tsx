'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import {
  Building2,
  Coins,
  ExternalLink,
  Shield,
  ShoppingBag,
  Plus,
  Trash2,
  UserRound,
  BarChart3,
  RefreshCw,
  ListTree,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Smartphone,
} from 'lucide-react';
import {
  SCHOOL_MODULE_KEYS,
  SCHOOL_MODULE_LABELS,
  SCHOOL_MODULE_MARKET_HINTS,
  type SchoolModuleKey,
} from '@/config/school-modules';
import { cn } from '@/lib/utils';
import { WEB_SETTINGS_TEXTAREA } from '@/components/web-settings/web-settings-shell';

type CurrencyPair = { jeton: number; ekders: number };
type ModuleScopeUsage = { monthly: CurrencyPair; yearly: CurrencyPair };
type ModuleEntryNotice = {
  notice_tr: string | null;
  notice_en: string | null;
  market_href: string | null;
  cta_market_tr: string | null;
  cta_market_en: string | null;
  purchase_href: string | null;
  cta_purchase_tr: string | null;
  cta_purchase_en: string | null;
};
type ModuleRow = { school: ModuleScopeUsage; teacher: ModuleScopeUsage; entry_notice: ModuleEntryNotice };

function emptyModuleRow(): ModuleRow {
  const z = (): CurrencyPair => ({ jeton: 0, ekders: 0 });
  return {
    school: { monthly: z(), yearly: z() },
    teacher: { monthly: z(), yearly: z() },
    entry_notice: {
      notice_tr: null,
      notice_en: null,
      market_href: null,
      cta_market_tr: null,
      cta_market_en: null,
      purchase_href: null,
      cta_purchase_tr: null,
      cta_purchase_en: null,
    },
  };
}
type IapPack = { product_id: string; amount: number; label?: string | null };
type IapSide = { jeton: IapPack[]; ekders: IapPack[] };

type MarketStoreCompliance = {
  purchase_disclosure_tr: string | null;
  purchase_disclosure_en: string | null;
  refunds_and_support_note: string | null;
};

type MarketSubscriptionUrls = {
  android_play_subscriptions_help_url: string | null;
  android_manage_play_subscriptions_url: string | null;
  apple_manage_subscriptions_url: string | null;
  apple_subscription_terms_note: string | null;
};

type MarketMinorPrivacy = {
  not_targeting_children_note: string | null;
  parental_consent_note: string | null;
};

type MarketRewardedAdJetonConfig = {
  enabled: boolean;
  jeton_per_reward: number;
  max_rewards_per_day: number;
  cooldown_seconds: number;
  allowed_ad_unit_ids: string[];
};

type MarketPolicyConfig = {
  cache_ttl_market_policy: number;
  module_prices: Record<string, ModuleRow>;
  iap_android: IapSide;
  iap_ios: IapSide;
  store_compliance: MarketStoreCompliance;
  subscription_urls: MarketSubscriptionUrls;
  minor_privacy: MarketMinorPrivacy;
  rewarded_ad_jeton: MarketRewardedAdJetonConfig;
};

type WalletSplit = { user: CurrencyPair; school: CurrencyPair };

type PlatformAdminSummary = {
  period_labels: { month: string; year: string };
  purchases: { month: WalletSplit; year: WalletSplit };
  consumption: { month: WalletSplit; year: WalletSplit };
};

function fmtStat(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n);
}

type AdminConsumptionRow = {
  id: string;
  user_id: string;
  school_id: string | null;
  module_key: string;
  jeton_debit: string;
  ekders_debit: string;
  debit_target: string;
  created_at: string | null;
};

const LEDGER_PAGE_SIZE = 15;

function moduleLabel(key: string): string {
  return key in SCHOOL_MODULE_LABELS ? SCHOOL_MODULE_LABELS[key as SchoolModuleKey] : key;
}

function parseDebit(s: string | undefined): number {
  const n = parseFloat(String(s ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function fmtLedgerDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

const emptyIap = (): IapSide => ({ jeton: [], ekders: [] });

const RATIO_MAX = 1_000_000_000;
function roundRatio(n: number): number {
  return Math.round(Math.min(RATIO_MAX, Math.max(0, n)) * 1e6) / 1e6;
}
function parseRatioInput(raw: string): number {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-' || t === '.' || t === '-.') return 0;
  const x = parseFloat(t);
  if (Number.isNaN(x)) return 0;
  return roundRatio(x);
}

function PriceInput(props: {
  id?: string;
  value: number;
  onChange: (raw: string) => void;
  className?: string;
  max?: number;
}) {
  return (
    <Input
      id={props.id}
      className={cn('h-9 min-w-[5.5rem] font-medium tabular-nums', props.className)}
      type="number"
      inputMode="decimal"
      min={0}
      max={props.max}
      step="any"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export default function MarketPolicyPage() {
  const { token, me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<MarketPolicyConfig | null>(null);
  const [adminStats, setAdminStats] = useState<PlatformAdminSummary | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [consumptionLedger, setConsumptionLedger] = useState<{
    total: number;
    items: AdminConsumptionRow[];
  } | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const canEdit = me?.role === 'superadmin' || me?.role === 'moderator';

  const loadConsumptionLedger = useCallback(async () => {
    if (!token || !canEdit) return;
    setLedgerLoading(true);
    try {
      const r = await apiFetch<{ total: number; items: AdminConsumptionRow[] }>(
        `/market/admin/consumption-ledger?page=${ledgerPage}&limit=${LEDGER_PAGE_SIZE}`,
        { token },
      );
      setConsumptionLedger({ total: r.total, items: Array.isArray(r.items) ? r.items : [] });
    } catch {
      setConsumptionLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  }, [token, canEdit, ledgerPage]);

  const loadStats = useCallback(async () => {
    if (!token || !canEdit) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const s = await apiFetch<PlatformAdminSummary>('/market/admin/summary', { token });
      setAdminStats(s);
    } catch {
      setAdminStats(null);
      setStatsError('İstatistik yüklenemedi. Oturum veya market_policy yetkisini kontrol edin.');
    } finally {
      setStatsLoading(false);
    }
  }, [token, canEdit]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<MarketPolicyConfig>('/app-config/market-policy', { token });
      setCfg({
        ...data,
        store_compliance: data.store_compliance ?? {
          purchase_disclosure_tr: null,
          purchase_disclosure_en: null,
          refunds_and_support_note: null,
        },
        subscription_urls: data.subscription_urls ?? {
          android_play_subscriptions_help_url: null,
          android_manage_play_subscriptions_url: null,
          apple_manage_subscriptions_url: null,
          apple_subscription_terms_note: null,
        },
        minor_privacy: data.minor_privacy ?? {
          not_targeting_children_note: null,
          parental_consent_note: null,
        },
        rewarded_ad_jeton: data.rewarded_ad_jeton ?? {
          enabled: false,
          jeton_per_reward: 1,
          max_rewards_per_day: 10,
          cooldown_seconds: 90,
          allowed_ad_unit_ids: [],
        },
      });
    } catch {
      toast.error('Yüklenemedi');
      setCfg(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void loadConsumptionLedger();
  }, [loadConsumptionLedger]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const setPair = (
    mod: SchoolModuleKey,
    scope: 'school' | 'teacher',
    period: 'monthly' | 'yearly',
    field: 'jeton' | 'ekders',
    raw: string,
  ) => {
    const n = parseRatioInput(raw);
    setCfg((prev) => {
      if (!prev) return prev;
      const row = prev.module_prices[mod] ?? emptyModuleRow();
      const scopeObj = row[scope];
      const periodObj = scopeObj[period];
      return {
        ...prev,
        module_prices: {
          ...prev.module_prices,
          [mod]: {
            ...row,
            [scope]: {
              ...scopeObj,
              [period]: { ...periodObj, [field]: n },
            },
          },
        },
      };
    });
  };

  const patchEntryNotice = (mod: SchoolModuleKey, patch: Partial<ModuleEntryNotice>) => {
    setCfg((prev) => {
      if (!prev) return prev;
      const row = prev.module_prices[mod] ?? emptyModuleRow();
      const base = emptyModuleRow().entry_notice;
      const cur = { ...base, ...row.entry_notice };
      return {
        ...prev,
        module_prices: {
          ...prev.module_prices,
          [mod]: {
            ...row,
            entry_notice: { ...cur, ...patch },
          },
        },
      };
    });
  };

  const addPack = (platform: 'iap_android' | 'iap_ios', kind: 'jeton' | 'ekders') => {
    setCfg((prev) => {
      if (!prev) return prev;
      const side = prev[platform];
      return {
        ...prev,
        [platform]: {
          ...side,
          [kind]: [...side[kind], { product_id: '', amount: 0, label: '' }],
        },
      };
    });
  };

  const setPack = (
    platform: 'iap_android' | 'iap_ios',
    kind: 'jeton' | 'ekders',
    index: number,
    patch: Partial<IapPack>
  ) => {
    setCfg((prev) => {
      if (!prev) return prev;
      const side = prev[platform];
      const list = [...side[kind]];
      list[index] = { ...list[index], ...patch };
      return {
        ...prev,
        [platform]: { ...side, [kind]: list },
      };
    });
  };

  const removePack = (platform: 'iap_android' | 'iap_ios', kind: 'jeton' | 'ekders', index: number) => {
    setCfg((prev) => {
      if (!prev) return prev;
      const side = prev[platform];
      return {
        ...prev,
        [platform]: {
          ...side,
          [kind]: side[kind].filter((_, i) => i !== index),
        },
      };
    });
  };

  const setCompliance = (patch: Partial<MarketStoreCompliance>) => {
    setCfg((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        store_compliance: { ...prev.store_compliance, ...patch },
      };
    });
  };

  const setSubscriptionUrls = (patch: Partial<MarketSubscriptionUrls>) => {
    setCfg((prev) => {
      if (!prev) return prev;
      return { ...prev, subscription_urls: { ...prev.subscription_urls, ...patch } };
    });
  };

  const setMinorPrivacy = (patch: Partial<MarketMinorPrivacy>) => {
    setCfg((prev) => {
      if (!prev) return prev;
      return { ...prev, minor_privacy: { ...prev.minor_privacy, ...patch } };
    });
  };

  const save = async () => {
    if (!token || !cfg) return;
    setSaving(true);
    try {
      await apiFetch('/app-config/market-policy', {
        method: 'PATCH',
        token,
        body: JSON.stringify(cfg),
      });
      toast.success('Kaydedildi');
      load();
      void loadStats();
      void loadConsumptionLedger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="space-y-6">
        <Alert message="Bu sayfa için yetkiniz yok." />
      </div>
    );
  }

  if (loading || !cfg) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const modPrices = cfg.module_prices ?? {};

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Market Politikası</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Okul tarafı', icon: Building2 },
              { label: 'Öğretmen tarafı', icon: UserRound },
              { label: 'Jeton / ek ders', icon: Coins },
              { label: 'Aylık / yıllık', icon: Calendar },
              { label: 'Mobil satın alma', icon: Smartphone },
              { label: 'Mağaza', icon: ShoppingBag },
            ]}
            summary="Modül tarifeleri; giriş paneli (metin, Market ve mağaza yönlendirmesi); mobil IAP ürünleri. Kayıt 6 ondalık. Sunucu varsayılan aylık tarife kullanır."
          />
        </ToolbarHeading>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void loadStats();
              void loadConsumptionLedger();
            }}
            disabled={statsLoading || ledgerLoading}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', (statsLoading || ledgerLoading) && 'animate-spin')} />
            İstatistik yenile
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </Toolbar>

      <Card className="overflow-hidden border-violet-200/60 shadow-sm dark:border-violet-900/40">
        <CardHeader className="border-b border-border/60 bg-violet-50/40 dark:bg-violet-950/25">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-violet-700 dark:text-violet-400" />
            Platform satın alma &amp; tüketim (aylık / yıllık)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Satın alma:</span> IAP doğrulaması sonrası bakiyeye eklenen
            jeton/ek ders. <span className="font-medium text-foreground">Tüketim:</span> modül kullanımında cüzdandan
            düşen toplamlar. Dönemler UTC. Kullanıcı tarafı için{' '}
            <Link href="/market" className="font-medium text-primary underline-offset-4 hover:underline">
              Market / Cüzdan
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {statsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-40 animate-pulse rounded-xl bg-muted md:col-span-1" />
              <div className="h-40 animate-pulse rounded-xl bg-muted md:col-span-1" />
            </div>
          ) : statsError ? (
            <Alert message={statsError} />
          ) : adminStats ? (
            <div className="grid gap-6 md:grid-cols-2">
              {(['month', 'year'] as const).map((key) => {
                const label = key === 'month' ? adminStats.period_labels.month : adminStats.period_labels.year;
                const title = key === 'month' ? 'Bu ay' : 'Bu yıl';
                const p = adminStats.purchases[key];
                const c = adminStats.consumption[key];
                return (
                  <div key={key} className="rounded-xl border border-border/70 bg-muted/15 p-4">
                    <p className="text-sm font-semibold text-foreground">
                      {title}{' '}
                      <span className="font-normal text-muted-foreground">({label})</span>
                    </p>
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Satın alma → bakiye
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-emerald-500/10 px-2 py-1.5">
                            <span className="text-xs text-muted-foreground">Öğretmen</span>
                            <div className="font-mono text-xs tabular-nums">
                              J {fmtStat(p.user.jeton)} · E {fmtStat(p.user.ekders)}
                            </div>
                          </div>
                          <div className="rounded-md bg-blue-500/10 px-2 py-1.5">
                            <span className="text-xs text-muted-foreground">Okul</span>
                            <div className="font-mono text-xs tabular-nums">
                              J {fmtStat(p.school.jeton)} · E {fmtStat(p.school.ekders)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Modül tüketimi
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-emerald-500/10 px-2 py-1.5">
                            <span className="text-xs text-muted-foreground">Bireysel cüzdan</span>
                            <div className="font-mono text-xs tabular-nums">
                              J {fmtStat(c.user.jeton)} · E {fmtStat(c.user.ekders)}
                            </div>
                          </div>
                          <div className="rounded-md bg-blue-500/10 px-2 py-1.5">
                            <span className="text-xs text-muted-foreground">Okul cüzdanı</span>
                            <div className="font-mono text-xs tabular-nums">
                              J {fmtStat(c.school.jeton)} · E {fmtStat(c.school.ekders)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Özet verisi yok.</p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTree className="h-5 w-5 text-muted-foreground" />
            Platform modül tüketim günlüğü
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Tüm kullanıcı/okul cüzdanından düşen son işlemler (sayfalı). Kullanıcı kimliği kısaltılmıştır; tam ID için
            veritabanı veya kullanıcılar ekranı.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {ledgerLoading ? (
            <div className="p-6">
              <div className="h-36 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : consumptionLedger && consumptionLedger.items.length > 0 ? (
            <>
              <div className="table-x-scroll">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Tarih</th>
                      <th className="px-4 py-3">Modül</th>
                      <th className="px-4 py-3">Hedef</th>
                      <th className="px-4 py-3">Kullanıcı</th>
                      <th className="px-4 py-3 text-right">Jeton</th>
                      <th className="px-4 py-3 text-right">Ek ders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {consumptionLedger.items.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {fmtLedgerDate(row.created_at)}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{moduleLabel(row.module_key)}</td>
                        <td className="px-4 py-2.5">
                          {row.debit_target === 'school' ? (
                            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
                              Okul
                            </span>
                          ) : (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">Bireysel</span>
                          )}
                        </td>
                        <td className="max-w-[120px] truncate px-4 py-2.5 font-mono text-xs text-muted-foreground" title={row.user_id}>
                          {shortId(row.user_id)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtStat(parseDebit(row.jeton_debit))}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{fmtStat(parseDebit(row.ekders_debit))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Toplam {consumptionLedger.total} kayıt · Sayfa {ledgerPage} /{' '}
                  {Math.max(1, Math.ceil(consumptionLedger.total / LEDGER_PAGE_SIZE))}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ledgerPage <= 1}
                    onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Önceki
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ledgerPage >= Math.max(1, Math.ceil(consumptionLedger.total / LEDGER_PAGE_SIZE))}
                    onClick={() => setLedgerPage((p) => p + 1)}
                  >
                    Sonraki
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Henüz modül tüketim kaydı yok veya liste yüklenemedi.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={cn(
            'rounded-xl border-2 border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900 dark:bg-blue-950/40',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-blue-950 dark:text-blue-50">Okul satın alma</h2>
              <p className="mt-1 text-sm leading-relaxed text-blue-900/90 dark:text-blue-100/90">
                <span className="font-medium">Okul yöneticisi (school_admin)</span> kurumsal özelliği açarken veya
                ödeme yaparken geçerli maliyet. Okul jetonu / okul ek ders havuzu üzerinden faturalandırma.
              </p>
            </div>
          </div>
        </div>
        <div
          className={cn(
            'rounded-xl border-2 border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/40',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white dark:bg-emerald-500">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-50">Öğretmen satın alma</h2>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900/90 dark:text-emerald-100/90">
                <span className="font-medium">Öğretmen (teacher)</span> kendi hesabından modül/hak satın alırken veya
                kullanım başına kesinti yapılırken geçerli maliyet. Bireysel jeton ve ek ders bakiyesi.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-amber-200/80 dark:border-amber-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-amber-700 dark:text-amber-500" />
            Mağaza uyumu (Google Play / Apple App Store)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Aşağıdaki metinler <code className="rounded bg-muted px-1">GET /content/market-policy</code> ile mobil
            uygulamaya gider; satın alma ve hesap ekranlarında gösterin. Bu panel hukuki danışmanlık değildir.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed">
            <p className="font-medium text-foreground">Kontrol listesi (özet)</p>
            <ul className="mt-2 list-inside list-disc space-y-1.5 text-muted-foreground">
              <li>
                Dijital içerik (jeton, ek ders vb.) için uygulama içinde yalnızca{' '}
                <strong className="text-foreground">Google Play Faturalandırma</strong> ve{' '}
                <strong className="text-foreground">App Store uygulama içi satın alma</strong> kullanın; mağaza
                kurallarına aykırı harici ödeme yönlendirmesinden kaçının.
              </li>
              <li>
                Satın almadan önce <strong className="text-foreground">fiyat, ne satın alındığı ve koşullar</strong> net
                olmalı; yanıltıcı veya eksik bilgi vermeyin.
              </li>
              <li>
                Gizlilik ve şartlar için{' '}
                <Link href="/web-ayarlar" className="font-medium text-primary underline underline-offset-2">
                  Web Ayarları → Mobil uygulama
                </Link>{' '}
                bölümündeki <code className="rounded bg-muted px-1">privacy_policy_url</code>,{' '}
                <code className="rounded bg-muted px-1">terms_url</code> alanlarını doldurun; uygulama içi metinlerle
                tutarlı olsun.
              </li>
              <li>İade, abonelik veya tüketilebilir ürünler için mağaza süreçlerine uygun destek / iletişim bilgisi verin.</li>
            </ul>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <a
                href="https://support.google.com/googleplay/android-developer/answer/9858738?hl=tr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Google Play — faturalandırma
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://play.google.com/about/developer-content-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Google Play — içerik politikaları
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://developer.apple.com/app-store/review/guidelines/#payments"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                App Store İnceleme — ödemeler (3.1)
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disc-tr">Satın alma bilgilendirmesi (Türkçe)</Label>
            <textarea
              id="disc-tr"
              className={WEB_SETTINGS_TEXTAREA}
              rows={4}
              placeholder="Örn: Fiyatlar TL cinsinden; jeton sanal bakiyedir, iade koşulları App Store / Google Play kurallarına tabidir…"
              value={cfg.store_compliance.purchase_disclosure_tr ?? ''}
              onChange={(e) =>
                setCompliance({
                  purchase_disclosure_tr: e.target.value.length ? e.target.value : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disc-en">Satın alma bilgilendirmesi (İngilizce, isteğe bağlı)</Label>
            <textarea
              id="disc-en"
              className={WEB_SETTINGS_TEXTAREA}
              rows={4}
              placeholder="Short disclosure for EN locale…"
              value={cfg.store_compliance.purchase_disclosure_en ?? ''}
              onChange={(e) =>
                setCompliance({
                  purchase_disclosure_en: e.target.value.length ? e.target.value : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="refund">İade, iptal ve destek özeti</Label>
            <textarea
              id="refund"
              className={WEB_SETTINGS_TEXTAREA}
              rows={3}
              placeholder="Kullanıcıların mağaza üzerinden iade başvurusu yapabileceği, destek e-postası veya iç destek bağlantısı…"
              value={cfg.store_compliance.refunds_and_support_note ?? ''}
              onChange={(e) =>
                setCompliance({
                  refunds_and_support_note: e.target.value.length ? e.target.value : null,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Abonelik yönetimi (mağaza bağlantıları)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Abonelik satıyorsanız kullanıcıya iptal / yönetim bağlantıları gösterin. URL alanları yalnızca{' '}
            <strong className="text-foreground">https://</strong> ile kaydedilir.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="sub-help">Google Play — abonelik yardım (https)</Label>
            <Input
              id="sub-help"
              type="url"
              placeholder="https://support.google.com/googleplay/answer/7018481"
              value={cfg.subscription_urls.android_play_subscriptions_help_url ?? ''}
              onChange={(e) =>
                setSubscriptionUrls({
                  android_play_subscriptions_help_url: e.target.value.trim() || null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-manage-gp">Google Play — abonelikleri yönet</Label>
            <Input
              id="sub-manage-gp"
              type="url"
              placeholder="https://play.google.com/store/account/subscriptions"
              value={cfg.subscription_urls.android_manage_play_subscriptions_url ?? ''}
              onChange={(e) =>
                setSubscriptionUrls({
                  android_manage_play_subscriptions_url: e.target.value.trim() || null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub-apple">Apple — abonelikleri yönet (https)</Label>
            <Input
              id="sub-apple"
              type="url"
              placeholder="https://apps.apple.com/account/subscriptions"
              value={cfg.subscription_urls.apple_manage_subscriptions_url ?? ''}
              onChange={(e) =>
                setSubscriptionUrls({ apple_manage_subscriptions_url: e.target.value.trim() || null })
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="sub-terms-apple">Apple abonelik koşulları (kısa not)</Label>
            <textarea
              id="sub-terms-apple"
              className={WEB_SETTINGS_TEXTAREA}
              rows={2}
              value={cfg.subscription_urls.apple_subscription_terms_note ?? ''}
              onChange={(e) =>
                setSubscriptionUrls({
                  apple_subscription_terms_note: e.target.value.length ? e.target.value : null,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Çocuklar ve KVKK (uygulama metni)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hedef kitle ve veli onayı stratejinize göre doldurun; mobilde gösterilecek metinlerdir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="minor-1">Çocuklara yönelik olmayan / yaş sınırı beyanı</Label>
            <textarea
              id="minor-1"
              className={WEB_SETTINGS_TEXTAREA}
              rows={3}
              placeholder="Örn: Bu uygulama 13 yaş altı çocuklara yönelik değildir…"
              value={cfg.minor_privacy.not_targeting_children_note ?? ''}
              onChange={(e) =>
                setMinorPrivacy({
                  not_targeting_children_note: e.target.value.length ? e.target.value : null,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minor-2">Veli onayı / reşit olmayan kullanım (varsa)</Label>
            <textarea
              id="minor-2"
              className={WEB_SETTINGS_TEXTAREA}
              rows={3}
              value={cfg.minor_privacy.parental_consent_note ?? ''}
              onChange={(e) =>
                setMinorPrivacy({ parental_consent_note: e.target.value.length ? e.target.value : null })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShoppingBag className="h-5 w-5" />
            Önbellek (public API)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="ttl">GET /content/market-policy max-age (sn)</Label>
            <Input
              id="ttl"
              type="number"
              min={10}
              max={86400}
              className="w-40"
              value={cfg.cache_ttl_market_policy}
              onChange={(e) =>
                setCfg((c) =>
                  c ? { ...c, cache_ttl_market_policy: parseInt(e.target.value, 10) || 120 } : c,
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <CardTitle className="text-lg">Modül kullanım maliyetleri (aylık / yıllık)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Okul cüzdanı veya öğretmen hesabından her kullanımda düşülecek jeton / ek ders. Aylık ve yıllık tarifeler
            ayrı; API tarafında varsayılan aylık tarife kullanılır.
          </p>
        </CardHeader>
        <CardContent className="table-x-scroll px-0 sm:px-0">
          <div className="rounded-none border-y border-border/60 bg-card sm:mx-4 sm:my-4 sm:rounded-xl sm:border sm:shadow-inner">
          <table className="w-full min-w-[1180px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th
                  className="bg-muted/30 p-2 align-bottom text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  rowSpan={2}
                >
                  Modül
                </th>
                <th
                  className="border-l-2 border-blue-400 bg-blue-100/90 px-2 py-2 text-center text-blue-950 dark:border-blue-600 dark:bg-blue-950/50 dark:text-blue-50"
                  colSpan={4}
                >
                  <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold">
                    <Building2 className="h-4 w-4 shrink-0" />
                    Okul — kullanım
                  </span>
                  <div className="mt-1 text-[11px] font-normal opacity-90">school_admin · kurumsal cüzdan</div>
                </th>
                <th
                  className="border-l-2 border-emerald-400 bg-emerald-100/90 px-2 py-2 text-center text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-50"
                  colSpan={4}
                >
                  <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold">
                    <UserRound className="h-4 w-4 shrink-0" />
                    Öğretmen — kullanım
                  </span>
                  <div className="mt-1 text-[11px] font-normal opacity-90">teacher · bireysel hesap</div>
                </th>
              </tr>
              <tr className="border-b border-border text-[11px] text-muted-foreground">
                <th className="border-l-2 border-blue-400 bg-blue-50/80 px-1 py-1.5 font-medium dark:border-blue-600 dark:bg-blue-950/30">
                  <span className="inline-flex items-center gap-0.5">
                    <Coins className="h-3 w-3" />
                    Aylık jeton
                  </span>
                </th>
                <th className="bg-blue-50/80 px-1 py-1.5 font-medium dark:bg-blue-950/30">Aylık ek ders</th>
                <th className="bg-blue-50/80 px-1 py-1.5 font-medium dark:bg-blue-950/30">
                  <span className="inline-flex items-center gap-0.5">
                    <Coins className="h-3 w-3" />
                    Yıllık jeton
                  </span>
                </th>
                <th className="bg-blue-50/80 px-1 py-1.5 font-medium dark:bg-blue-950/30">Yıllık ek ders</th>
                <th className="border-l-2 border-emerald-400 bg-emerald-50/80 px-1 py-1.5 font-medium dark:border-emerald-600 dark:bg-emerald-950/30">
                  <span className="inline-flex items-center gap-0.5">
                    <Coins className="h-3 w-3" />
                    Aylık jeton
                  </span>
                </th>
                <th className="bg-emerald-50/80 px-1 py-1.5 font-medium dark:bg-emerald-950/30">Aylık ek ders</th>
                <th className="bg-emerald-50/80 px-1 py-1.5 font-medium dark:bg-emerald-950/30">
                  <span className="inline-flex items-center gap-0.5">
                    <Coins className="h-3 w-3" />
                    Yıllık jeton
                  </span>
                </th>
                <th className="bg-emerald-50/80 px-1 py-1.5 font-medium dark:bg-emerald-950/30">Yıllık ek ders</th>
              </tr>
            </thead>
            <tbody>
              {SCHOOL_MODULE_KEYS.map((k) => {
                const row = modPrices[k] ?? emptyModuleRow();
                const hint = SCHOOL_MODULE_MARKET_HINTS[k];
                return (
                  <tr key={k} className="border-b border-border/60 hover:bg-muted/20">
                    <td className="max-w-[200px] p-2">
                      <span className="font-medium leading-snug" title={hint}>
                        {SCHOOL_MODULE_LABELS[k]}
                      </span>
                    </td>
                    <td className="border-l-2 border-blue-200 bg-blue-50/40 p-1 dark:border-blue-800 dark:bg-blue-950/20">
                      <PriceInput
                        value={row.school.monthly.jeton}
                        onChange={(raw) => setPair(k, 'school', 'monthly', 'jeton', raw)}
                      />
                    </td>
                    <td className="bg-blue-50/40 p-1 dark:bg-blue-950/20">
                      <PriceInput
                        value={row.school.monthly.ekders}
                        onChange={(raw) => setPair(k, 'school', 'monthly', 'ekders', raw)}
                      />
                    </td>
                    <td className="bg-blue-50/40 p-1 dark:bg-blue-950/20">
                      <PriceInput
                        value={row.school.yearly.jeton}
                        onChange={(raw) => setPair(k, 'school', 'yearly', 'jeton', raw)}
                      />
                    </td>
                    <td className="bg-blue-50/40 p-1 dark:bg-blue-950/20">
                      <PriceInput
                        value={row.school.yearly.ekders}
                        onChange={(raw) => setPair(k, 'school', 'yearly', 'ekders', raw)}
                      />
                    </td>
                    <td className="border-l-2 border-emerald-200 bg-emerald-50/40 p-1 dark:border-emerald-800 dark:bg-emerald-950/20">
                      <PriceInput
                        value={row.teacher.monthly.jeton}
                        onChange={(raw) => setPair(k, 'teacher', 'monthly', 'jeton', raw)}
                      />
                    </td>
                    <td className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20">
                      <PriceInput
                        value={row.teacher.monthly.ekders}
                        onChange={(raw) => setPair(k, 'teacher', 'monthly', 'ekders', raw)}
                      />
                    </td>
                    <td className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20">
                      <PriceInput
                        value={row.teacher.yearly.jeton}
                        onChange={(raw) => setPair(k, 'teacher', 'yearly', 'jeton', raw)}
                      />
                    </td>
                    <td className="bg-emerald-50/40 p-1 dark:bg-emerald-950/20">
                      <PriceInput
                        value={row.teacher.yearly.ekders}
                        onChange={(raw) => setPair(k, 'teacher', 'yearly', 'ekders', raw)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/10">
          <CardTitle className="text-lg">Modül giriş paneli — metin, yönlendirme, satın alma</CardTitle>
          <p className="text-sm text-muted-foreground">
            Kullanıcı ilgili modül sayfasına girdiğinde geniş bir bilgi kutusu gösterilir: açıklama metni,{' '}
            <span className="font-medium text-foreground">Market / cüzdan</span> butonu ve isteğe bağlı{' '}
            <span className="font-medium text-foreground">harici mağaza</span> bağlantısı. Boş metinlerde tarife
            tanımlıysa varsayılan uyarı kullanılır. İngilizce alanlar EN arayüzde kullanılabilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {SCHOOL_MODULE_KEYS.map((k) => {
            const row = modPrices[k] ?? emptyModuleRow();
            const en = { ...emptyModuleRow().entry_notice, ...row.entry_notice };
            return (
              <div
                key={k}
                className="rounded-xl border border-border/70 bg-linear-to-br from-muted/40 to-card p-4 shadow-sm ring-1 ring-black/3 dark:ring-white/10"
              >
                <p className="mb-4 text-base font-semibold text-foreground">{SCHOOL_MODULE_LABELS[k]}</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`notice-tr-${k}`}>Türkçe açıklama</Label>
                    <textarea
                      id={`notice-tr-${k}`}
                      className={WEB_SETTINGS_TEXTAREA}
                      rows={3}
                      placeholder="Örn: Bu modülde kullanım başına jeton veya ek ders düşebilir. Bakiyenizi Market’ten kontrol edebilirsiniz."
                      value={en.notice_tr ?? ''}
                      onChange={(e) =>
                        patchEntryNotice(k, { notice_tr: e.target.value.trim() ? e.target.value : null })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`notice-en-${k}`}>English (isteğe bağlı)</Label>
                    <textarea
                      id={`notice-en-${k}`}
                      className={WEB_SETTINGS_TEXTAREA}
                      rows={3}
                      placeholder="Short notice for English UI."
                      value={en.notice_en ?? ''}
                      onChange={(e) =>
                        patchEntryNotice(k, { notice_en: e.target.value.trim() ? e.target.value : null })
                      }
                    />
                  </div>
                </div>
                <div className="mt-5 border-t border-border/60 pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Butonlar ve bağlantılar
                  </p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`market-href-${k}`}>Market / cüzdan yolu (web)</Label>
                      <Input
                        id={`market-href-${k}`}
                        placeholder="/market"
                        value={en.market_href ?? ''}
                        onChange={(e) =>
                          patchEntryNotice(k, { market_href: e.target.value.trim() || null })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">Boş bırakılırsa /market kullanılır.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`purchase-href-${k}`}>Mağaza / satın alma URL (https)</Label>
                      <Input
                        id={`purchase-href-${k}`}
                        placeholder="https://play.google.com/store/apps/details?id=..."
                        value={en.purchase_href ?? ''}
                        onChange={(e) =>
                          patchEntryNotice(k, { purchase_href: e.target.value.trim() || null })
                        }
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Doluysa ikinci buton gösterilir. Boşsa kısa mobil mağaza notu çıkar.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor={`cta-m-tr-${k}`}>Market butonu (TR)</Label>
                      <Input
                        id={`cta-m-tr-${k}`}
                        placeholder="Cüzdan ve Market"
                        value={en.cta_market_tr ?? ''}
                        onChange={(e) =>
                          patchEntryNotice(k, { cta_market_tr: e.target.value.trim() || null })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cta-m-en-${k}`}>Market butonu (EN)</Label>
                      <Input
                        id={`cta-m-en-${k}`}
                        placeholder="Wallet & Market"
                        value={en.cta_market_en ?? ''}
                        onChange={(e) =>
                          patchEntryNotice(k, { cta_market_en: e.target.value.trim() || null })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cta-p-tr-${k}`}>Mağaza butonu (TR)</Label>
                      <Input
                        id={`cta-p-tr-${k}`}
                        placeholder="Satın alma (mağaza)"
                        value={en.cta_purchase_tr ?? ''}
                        onChange={(e) =>
                          patchEntryNotice(k, { cta_purchase_tr: e.target.value.trim() || null })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`cta-p-en-${k}`}>Mağaza butonu (EN)</Label>
                      <Input
                        id={`cta-p-en-${k}`}
                        placeholder="Buy (store)"
                        value={en.cta_purchase_en ?? ''}
                        onChange={(e) =>
                          patchEntryNotice(k, { cta_purchase_en: e.target.value.trim() || null })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {(
        [
          ['iap_android', 'Android (Google Play)'],
          ['iap_ios', 'iOS (App Store)'],
        ] as const
      ).map(([key, title]) => {
        const side = cfg[key] ?? emptyIap();
        return (
          <Card key={key} className="overflow-hidden shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/10">
              <CardTitle className="text-lg">{title} — uygulama içi satın alma (IAP)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kullanıcıların telefondan jeton / ek ders yüklemesi için mağaza ürün kimlikleri. Genelde{' '}
                <span className="font-medium text-foreground">öğretmen bireysel</span> hesabına tanımlanır; iş kuralını
                mobil uygulamada net gösterin.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              {(['jeton', 'ekders'] as const).map((kind) => (
                <div key={kind} className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium capitalize">{kind === 'jeton' ? 'Jeton paketleri' : 'Ek ders paketleri'}</h3>
                    <Button type="button" variant="outline" size="sm" onClick={() => addPack(key, kind)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Satır ekle
                    </Button>
                  </div>
                  {side[kind].length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                      Henüz ürün yok. &quot;Satır ekle&quot; ile mağaza product_id ekleyin.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {side[kind].map((pack, i) => (
                        <div
                          key={`${kind}-${i}`}
                          className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/15 p-3 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:flex-wrap sm:items-end"
                        >
                          <div className="w-full min-w-0 flex-1 space-y-1 sm:min-w-[200px]">
                            <Label>product_id</Label>
                            <Input
                              value={pack.product_id}
                              onChange={(e) =>
                                setPack(key, kind, i, { product_id: e.target.value })
                              }
                              placeholder="com.app.jeton.100"
                            />
                          </div>
                          <div className="w-full space-y-1 sm:w-28 sm:shrink-0">
                            <Label>Miktar</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step="any"
                              value={pack.amount}
                              onChange={(e) =>
                                setPack(key, kind, i, {
                                  amount: parseRatioInput(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="w-full min-w-0 flex-1 space-y-1 sm:min-w-[140px]">
                            <Label>Etiket (opsiyonel)</Label>
                            <Input
                              value={pack.label ?? ''}
                              onChange={(e) => setPack(key, kind, i, { label: e.target.value })}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive"
                            onClick={() => removePack(key, kind, i)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          Kamu yapılandırma: <code className="rounded bg-muted px-1">GET /api/content/market-policy</code> (auth yok).
        </p>
        <p>
          Satın alma doğrulama (oturum gerekli):{' '}
          <code className="rounded bg-muted px-1">POST /api/market/purchases/verify-android</code>,{' '}
          <code className="rounded bg-muted px-1">POST /api/market/purchases/verify-ios</code>
        </p>
        <p>
          İşlem günlüğü / anomali (superadmin veya market_policy modüllü moderator):{' '}
          <code className="rounded bg-muted px-1">GET /api/market/purchases/ledger</code>,{' '}
          <code className="rounded bg-muted px-1">GET /api/market/purchases/anomalies</code>
        </p>
        <p>
          Platform aylık/yıllık özet (satın alma kredi + modül tüketim):{' '}
          <code className="rounded bg-muted px-1">GET /api/market/admin/summary</code>
        </p>
        <p>
          Platform modül tüketim günlüğü (sayfalı):{' '}
          <code className="rounded bg-muted px-1">GET /api/market/admin/consumption-ledger</code>
        </p>
      </div>
    </div>
  );
}
