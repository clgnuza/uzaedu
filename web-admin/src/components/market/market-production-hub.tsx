'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  FileText,
  GraduationCap,
  Layers,
  Sparkles,
  Coins,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoHintDialog } from '@/components/market/info-hint-dialog';

export type EntitlementItem = {
  entitlementType: string;
  quantity: number;
  expiresAt: string | null;
};

export type EntitlementExchangeConfig = {
  enabled: boolean;
  jeton_per_yillik_plan_unit: number;
  jeton_per_evrak_unit: number;
  max_units_per_request: number;
};

export type PlanKatkiCreditsSummary = {
  usage_count: number;
  total_jeton_credited: string;
};

export type BilsemPlanCreditRow = {
  id: string;
  jeton_credit: string;
  created_at: string | null;
  submission_id: string | null;
  subject_label: string | null;
  subject_code: string | null;
  ana_grup: string | null;
  consumer_display_name: string | null;
  consumer_email: string | null;
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function QuotaCard({
  title,
  subtitle,
  value,
  icon,
  accent,
  sharedNote,
}: {
  title: string;
  subtitle: string;
  value: number;
  icon: ReactNode;
  accent: 'indigo' | 'amber';
  sharedNote?: string;
}) {
  const styles =
    accent === 'indigo'
      ? 'border-indigo-400/40 bg-linear-to-br from-indigo-500/10 via-card to-violet-500/5 ring-indigo-500/15 dark:border-indigo-600/35'
      : 'border-amber-400/40 bg-linear-to-br from-amber-500/10 via-card to-orange-500/5 ring-amber-500/15 dark:border-amber-600/35';
  const iconBg =
    accent === 'indigo'
      ? 'bg-indigo-600/15 text-indigo-800 dark:text-indigo-200'
      : 'bg-amber-600/15 text-amber-900 dark:text-amber-200';

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-sm ring-1 sm:p-5', styles)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', iconBg)}>{icon}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            {sharedNote ? (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-900 dark:text-indigo-200">
                <Layers className="size-3 shrink-0" aria-hidden />
                {sharedNote}
              </p>
            ) : null}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-xl px-3 py-1.5 text-2xl font-bold tabular-nums tracking-tight',
            value > 0
              ? 'bg-primary/12 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

export function MarketProductionHub({
  entitlements,
  exchangeConfig,
  jetonBalance,
  token,
  onRefresh,
  bilsemPlanCredits,
}: {
  entitlements: EntitlementItem[];
  exchangeConfig: EntitlementExchangeConfig | undefined;
  jetonBalance: number;
  token: string | null;
  onRefresh: () => Promise<void>;
  bilsemPlanCredits: {
    total: number;
    items: BilsemPlanCreditRow[];
    summary?: PlanKatkiCreditsSummary | null;
  } | null;
}) {
  const [exchangeKind, setExchangeKind] = useState<'yillik_plan_uretim' | 'evrak_uretim'>('yillik_plan_uretim');
  const [exchangeQty, setExchangeQty] = useState(1);
  const [exchangeBusy, setExchangeBusy] = useState(false);

  const yillikPlanKota = entitlements.find((e) => e.entitlementType === 'yillik_plan_uretim')?.quantity ?? 0;
  const evrakQty = entitlements.find((e) => e.entitlementType === 'evrak_uretim')?.quantity ?? 0;
  const otherEntitlements = entitlements.filter(
    (e) => e.entitlementType !== 'yillik_plan_uretim' && e.entitlementType !== 'evrak_uretim',
  );

  const exMaxUnits = exchangeConfig
    ? Math.min(500, Math.max(1, Math.floor(exchangeConfig.max_units_per_request ?? 25)))
    : 25;
  const exQtyClamped = Math.min(exMaxUnits, Math.max(1, Math.floor(exchangeQty)));
  const exRate =
    exchangeKind === 'yillik_plan_uretim'
      ? (exchangeConfig?.jeton_per_yillik_plan_unit ?? 0)
      : (exchangeConfig?.jeton_per_evrak_unit ?? 0);
  const exCost = exRate * exQtyClamped;

  const planKatkiUsageCount = bilsemPlanCredits?.summary?.usage_count ?? bilsemPlanCredits?.total ?? 0;
  const planKatkiTotalJeton =
    Number.parseFloat(bilsemPlanCredits?.summary?.total_jeton_credited ?? '0') || 0;

  const canExchange = exchangeConfig?.enabled;

  return (
    <section id="market-uretim-ekonomisi" className="scroll-mt-4 space-y-5 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-indigo-400/35 bg-linear-to-br from-indigo-500/12 via-card to-violet-500/8 p-4 shadow-md ring-1 ring-indigo-500/15 sm:p-6 dark:border-indigo-600/30">
        <div className="pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-violet-400/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg ring-2 ring-white/20">
              <BookOpen className="size-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">Plan ve evrak üretimi</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                <strong className="font-medium text-foreground">MEB</strong> ve{' '}
                <strong className="font-medium text-foreground">Bilsem</strong> yıllık plan Word üretimi aynı{' '}
                <em>üretim hakkı</em> kotasını kullanır (üretim başına 1 hak). Kotayı jeton takası ile artırabilirsiniz.
                Yayınladığınız katalog planı başka öğretmenlerce kullanıldığında{' '}
                <strong className="font-medium text-foreground">jeton kazanırsınız</strong> — bu öğretmenlere özeldir.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="h-9" asChild>
              <Link href="/evrak">
                <FileText className="mr-1.5 size-4" />
                Üretime git
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-9" asChild>
              <Link href="/bilsem">
                <GraduationCap className="mr-1.5 size-4" />
                Bilsem
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuotaCard
          title="Yıllık plan üretimi"
          subtitle="MEB müfredatı + Bilsem planları"
          value={yillikPlanKota}
          sharedNote="Ortak kota — her Word üretimi 1 hak"
          icon={<BookOpen className="size-5" />}
          accent="indigo"
        />
        <QuotaCard
          title="Evrak üretimi"
          subtitle="Yıllık plan dışındaki şablonlar"
          value={evrakQty}
          icon={<FileText className="size-5" />}
          accent="amber"
        />
      </div>

      {otherEntitlements.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {otherEntitlements.map((e, idx) => (
            <span
              key={`${e.entitlementType}-${idx}`}
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-3 py-1.5 text-xs"
            >
              <span className="text-muted-foreground">{e.entitlementType}</span>
              <span className="font-semibold tabular-nums text-foreground">{e.quantity}</span>
            </span>
          ))}
        </div>
      ) : null}

      <Card id="market-plan-katki-jeton" className="scroll-mt-4 overflow-hidden border-teal-500/35 shadow-md">
        <CardHeader className="border-b border-border/60 bg-linear-to-r from-teal-500/10 via-emerald-500/5 to-transparent pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-600/15 text-teal-900 dark:text-teal-100">
                <Sparkles className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Plan katkısından jeton kazançları</CardTitle>
                <p className="mt-1 max-w-xl text-xs text-muted-foreground sm:text-sm">
                  Yalnızca <strong className="font-medium text-foreground">öğretmen</strong> hesapları. MEB ve Bilsem
                  planları aynı Word üretiminde tüketilir; katalog planınız kullanıldığında jeton bakiyenize eklenir (kota
                  değil).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                <Link href="/evrak/plan-katki">
                  <FileText className="mr-1.5 size-3.5" />
                  MEB plan katkısı
                </Link>
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8" asChild>
                <Link href="/bilsem/plan-katki">
                  <GraduationCap className="mr-1.5 size-3.5" />
                  Bilsem plan katkısı
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-teal-500/25 bg-teal-500/5 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Toplam kazanılan jeton</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-teal-900 dark:text-teal-100">
                {fmtNum(planKatkiTotalJeton)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Katalog kullanımı</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{planKatkiUsageCount}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Başka öğretmenin Word üretimi</p>
            </div>
          </div>

          <ol className="grid gap-2 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Planınızı yayınlayın',
                desc: 'MEB veya Bilsem plan katkısı moderasyon sonrası katalogda.',
                icon: BookOpen,
              },
              {
                step: '2',
                title: 'Başka öğretmen üretir',
                desc: 'MEB/Bilsem aynı yıllık plan hakkından 1 düşer.',
                icon: Users,
              },
              {
                step: '3',
                title: 'Jeton kazanırsınız',
                desc: 'Ödül jetonu cüzdanınıza; jetonla yeni hak alabilirsiniz.',
                icon: Coins,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <li
                key={step}
                className="relative flex gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {step}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    {title}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{desc}</p>
                </div>
                {step !== '3' ? (
                  <ArrowRight
                    className="pointer-events-none absolute -right-2 top-1/2 hidden size-4 -translate-y-1/2 text-muted-foreground/50 sm:block"
                    aria-hidden
                  />
                ) : null}
              </li>
            ))}
          </ol>

          <div className="rounded-xl border border-border/70 bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-foreground">Son jeton hareketleri</p>
              <InfoHintDialog label="Plan katkı jetonu" title="Plan katkısından jeton">
                <p>
                  Liste, katalog planınızın başka öğretmenler tarafından Word üretiminde kullanılmasıyla oluşan jeton
                  kayıtlarını gösterir. Tüketim kotası ile karıştırmayın.
                </p>
              </InfoHintDialog>
            </div>
            {bilsemPlanCredits && bilsemPlanCredits.items.length > 0 ? (
              <div className="table-x-scroll">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5">Tarih</th>
                      <th className="px-4 py-2.5">Plan</th>
                      <th className="px-4 py-2.5">Kullanan öğretmen</th>
                      <th className="px-4 py-2.5 text-right">Jeton</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {bilsemPlanCredits.items.map((row) => {
                      const planLabel = row.subject_label || row.subject_code || 'Yıllık plan';
                      const consumer = row.consumer_display_name || row.consumer_email || '—';
                      return (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                            {row.created_at ? fmtDate(row.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-foreground">{planLabel}</span>
                            {row.ana_grup ? (
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">{row.ana_grup}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{consumer}</td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            +{fmtNum(Number.parseFloat(row.jeton_credit || '0') || 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Henüz jeton kazancı yok. Plan katkınız yayınlandıktan ve başka öğretmenler üretimde kullandıktan sonra
                burada listelenir.
              </p>
            )}
            {bilsemPlanCredits && bilsemPlanCredits.total > bilsemPlanCredits.items.length ? (
              <p className="border-t border-border/60 px-4 py-2 text-center text-[11px] text-muted-foreground">
                Toplam {bilsemPlanCredits.total} hareket · Son {bilsemPlanCredits.items.length} kayıt gösteriliyor
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canExchange ? (
        <Card className="overflow-hidden border-emerald-500/30 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-emerald-500/5 pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-800 dark:text-emerald-200">
                  <Coins className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Jetonla hak al</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Bakiye: <span className="font-semibold tabular-nums text-foreground">{fmtNum(jetonBalance)}</span> jeton
                  </p>
                </div>
              </div>
              <InfoHintDialog label="Jeton takası" title="Jetonla üretim hakkı">
                <p>
                  Tarife Market Politikasından gelir. Yıllık plan hakkı MEB ve Bilsem üretiminde ortak kullanılır; evrak
                  hakkı diğer şablonlar içindir.
                </p>
              </InfoHintDialog>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 space-y-1.5 sm:min-w-[220px]">
                <Label htmlFor="mex-kind">Hak türü</Label>
                <Select
                  value={exchangeKind}
                  onValueChange={(v) => setExchangeKind(v as 'yillik_plan_uretim' | 'evrak_uretim')}
                >
                  <SelectTrigger id="mex-kind" className="h-9" />
                  <SelectValue />
                  <SelectItem value="yillik_plan_uretim">Yıllık plan (MEB + Bilsem)</SelectItem>
                  <SelectItem value="evrak_uretim">Evrak üretimi</SelectItem>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mex-qty">Adet (en fazla {exMaxUnits})</Label>
                <Input
                  id="mex-qty"
                  type="number"
                  min={1}
                  max={exMaxUnits}
                  className="h-9 w-28 font-medium tabular-nums"
                  value={exchangeQty}
                  onChange={(e) => setExchangeQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:pb-0.5">
                <p className="text-xs text-muted-foreground">
                  Birim: <span className="font-medium tabular-nums text-foreground">{fmtNum(exRate)}</span> jeton · Toplam:{' '}
                  <span className="font-semibold tabular-nums text-foreground">{fmtNum(exCost)}</span>
                  {exRate <= 0 ? (
                    <span className="ml-2 text-amber-700 dark:text-amber-400">(Tarife tanımlı değil)</span>
                  ) : null}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="w-full sm:w-auto"
                  disabled={exchangeBusy || exRate <= 0 || !Number.isFinite(exCost) || exCost <= 0}
                  onClick={() => {
                    void (async () => {
                      if (!token) return;
                      setExchangeBusy(true);
                      try {
                        await apiFetch('/market/entitlements/exchange', {
                          token,
                          method: 'POST',
                          body: JSON.stringify({ kind: exchangeKind, quantity: exQtyClamped }),
                        });
                        toast.success('Üretim hakkı eklendi');
                        await onRefresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
                      } finally {
                        setExchangeBusy(false);
                      }
                    })();
                  }}
                >
                  {exchangeBusy ? 'İşleniyor…' : 'Jetonla al'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

    </section>
  );
}
