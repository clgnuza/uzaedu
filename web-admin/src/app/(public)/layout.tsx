'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Star, LogIn, LayoutDashboard } from 'lucide-react';

/**
 * Herkese açık sayfalar için layout – auth zorunlu değil.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-slate-900/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Ana Sayfa
            </Link>
            <Link
              href="/okul-degerlendirmeleri"
              className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"
            >
              <Star className="size-5 text-amber-500 fill-amber-500" />
              Okul Değerlendirmeleri
            </Link>
          </div>
          <nav className="flex items-center gap-3">
            {!loading && me && (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <LayoutDashboard className="size-4" />
                Panele Dön
              </Link>
            )}
            {!loading && !me && (
              <Link
                href="/login?redirect=/okul-degerlendirmeleri"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <LogIn className="size-4" />
                Giriş Yap
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
