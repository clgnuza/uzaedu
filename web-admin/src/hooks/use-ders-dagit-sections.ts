'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { dedupeSectionAliases } from '@/lib/class-section-canonical';

const CACHE_MS = 90_000;
const cache = new Map<string, { at: number; data: string[] }>();
const inflight = new Map<string, Promise<string[]>>();

export function invalidateDersDagitSectionsCache(studioId?: string) {
  if (!studioId) {
    cache.clear();
    inflight.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.includes(`:${studioId}:`)) cache.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (key.includes(`:${studioId}:`)) inflight.delete(key);
  }
}

function hashStringFNV1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mergeSections(base: string[], extra?: string[]): string[] {
  if (!extra?.length) return base;
  return dedupeSectionAliases([...base, ...extra.map((s) => s.trim()).filter(Boolean)]);
}

export function useDersDagitSections(extra?: string[]) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [sections, setSections] = useState<string[]>([]);
  const extraNormalized = useMemo(() => {
    if (!extra?.length) return undefined;
    const unique = Array.from(new Set(extra.map((s) => s.trim()).filter(Boolean)));
    unique.sort((a, b) => a.localeCompare(b, 'tr'));
    return unique.slice(0, 256);
  }, [extra]);
  const extraKey = useMemo(() => {
    if (!extraNormalized?.length) return '';
    let h = 2166136261;
    for (const s of extraNormalized) {
      h ^= hashStringFNV1a(s);
      h = Math.imul(h, 16777619);
    }
    return `${extraNormalized.length}:${h >>> 0}`;
  }, [extraNormalized]);

  const load = useCallback(
    async (force = false) => {
      if (!token || !studio) return;
      const baseKey = `${token}:${studio.id}:base`;
      const fullKey = `${baseKey}:${extraKey}`;

      if (!force) {
        const fullHit = cache.get(fullKey);
        if (fullHit && Date.now() - fullHit.at < CACHE_MS) {
          setSections(fullHit.data);
          return;
        }
      }

      let baseList: string[];
      const baseHit = !force ? cache.get(baseKey) : undefined;
      if (baseHit && Date.now() - baseHit.at < CACHE_MS) {
        baseList = baseHit.data;
      } else {
        const running = inflight.get(baseKey);
        if (running) {
          baseList = await running;
        } else {
          const request = apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, {
            token,
          }).then((list) =>
            dedupeSectionAliases(list.map((s) => s.trim()).filter(Boolean)),
          );
          inflight.set(baseKey, request);
          try {
            baseList = await request;
            cache.set(baseKey, { at: Date.now(), data: baseList });
          } catch {
            setSections([]);
            return;
          } finally {
            inflight.delete(baseKey);
          }
        }
      }

      const merged = mergeSections(baseList, extraNormalized);
      cache.set(fullKey, { at: Date.now(), data: merged });
      setSections(merged);
    },
    [token, studio, extraKey, extraNormalized],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const options = sections.map((s) => ({ value: s, label: s }));

  return { sections, options, reload: load };
}
