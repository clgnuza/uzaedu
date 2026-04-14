'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Mail, Megaphone, Monitor, Tv } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { AdminMessageListSection } from '@/components/admin-message-list';
import { cn } from '@/lib/utils';

export default function SystemMessagesPage() {
  const router = useRouter();
  const { token, me } = useAuth();

  const isSchoolAdmin = me?.role === 'school_admin';

  useEffect(() => {
    if (!isSchoolAdmin) {
      router.replace('/403');
    }
  }, [isSchoolAdmin, router]);

  if (!isSchoolAdmin) return null;

  return (
    <div className="support-page space-y-2 pb-4 sm:space-y-4 sm:pb-6">
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2.5 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-cyan-400/18 blur-3xl dark:bg-cyan-500/10 sm:size-32"
          aria-hidden
        />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-10">
              <Mail className="size-[1.05rem] sm:size-[1.2rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
                Sistem mesajları
              </h1>
              <div className="mt-0.5">
                <ToolbarIconHints
                  compact
                  showOnMobile
                  className="text-[11px] sm:text-xs"
                  items={[
                    { label: 'Merkez', icon: Megaphone },
                    { label: 'Yalnız yönetici', icon: Monitor },
                  ]}
                  summary="Merkezden gelen bilgilendirmeler; öğretmenler bu listeyi görmez."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-sm">
        Öğretmen Pro merkezi tarafından yalnızca okul yöneticilerine iletilen duyurular. Bakım, politika ve hatırlatmalar burada toplanır.
      </p>

      <div
        className={cn(
          'overflow-hidden rounded-xl border border-sky-500/20 bg-linear-to-br from-sky-500/5 via-background to-violet-500/5 shadow-sm ring-1 ring-sky-500/10',
          'dark:border-sky-500/15 dark:from-sky-950/25 dark:via-background dark:to-violet-950/20 dark:ring-sky-500/15 sm:rounded-2xl',
        )}
      >
        <div className="border-b border-sky-200/40 bg-linear-to-r from-sky-500/10 via-background/90 to-violet-500/8 px-3 py-3 dark:border-sky-900/40 sm:px-4 sm:py-3.5">
          <div className="flex flex-wrap items-start gap-2 sm:gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 shadow-sm ring-1 ring-sky-500/20 dark:bg-sky-950/50 dark:text-sky-300">
              <Info className="size-4" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
              <h2 className="text-xs font-bold text-foreground sm:text-sm">Bu sayfa ne işe yarar?</h2>
              <ul className="grid gap-1.5 text-[11px] leading-snug text-muted-foreground sm:grid-cols-3 sm:gap-2 sm:text-xs">
                <li className="flex gap-2 rounded-lg border border-border/50 bg-card/80 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-2.5">
                  <Megaphone className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <span>
                    <strong className="font-medium text-foreground">Merkez mesajı</strong> — Resmi duyuru ve notlar.
                  </span>
                </li>
                <li className="flex gap-2 rounded-lg border border-border/50 bg-card/80 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-2.5">
                  <Tv className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>
                    <strong className="font-medium text-foreground">Duyuru TV değil</strong> — Okul TV duyurularından ayrıdır.
                  </span>
                </li>
                <li className="flex gap-2 rounded-lg border border-border/50 bg-card/80 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-2.5">
                  <Monitor className="mt-0.5 size-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                  <span>
                    <strong className="font-medium text-foreground">Sadece siz</strong> — Yönetici hesabınıza özeldir.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-linear-to-b from-background/80 to-muted/10 p-2.5 sm:p-4 md:p-5 dark:from-transparent dark:to-transparent">
          <AdminMessageListSection token={token} canMarkRead />
        </div>
      </div>
    </div>
  );
}
