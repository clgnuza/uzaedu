'use client';

import { useEffect, useState } from 'react';
import {
  isPwaDeferredInstallReady,
  promptPwaDeferredInstall,
  subscribePwaDeferredInstall,
} from '@/lib/pwa-deferred-install';

export function usePwaDeferredInstall() {
  const [ready, setReady] = useState(false);

  useEffect(() => subscribePwaDeferredInstall(setReady), []);

  return {
    canInstall: ready || isPwaDeferredInstallReady(),
    promptInstall: promptPwaDeferredInstall,
  };
}
