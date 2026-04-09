'use client';

import Link from 'next/link';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';
import { cn } from '@/lib/utils';

const pill =
  'flex min-h-[1.35rem] w-full min-w-0 items-center justify-center whitespace-nowrap rounded-full border border-border/40 bg-background/60 px-0.5 py-0.5 text-[7px] font-medium leading-none tracking-tight text-muted-foreground shadow-sm shadow-black/[0.03] transition-all hover:border-primary/25 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 min-[380px]:px-1 min-[380px]:text-[8px] sm:min-h-7 sm:px-2 sm:text-[9px] sm:tracking-normal md:text-[10px] dark:bg-muted/20 dark:shadow-none';

export function AuthLegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn('grid w-full min-w-0 grid-cols-4 gap-0.5 min-[360px]:gap-1 sm:gap-1.5', className)}
      aria-label="Yasal ve çerez"
    >
      <Link href="/gizlilik" className={pill} title="Kişisel verilerin korunması (KVKK aydınlatma metni)">
        KVKK aydınlatma
      </Link>
      <Link href="/kullanim-sartlari" className={pill} title="Site ve hizmet kullanım şartları">
        Kullanım şartları
      </Link>
      <Link href="/cerez" className={pill} title="Çerez türleri, amaçlar ve haklarınız">
        Çerez politikası
      </Link>
      <CookiePreferencesLink className={pill}>Çerez tercihleri</CookiePreferencesLink>
    </footer>
  );
}
