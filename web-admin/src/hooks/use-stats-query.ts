'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { StatsResponse } from '@/lib/stats-response';

export function useStatsQuery(token: string | null) {
  return useQuery({
    queryKey: ['stats', token],
    queryFn: () => apiFetch<StatsResponse>('stats', { token: token! }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
}
