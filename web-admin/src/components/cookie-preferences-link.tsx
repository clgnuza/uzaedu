'use client';

import { reopenCookiePreferences } from '@/lib/cookie-consent';

export function CookiePreferencesLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      aria-label="Rıza ve çerez tercihlerini yeniden aç"
      onClick={() => reopenCookiePreferences()}
    >
      Rıza ayarları
    </button>
  );
}
