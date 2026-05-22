'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { sortClassSections } from '@/lib/class-section-sort';

export function useDersDagitSections(extra?: string[]) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [sections, setSections] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const list = await apiFetch<string[]>(`/ders-dagit/studios/${studio.id}/class-sections`, { token }).catch(
      () => [] as string[],
    );
    const merged = sortClassSections([...new Set([...list, ...(extra ?? [])].map((s) => s.trim()).filter(Boolean))]);
    setSections(merged.length ? merged : ['5A', '5B', '6A']);
  }, [token, studio, extra?.join('|')]);

  useEffect(() => {
    void load();
  }, [load]);

  const options = sections.map((s) => ({ value: s, label: s }));

  return { sections, options, reload: load };
}
