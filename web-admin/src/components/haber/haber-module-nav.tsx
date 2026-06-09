'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Megaphone, Newspaper, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const HABER_NAV_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  superadminOnly?: boolean;
}[] = [
  { href: '/haberler', label: 'Haberler', icon: Newspaper },
  { href: '/haberler/yayin', label: 'Haber yayın', icon: Megaphone },
  { href: '/haberler/ayarlar', label: 'Ayarlar', icon: Settings, superadminOnly: true },
];

export function HaberModuleNav({
  activePath,
  isSuperadmin = false,
}: {
  activePath: string;
  isSuperadmin?: boolean;
}) {
  const items = HABER_NAV_ITEMS.filter((item) => !item.superadminOnly || isSuperadmin);

  return (
    <nav className="haber-module-nav" aria-label="Haber menüsü">
      <div className="haber-module-nav-card">
        <div className="haber-module-nav-head">
          <span className="haber-module-nav-icon" aria-hidden>
            <Newspaper className="size-3.5" strokeWidth={2} />
          </span>
          <span className="haber-module-nav-title">Haber ve yayın</span>
        </div>
        <ul className="haber-module-nav-list">
          {items.map((item) => {
            const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-nav-active={active ? 'true' : undefined}
                  className={cn('haber-module-nav-link', active && 'haber-module-nav-link--active')}
                >
                  <Icon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
