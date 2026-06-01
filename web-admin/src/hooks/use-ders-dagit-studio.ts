'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, isApiErrorCode } from '@/lib/api';
import { invalidateStudioValidationCache } from '@/hooks/use-studio-validation';

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
  validation: Array<{
    code: string;
    severity: string;
    message: string;
    fix_hint?: string;
    href?: string;
    entity_type?: string;
    entity_id?: string;
  }>;
  health_score: number;
};

export type DersDagitStudioContextValue = {
  studio: DersDagitStudio | null;
  overview: StudioOverview | null;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
};

const STUDIO_LIST_CACHE_MS = 120_000;
const STUDIO_OVERVIEW_CACHE_MS = 90_000;

export const DersDagitStudioContext = createContext<DersDagitStudioContextValue | null>(null);

let createStudioInflight: Promise<DersDagitStudio> | null = null;
let listCache: { token: string; data: DersDagitStudio[]; at: number } | null = null;
const listInflight = new Map<string, Promise<DersDagitStudio[]>>();
const overviewCache = new Map<string, { data: StudioOverview; at: number }>();
const overviewInflight = new Map<string, Promise<StudioOverview>>();

export function clearDersDagitStudioCache() {
  listCache = null;
  overviewCache.clear();
  invalidateStudioValidationCache();
}

function fetchStudioList(token: string, force = false): Promise<DersDagitStudio[]> {
  if (!force && listCache?.token === token && Date.now() - listCache.at < STUDIO_LIST_CACHE_MS) {
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
  if (!force && cached && Date.now() - cached.at < STUDIO_OVERVIEW_CACHE_MS) {
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

function hydrateFromCaches(token: string): { studio: DersDagitStudio | null; overview: StudioOverview | null } {
  const list = listCache?.token === token ? listCache.data : null;
  const s = list?.[0] ?? null;
  if (!s) return { studio: null, overview: null };
  const ov = overviewCache.get(`${token}:${s.id}`)?.data ?? null;
  return { studio: ov?.studio ?? s, overview: ov };
}

export function useDersDagitStudioState(active: boolean): DersDagitStudioContextValue {
  const { token, me } = useAuth();
  const [studio, setStudio] = useState<DersDagitStudio | null>(null);
  const [overview, setOverview] = useState<StudioOverview | null>(null);
  const [loading, setLoading] = useState(active);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { force?: boolean }) => {
    if (!active) return;
    if (!token || (me?.role !== 'school_admin' && me?.role !== 'teacher')) {
      setLoading(false);
      return;
    }
    const force = opts?.force === true;
    if (force) clearDersDagitStudioCache();

    const warm = !force ? hydrateFromCaches(token) : { studio: null, overview: null };
    if (warm.studio) {
      setStudio(warm.studio);
      setOverview(warm.overview);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const list = await fetchStudioList(token, force);
      let s = list[0] ?? null;
      if (!s && me?.role === 'school_admin') {
        s = await createStudioOnce(token);
        clearDersDagitStudioCache();
      }
      if (!s) {
        setError('Henüz stüdyo oluşturulmamış');
        setStudio(null);
        setOverview(null);
        return;
      }
      setStudio(s);
      const ov =
        me?.role === 'school_admin' ? await fetchStudioOverview(token, s.id, force) : null;
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
  }, [active, token, me?.role]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  return { studio, overview, loading, error, refresh };
}

/** Layout içinde tek istek; stüdyo layout dışında yedek yükler */
export function useDersDagitStudio(): DersDagitStudioContextValue {
  const ctx = useContext(DersDagitStudioContext);
  const local = useDersDagitStudioState(!ctx);
  return ctx ?? local;
}
