'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, House } from 'lucide-react';
import { getBreadcrumbs } from '@/config/menu';
import type { WebAdminRole } from '@/config/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { isPublicAdminPath } from '@/lib/public-admin-paths';

const GUEST_PUBLIC_LABELS: Record<string, string> = {
  '/ek-ders-hesaplama': 'Ek ders hesaplama',
  '/hesaplamalar': 'Hesaplamalar',
  '/sinav-gorev-ucretleri': 'Sınav görev ücretleri',
  '/haberler': 'Haberler',
  '/haberler/yayin': 'Yayın',
};

type BreadcrumbProps = { guestPublicChrome?: boolean };

export function Breadcrumb({ guestPublicChrome }: BreadcrumbProps = {}) {
  const pathname = usePathname();
  const { me } = useAuth();
  const p = pathname?.split('?')[0] ?? '';
  const guest =
    guestPublicChrome ?? (!me?.role && isPublicAdminPath(p));
  const items = guest
    ? [
        { label: 'Ana sayfa', path: '/' },
        ...(GUEST_PUBLIC_LABELS[p] ? [{ label: GUEST_PUBLIC_LABELS[p] }] : [{ label: p.replace(/^\//, '') || 'Sayfa' }]),
      ]
    : getBreadcrumbs(pathname ?? '', me?.role as WebAdminRole | undefined);

  if (items.length === 0) return null;
  /** Ana sayfa: breadcrumb tekrarını kaldır (mobilde özellikle kalabalık) */
  if (p === '/dashboard' || p === '/') return null;
  /** Sayfa içinde başlık/geri var; üstteki «Ana sayfa › …» kartını gösterme */
  if (p === '/sinav-gorev-ucretleri' || p === '/ek-ders-hesaplama') return null;

  /** Bildirimler / okul değerlendirmeleri / haberler: mobilde üst breadcrumb kartı kalabalık etmesin */
  const hideOnMobile =
    p === '/sinav-gorevlerim' ||
    p === '/bildirimler' ||
    p === '/haberler' ||
    p === '/haberler/yayin' ||
    p === '/okul-degerlendirmeleri' ||
    p.startsWith('/okul-degerlendirmeleri/');

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        'mb-2 max-w-full flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-muted/25 px-2 py-1 text-[12px] font-medium shadow-sm backdrop-blur-sm sm:mb-3 sm:inline-flex sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm lg:mb-0 print:hidden',
        hideOnMobile ? 'hidden sm:inline-flex' : 'inline-flex',
      )}
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const showHome = index === 0 && (item.path === '/dashboard' || item.path === '/');
        return (
          <span key={index} className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/80 sm:size-4" />}
            {item.path && !last ? (
              <Link
                href={item.path}
                className="inline-flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
              >
                {showHome ? (
                  <>
                    <House className="size-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </>
                ) : (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            ) : (
              <span
                className={cn('min-w-0 truncate', last ? 'font-medium text-foreground' : 'text-muted-foreground')}
                aria-current={last ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
