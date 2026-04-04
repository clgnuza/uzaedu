'use client';

import Link from 'next/link';
import type { Me } from '@/providers/auth-provider';
import { useAuth } from '@/hooks/use-auth';
import { useMarketModuleActivationMap, isMarketModuleLocked } from '@/hooks/use-market-module-activation-map';
import { getMarketModuleKeyForPath } from '@/config/module-market-route';
import { SCHOOL_MODULE_KEYS, type SchoolModuleKey } from '@/config/school-modules';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowRight,
  Award,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Coins,
  Clock,
  FileText,
  Headphones,
  Heart,
  Layers,
  LayoutDashboard,
  MapPin,
  Monitor,
  Newspaper,
  ScanLine,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Table2,
  Target,
  User,
  XCircle,
  Undo2,
  Calculator,
  Lock,
} from 'lucide-react';
import { WelcomeMotivationBanner } from '@/components/dashboard/welcome-motivation-banner';
import { TeacherSchoolJoinBanner } from '@/components/dashboard/teacher-school-join-banner';

function greetingTr(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Günaydın';
  if (h >= 12 && h < 18) return 'İyi günler';
  if (h >= 18 && h < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}

function formatTodayTr(): string {
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

/** Okul `enabled_modules` boş veya tanımsızsa tüm okul modülleri erişilebilir kabul edilir (menü ile uyumlu). */
export function isSchoolModuleEnabled(
  enabledModules: string[] | null | undefined,
  moduleKey: string
): boolean {
  if (!enabledModules || enabledModules.length === 0) return true;
  return enabledModules.includes(moduleKey);
}

type QuickIcon = typeof Calendar;

type QuickItem = {
  href: string;
  title: string;
  desc: string;
  icon: QuickIcon;
  accent: string;
  /** Tanımlıysa yalnızca bu okul modülü açıkken gösterilir */
  schoolModule?: string;
};

type QuickSection = { label: string; items: QuickItem[] };

function marketKeyForQuickItem(item: QuickItem): SchoolModuleKey | null {
  if (item.schoolModule && SCHOOL_MODULE_KEYS.includes(item.schoolModule as SchoolModuleKey)) {
    return item.schoolModule as SchoolModuleKey;
  }
  return getMarketModuleKeyForPath(item.href);
}

function buildTeacherQuickSections(enabledModules: string[] | null | undefined): QuickSection[] {
  const sections: QuickSection[] = [
    {
      label: 'Hesaplamalar',
      items: [
        {
          href: '/hesaplamalar',
          title: 'Hesaplamalar',
          desc: 'Ek ders, sınav görev ücreti ve diğer hesap sayfaları',
          icon: Calculator,
          accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-800 dark:text-violet-300',
        },
      ],
    },
    {
      label: 'Plan ve ders',
      items: [
        {
          href: '/akademik-takvim',
          title: 'Akademik takvim',
          desc: 'Takvim ve belirli gün görevleri',
          icon: Calendar,
          accent: 'from-amber-500/20 to-orange-500/10 text-amber-700 dark:text-amber-300',
        },
        {
          href: '/ders-programi/programlarim',
          title: 'Ders programım',
          desc: 'Haftalık program',
          icon: Table2,
          accent: 'from-emerald-500/20 to-teal-500/10 text-emerald-700 dark:text-emerald-300',
        },
        {
          href: '/evrak',
          title: 'MEB yıllık plan',
          desc: 'Plan talebi ve Word çıktısı',
          icon: FileText,
          accent: 'from-teal-500/20 to-cyan-500/10 text-teal-700 dark:text-teal-300',
          schoolModule: 'document',
        },
        {
          href: '/ogretmen-ajandasi',
          title: 'Öğretmen ajandası',
          desc: 'Ajanda kayıtları',
          icon: CalendarClock,
          accent: 'from-sky-500/20 to-blue-500/10 text-sky-700 dark:text-sky-300',
          schoolModule: 'teacher_agenda',
        },
        {
          href: '/ogretmen-ajandasi/degerlendirme',
          title: 'Öğrenci değerlendirme',
          desc: 'Ajanda üzerinden değerlendirme',
          icon: Target,
          accent: 'from-blue-500/20 to-cyan-500/10 text-blue-700 dark:text-blue-300',
          schoolModule: 'teacher_agenda',
        },
      ],
    },
    {
      label: 'Okul araçları',
      items: [
        {
          href: '/duty',
          title: 'Nöbet ve görevler',
          desc: 'Günlük nöbet, tercih, takas',
          icon: CalendarClock,
          accent: 'from-emerald-500/20 to-green-500/10 text-emerald-800 dark:text-emerald-300',
          schoolModule: 'duty',
        },
        {
          href: '/akilli-tahta',
          title: 'Akıllı tahta',
          desc: 'İçerik ve oturum',
          icon: Monitor,
          accent: 'from-violet-500/20 to-purple-500/10 text-violet-700 dark:text-violet-300',
          schoolModule: 'smart_board',
        },
      ],
    },
    {
      label: 'BİLSEM',
      items: [
        {
          href: '/bilsem/takvim',
          title: 'BİLSEM takvimi',
          desc: 'Haftalık plan ve etkinlikler',
          icon: Calendar,
          accent: 'from-violet-500/20 to-fuchsia-500/10 text-violet-800 dark:text-violet-300',
          schoolModule: 'bilsem',
        },
        {
          href: '/bilsem/yillik-plan',
          title: 'BİLSEM yıllık plan',
          desc: 'Word plan çıktısı',
          icon: Layers,
          accent: 'from-fuchsia-500/20 to-purple-500/10 text-fuchsia-800 dark:text-fuchsia-300',
          schoolModule: 'bilsem',
        },
      ],
    },
    {
      label: 'Ölçme',
      items: [
        {
          href: '/optik-formlar',
          title: 'Optik formlar',
          desc: 'Optik işlemleri',
          icon: ScanLine,
          accent: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-800 dark:text-fuchsia-300',
          schoolModule: 'optical',
        },
      ],
    },
    {
      label: 'Öğrenci ve topluluk',
      items: [
        {
          href: '/kazanim-takip',
          title: 'Kazanım takibi',
          desc: 'Branş kazanımları',
          icon: Target,
          accent: 'from-indigo-500/20 to-violet-500/10 text-indigo-700 dark:text-indigo-300',
          schoolModule: 'outcome',
        },
        {
          href: '/school-reviews',
          title: 'Okul değerlendirmeleri',
          desc: 'Araştır ve puanla',
          icon: Star,
          accent: 'from-orange-500/20 to-amber-500/10 text-orange-700 dark:text-orange-300',
          schoolModule: 'school_reviews',
        },
        {
          href: '/favoriler',
          title: 'Favorilerim',
          desc: 'Kayıtlı okullar',
          icon: Heart,
          accent: 'from-rose-500/20 to-pink-500/10 text-rose-700 dark:text-rose-300',
          schoolModule: 'school_reviews',
        },
      ],
    },
    {
      label: 'Haber ve sınav',
      items: [
        {
          href: '/haberler',
          title: 'Haberler',
          desc: 'Okul ve platform haberleri',
          icon: Newspaper,
          accent: 'from-violet-500/20 to-purple-500/10 text-violet-700 dark:text-violet-300',
        },
        {
          href: '/haberler/yayin',
          title: 'Haber yayını',
          desc: 'Yayın oluştur ve paylaş',
          icon: Sparkles,
          accent: 'from-amber-500/20 to-yellow-500/10 text-amber-800 dark:text-amber-300',
        },
        {
          href: '/sinav-gorevlerim',
          title: 'Sınav görevlerim',
          desc: 'Atanan sınavlar',
          icon: ClipboardList,
          accent: 'from-slate-500/20 to-zinc-500/10 text-slate-700 dark:text-slate-300',
        },
      ],
    },
    {
      label: 'Hizmetler',
      items: [
        {
          href: '/market',
          title: 'Market',
          desc: 'İçerik ve satın alma',
          icon: ShoppingBag,
          accent: 'from-emerald-500/20 to-green-500/10 text-emerald-800 dark:text-emerald-300',
        },
        {
          href: '/market/rewarded-ad',
          title: 'Reklamla jeton',
          desc: 'Ödüllü reklam (mobil)',
          icon: Coins,
          accent: 'from-violet-500/20 to-purple-500/10 text-violet-800 dark:text-violet-300',
        },
        {
          href: '/support',
          title: 'Destek talepleri',
          desc: 'Yardım ve talep oluştur',
          icon: Headphones,
          accent: 'from-cyan-500/20 to-sky-500/10 text-cyan-800 dark:text-cyan-300',
        },
      ],
    },
    {
      label: 'Hesap',
      items: [
        {
          href: '/profile',
          title: 'Profilim',
          desc: 'Bilgiler ve tercihler',
          icon: User,
          accent: 'from-fuchsia-500/20 to-pink-500/10 text-fuchsia-700 dark:text-fuchsia-300',
        },
        {
          href: '/settings',
          title: 'Ayarlar',
          desc: 'Uygulama ayarları',
          icon: Settings,
          accent: 'from-zinc-500/20 to-neutral-500/10 text-zinc-700 dark:text-zinc-300',
        },
      ],
    },
  ];

  return sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) =>
        it.schoolModule ? isSchoolModuleEnabled(enabledModules, it.schoolModule) : true
      ),
    }))
    .filter((sec) => sec.items.length > 0);
}

type DutySlot = { user_id: string; area_name: string | null; slot_name: string | null; shift?: string };
type Pref = { id?: string; date: string; status: string };
type Swap = {
  id: string;
  status: string;
  duty_slot?: { date: string; area_name: string | null };
  proposedUser?: { display_name: string | null; email: string };
};
type Assignment = {
  id: string;
  itemTitle: string;
  weekDateStart: string | null;
  weekDateEnd: string | null;
  weekLabel: string | null;
  gorevTipi: string;
};

export type TeacherHomeProps = {
  me: Me;
  displayName: string;
  allNotificationsUnread: number;
  todayDuty: { date: string; slots: DutySlot[] } | null;
  belirliGunAssignments: Assignment[];
  teacherPrefs: Pref[];
  teacherSwaps: Swap[];
};

export function TeacherHome({
  me,
  displayName,
  allNotificationsUnread,
  todayDuty,
  belirliGunAssignments,
  teacherPrefs,
  teacherSwaps,
}: TeacherHomeProps) {
  const { token } = useAuth();
  const activationModules = useMarketModuleActivationMap(token, me.role);
  const enabledModules = me.school?.enabled_modules ?? null;
  const quickSections = buildTeacherQuickSections(enabledModules);
  const dutyEnabled = isSchoolModuleEnabled(enabledModules, 'duty');
  const dutyMarketLocked = dutyEnabled && isMarketModuleLocked(activationModules, 'duty');
  const mySlots = (todayDuty?.slots ?? []).filter((s) => s.user_id === me.id);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-3 pb-6 sm:space-y-6 sm:px-4 lg:px-2">
      <WelcomeMotivationBanner />
      <TeacherSchoolJoinBanner me={me} />
      <section
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/60 sm:rounded-3xl',
          'bg-gradient-to-br from-sky-500/[0.12] via-background to-violet-500/[0.08]',
          'dark:from-sky-950/50 dark:via-background dark:to-violet-950/40',
          'p-4 shadow-sm sm:p-6 md:p-8',
        )}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-sky-400/20 to-violet-400/10 blur-3xl dark:from-sky-500/10 dark:to-violet-500/10"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gradient-to-tr from-teal-400/10 to-transparent blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium tracking-wide text-muted-foreground">{greetingTr()}</p>
            <h1 className="text-balance break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {displayName}
            </h1>
            {me.school?.name && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                  <Sparkles className="size-3.5 text-amber-500" aria-hidden />
                  {me.school.name}
                </span>
              </p>
            )}
            <time className="block text-xs text-muted-foreground/90" dateTime={new Date().toISOString()}>
              {formatTodayTr()}
            </time>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
            <Link
              href="/bildirimler"
              className={cn(
                'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all sm:w-auto',
                'border-border/80 bg-background/80 backdrop-blur-sm hover:border-primary/40 hover:bg-background',
                allNotificationsUnread > 0 && 'border-indigo-300/60 bg-indigo-50/90 dark:border-indigo-500/40 dark:bg-indigo-950/40',
              )}
            >
              <Bell className="size-4 shrink-0" />
              Bildirimler
              {allNotificationsUnread > 0 && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-indigo-500">
                  {allNotificationsUnread > 99 ? '99+' : allNotificationsUnread}
                </span>
              )}
            </Link>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end sm:gap-2">
              <Link
                href="/market"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-muted/80"
              >
                <ShoppingBag className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Market
              </Link>
              <Link
                href="/support"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-muted/80"
              >
                <Headphones className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                Destek
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-6 xl:grid xl:grid-cols-12 xl:items-start xl:gap-8">
        <div className="min-w-0 space-y-6 xl:col-span-8 xl:space-y-8">
      <div
        className={cn(
          '-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 sm:mx-0 sm:grid sm:overflow-visible sm:pb-0',
          dutyEnabled ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {dutyEnabled && (
          <Link
            href="/duty"
            className={cn(
              'group relative flex min-w-[85vw] shrink-0 snap-start flex-col gap-3 overflow-hidden rounded-2xl border p-4 transition-all sm:min-w-0',
              'hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mySlots.length
                ? 'border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 dark:border-emerald-500/40 dark:from-emerald-950/50 dark:to-teal-950/30'
                : 'border-border/80 bg-card hover:border-border',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl',
                  mySlots.length ? 'bg-emerald-500 text-white shadow-md' : 'bg-muted text-muted-foreground',
                )}
              >
                <CalendarClock className="size-5" />
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bugün nöbet</p>
              <p className="mt-1 font-semibold leading-snug text-foreground">
                {mySlots.length ? `${mySlots.length} görev` : 'Nöbet yok'}
              </p>
              {mySlots.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mySlots.slice(0, 2).map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-lg bg-background/80 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:text-emerald-100"
                    >
                      <MapPin className="size-3 shrink-0" />
                      {s.area_name || s.slot_name || 'Nöbet'}
                    </span>
                  ))}
                  {mySlots.length > 2 && (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      +{mySlots.length - 2}
                    </span>
                  )}
                </div>
              )}
              {dutyMarketLocked && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                  <Lock className="size-3.5 shrink-0" aria-hidden />
                  Market’te etkinleştirme gerekir
                </p>
              )}
            </div>
          </Link>
        )}

        <Link
          href="/bildirimler"
          className={cn(
            'group flex min-w-[85vw] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 transition-all sm:min-w-0',
            'hover:-translate-y-0.5 hover:border-indigo-300/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            allNotificationsUnread > 0 && 'border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-500/30 dark:bg-indigo-950/25',
          )}
        >
          <div className="flex items-start justify-between">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm">
              <Bell className="size-5" />
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bildirim</p>
            <p className="mt-1 font-semibold text-foreground">
              {allNotificationsUnread > 0 ? `${allNotificationsUnread} okunmamış` : 'Güncel'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Nöbet, ders, duyuru</p>
          </div>
        </Link>

        {belirliGunAssignments.length > 0 ? (
          <Link
            href="/akademik-takvim"
            className="group flex min-w-[85vw] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-amber-300/70 bg-gradient-to-br from-amber-50/90 to-orange-50/60 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 dark:border-amber-500/35 dark:from-amber-950/45 dark:to-orange-950/35 sm:min-w-0"
          >
            <div className="flex items-start justify-between">
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md">
                <Award className="size-5" />
              </div>
              <ArrowRight className="size-4 text-amber-700/80 transition-transform group-hover:translate-x-0.5 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/80 dark:text-amber-200/90">
                Belirli gün
              </p>
              <p className="mt-1 font-semibold text-amber-950 dark:text-amber-50">
                {belirliGunAssignments.length} görevlendirme
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-amber-900/80 dark:text-amber-100/80">
                {belirliGunAssignments[0]?.itemTitle}
                {belirliGunAssignments.length > 1 ? ` · +${belirliGunAssignments.length - 1}` : ''}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex min-w-[85vw] shrink-0 snap-start flex-col justify-center rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-center sm:min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Belirli gün</p>
            <p className="mt-2 text-sm text-muted-foreground">Yakında görev yok</p>
            <Link href="/akademik-takvim" className="mt-2 text-xs font-medium text-primary hover:underline">
              Takvime git
            </Link>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div className="border-b border-border/50 pb-4">
          <h2 className="text-xl font-semibold tracking-tight">Modüller</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Okulunuzda açık olan araçlar; kapalı modüller gizlenir.
          </p>
        </div>

        {quickSections.map((section) => (
          <div
            key={section.label}
            className="rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm backdrop-blur-sm sm:rounded-3xl sm:p-6 dark:bg-card/25"
          >
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {section.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => {
                const mk = marketKeyForQuickItem(item);
                const itemLocked = isMarketModuleLocked(activationModules, mk);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative overflow-hidden rounded-2xl border border-border/60 bg-background/60 p-4 transition-all',
                      'hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <div
                      className={cn(
                        'mb-3 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-inner',
                        item.accent,
                      )}
                    >
                      <item.icon className="size-5" />
                    </div>
                    <p className="font-semibold leading-tight text-foreground">{item.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.desc}</p>
                    {itemLocked ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                        <Lock className="size-3.5 shrink-0" aria-hidden />
                        Market’te etkinleştir
                      </p>
                    ) : null}
                    <ArrowRight className="absolute right-3 top-3 size-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {dutyEnabled && (
        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/50 shadow-sm backdrop-blur-sm sm:rounded-3xl">
          <CardHeader className="border-b border-border/50 bg-muted/30 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CalendarCheck className="size-5 text-muted-foreground" />
                Nöbet tercihleri ve takas
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/duty/tercihler"
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  Tercihler
                </Link>
                <Link
                  href="/duty/takas"
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                >
                  Takas
                </Link>
                <Link
                  href="/duty"
                  className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15"
                >
                  Nöbet özeti
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {teacherPrefs.length === 0 && teacherSwaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz kayıt yok.{' '}
                <Link href="/duty/tercihler" className="font-medium text-primary hover:underline">
                  Tercih ekle
                </Link>{' '}
                veya{' '}
                <Link href="/duty/takas" className="font-medium text-primary hover:underline">
                  takas talebi
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Son tercihler</p>
                  {teacherPrefs.length > 0 ? (
                    <ul className="space-y-2">
                      {teacherPrefs.map((p) => {
                        const statusConfig = {
                          available: { icon: CheckCircle2, label: 'Müsait', className: 'text-emerald-600 dark:text-emerald-400' },
                          unavailable: { icon: XCircle, label: 'Müsait değil', className: 'text-rose-600 dark:text-rose-400' },
                          prefer: { icon: Star, label: 'Tercih', className: 'text-blue-600 dark:text-blue-400' },
                        };
                        const cfg =
                          statusConfig[p.status as keyof typeof statusConfig] ?? {
                            icon: Clock,
                            label: p.status,
                            className: 'text-muted-foreground',
                          };
                        const Icon = cfg.icon;
                        return (
                          <li
                            key={p.id ?? p.date}
                            className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm"
                          >
                            <span className="tabular-nums text-foreground">
                              {new Date(p.date + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium', cfg.className)}>
                              <Icon className="size-3.5" />
                              {cfg.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <Link href="/duty/tercihler" className="text-primary hover:underline">
                        Tercih ekleyin
                      </Link>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Takas</p>
                  {teacherSwaps.length > 0 ? (
                    <ul className="space-y-2">
                      {teacherSwaps.map((s) => {
                        const cfg =
                          s.status === 'approved'
                            ? { icon: CheckCircle2, label: 'Onaylandı' }
                            : s.status === 'rejected'
                              ? { icon: XCircle, label: 'Reddedildi' }
                              : s.status === 'reverted'
                                ? { icon: Undo2, label: 'Geri alındı' }
                                : { icon: Clock, label: 'Bekliyor' };
                        const Icon = cfg.icon;
                        return (
                          <li
                            key={s.id}
                            className="flex flex-col gap-1 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="truncate text-foreground">
                              {s.duty_slot?.date
                                ? new Date(s.duty_slot.date + 'T12:00:00').toLocaleDateString('tr-TR', {
                                    day: 'numeric',
                                    month: 'short',
                                  })
                                : '—'}
                              <span className="text-muted-foreground"> → </span>
                              {s.proposedUser?.display_name || s.proposedUser?.email || '—'}
                            </span>
                            <span
                              className={cn(
                                'inline-flex shrink-0 items-center gap-1 text-xs font-medium',
                                s.status === 'approved' && 'text-emerald-600 dark:text-emerald-400',
                                s.status === 'rejected' && 'text-rose-600 dark:text-rose-400',
                                s.status === 'reverted' && 'text-slate-600 dark:text-slate-400',
                                s.status === 'pending' && 'text-amber-600 dark:text-amber-400',
                              )}
                            >
                              <Icon className="size-3.5" />
                              {cfg.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      <Link href="/duty/takas" className="text-primary hover:underline">
                        Takas oluştur
                      </Link>
                    </p>
                  )}
                  {teacherSwaps.length > 0 && (
                    <Link href="/duty/takas" className="inline-block text-xs font-medium text-primary hover:underline">
                      Tümünü gör →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
        </div>

        <aside className="space-y-4 xl:col-span-4 xl:sticky xl:top-20 xl:self-start">
          <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-muted/25 p-4 shadow-sm backdrop-blur-sm sm:rounded-3xl sm:p-5 dark:to-muted/10">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Hesap</p>
            <p className="mt-1 text-sm text-muted-foreground">Profil ve uygulama ayarları</p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/profile"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/80 active:bg-muted"
              >
                <User className="size-4 text-primary" />
                Profilim
              </Link>
              <Link
                href="/profile"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/80 active:bg-muted"
              >
                <Settings className="size-4 text-muted-foreground" />
                Ayarlar
              </Link>
              <p className="flex min-h-10 items-center gap-2 rounded-xl border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                <LayoutDashboard className="size-3.5 shrink-0" />
                Bu sayfa ana sayfanız
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/50 p-4 text-sm text-muted-foreground shadow-sm sm:rounded-3xl sm:p-5">
            <p>
              Kısayollar menü ile aynıdır; sık kullandığınız modülleri buradan da açabilirsiniz.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
