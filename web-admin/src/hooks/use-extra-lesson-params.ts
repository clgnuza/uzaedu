/**
 * Ek ders parametreleri – client-side cache ile yoğun kullanımda API yükünü azaltır.
 * TTL 5 dk; aynı semester_code için tekrar fetch yapılmaz.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { Params } from '@/lib/extra-lesson-calc';

type SemesterOption = { semester_code: string; title: string };

const CACHE_TTL_MS = 8 * 60 * 1000; // 8 dk — parametre seti sık değişmez, API yükü azalır
const paramsCache = new Map<string, { data: Params | null; ts: number }>();

/** Parametre önbelleğini temizle (örn. superadmin güncellemesi sonrası hesaplama sayfasında yenile) */
export function invalidateParamsCache(semesterCode?: string) {
  if (semesterCode) {
    paramsCache.delete(semesterCode);
  } else {
    paramsCache.clear();
  }
}

export function useExtraLessonParams(token: string | null, semesterCode: string) {
  const [params, setParams] = useState<Params | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const cacheKey = semesterCode || '__default__';

  const fetchParams = useCallback((): Promise<boolean> => {
    paramsCache.delete(cacheKey);
    setLoading(true);
    setError(null);
    const q = semesterCode ? `?semester_code=${encodeURIComponent(semesterCode)}` : '';
    return apiFetch<Params | null>(`/extra-lesson/params/active${q}`, {
      token: token ?? undefined,
      cache: 'no-store',
    })
      .then((r) => {
        const data = r ?? null;
        paramsCache.set(cacheKey, { data, ts: Date.now() });
        setParams(data);
        return true;
      })
      .catch(() => {
        setParams(null);
        setError('Parametreler yüklenemedi. Lütfen tekrar deneyin.');
        return false;
      })
      .finally(() => setLoading(false));
  }, [token, cacheKey, semesterCode]);

  useEffect(() => {
    const cached = paramsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS && refetchTrigger === 0) {
      setParams(cached.data);
      setLoading(false);
      setError(null);
      return;
    }
    fetchParams();
  }, [token, cacheKey, refetchTrigger, fetchParams]);

  const refetch = useCallback((): Promise<boolean> => fetchParams(), [fetchParams]);

  return { params, loading, error, refetch };
}

export function useAvailableSemesters(token: string | null) {
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);

  const fetchSemesters = useCallback(() => {
    return apiFetch<SemesterOption[]>('/extra-lesson/params/available-semesters', {
      token: token ?? undefined,
      cache: 'no-store',
    })
      .then((r) => {
        setSemesters(r ?? []);
        return true;
      })
      .catch(() => {
        setSemesters([]);
        return false;
      });
  }, [token]);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  return { semesters, refetchSemesters: fetchSemesters };
}
