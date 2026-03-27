'use client';

import type { ReactNode } from 'react';

/** TV sayfası wrapper – iframe içinde de dışarıda da min-h-screen ile tam dolar. */
export function TvRootShell({ children }: { isPreview?: boolean; children: ReactNode }) {
  return (
    <div className="tv-root flex min-h-screen w-full flex-col" lang="tr">
      {children}
    </div>
  );
}
