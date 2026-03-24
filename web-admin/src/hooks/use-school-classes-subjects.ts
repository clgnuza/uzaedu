'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';

export type SchoolClass = { id: string; name: string; grade: number | null; section: string | null };
export type SchoolSubject = { id: string; name: string; code: string | null };

/**
 * Merkezi sınıf/grup ve ders verisi. BİLSEM modülünde arayüzde «grup» terimi kullanılır.
 * Ders programı, nöbet, kazanım takip, evrak gibi modüller bu veriyi tek kaynak olarak kullanabilir.
 * school_admin ve teacher rollerinde school_id varsa veri çekilir.
 */
export function useSchoolClassesSubjects() {
  const { token, me } = useAuth();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFetch = !!token && !!me?.school_id && (me?.role === 'school_admin' || me?.role === 'teacher');

  const refetch = useCallback(async () => {
    if (!canFetch) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [classesData, subjectsData] = await Promise.all([
        apiFetch<SchoolClass[]>('/classes-subjects/classes', { token: token! }),
        apiFetch<SchoolSubject[]>('/classes-subjects/subjects', { token: token! }),
      ]);
      setClasses(classesData);
      setSubjects(subjectsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri alınamadı');
      setClasses([]);
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, [canFetch, token]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    classes,
    subjects,
    loading,
    error,
    refetch,
    canManage: me?.role === 'school_admin',
  };
}
