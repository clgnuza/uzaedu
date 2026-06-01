'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, GraduationCap, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENTITIES = [
  { href: '/ders-dagit/studyo/dersler', label: 'Dersler', icon: BookOpen, entity: 'dersler' },
  { href: '/ders-dagit/studyo/ogretmenler', label: 'Öğretmenler', icon: Users, entity: 'ogretmenler' },
  { href: '/ders-dagit/studyo/derslikler', label: 'Derslikler', icon: Building2, entity: 'derslikler' },
  { href: '/ders-dagit/studyo/sinif-saatleri', label: 'Sınıflar', icon: GraduationCap, entity: 'siniflar' },
] as const;

export function DdStudioEntityNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn('dd-entity-rail-nav', className)} aria-label="Tanım modülleri">
      {ENTITIES.map(({ href, label, icon: Icon, entity }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            data-entity={entity}
            className={cn('dd-entity-rail-link', active && 'dd-entity-rail-link-active')}
          >
            <span className="dd-entity-rail-icon">
              <Icon className="size-5 shrink-0" strokeWidth={2} />
            </span>
            <span className="hidden text-center sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
