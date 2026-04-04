'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { MODULE_ACTIVATION_REFRESH_EVENT } from '@/lib/module-activation-events';
import type { SchoolModuleKey } from '@/config/school-modules';

type ActivationStatusRes = {
  billing_account: 'user' | 'school';
  modules: Record<string, { free: boolean; active: boolean }>;
};

export function isMarketModuleLocked(
  modules: Record<string, { free: boolean; active: boolean }> | null,
  key: SchoolModuleKey | null,
): boolean {
  if (!key || !modules) return false;
  const row = modules[key];
  return !!row && !row.free && !row.active;
}

export function useMarketModuleActivationMap(token: string | null, role: string | undefined) {
  const [modules, setModules] = useState<Record<string, { free: boolean; active: boolean }> | null>(null);

  const load = useCallback(async () => {
    if (!token || role === 'superadmin' || role === 'moderator') {
      setModules({});
      return;
    }
    try {
      const data = await apiFetch<ActivationStatusRes>('/market/modules/activation-status', { token });
      setModules(data.modules);
    } catch {
      setModules({});
    }
  }, [token, role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const on = () => void load();
    window.addEventListener(MODULE_ACTIVATION_REFRESH_EVENT, on);
    return () => window.removeEventListener(MODULE_ACTIVATION_REFRESH_EVENT, on);
  }, [load]);

  return modules;
}
