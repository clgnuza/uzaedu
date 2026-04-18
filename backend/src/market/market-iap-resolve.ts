import type { MarketIapPack, MarketPolicyConfig } from '../app-config/market-policy.defaults';

export type ResolvedIapCredit = {
  currencyKind: 'jeton' | 'ekders';
  amount: number;
};

function findIapPackByProductId(
  side: { jeton: MarketIapPack[]; ekders: MarketIapPack[] },
  productId: string,
): MarketIapPack | null {
  const pid = productId.trim();
  if (!pid) return null;
  return side.jeton.find((p) => p.product_id === pid) ?? side.ekders.find((p) => p.product_id === pid) ?? null;
}

export type ResolvedIapEntitlementGrants = {
  yillik_plan_uretim: number;
  evrak_uretim: number;
};

/** IAP satırındaki opsiyonel üretim hakları (jeton/ekders miktarından bağımsız). */
export function resolveIapEntitlementGrantsFromPolicy(
  policy: MarketPolicyConfig,
  platform: 'android' | 'ios',
  productId: string,
): ResolvedIapEntitlementGrants {
  const side = platform === 'android' ? policy.iap_android : policy.iap_ios;
  const pack = findIapPackByProductId(side, productId);
  if (!pack) return { yillik_plan_uretim: 0, evrak_uretim: 0 };
  const y = Math.floor(Number(pack.grant_yillik_plan_uretim ?? 0));
  const e = Math.floor(Number(pack.grant_evrak_uretim ?? 0));
  const cap = 10_000;
  return {
    yillik_plan_uretim: Math.min(cap, Math.max(0, Number.isFinite(y) ? y : 0)),
    evrak_uretim: Math.min(cap, Math.max(0, Number.isFinite(e) ? e : 0)),
  };
}

/**
 * Market politikasındaki IAP listesinden product_id ile miktar çözümler.
 */
export function resolveIapCreditFromPolicy(
  policy: MarketPolicyConfig,
  platform: 'android' | 'ios',
  productId: string,
  hintCurrency?: 'jeton' | 'ekders' | 'unknown',
): ResolvedIapCredit | null {
  const pid = productId.trim();
  if (!pid) return null;
  const side = platform === 'android' ? policy.iap_android : policy.iap_ios;
  const tryJeton = side.jeton.find((p) => p.product_id === pid);
  const tryEkd = side.ekders.find((p) => p.product_id === pid);
  if (hintCurrency === 'jeton' && tryJeton) return { currencyKind: 'jeton', amount: tryJeton.amount };
  if (hintCurrency === 'ekders' && tryEkd) return { currencyKind: 'ekders', amount: tryEkd.amount };
  if (tryJeton && !tryEkd) return { currencyKind: 'jeton', amount: tryJeton.amount };
  if (tryEkd && !tryJeton) return { currencyKind: 'ekders', amount: tryEkd.amount };
  if (tryJeton && tryEkd) {
    return hintCurrency === 'ekders'
      ? { currencyKind: 'ekders', amount: tryEkd.amount }
      : { currencyKind: 'jeton', amount: tryJeton.amount };
  }
  return null;
}
