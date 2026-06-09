'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Banknote, Calculator, ClipboardList, Settings } from 'lucide-react';
import type { WebAdminRole } from '@/config/types';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: WebAdminRole[];
};

const HESAPLAMA_NAV_ITEMS: NavItem[] = [
  { href: '/hesaplamalar', label: 'Özet', icon: Calculator, roles: ['teacher', 'school_admin', 'superadmin', 'moderator'] },
  { href: '/ek-ders-hesaplama', label: 'Ek ders hesaplama', icon: Calculator, roles: ['teacher', 'school_admin', 'superadmin', 'moderator'] },
  { href: '/sinav-gorev-ucretleri', label: 'Sınav görev ücretleri', icon: ClipboardList, roles: ['teacher', 'school_admin', 'superadmin', 'moderator'] },
  { href: '/yolluk-hesaplama/benim', label: 'Yolluk hesaplarım', icon: Banknote, roles: ['teacher'] },
  { href: '/yolluk-hesaplama/okul', label: 'Yolluk (okul)', icon: Banknote, roles: ['school_admin', 'superadmin'] },
  { href: '/yolluk-hesaplama/ayarlar', label: 'Yolluk ayarları', icon: Settings, roles: ['superadmin'] },
];

function navActive(activePath: string, href: string): boolean {
  if (href === '/hesaplamalar') return activePath === href;
  return activePath === href || activePath.startsWith(`${href}/`);
}

export function HesaplamalarModuleNav({
  activePath,
  role,
}: {
  activePath: string;
  role: WebAdminRole | null;
}) {
  if (!role) return null;
  const items = HESAPLAMA_NAV_ITEMS.filter((item) => item.roles.includes(role));
  if (items.length === 0) return null;

  return (
    <nav className="hesap-module-nav" aria-label="Hesaplamalar menüsü">
      <div className="hesap-module-nav-card">
        <div className="hesap-module-nav-head">
          <span className="hesap-module-nav-icon" aria-hidden>
            <Calculator className="size-3.5" strokeWidth={2} />
          </span>
          <span className="hesap-module-nav-title">Hesaplamalar</span>
        </div>
        <ul className="hesap-module-nav-list">
          {items.map((item) => {
            const active = navActive(activePath, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  data-nav-active={active ? 'true' : undefined}
                  className={cn('hesap-module-nav-link', active && 'hesap-module-nav-link--active')}
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
