'use client';

import { useEffect, useState } from 'react';
import { fetchWebExtrasSupportEnabled, getSupportEnabledSnapshot } from '@/lib/support-module-cache';

function initialSupportEnabled(): boolean | null {
  const s = getSupportEnabledSnapshot();
  if (s === false) return false;
  return null;
}

export function useSupportModuleAvailability() {
  const [supportEnabled, setSupportEnabled] = useState<boolean | null>(initialSupportEnabled);

  useEffect(() => {
    let active = true;
    fetchWebExtrasSupportEnabled()
      .then((enabled) => {
        if (!active) return;
        setSupportEnabled(enabled);
      })
      .catch(() => {
        if (!active) return;
        setSupportEnabled(getSupportEnabledSnapshot() ?? true);
      });
    return () => {
      active = false;
    };
  }, []);

  return {
    supportEnabled,
    loading: supportEnabled === null,
  };
}
