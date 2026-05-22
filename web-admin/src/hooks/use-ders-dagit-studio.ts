'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, isApiErrorCode } from '@/lib/api';

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

let createStudioInflight: Promise<DersDagitStudio> | null = null;

async function createStudioOnce(token: string): Promise<DersDagitStudio> {
  if (!createStudioInflight) {
    createStudioInflight = apiFetch<DersDagitStudio>('/ders-dagit/studios', {
      token,
      method: 'POST',
      body: JSON.stringify({}),
    }).finally(() => {
      createStudioInflight = null;
    });
  }
  return createStudioInflight;
}

export function useDersDagitStudio() {
  const { token, me } = useAuth();
  const [studio, setStudio] = useState<DersDagitStudio | null>(null);
  const [overview, setOverview] = useState<StudioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token || (me?.role !== 'school_admin' && me?.role !== 'teacher')) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<DersDagitStudio[]>('/ders-dagit/studios', { token });
      let s = list[0] ?? null;
      if (!s && me?.role === 'school_admin') {
        s = await createStudioOnce(token);
      }
      if (!s) {
        setError('Henüz stüdyo oluşturulmamış');
        setStudio(null);
        setOverview(null);
        return;
      }
      setStudio(s);
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
      if (isApiErrorCode(e, 'MODULE_DISABLED')) {
        setError('Bu okulda DersDağıt modülü kapalı. Okul ayarlarından modülü açın.');
      } else {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
      }
    } finally {
      setLoading(false);
    }
  }, [token, me?.role]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { studio, overview, loading, error, refresh };
}
