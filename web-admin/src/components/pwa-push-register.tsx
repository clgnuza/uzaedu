'use client';

import { useEffect, useRef } from 'react';
import { useAuthOptional } from '@/providers/auth-provider';
import { repairPushSubscriptionIfNeeded } from '@/lib/web-push';
import { shouldSilentRepairPushOnLogin } from '@/lib/pwa-push-permission';

/** Giriş sonrası: izin zaten verilmişse push aboneliğini sessizce onarır (yeni izin istemez). */
export function PwaPushRegister() {
  const token = useAuthOptional()?.token ?? null;
  const tried = useRef(false);

  useEffect(() => {
    if (!token || tried.current) return;
    if (!shouldSilentRepairPushOnLogin()) return;

    tried.current = true;
    void repairPushSubscriptionIfNeeded(token).catch(() => undefined);
  }, [token]);

  return null;
}
