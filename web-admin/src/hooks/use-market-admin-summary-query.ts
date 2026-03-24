'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

type WalletSplit = { user: { jeton: number; ekders: number }; school: { jeton: number; ekders: number } };

export type MarketAdminSummary = {
  period_labels: { month: string; year: string };
  purchases: { month: WalletSplit; year: WalletSplit };
  consumption: { month: WalletSplit; year: WalletSplit };
};

export function useMarketAdminSummaryQuery(token: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['market-admin-summary', token],
    queryFn: () => apiFetch<MarketAdminSummary>('market/admin/summary', { token: token! }),
    enabled: Boolean(token) && enabled,
    staleTime: 120_000,
    retry: false,
  });
}
