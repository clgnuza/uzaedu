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

const STUDIO_CACHE_MS = 4000;

let createStudioInflight: Promise<DersDagitStudio> | null = null;
let listCache: { token: string; data: DersDagitStudio[]; at: number } | null = null;
const listInflight = new Map<string, Promise<DersDagitStudio[]>>();
const overviewCache = new Map<string, { data: StudioOverview; at: number }>();
const overviewInflight = new Map<string, Promise<StudioOverview>>();

function clearStudioFetchCache() {
  listCache = null;
  overviewCache.clear();
}

function fetchStudioList(token: string, force = false): Promise<DersDagitStudio[]> {
  if (!force && listCache?.token === token && Date.now() - listCache.at < STUDIO_CACHE_MS) {
    return Promise.resolve(listCache.data);
  }
  const inflight = listInflight.get(token);
  if (inflight) return inflight;
  const p = apiFetch<DersDagitStudio[]>('/ders-dagit/studios', { token })
    .then((data) => {
      listCache = { token, data, at: Date.now() };
      return data;
    })
    .finally(() => {
      listInflight.delete(token);
    });
  listInflight.set(token, p);
  return p;
}

function fetchStudioOverview(token: string, studioId: string, force = false): Promise<StudioOverview> {
  const key = `${token}:${studioId}`;
  const cached = overviewCache.get(key);
  if (!force && cached && Date.now() - cached.at < STUDIO_CACHE_MS) {
    return Promise.resolve(cached.data);
  }
  const inflight = overviewInflight.get(key);
  if (inflight) return inflight;
  const p = apiFetch<StudioOverview>(`/ders-dagit/studios/${studioId}/overview`, { token })
    .then((data) => {
      overviewCache.set(key, { data, at: Date.now() });
      return data;
    })
    .finally(() => {
      overviewInflight.delete(key);
    });
  overviewInflight.set(key, p);
  return p;
}

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

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    if (!token || (me?.role !== 'school_admin' && me?.role !== 'teacher')) {
      setLoading(false);
      return;
    }
    const force = opts?.force === true;
    if (force) clearStudioFetchCache();
    setLoading(true);
    setError(null);
    try {
      const list = await fetchStudioList(token, force);
      let s = list[0] ?? null;
      if (!s && me?.role === 'school_admin') {
        s = await createStudioOnce(token);
        clearStudioFetchCache();
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
          ? await fetchStudioOverview(token, s.id, force)
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
