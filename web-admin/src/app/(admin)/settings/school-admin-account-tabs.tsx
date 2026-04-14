'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  KeyRound,
  School,
  Users,
  BookOpen,
  Tv,
  Calendar,
  Settings,
  User,
  ChevronRight,
  Shield,
  FileDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditProfileForm, ChangePasswordForm } from '@/components/account/profile-account-forms';
import { DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { BackupExportPanel } from '@/components/account/backup-export-panel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TabId = 'hesap' | 'okul' | 'yedek';

const TAB_STYLE: Record<
  TabId,
  { active: string; idle: string; iconActive: string; iconIdle: string }
> = {
  hesap: {
    active:
      'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/45 dark:bg-sky-500 dark:ring-sky-300/35',
    idle:
      'border border-sky-200/80 bg-sky-500/12 text-sky-950 hover:bg-sky-500/22 dark:border-sky-800/60 dark:bg-sky-950/45 dark:text-sky-100 dark:hover:bg-sky-900/55',
    iconActive: 'text-white',
    iconIdle: 'text-sky-600 dark:text-sky-400',
  },
  okul: {
    active:
      'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/45 dark:bg-emerald-600 dark:ring-emerald-300/35',
    idle:
      'border border-emerald-200/80 bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/22 dark:border-emerald-800/60 dark:bg-emerald-950/45 dark:text-emerald-100 dark:hover:bg-emerald-900/55',
    iconActive: 'text-white',
    iconIdle: 'text-emerald-600 dark:text-emerald-400',
  },
  yedek: {
    active:
      'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400/55 dark:bg-amber-500 dark:text-amber-950 dark:ring-amber-300/40',
    idle:
      'border border-amber-200/90 bg-amber-500/15 text-amber-950 hover:bg-amber-500/28 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50',
    iconActive: 'text-amber-950 dark:text-amber-950',
    iconIdle: 'text-amber-700 dark:text-amber-400',
  },
};

const TABS: {
  id: TabId;
  label: string;
  hint: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'hesap',
    label: 'Hesap',
    hint: 'Profil ve şifre',
    icon: User,
  },
  {
    id: 'okul',
    label: 'Okul',
    hint: 'Okul sayfaları',
    icon: School,
  },
  {
    id: 'yedek',
    label: 'Yedek',
    hint: 'JSON yedek',
    icon: FileDown,
  },
];

const OKUL_GROUPS: {
  title: string;
  description: string;
  items: { href: string; label: string; sub: string; icon: React.ElementType }[];
}[] = [
  {
    title: 'Kurumsal görünüm',
    description: 'Tanıtım ve ekranlar',
    items: [
      { href: '/school-profile', label: 'Okul tanıtımı', sub: 'Logo, metin ve iletişim', icon: Building2 },
      { href: '/tv', label: 'Duyuru TV', sub: 'Koridor ve öğretmenler odası', icon: Tv },
    ],
  },
  {
    title: 'Takvim ve program',
    description: 'Takvim ve program',
    items: [
      { href: '/akademik-takvim-ayarlar', label: 'Akademik takvim', sub: 'Dönem ve haftalar', icon: Calendar },
      { href: '/ders-programi/ayarlar', label: 'Ders programı ayarları', sub: 'Şablon ve kurallar', icon: Settings },
    ],
  },
  {
    title: 'Öğretmen ve sınıflar',
    description: 'Öğretmen ve sınıflar',
    items: [
      { href: '/teachers', label: 'Öğretmenler', sub: 'Hesaplar ve roller', icon: Users },
      { href: '/classes-subjects', label: 'Sınıflar ve dersler', sub: 'Şube ve branş eşlemesi', icon: BookOpen },
    ],
  },
];

export function SchoolAdminAccountTabs() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { token, me, refetchMe } = useAuth();
  const [tab, setTab] = useState<TabId>('hesap');

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q === 'hesap' || q === 'okul' || q === 'yedek') setTab(q);
  }, [searchParams]);

  const goTab = (id: TabId) => {
    if (tab === id) return;
    setTab(id);
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    const meta = TABS.find((t) => t.id === id);
    toast.success(meta?.label ?? id, {
      id: 'school-admin-tab',
      description: meta?.hint,
      duration: 2200,
    });
  };

  if (!me || me.role !== 'school_admin') return null;

  return (
    <div className="space-y-2 sm:space-y-4 md:space-y-5">
      <div
        className="rounded-lg border border-border/50 bg-linear-to-r from-sky-500/10 via-violet-500/8 to-amber-500/10 p-0.5 shadow-sm ring-1 ring-black/6 dark:border-zinc-700/80 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-zinc-900/90 dark:ring-white/10 sm:rounded-xl sm:p-1 sm:shadow-md"
        role="tablist"
        aria-label="Okul yöneticisi profil bölümleri"
      >
        <div className="grid grid-cols-3 gap-0.5 sm:gap-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const st = TAB_STYLE[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`${t.label}. ${t.hint}`}
                onClick={() => goTab(t.id)}
                className={cn(
                  'flex min-h-9 flex-col items-center justify-center gap-0 rounded-md px-1 py-1 text-center transition-[color,box-shadow,background-color,border-color] duration-200 sm:min-h-12 sm:gap-0.5 sm:rounded-xl sm:px-2 sm:py-2.5',
                  isActive ? st.active : st.idle,
                )}
              >
                <span className="flex max-w-full items-center justify-center gap-0.5 sm:gap-2">
                  <Icon
                    className={cn('size-3.5 shrink-0 sm:size-4', isActive ? st.iconActive : st.iconIdle)}
                    aria-hidden
                  />
                  <span className="truncate text-[10px] font-bold tracking-tight sm:text-sm">{t.label}</span>
                </span>
                <span
                  className={cn(
                    'hidden text-[10px] leading-tight opacity-90 sm:line-clamp-2 sm:block sm:max-w-none',
                    isActive && 'text-white dark:text-white',
                  )}
                >
                  {t.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'hesap' && (
        <div className="space-y-2 sm:space-y-3 md:space-y-4">
          <Card className="overflow-hidden rounded-lg border border-sky-500/20 bg-linear-to-br from-card via-card to-sky-500/6 shadow-sm ring-1 ring-sky-500/10 backdrop-blur-sm dark:border-sky-500/20 dark:from-card dark:via-card dark:to-sky-950/25 sm:rounded-xl sm:border-2 sm:shadow-md">
            <CardHeader className="border-b border-sky-200/30 bg-linear-to-r from-sky-500/12 via-sky-500/5 to-transparent px-2 py-2 dark:border-sky-900/40 dark:from-sky-950/50 dark:via-sky-950/25 sm:px-5 sm:py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-[10px] font-bold text-sky-800 dark:text-sky-200 sm:size-8 sm:text-xs">
                  1
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-lg">Profil</CardTitle>
                  <CardDescription className="text-[10px] leading-snug sm:text-sm">Pano ve bildirimlerde görünen ad.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2.5 sm:p-5 md:p-6">
              <EditProfileForm
                token={token}
                displayName={me.display_name ?? ''}
                avatarKey={me.avatar_key ?? null}
                onSuccess={refetchMe}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-lg border border-amber-500/25 bg-linear-to-br from-card via-card to-amber-500/5 shadow-sm ring-1 ring-amber-500/10 backdrop-blur-sm dark:border-amber-500/15 dark:to-amber-950/20 sm:rounded-xl sm:border-2 sm:shadow-md">
            <CardHeader className="border-b border-amber-200/35 bg-linear-to-r from-amber-500/12 via-amber-500/5 to-transparent px-2 py-2 dark:border-amber-900/40 dark:from-amber-950/45 dark:via-amber-950/20 sm:px-5 sm:py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-[10px] font-bold text-amber-900 dark:text-amber-300 sm:size-8 sm:text-xs">
                  2
                </span>
                <div className="min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-1 text-sm sm:gap-2 sm:text-lg">
                    <KeyRound className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400 sm:size-4" aria-hidden />
                    <span>Güvenlik — şifre</span>
                  </CardTitle>
                  <CardDescription className="text-[10px] leading-snug sm:text-sm">Güçlü şifre, kimseyle paylaşmayın.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-2.5 sm:p-5 md:p-6">
              <ChangePasswordForm token={token} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-lg border border-emerald-500/25 bg-linear-to-br from-card via-card to-emerald-500/5 shadow-sm ring-1 ring-emerald-500/10 backdrop-blur-sm dark:border-emerald-500/15 dark:to-emerald-950/20 sm:rounded-xl sm:border-2 sm:shadow-md">
            <CardHeader className="border-b border-emerald-200/35 bg-linear-to-r from-emerald-500/12 via-emerald-500/5 to-transparent px-2 py-2 dark:border-emerald-900/40 dark:from-emerald-950/45 dark:via-emerald-950/20 sm:px-5 sm:py-3 md:px-6 md:py-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 sm:size-8 sm:text-xs">
                  3
                </span>
                <div className="min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-1 text-sm sm:gap-2 sm:text-lg">
                    <Shield className="size-3.5 shrink-0 text-emerald-700 dark:text-emerald-400 sm:size-4" aria-hidden />
                    <span>Hesabı kapat</span>
                  </CardTitle>
                  <CardDescription className="text-[10px] leading-snug sm:text-sm">
                    Önce veri: <strong>Yedek</strong>.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-2.5 sm:gap-4 sm:p-5 md:p-6">
              <DeleteAccountButton token={token} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'yedek' && (
        <Card className="overflow-hidden rounded-lg border border-amber-500/30 bg-linear-to-br from-amber-500/7 via-card to-violet-500/4 shadow-sm ring-1 ring-amber-500/15 backdrop-blur-sm dark:from-amber-950/30 dark:via-card dark:to-violet-950/20 sm:rounded-xl sm:border-2 sm:shadow-md">
          <CardHeader className="border-b border-amber-200/40 bg-linear-to-r from-amber-500/15 via-amber-500/8 to-violet-500/10 px-2 py-2 dark:border-amber-900/45 dark:from-amber-950/50 dark:via-amber-950/25 dark:to-violet-950/30 sm:px-5 sm:py-3 md:px-6 md:py-4">
            <CardTitle className="flex items-center gap-1.5 text-sm sm:gap-2 sm:text-lg">
              <FileDown className="size-3.5 shrink-0 text-amber-700 dark:text-amber-400 sm:size-4" aria-hidden />
              Yedek indir
            </CardTitle>
            <CardDescription className="text-[10px] leading-snug sm:text-sm">
              Modül seç, JSON indir. Eksik modüller işaretlenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-5 md:p-6">
            <BackupExportPanel token={token} enabledModules={me?.school?.enabled_modules ?? null} />
          </CardContent>
        </Card>
      )}

      {tab === 'okul' && (
        <div className="space-y-2 sm:space-y-4 md:space-y-5">
          {OKUL_GROUPS.map((group) => (
            <div
              key={group.title}
              className="overflow-hidden rounded-xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/6 via-card to-sky-500/5 p-2 shadow-sm ring-1 ring-emerald-500/10 dark:from-emerald-950/25 dark:via-card dark:to-sky-950/20 sm:rounded-2xl sm:border-2 sm:p-3 md:p-4"
            >
              <div className="mb-1.5 px-0.5 sm:mb-2">
                <h3 className="text-xs font-bold text-foreground sm:text-sm">{group.title}</h3>
                <p className="text-[10px] text-muted-foreground sm:text-xs">{group.description}</p>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() =>
                        toast.message(item.label, {
                          description: 'Sayfa açılıyor…',
                          duration: 1800,
                        })
                      }
                      className={cn(
                        'group relative flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-card/90 p-2 shadow-sm ring-1 ring-black/5 backdrop-blur-sm',
                        'transition-all duration-200 hover:z-1 hover:border-emerald-400/55 hover:bg-emerald-500/8 hover:shadow-md',
                        'active:scale-[0.99] dark:border-emerald-800/30 dark:bg-card/80 dark:ring-white/5 dark:hover:border-emerald-500/45 sm:gap-2.5 sm:rounded-xl sm:border-2 sm:p-3 sm:shadow-md',
                      )}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25 transition-colors group-hover:bg-emerald-500/20 dark:bg-emerald-950/45 dark:text-emerald-300 dark:ring-emerald-800/50 sm:size-11 sm:rounded-xl">
                        <ItemIcon className="size-3.5 sm:size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[13px] font-semibold leading-tight text-foreground sm:text-sm">{item.label}</p>
                        <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:truncate sm:text-xs">
                          {item.sub}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 sm:size-5"
                        aria-hidden
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
