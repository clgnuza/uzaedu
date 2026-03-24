'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetTrigger, SheetContent, SheetBody } from '@/components/ui/sheet';
import { SidebarMenu } from './sidebar-menu';
import type { WebAdminRole } from '@/config/types';

interface HeaderProps {
  role: WebAdminRole | null;
  moderatorModules?: string[] | null;
  onOpenSidebar?: () => void;
}

export function Header({ role, moderatorModules, onOpenSidebar }: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { me, logout } = useAuth();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <header className="header fixed left-0 right-0 top-0 z-10 flex h-[var(--header-height)] items-center border-b border-border bg-background">
      <div className="container-fluid flex w-full items-center justify-between gap-4">
        {/* Sol: mobil menü butonu */}
        <div className="flex items-center gap-2">
          {isMobile && (
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Menüyü aç"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="max-w-[280px] p-0">
                <SheetBody className="p-0">
                  <SidebarMenu role={role} moderatorModules={moderatorModules} />
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
          {!isMobile && onOpenSidebar && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Menüyü aç/kapat"
            >
              <Menu className="size-5" />
            </button>
          )}
        </div>

        {/* Sağ: kullanıcı */}
        <div className="relative flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {me?.display_name || me?.email}
          </span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted"
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <User className="size-4" />
              </span>
            </button>
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  aria-hidden
                  onClick={() => setUserMenuOpen(false)}
                />
                <div
                  className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card py-1.5 shadow-lg"
                  role="menu"
                >
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <User className="size-4 text-muted-foreground" />
                    Profil
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-muted"
                    onClick={() => {
                      logout();
                      setUserMenuOpen(false);
                      router.refresh();
                    }}
                  >
                    <LogOut className="size-4" />
                    Çıkış
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
