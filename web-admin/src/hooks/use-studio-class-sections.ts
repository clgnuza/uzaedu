'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

/** Stüdyo şube listesi — kurulum, ders kataloğu, atamalar ve okul kaydı birleşimi (backend tek kaynak). */
export function useStudioClassSections(studioId: string | undefined, token: string | null) {
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !studioId) {
      setSections([]);
      return;
    }
    setLoading(true);
    try {
      const list = await apiFetch<string[]>(`/ders-dagit/studios/${studioId}/class-sections`, { token });
      setSections(Array.isArray(list) ? list : []);
    } catch {
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, [token, studioId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sections, reload, loading };
}
