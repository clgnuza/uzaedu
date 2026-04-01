'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  MODULE_ACTIVATION_REQUIRED_EVENT,
  type ModuleActivationRequiredDetail,
} from '@/lib/module-activation-events';
import { ModuleActivationRequiredDialog } from '@/components/market/module-activation-required-dialog';

const ROLES = new Set(['teacher', 'school_admin', 'superadmin', 'moderator']);

export function ModuleActivationListener() {
  const { role } = useAuth();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<ModuleActivationRequiredDetail | null>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const ce = e as CustomEvent<ModuleActivationRequiredDetail>;
      if (role && !ROLES.has(role)) return;
      setPayload(ce.detail);
      setOpen(true);
    };
    window.addEventListener(MODULE_ACTIVATION_REQUIRED_EVENT, on);
    return () => window.removeEventListener(MODULE_ACTIVATION_REQUIRED_EVENT, on);
  }, [role]);

  if (!payload) return null;

  return (
    <ModuleActivationRequiredDialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPayload(null);
      }}
      detail={payload}
    />
  );
}
