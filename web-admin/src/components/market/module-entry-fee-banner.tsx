'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getMarketModuleKeyForPath } from '@/config/module-market-route';
import { SCHOOL_MODULE_LABELS } from '@/config/school-modules';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight, ChevronDown, ChevronUp, ExternalLink, Info, Wallet, X } from 'lucide-react';

type Scope = { monthly: { jeton: number; ekders: number }; yearly: { jeton: number; ekders: number } };

type EntryNotice = {
  notice_tr: string | null;
  notice_en: string | null;
  market_href: string | null;
  cta_market_tr: string | null;
  cta_market_en: string | null;
  purchase_href: string | null;
  cta_purchase_tr: string | null;
  cta_purchase_en: string | null;
};

type PolicyRow = {
  school: Scope;
  teacher: Scope;
  entry_notice?: EntryNotice;
};

type PolicyRes = { module_prices: Record<string, PolicyRow> };

let policyCache: PolicyRes | null = null;
let policyLoad: Promise<PolicyRes | null> | null = null;

function loadPolicy(): Promise<PolicyRes | null> {
  if (policyCache) return Promise.resolve(policyCache);
  if (!policyLoad) {
    policyLoad = apiFetch<PolicyRes>('content/market-policy')
      .then((p) => {
        policyCache = p;
        return p;
      })
      .catch(() => null)
      .finally(() => {
        policyLoad = null;
      });
  }
  return policyLoad;
}

function scopeHasFee(s: Scope | undefined): boolean {
  if (!s) return false;
  return [s.monthly, s.yearly].some((p) => (p.jeton ?? 0) > 0 || (p.ekders ?? 0) > 0);
}

function rowHasAnyFee(row: PolicyRow | undefined): boolean {
  if (!row) return false;
  return scopeHasFee(row.school) || scopeHasFee(row.teacher);
}

const COPY = {
  tr: {
    heading: 'Kullanım ve bakiye',
    market: 'Cüzdan ve Market',
    purchase: 'Satın alma (mağaza)',
    reassurance:
      'Bu kutu yalnızca bilgilendirme içindir; modülü aşağıdaki içerikle normal şekilde kullanmaya devam edebilirsiniz.',
    /** Ücretli tarife: ödeme yeri + devam */
    reassurancePaid: (
      <>
        <span className="font-medium text-foreground">Ücreti nereden ödersiniz:</span> Aşağıdaki{' '}
        <span className="font-medium text-foreground">Cüzdan ve Market</span> düğmesi web’de{' '}
        <Link href="/market" className="font-medium text-primary underline-offset-4 hover:underline">
          Market
        </Link>{' '}
        sayfasına gider — jeton ve ek ders bakiyenizi görür, gerekirse yükleme yaparsınız. Ücretli modüllerde{' '}
        <span className="font-medium text-foreground">önce Market’te modül etkinleştirmesi</span> (aylık veya yıllık
        tarife) gerekir; ardından bakiye yeterliyse kullanım devam eder. İsterseniz mobil uygulamada mağaza paketleriyle de
        bakiye ekleyebilirsiniz.
      </>
    ),
    mobileHint:
      'Mobil uygulamada Google Play / App Store üzerinden paket satın alarak jeton ekleyebilirsiniz; bakiye hesabınıza işlendikten sonra bu modülü web’den veya uygulamadan kullanmaya devam edebilirsiniz.',
    fallbackMinimal: 'Bu modülü kullanmak için bakiyenizi Market üzerinden yönetin veya mobil uygulamadan paket satın alın.',
    expand: 'Kullanım bilgisini göster',
    collapse: 'Daralt',
  },
  en: {
    heading: 'Usage & balance',
    market: 'Wallet & Market',
    purchase: 'Buy (store)',
    reassurance: 'This is informational only — you can keep using the module below as usual.',
    reassurancePaid: (
      <>
        <span className="font-medium text-foreground">Where to pay:</span> Use{' '}
        <span className="font-medium text-foreground">Wallet &amp; Market</span> below to open the{' '}
        <Link href="/market" className="font-medium text-primary underline-offset-4 hover:underline">
          Market
        </Link>{' '}
        page — view jeton / extra lesson balance and top up. For paid modules,{' '}
        <span className="font-medium text-foreground">activate the module first</span> (monthly or yearly tariff), then
        usage continues when your balance is sufficient. You can also add balance via in-app store packs on your phone.
      </>
    ),
    mobileHint:
      'Purchases on Google Play / App Store add jeton to your account; then keep using this module on web or in the app.',
    fallbackMinimal: 'Manage your balance in Market or purchase packs in the mobile app.',
    expand: 'Show usage info',
    collapse: 'Collapse',
  },
} as const;

function sessionDismissKey(moduleKey: string) {
  return `fee-banner-dismiss:${moduleKey}`;
}

export function ModuleEntryFeeBanner() {
  const pathname = usePathname();
  const [policy, setPolicy] = useState<PolicyRes | null>(() => policyCache);
  const [uiLang, setUiLang] = useState<'tr' | 'en'>('tr');
  const [collapsed, setCollapsed] = useState(false);

  const moduleKey = getMarketModuleKeyForPath(pathname ?? '');

  useEffect(() => {
    setUiLang(typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'tr');
  }, []);

  useEffect(() => {
    if (!moduleKey) return;
    try {
      if (sessionStorage.getItem(sessionDismissKey(moduleKey)) === '1') {
        setCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, [moduleKey]);

  useEffect(() => {
    if (!moduleKey) return;
    let cancelled = false;
    void loadPolicy().then((p) => {
      if (!cancelled && p) setPolicy(p);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  if (!moduleKey) return null;

  const row = (policy ?? policyCache)?.module_prices?.[moduleKey];
  const en = row?.entry_notice;
  const enText = en?.notice_en?.trim();
  const trText = en?.notice_tr?.trim();
  const custom =
    uiLang === 'en' && enText ? enText : uiLang === 'en' && !enText && trText ? trText : trText || enText || '';
  const title = SCHOOL_MODULE_LABELS[moduleKey];

  const hasFee = rowHasAnyFee(row);
  const hasPurchaseHref = !!(en?.purchase_href && en.purchase_href.trim());
  const showPanel = !!(custom || hasFee || hasPurchaseHref);
  if (!showPanel) return null;

  const c = COPY[uiLang];
  const marketHref = (en?.market_href?.trim() || '/market') as string;
  const marketLabel =
    uiLang === 'en'
      ? en?.cta_market_en?.trim() || en?.cta_market_tr?.trim() || c.market
      : en?.cta_market_tr?.trim() || en?.cta_market_en?.trim() || c.market;
  const purchaseHref = en?.purchase_href?.trim() || '';
  const purchaseLabel =
    uiLang === 'en'
      ? en?.cta_purchase_en?.trim() || en?.cta_purchase_tr?.trim() || c.purchase
      : en?.cta_purchase_tr?.trim() || en?.cta_purchase_en?.trim() || c.purchase;

  const reassuranceBlock: ReactNode = hasFee
    ? COPY[uiLang].reassurancePaid
    : c.reassurance;

  const body = custom ? (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{custom}</p>
  ) : hasFee ? (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {uiLang === 'en' ? (
        <>
          Some actions in <span className="font-medium text-foreground">{title}</span> may use jeton and/or extra lesson
          credits. Check rates on the{' '}
          <Link href="/market" className="font-medium text-primary underline-offset-4 hover:underline">
            Market
          </Link>{' '}
          page.
        </>
      ) : (
        <>
          <span className="font-medium text-foreground">{title}</span> modülünde bazı işlemler jeton ve/veya ek ders
          kullanımı gerektirebilir. Güncel tarifeleri{' '}
          <Link href="/market" className="font-medium text-primary underline-offset-4 hover:underline">
            Market
          </Link>{' '}
          sayfasından inceleyebilirsiniz.
        </>
      )}
    </p>
  ) : (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {uiLang === 'en' ? COPY.en.fallbackMinimal : COPY.tr.fallbackMinimal}
    </p>
  );

  const handleDismiss = () => {
    setCollapsed(true);
    try {
      sessionStorage.setItem(sessionDismissKey(moduleKey), '1');
    } catch {
      /* ignore */
    }
  };

  const handleExpand = () => {
    setCollapsed(false);
    try {
      sessionStorage.removeItem(sessionDismissKey(moduleKey));
    } catch {
      /* ignore */
    }
  };

  if (collapsed) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          {uiLang === 'en' ? `${title}: usage fee info hidden.` : `${title}: kullanım ücreti bilgisi gizlendi.`}
        </span>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={handleExpand}>
          <ChevronDown className="size-3.5" aria-hidden />
          {c.expand}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="complementary"
      aria-label={uiLang === 'en' ? 'Module usage and balance (informational)' : 'Modül kullanımı ve bakiye (bilgilendirme)'}
      className={cn(
        'relative overflow-hidden rounded-xl border border-violet-500/20 bg-linear-to-br from-violet-500/6 via-card to-amber-500/5 shadow-sm ring-1 ring-black/4 dark:from-violet-950/35 dark:to-amber-950/15 dark:ring-white/10',
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 size-24 rounded-full bg-amber-500/10 blur-xl" />

      <div className="relative space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                <Info className="size-4" aria-hidden />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{c.heading}</h2>
              <span className="rounded-full border border-border/80 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {title}
              </span>
            </div>
            <p className="text-[12px] leading-snug text-muted-foreground sm:text-xs">{reassuranceBlock}</p>
            {body}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label={uiLang === 'en' ? 'Hide banner' : 'Bilgilendirmeyi gizle'}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild size="default" variant="default" className="gap-2 shadow-sm">
              <Link href={marketHref}>
                <Wallet className="size-4" aria-hidden />
                {marketLabel}
                <ArrowRight className="size-3.5 opacity-80" aria-hidden />
              </Link>
            </Button>
            {purchaseHref ? (
              <Button asChild size="default" variant="secondary" className="gap-2 border border-border/80 bg-background/90">
                <a href={purchaseHref} target="_blank" rel="noopener noreferrer">
                  {purchaseLabel}
                  <ExternalLink className="size-3.5 opacity-80" aria-hidden />
                </a>
              </Button>
            ) : (
              <p className="max-w-md text-[11px] leading-snug text-muted-foreground">
                {uiLang === 'en' ? COPY.en.mobileHint : COPY.tr.mobileHint}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 self-start text-[11px] text-muted-foreground sm:self-center"
            onClick={handleDismiss}
          >
            <ChevronUp className="mr-1 size-3.5" aria-hidden />
            {c.collapse}
          </Button>
        </div>
      </div>
    </div>
  );
}
