'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import './ders-dagit-theme.css';

const WIDE_RE = /^\/ders-dagit\/studyo\/(program|ogretmen-program)(\/|$)/;

export function DersDagitShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = WIDE_RE.test(pathname ?? '');

  return (
    <div className={cn('ders-dagit-theme min-h-0 w-full', wide ? 'dd-wide' : 'dd-standard')}>
      <div className="dd-inner">{children}</div>
    </div>
  );
}
