'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { dedupeSectionAliases } from '@/lib/class-section-canonical';

const CACHE_MS = 90_000;
const cache = new Map<string, { at: number; data: string[] }>();
const inflight = new Map<string, Promise<string[]>>();

export function useDersDagitSections(extra?: string[]) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [sections, setSections] = useState<string[]>([]);
  const extraKey = extra?.join('|') ?? '';

  const load = useCallback(
    async (force = false) => {
      if (!token || !studio) return;
      const key = `${token}:${studio.id}:${extraKey}`;
      if (!force) {
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < CACHE_MS) {
          setSections(hit.data);
          return;
        }
        const running = inflight.get(key);
        if (running) {
          setSections(await running);
          return;
        }
      }
      const request = apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, {
        token,
      }).then((list) => {
        const merged = dedupeSectionAliases(
          [...list, ...(extra ?? [])].map((s) => s.trim()).filter(Boolean),
        );
        return merged.length ? merged : ['5-A', '5-B', '6-A'];
      });
      if (!force) inflight.set(key, request);
      try {
        const merged = await request;
        cache.set(key, { at: Date.now(), data: merged });
        setSections(merged);
      } catch {
        setSections(['5-A', '5-B', '6-A']);
      } finally {
        if (!force) inflight.delete(key);
      }
    },
    [token, studio, extraKey, extra],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const options = sections.map((s) => ({ value: s, label: s }));

  return { sections, options, reload: load };
}
