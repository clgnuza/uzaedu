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
  ShoppingBag,
  UserRound,
  BarChart3,
  RefreshCw,
  ListTree,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import {
  SCHOOL_MODULE_KEYS,
  SCHOOL_MODULE_LABELS,
  SCHOOL_MODULE_MARKET_HINTS,
  type SchoolModuleKey,
} from '@/config/school-modules';
import { cn } from '@/lib/utils';
import { WEB_SETTINGS_TEXTAREA } from '@/components/web-settings/web-settings-shell';
import { MarketIapPolicyPanel, type IapSide } from '@/components/market/market-iap-policy-panel';
import { MarketProductionPolicyPanel } from '@/components/market/market-production-policy-panel';

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
type MarketMinorPrivacy = {
  not_targeting_children_note: string | null;
  parental_consent_note: string | null;
};

type MarketEntitlementExchangeConfig = {
  enabled: boolean;
  jeton_per_yillik_plan_unit: number;
  jeton_per_evrak_unit: number;
  max_units_per_request: number;
};

type MarketStoreComplianceLite = {
  purchase_disclosure_tr: string | null;
  purchase_disclosure_en: string | null;
  refunds_and_support_note: string | null;
};

type MarketPolicyConfig = {
  cache_ttl_market_policy: number;
  module_prices: Record<string, ModuleRow>;
  iap_android: IapSide;
  iap_ios: IapSide;
  store_compliance: MarketStoreComplianceLite;
  minor_privacy: MarketMinorPrivacy;
  entitlement_exchange: MarketEntitlementExchangeConfig;
};

const emptyIap = (): IapSide => ({ jeton: [], ekders: [] });

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

/** Jeton tarifesi: `type=number` virgül kabul etmediği için metin alanında gösterim. */
function fmtTrRatioInput(n: number): string {
  if (!Number.isFinite(n)) return '';
  const r = roundRatio(n);
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6, useGrouping: false }).format(r);
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
  /** Jeton/hak oranı: ondalık + virgül girişi (örn. 0,1); blur’da cfg’den yeniden formatlanır. */
  const [eeJetonDraft, setEeJetonDraft] = useState<{ yp: string; ev: string } | null>(null);
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
      const raw = await apiFetch<MarketPolicyConfig & { rewarded_ad_jeton?: unknown; teacher_invite_jeton?: unknown }>(
        '/app-config/market-policy',
        { token },
      );
      const { rewarded_ad_jeton: _rewarded, teacher_invite_jeton: _invite, ...data } = raw;
      setCfg({
        cache_ttl_market_policy: data.cache_ttl_market_policy,
        module_prices: data.module_prices ?? {},
        iap_android: data.iap_android ?? emptyIap(),
        iap_ios: data.iap_ios ?? emptyIap(),
        store_compliance: data.store_compliance ?? {
          purchase_disclosure_tr: null,
          purchase_disclosure_en: null,
          refunds_and_support_note: null,
        },
        minor_privacy: data.minor_privacy ?? {
          not_targeting_children_note: null,
          parental_consent_note: null,
        },
        entitlement_exchange: data.entitlement_exchange ?? {
          enabled: false,
          jeton_per_yillik_plan_unit: 25,
          jeton_per_evrak_unit: 10,
          max_units_per_request: 25,
        },
      });
      setEeJetonDraft(null);
    } catch {
      toast.error('Yüklenemedi');
      setCfg(null);
      setEeJetonDraft(null);
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

  const setMinorPrivacy = (patch: Partial<MarketMinorPrivacy>) => {
    setCfg((prev) => {
      if (!prev) return prev;
      return { ...prev, minor_privacy: { ...prev.minor_privacy, ...patch } };
    });
  };

  const setEntitlementExchange = (patch: Partial<MarketEntitlementExchangeConfig>) => {
    setCfg((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        entitlement_exchange: { ...prev.entitlement_exchange, ...patch },
      };
    });
  };

  const save = async () => {
    if (!token || !cfg) return;
    setSaving(true);
    try {
      const payload = {
        cache_ttl_market_policy: cfg.cache_ttl_market_policy,
        module_prices: cfg.module_prices,
        iap_android: cfg.iap_android,
        iap_ios: cfg.iap_ios,
        store_compliance: cfg.store_compliance,
        minor_privacy: cfg.minor_privacy,
        entitlement_exchange: cfg.entitlement_exchange,
      };
      await apiFetch('/app-config/market-policy', {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
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
            ]}
            summary="Modül tarifeleri ve üretim ekonomisi. Kayıt 6 ondalık. Sunucu varsayılan aylık tarife kullanır; modül giriş uyarıları sunucu varsayılanıyla gelir."
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

      <MarketIapPolicyPanel
        iapAndroid={cfg.iap_android}
        iapIos={cfg.iap_ios}
        onChange={(platform, side) =>
          setCfg((prev) => (prev ? { ...prev, [platform]: side } : prev))
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mobil satın alma metni</CardTitle>
          <p className="text-sm text-muted-foreground">
            Uygulama mağaza ekranında gösterilir (<code className="rounded bg-muted px-1">GET /content/market-policy</code>
            ).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="iap-disc-tr">Satın alma bilgilendirmesi (TR)</Label>
            <textarea
              id="iap-disc-tr"
              className={WEB_SETTINGS_TEXTAREA}
              rows={3}
              value={cfg.store_compliance.purchase_disclosure_tr ?? ''}
              onChange={(e) =>
                setCfg((prev) =>
                  prev
                    ? {
                        ...prev,
                        store_compliance: {
                          ...prev.store_compliance,
                          purchase_disclosure_tr: e.target.value.length ? e.target.value : null,
                        },
                      }
                    : prev,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iap-disc-en">Satın alma bilgilendirmesi (EN)</Label>
            <textarea
              id="iap-disc-en"
              className={WEB_SETTINGS_TEXTAREA}
              rows={2}
              value={cfg.store_compliance.purchase_disclosure_en ?? ''}
              onChange={(e) =>
                setCfg((prev) =>
                  prev
                    ? {
                        ...prev,
                        store_compliance: {
                          ...prev.store_compliance,
                          purchase_disclosure_en: e.target.value.length ? e.target.value : null,
                        },
                      }
                    : prev,
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <MarketProductionPolicyPanel
        exchange={cfg.entitlement_exchange}
        eeJetonDraft={eeJetonDraft}
        onEeJetonDraftChange={setEeJetonDraft}
        onExchangeChange={setEntitlementExchange}
        onEeBlur={() => setEeJetonDraft(null)}
      />

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

      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          Kamu yapılandırma: <code className="rounded bg-muted px-1">GET /api/content/market-policy</code> (auth yok).
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
