'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import {
  DERS_DAGIT_ASSIGNMENTS_CHANGED,
  type AssignmentsChangedDetail,
} from '@/lib/ders-dagit-assignments-sync';
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

function seedValidationCache(token: string, studioId: string, issues: ValidationIssue[]) {
  cache.set(`${token}:${studioId}`, { data: issues, at: Date.now() });
}

type UseStudioValidationOptions = {
  /** Layout overview — aynı veri tekrar çekilmesin */
  initialIssues?: ValidationIssue[] | null;
};

export function useStudioValidation(
  studioId: string | null | undefined,
  opts?: UseStudioValidationOptions,
) {
  const { token } = useAuth();
  const initialIssues = opts?.initialIssues;
  const [issues, setIssues] = useState<ValidationIssue[]>(() => initialIssues ?? []);
  const [ready, setReady] = useState(() => initialIssues != null);
  const [syncing, setSyncing] = useState(false);

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
    if (initialIssues == null || !token || !studioId) return;
    seedValidationCache(token, studioId, initialIssues);
    setIssues(initialIssues);
    setReady(true);
  }, [initialIssues, token, studioId]);

  useEffect(() => {
    if (!token || !studioId) return;
    void refresh();
  }, [token, studioId, refresh]);

  useEffect(() => {
    const onAssignmentsChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<AssignmentsChangedDetail>).detail;
      if (detail?.studioId && detail.studioId !== studioId) return;
      invalidateStudioValidationCache(studioId);
      void refresh({ force: true });
    };
    window.addEventListener(DERS_DAGIT_ASSIGNMENTS_CHANGED, onAssignmentsChanged);
    return () => window.removeEventListener(DERS_DAGIT_ASSIGNMENTS_CHANGED, onAssignmentsChanged);
  }, [studioId, refresh]);

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
