'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLayout } from './context';

export function SidebarHeader() {
  const { sidebarCollapse, setSidebarCollapse, sidebarTheme } = useLayout();

  return (
    <div
      className={cn(
        'flex h-[var(--header-height)] items-center justify-between border-b border-border px-5',
        sidebarTheme === 'dark' && 'dark border-zinc-700',
      )}
    >
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-foreground hover:opacity-90">
        Öğretmen Pro
      </Link>
      <button
        type="button"
        onClick={() => setSidebarCollapse(!sidebarCollapse)}
        className="hidden rounded p-1 hover:bg-muted lg:inline-flex"
        aria-label={sidebarCollapse ? 'Menüyü aç' : 'Menüyü daralt'}
      >
        <ChevronLeft
          className={cn('size-5 text-muted-foreground', sidebarCollapse && 'rotate-180')}
        />
      </button>
    </div>
  );
}
