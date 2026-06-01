'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';

const CACHE_MS = 90_000;
const cache = new Map<string, { data: ValidationIssue[]; at: number }>();
const inflight = new Map<string, Promise<ValidationIssue[]>>();

export function invalidateStudioValidationCache(studioId?: string) {
  if (!studioId) {
    cache.clear();
    return;
  }
  const suffix = `:${studioId}`;
  for (const key of [...cache.keys()]) {
    if (key.endsWith(suffix)) cache.delete(key);
  }
}

type UseStudioValidationOptions = {
  /** Stüdyo özetinden — sayfa açılışında ek API çağrısı yapılmaz */
  initialIssues?: ValidationIssue[] | null;
};

export function useStudioValidation(
  studioId: string | null | undefined,
  opts?: UseStudioValidationOptions,
) {
  const { token } = useAuth();
  const initialIssues = opts?.initialIssues;
  const hasSnapshot = Boolean(initialIssues?.length);
  const [issues, setIssues] = useState<ValidationIssue[]>(() => initialIssues ?? []);
  const [ready, setReady] = useState(hasSnapshot);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (initialIssues) {
      setIssues(initialIssues);
      setReady(true);
    }
  }, [initialIssues]);

  const refresh = useCallback(
    async (fetchOpts?: { force?: boolean }) => {
      if (!token || !studioId) return;
      const key = `${token}:${studioId}`;
      const force = fetchOpts?.force === true;

      if (!force) {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.at < CACHE_MS) {
          setIssues(cached.data);
          setReady(true);
          return;
        }
        const running = inflight.get(key);
        if (running) {
          const data = await running;
          setIssues(data);
          setReady(true);
          return;
        }
      }

      setSyncing(true);
      try {
        const request = apiFetch<ValidationIssue[]>(`/ders-dagit/studios/${studioId}/validation`, {
          token,
        });
        if (!force) inflight.set(key, request);
        const data = await request;
        cache.set(key, { data, at: Date.now() });
        setIssues(data);
        setReady(true);
      } finally {
        if (!force) inflight.delete(key);
        setSyncing(false);
      }
    },
    [token, studioId],
  );

  useEffect(() => {
    if (!token || !studioId || hasSnapshot) return;
    void refresh();
  }, [token, studioId, hasSnapshot, refresh]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity !== 'error');

  return {
    issues,
    errors,
    warns,
    ready,
    syncing,
    refresh,
    canProceed: ready && errors.length === 0,
  };
}
