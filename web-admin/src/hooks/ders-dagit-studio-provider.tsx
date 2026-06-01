'use client';

import type { ReactNode } from 'react';
import { DersDagitStudioContext, useDersDagitStudioState } from '@/hooks/use-ders-dagit-studio';

export function DersDagitStudioProvider({ children }: { children: ReactNode }) {
  const value = useDersDagitStudioState(true);
  return <DersDagitStudioContext.Provider value={value}>{children}</DersDagitStudioContext.Provider>;
}
