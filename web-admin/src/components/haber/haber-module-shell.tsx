'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { HaberModuleNav } from './haber-module-nav';

export function HaberModuleShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me } = useAuth();
  const showNav =
    me?.role === 'teacher' || me?.role === 'school_admin' || me?.role === 'superadmin';

  if (!showNav) {
    return <>{children}</>;
  }

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,11.75rem)_minmax(0,1fr)] lg:gap-4">
      <aside className="min-w-0 max-lg:order-first lg:sticky lg:top-4 lg:self-start">
        <HaberModuleNav activePath={pathname} isSuperadmin={me?.role === 'superadmin'} />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
