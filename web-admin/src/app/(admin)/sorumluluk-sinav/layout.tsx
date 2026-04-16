'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LayoutGrid, Users, CalendarRange, Shuffle, UserCheck, FileDown, Bell } from 'lucide-react';

const TEACHER_TABS = [
  {
    path: '/sorumluluk-sinav/bilgilendirme',
    label: 'Görev bilgilendirmem',
    icon: Bell,
    step: '1',
    hint: 'Size atanan sınav görevleri',
    match: (p: string) => p.startsWith('/sorumluluk-sinav/bilgilendirme'),
    idle:
      'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 dark:bg-teal-950/35 dark:text-teal-200 dark:border-teal-800/50',
    active: 'bg-teal-600 text-white border-teal-600 shadow-teal-500/35 shadow-md',
    dot: 'bg-teal-400',
  },
] as const;

const TABS = [
  {
    path:     '/sorumluluk-sinav',
    label:    'Gruplar',
    icon:     LayoutGrid,
    adminOnly: false,
    step:     '1',
    hint:     'Sınav grubu oluştur',
    match:    (p: string) => p === '/sorumluluk-sinav',
    idle:     'bg-indigo-50  text-indigo-700  border-indigo-200  hover:bg-indigo-100  dark:bg-indigo-950/30  dark:text-indigo-300  dark:border-indigo-800/40',
    active:   'bg-indigo-600 text-white       border-indigo-600  shadow-indigo-500/35 shadow-md',
    dot:      'bg-indigo-400',
  },
  {
    path:     '/sorumluluk-sinav/ogrenciler',
    label:    'Öğrenciler',
    icon:     Users,
    adminOnly: false,
    step:     '2',
    hint:     'Öğrenci & ders ekle',
    match:    (p: string) => p.startsWith('/sorumluluk-sinav/ogrenciler'),
    idle:     'bg-sky-50     text-sky-700     border-sky-200     hover:bg-sky-100     dark:bg-sky-950/30     dark:text-sky-300     dark:border-sky-800/40',
    active:   'bg-sky-600    text-white       border-sky-600     shadow-sky-500/35    shadow-md',
    dot:      'bg-sky-400',
  },
  {
    path:     '/sorumluluk-sinav/oturumlar',
    label:    'Oturumlar',
    icon:     CalendarRange,
    adminOnly: true,
    step:     '3',
    hint:     'Tarih / saat / salon',
    match:    (p: string) => p.startsWith('/sorumluluk-sinav/oturumlar'),
    idle:     'bg-amber-50   text-amber-700   border-amber-200   hover:bg-amber-100   dark:bg-amber-950/30   dark:text-amber-300   dark:border-amber-800/40',
    active:   'bg-amber-500  text-white       border-amber-500   shadow-amber-500/35  shadow-md',
    dot:      'bg-amber-400',
  },
  {
    path:     '/sorumluluk-sinav/programlama',
    label:    'Programlama',
    icon:     Shuffle,
    adminOnly: true,
    step:     '4',
    hint:     'Otomatik / manuel ata',
    match:    (p: string) => p.startsWith('/sorumluluk-sinav/programlama'),
    idle:     'bg-violet-50  text-violet-700  border-violet-200  hover:bg-violet-100  dark:bg-violet-950/30  dark:text-violet-300  dark:border-violet-800/40',
    active:   'bg-violet-600 text-white       border-violet-600  shadow-violet-500/35 shadow-md',
    dot:      'bg-violet-400',
  },
  {
    path:     '/sorumluluk-sinav/gorevlendirme',
    label:    'Görevlendirme',
    icon:     UserCheck,
    adminOnly: true,
    step:     '5',
    hint:     'Komisyon & gözcü',
    match:    (p: string) => p.startsWith('/sorumluluk-sinav/gorevlendirme'),
    idle:     'bg-teal-50    text-teal-700    border-teal-200    hover:bg-teal-100    dark:bg-teal-950/30    dark:text-teal-300    dark:border-teal-800/40',
    active:   'bg-teal-600   text-white       border-teal-600    shadow-teal-500/35   shadow-md',
    dot:      'bg-teal-400',
  },
  {
    path:     '/sorumluluk-sinav/raporlar',
    label:    'Raporlar',
    icon:     FileDown,
    adminOnly: false,
    step:     '6',
    hint:     'PDF & yoklama',
    match:    (p: string) => p.startsWith('/sorumluluk-sinav/raporlar'),
    idle:     'bg-emerald-50  text-emerald-700  border-emerald-200  hover:bg-emerald-100  dark:bg-emerald-950/30  dark:text-emerald-300  dark:border-emerald-800/40',
    active:   'bg-emerald-600 text-white        border-emerald-600  shadow-emerald-500/35 shadow-md',
    dot:      'bg-emerald-400',
  },
] as const;

export default function SorumlulukSinavLayout({ children }: { children: React.ReactNode }) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const { me }       = useAuth();
  const isAdmin      = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';
  const isTeacher    = me?.role === 'teacher';
  const schoolQ      = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const groupId      = searchParams.get('group_id');
  const visible      = isTeacher
    ? [...TEACHER_TABS]
    : TABS.filter((t) => !t.adminOnly || isAdmin);

  const tabHref = (path: string) => {
    const params = new URLSearchParams();
    if (schoolQ) {
      schoolQ.replace(/^\?/, '').split('&').forEach((pair) => {
        const [k, v] = pair.split('='); if (k && v) params.set(k, v);
      });
    }
    if (groupId) params.set('group_id', groupId);
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const activeTab = visible.find((t) => t.match(pathname));

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-1 sm:space-y-5 sm:px-0">
      {/* Header kart */}
      <div className="overflow-hidden rounded-xl border border-indigo-200/50 bg-linear-to-br from-indigo-500/10 via-violet-500/5 to-teal-400/8 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/55 dark:via-violet-950/25 dark:to-teal-950/15 sm:rounded-2xl">

        {/* Başlık */}
        <div className="px-3 pt-3 pb-2 sm:px-5 sm:pt-5 sm:pb-3">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-bold leading-tight tracking-tight text-indigo-950 dark:text-indigo-50 sm:text-xl">
                {isTeacher ? 'Sorumluluk sınavı — görevlerim' : 'Sorumluluk / Beceri Sınavı'}
              </h1>
              <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground sm:text-sm">
                {isTeacher
                  ? 'Yalnızca size atanan görevler; okul verilerine genel erişim yoktur.'
                  : activeTab
                    ? `${activeTab.step}. adım — ${activeTab.hint}`
                    : 'Öğrenci-ders girişi, programlama, görevlendirme ve raporlar.'}
              </p>
            </div>
            {!isTeacher && activeTab && (
              <span className="shrink-0 rounded-lg bg-white/70 px-2 py-1 text-[10px] font-bold text-indigo-700 shadow-sm dark:bg-zinc-900/60 dark:text-indigo-300 sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-sm">
                {activeTab.step} / {visible.length}
              </span>
            )}
          </div>

          {/* İlerleme çizgisi */}
          {!isTeacher ? (
          <div className="mt-2 flex gap-0.5 sm:mt-3 sm:gap-1">
            {visible.map((tab) => {
              const isActive = tab.match(pathname);
              const isPast   = parseInt(tab.step) < parseInt(activeTab?.step ?? '99');
              return (
                <Link key={tab.path} href={tabHref(tab.path)}
                  className={cn('h-1.5 flex-1 rounded-full transition-all',
                    isActive ? tab.dot :
                    isPast   ? 'bg-slate-300 dark:bg-zinc-600' :
                               'bg-slate-200 dark:bg-zinc-700/50')} />
              );
            })}
          </div>
          ) : null}
        </div>

        {/* Sekme çubuğu */}
        <nav className="flex gap-1 overflow-x-auto overscroll-x-contain px-2 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1.5 sm:px-3 sm:pb-3 [&::-webkit-scrollbar]:hidden" role="tablist">
          {visible.map((tab) => {
            const isActive = tab.match(pathname);
            const Icon     = tab.icon;
            return (
              <Link
                key={tab.path}
                href={tabHref(tab.path)}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-all duration-200 sm:flex-row sm:justify-center sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2',
                  visible.length === 1 ? 'min-w-0 sm:min-w-[72px]' : 'min-w-[4.5rem] max-sm:flex-none max-sm:min-w-[4.75rem] sm:min-w-[72px]',
                  isActive ? tab.active : tab.idle,
                )}>
                {!isTeacher ? (
                <span className={cn(
                  'inline-flex size-3.5 items-center justify-center rounded-full text-[7px] font-bold shrink-0 sm:size-4 sm:text-[8px]',
                  isActive ? 'bg-white/30 text-white' : 'bg-white/80 dark:bg-zinc-800 text-current opacity-70',
                )}>
                  {tab.step}
                </span>
                ) : null}
                <Icon className="size-3.5 shrink-0 sm:size-4" strokeWidth={2} />
                <span
                  className={cn(
                    'text-[9px] font-semibold leading-tight sm:text-[11px]',
                    visible.length === 1 ? 'sm:truncate' : 'max-w-[5.5rem] sm:max-w-none sm:truncate',
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
