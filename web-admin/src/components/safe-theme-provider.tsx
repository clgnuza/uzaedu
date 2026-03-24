'use client';

import { useState, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';

const STORAGE_KEY = 'ogretmenpro-theme';

function canUseStorage(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/** Storage engellendiğinde sadece light tema; persistence yok */
function FallbackThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
  }, []);
  return <>{children}</>;
}

/**
 * Storage kullanılamadığında (iframe, gizlilik ayarları, eklentiler) next-themes
 * "Access to storage is not allowed" hatası verebilir. Bu wrapper önce storage
 * erişimini test eder; engellenmişse FallbackThemeProvider kullanır.
 */
export function SafeThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof ThemeProvider>) {
  const [storageOk, setStorageOk] = useState<boolean | null>(null);

  useEffect(() => {
    setStorageOk(canUseStorage());
  }, []);

  if (storageOk !== true) {
    return <FallbackThemeProvider>{children}</FallbackThemeProvider>;
  }

  return (
    <ThemeProvider {...props} storageKey={STORAGE_KEY}>
      {children}
    </ThemeProvider>
  );
}
