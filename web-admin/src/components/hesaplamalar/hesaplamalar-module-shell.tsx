'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { HesaplamalarModuleNav } from './hesaplamalar-module-nav';

const HESAPLAMA_PREFIXES = [
  '/hesaplamalar',
  '/ek-ders-hesaplama',
  '/sinav-gorev-ucretleri',
  '/yolluk-hesaplama',
] as const;

function isHesaplamaRoute(pathname: string): boolean {
  return HESAPLAMA_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function HesaplamalarModuleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const role = me?.role ?? null;
  const showNav =
    isHesaplamaRoute(pathname) &&
    (role === 'teacher' || role === 'school_admin' || role === 'superadmin' || role === 'moderator');

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,11.75rem)_minmax(0,1fr)] lg:gap-4">
      <aside className="min-w-0 max-lg:order-first lg:sticky lg:top-4 lg:self-start">
        <HesaplamalarModuleNav activePath={pathname} role={role} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
