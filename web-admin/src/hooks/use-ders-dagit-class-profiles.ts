'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import type { ClassProfileCapacity } from '@/lib/assigned-lessons-summary';

export type { ClassProfileCapacity };

const CACHE_MS = 90_000;
const cache = new Map<string, { at: number; data: ClassProfileCapacity[] }>();
const inflight = new Map<string, Promise<ClassProfileCapacity[]>>();

export function invalidateClassProfilesCache(studioId?: string) {
  if (!studioId) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.endsWith(`:${studioId}`)) cache.delete(key);
  }
}

export function useDersDagitClassProfiles(studioId: string | undefined) {
  const { token } = useAuth();
  const [profiles, setProfiles] = useState<ClassProfileCapacity[]>([]);

  const reload = useCallback(
    async (force = false) => {
      if (!token || !studioId) {
        setProfiles([]);
        return;
      }
      const key = `${token}:${studioId}`;
      if (!force) {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) {
          setProfiles(hit.data);
          return;
        }
        const running = inflight.get(key);
        if (running) {
          setProfiles(await running);
          return;
        }
      }
      const request = apiFetch<ClassProfileCapacity[]>(
        `/ders-dagit/studios/${studioId}/class-profiles`,
        { token },
      );
      if (!force) inflight.set(key, request);
      try {
        const list = await request;
        cache.set(key, { at: Date.now(), data: list });
        setProfiles(list);
      } catch {
        setProfiles([]);
      } finally {
        if (!force) inflight.delete(key);
      }
    },
    [token, studioId],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profiles, reload };
}
