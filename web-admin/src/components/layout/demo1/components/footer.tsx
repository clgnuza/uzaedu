'use client';

import Link from 'next/link';
import { Container } from '@/components/common/container';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30 py-4 print:hidden">
      <Container>
        <div className="flex flex-col md:flex-row justify-center md:justify-between items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {year} © Öğretmen Pro Web Admin
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/gizlilik" className="text-muted-foreground hover:text-foreground transition-colors">
              Gizlilik
            </Link>
            <Link href="/kullanim-sartlari" className="text-muted-foreground hover:text-foreground transition-colors">
              Kullanım Şartları
            </Link>
            <Link href="/cerez" className="text-muted-foreground hover:text-foreground transition-colors">
              Çerez politikası
            </Link>
            <CookiePreferencesLink className="text-muted-foreground hover:text-foreground transition-colors" />
          </nav>
        </div>
      </Container>
    </footer>
  );
}
