'use client';

import { createContext, ReactNode, useContext, useLayoutEffect, useState } from 'react';

type SidebarTheme = 'dark' | 'light';

const STORAGE_SIDEBAR_THEME = 'ogretmenpro-sidebar-theme';
const STORAGE_SIDEBAR_COLLAPSE = 'ogretmenpro-sidebar-collapse';

function getStoredSidebarTheme(): SidebarTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = localStorage.getItem(STORAGE_SIDEBAR_THEME);
    if (v === 'dark' || v === 'light') return v;
  } catch {}
  return 'light';
}

function getStoredSidebarCollapse(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const v = localStorage.getItem(STORAGE_SIDEBAR_COLLAPSE);
    return v === 'true';
  } catch {}
  return false;
}

interface LayoutState {
  sidebarCollapse: boolean;
  setSidebarCollapse: (v: boolean) => void;
  sidebarTheme: SidebarTheme;
  setSidebarTheme: (v: SidebarTheme) => void;
}

const LayoutContext = createContext<LayoutState | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapse, setSidebarCollapseState] = useState(false);
  const [sidebarTheme, setSidebarThemeState] = useState<SidebarTheme>('light');

  /** Boya öncesi localStorage ile senkron — yanlış “tam genişlik” flaşı ve body sınıfı uyumsuzluğunu önler */
  useLayoutEffect(() => {
    setSidebarThemeState(getStoredSidebarTheme());
    setSidebarCollapseState(getStoredSidebarCollapse());
  }, []);

  const setSidebarCollapse = (v: boolean) => {
    setSidebarCollapseState(v);
    try {
      localStorage.setItem(STORAGE_SIDEBAR_COLLAPSE, String(v));
    } catch {}
  };

  const setSidebarTheme = (v: SidebarTheme) => {
    setSidebarThemeState(v);
    try {
      localStorage.setItem(STORAGE_SIDEBAR_THEME, v);
    } catch {}
  };

  return (
    <LayoutContext.Provider
      value={{
        sidebarCollapse,
        setSidebarCollapse,
        sidebarTheme,
        setSidebarTheme,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutState {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider');
  return ctx;
}
