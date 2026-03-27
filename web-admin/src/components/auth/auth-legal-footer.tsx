'use client';

import Link from 'next/link';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';
import { cn } from '@/lib/utils';

const pill =
  'inline-flex min-h-7 items-center rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[10px] font-medium leading-none tracking-wide text-muted-foreground shadow-sm shadow-black/[0.03] transition-all hover:border-primary/25 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:bg-muted/20 dark:shadow-none';

export function AuthLegalFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}
      aria-label="Yasal ve çerez"
    >
      <Link href="/gizlilik" className={pill}>
        Gizlilik
      </Link>
      <Link href="/kullanim-sartlari" className={pill}>
        Şartlar
      </Link>
      <Link href="/cerez" className={pill}>
        Çerez politikası
      </Link>
      <CookiePreferencesLink className={pill}>Rıza ayarları</CookiePreferencesLink>
    </footer>
  );
}
