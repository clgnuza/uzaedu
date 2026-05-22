'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const STEPS = [
  { href: '/ders-dagit/studyo/kurulum', label: '1 Kurulum' },
  { href: '/ders-dagit/studyo/donem', label: '2 Dönem' },
  { href: '/ders-dagit/studyo/atamalar', label: '3 Atama' },
  { href: '/ders-dagit/studyo/kurallar', label: '4 Kurallar' },
  { href: '/ders-dagit/studyo/dogrulama', label: '5 Doğrula' },
  { href: '/ders-dagit/studyo/uret', label: '6 Üret' },
  { href: '/ders-dagit/studyo/program', label: '7 Program' },
] as const;

export function StudioProgramStepper() {
  const pathname = usePathname();
  return (
    <nav className="print:hidden flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1 text-xs">
      {STEPS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1.5 font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
