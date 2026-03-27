'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Mail, Megaphone, Monitor, Tv } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
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
    <div className="space-y-8">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-sky-100/90 to-slate-50 shadow-inner ring-1 ring-sky-200/80 dark:from-sky-500/15 dark:to-slate-900 dark:ring-sky-500/20">
                <Mail className="size-7 text-sky-600 dark:text-sky-300" aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <ToolbarPageTitle className="text-2xl tracking-tight text-slate-900 dark:text-slate-50">Sistem mesajları</ToolbarPageTitle>
                <p className="max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  Öğretmen Pro merkezi tarafından yalnızca okul yöneticilerine iletilen bilgilendirmeler. Bakım, politika veya
                  hatırlatmalar burada toplanır.
                </p>
              </div>
            </div>
          </div>
        </ToolbarHeading>
      </Toolbar>

      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/50 shadow-sm',
          'ring-1 ring-slate-200/60 dark:border-slate-700/60 dark:bg-slate-950/40 dark:ring-slate-700/50',
        )}
      >
        <div className="border-b border-slate-200/80 bg-slate-100/60 px-5 py-4 dark:border-slate-700/50 dark:bg-slate-900/50">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-sky-300 dark:ring-slate-600/50">
              <Info className="size-[18px]" strokeWidth={2} aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bu sayfa ne işe yarar?</h2>
              <ul className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                <li className="flex gap-2.5 rounded-xl bg-white/90 p-3 ring-1 ring-slate-200/80 dark:bg-slate-900/60 dark:ring-slate-600/40">
                  <Megaphone className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <span>
                    <strong className="font-medium text-slate-800 dark:text-slate-100">Merkez mesajı</strong> — Platform yönetiminden gelen resmi
                    duyuru ve notlar.
                  </span>
                </li>
                <li className="flex gap-2.5 rounded-xl bg-white/90 p-3 ring-1 ring-slate-200/80 dark:bg-slate-900/60 dark:ring-slate-600/40">
                  <Tv className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <span>
                    <strong className="font-medium text-slate-800 dark:text-slate-100">Duyuru TV değil</strong> — Okul içi TV / sınıf ekranı
                    duyurularıyla karıştırmayın; bu liste yalnızca yönetim paneli içindir.
                  </span>
                </li>
                <li className="flex gap-2.5 rounded-xl bg-white/90 p-3 ring-1 ring-slate-200/80 dark:bg-slate-900/60 dark:ring-slate-600/40">
                  <Monitor className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <span>
                    <strong className="font-medium text-slate-800 dark:text-slate-100">Sadece siz</strong> — Mesajlar okul yöneticisi hesabınıza
                    özeldir; öğretmenler bu listeyi görmez.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-slate-50/30 p-5 sm:p-6 dark:bg-transparent">
          <AdminMessageListSection token={token} canMarkRead />
        </div>
      </div>
    </div>
  );
}
