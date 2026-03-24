'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { getMarketModuleKeyForPath } from '@/config/module-market-route';
import { SCHOOL_MODULE_LABELS } from '@/config/school-modules';

type Scope = { monthly: { jeton: number; ekders: number }; yearly: { jeton: number; ekders: number } };

type PolicyRow = {
  school: Scope;
  teacher: Scope;
  entry_notice?: { notice_tr: string | null; notice_en: string | null };
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

export function ModuleEntryFeeBanner() {
  const pathname = usePathname();
  const [policy, setPolicy] = useState<PolicyRes | null>(() => policyCache);
  const [uiLang, setUiLang] = useState<'tr' | 'en'>('tr');

  const moduleKey = getMarketModuleKeyForPath(pathname ?? '');

  useEffect(() => {
    setUiLang(typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'tr');
  }, []);

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
  const enText = row?.entry_notice?.notice_en?.trim();
  const trText = row?.entry_notice?.notice_tr?.trim();
  const custom =
    uiLang === 'en' && enText ? enText : uiLang === 'en' && !enText && trText ? trText : trText || enText || '';
  const title = SCHOOL_MODULE_LABELS[moduleKey];

  const showFallback = !custom && rowHasAnyFee(row);

  if (!custom && !showFallback) return null;

  const heading = uiLang === 'en' ? 'Usage fee information' : 'Kullanım ücreti bilgisi';

  const body = custom ? (
    <p className="whitespace-pre-wrap leading-relaxed">{custom}</p>
  ) : (
    <p className="leading-relaxed">
      {uiLang === 'en' ? (
        <>
          Some actions in <span className="font-medium text-foreground">{title}</span> may use jeton and/or extra lesson
          credits. Check current rates on the{' '}
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
  );

  return (
    <Alert variant="info" className="text-sm">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{heading}</p>
        {body}
      </div>
    </Alert>
  );
}
