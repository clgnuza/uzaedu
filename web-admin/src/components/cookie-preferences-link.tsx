'use client';

import type { ReactNode } from 'react';
import { reopenCookiePreferences } from '@/lib/cookie-consent';

export function CookiePreferencesLink({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      aria-label="Rıza ve çerez tercihlerini yeniden aç"
      onClick={() => reopenCookiePreferences()}
    >
      {children ?? 'Rıza ayarları'}
    </button>
  );
}
