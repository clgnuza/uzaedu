'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';

export function useStudioValidation(studioId: string | null | undefined) {
  const { token } = useAuth();
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token || !studioId) return;
    setLoading(true);
    try {
      setIssues(await apiFetch<ValidationIssue[]>(`/ders-dagit/studios/${studioId}/validation`, { token }));
    } finally {
      setLoading(false);
    }
  }, [token, studioId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity !== 'error');

  return { issues, errors, warns, loading, refresh, canProceed: errors.length === 0 };
}
