import type { MarketPolicyConfig } from '../app-config/market-policy.defaults';

export type ResolvedIapCredit = {
  currencyKind: 'jeton' | 'ekders';
  amount: number;
};

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
