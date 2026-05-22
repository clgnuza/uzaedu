'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, GraduationCap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENTITIES = [
  { href: '/ders-dagit/studyo/dersler', label: 'Dersler', icon: BookOpen, tone: 'bg-sky-600' },
  { href: '/ders-dagit/studyo/ogretmenler', label: 'Öğretmenler', icon: Users, tone: 'bg-teal-600' },
  { href: '/ders-dagit/studyo/derslikler', label: 'Derslikler', icon: Building2, tone: 'bg-orange-600' },
  { href: '/ders-dagit/studyo/sinif-saatleri', label: 'Sınıflar', icon: GraduationCap, tone: 'bg-violet-600' },
] as const;

export function DdStudioEntityNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn('flex flex-row gap-1 sm:flex-col sm:gap-2', className)}
      aria-label="Tanım modülleri"
    >
      {ENTITIES.map(({ href, label, icon: Icon, tone }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition-colors sm:flex-col sm:px-2 sm:py-3 sm:text-[10px]',
              active
                ? 'dd-nav-pill-active border-transparent shadow-sm'
                : 'dd-nav-pill text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5 shrink-0 sm:size-6" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
