'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';

export type DersDagitStudio = {
  id: string;
  school_id: string;
  academic_year: string;
  name: string | null;
  workflow_status: string;
  health_score: number;
  preference_window_open: boolean;
  settings?: Record<string, unknown>;
};

export type StudioOverview = {
  studio: DersDagitStudio;
  counts: Record<string, number>;
  validation: Array<{ code: string; severity: string; message: string }>;
  health_score: number;
};

export function useDersDagitStudio() {
  const { token, me } = useAuth();
  const [studio, setStudio] = useState<DersDagitStudio | null>(null);
  const [overview, setOverview] = useState<StudioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || (me?.role !== 'school_admin' && me?.role !== 'teacher')) return;
    setLoading(true);
    setError(null);
    try {
      let s = studio;
      if (!s) {
        const list = await apiFetch<DersDagitStudio[]>('/ders-dagit/studios', { token });
        if (list.length > 0) s = list[0]!;
        else if (me?.role === 'school_admin') {
          s = await apiFetch<DersDagitStudio>('/ders-dagit/studios', { token, method: 'POST', body: {} });
        } else {
          setError('Henüz stüdyo oluşturulmamış');
          return;
        }
        setStudio(s);
      }
      const ov =
        me?.role === 'school_admin'
          ? await apiFetch<StudioOverview>(`/ders-dagit/studios/${s.id}/overview`, { token })
          : null;
      if (ov) {
        setOverview(ov);
        setStudio(ov.studio);
      } else {
        setOverview(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, me?.role, studio]);

  useEffect(() => {
    void refresh();
  }, [token, me?.role]);

  return { studio, overview, loading, error, refresh };
}
