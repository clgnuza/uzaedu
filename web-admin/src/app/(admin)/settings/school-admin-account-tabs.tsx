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
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditProfileForm, ChangePasswordForm } from '@/components/account/profile-account-forms';
import { DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { BackupExportPanel } from '@/components/account/backup-export-panel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type TabId = 'hesap' | 'okul' | 'yedek';

const TABS: {
  id: TabId;
  label: string;
  hint: string;
  icon: React.ElementType;
}[] = [
  {
    id: 'hesap',
    label: 'Hesap',
    hint: 'Profil, şifre ve hesap kapatma',
    icon: User,
  },
  {
    id: 'okul',
    label: 'Okul',
    hint: 'Tanıtım, TV, öğretmen ve program',
    icon: School,
  },
  {
    id: 'yedek',
    label: 'Yedek',
    hint: 'Modül seçerek veri indir',
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
    description: 'Okulunuzu tanıtın ve ekranlarda gösterin',
    items: [
      { href: '/school-profile', label: 'Okul tanıtımı', sub: 'Logo, metin ve iletişim', icon: Building2 },
      { href: '/tv', label: 'Duyuru TV', sub: 'Koridor ve öğretmenler odası', icon: Tv },
    ],
  },
  {
    title: 'Takvim ve program',
    description: 'Akademik yapı ve ders düzeni',
    items: [
      { href: '/akademik-takvim-ayarlar', label: 'Akademik takvim', sub: 'Dönem ve haftalar', icon: Calendar },
      { href: '/ders-programi/ayarlar', label: 'Ders programı ayarları', sub: 'Şablon ve kurallar', icon: Settings },
    ],
  },
  {
    title: 'Öğretmen ve sınıflar',
    description: 'Kadro ve ders dağılımı',
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
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-linear-to-br from-muted/30 via-card to-muted/20 p-1 shadow-sm ring-1 ring-border/30 dark:from-zinc-900/90 dark:via-zinc-950 dark:to-zinc-900/80 dark:ring-zinc-800/80">
        <div className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 dark:bg-primary/15">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Okul ve hesap merkezi</p>
              <p className="text-pretty text-xs text-muted-foreground sm:text-sm">
                {tab === 'hesap'
                  ? 'Kişisel bilgilerinizi güncelleyin; şifre ve hesap kapatma burada.'
                  : tab === 'yedek'
                    ? 'Modül seçerek JSON yedeği indirin.'
                    : 'Okul içi sayfalara tek tıkla geçin; detaylı TV ve sistem kartları aşağıda da var.'}
              </p>
            </div>
          </div>
        </div>

        <div className="mobile-tab-scroll pb-1">
          <div className="flex min-w-max gap-1 rounded-xl border border-border/40 bg-linear-to-r from-muted/25 via-muted/35 to-muted/25 p-1 shadow-inner dark:from-zinc-800/70 dark:via-zinc-800/50 dark:to-zinc-800/70">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={cn(
                  'flex min-w-[150px] shrink-0 flex-col items-stretch gap-0.5 rounded-lg px-3 py-2.5 text-left transition-all duration-200',
                  active
                    ? 'bg-background/95 text-foreground shadow-md ring-1 ring-primary/25 backdrop-blur-sm dark:bg-zinc-800/95 dark:ring-zinc-600/50'
                    : 'text-muted-foreground hover:bg-background/50 hover:text-foreground dark:hover:bg-zinc-800/60',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={cn('size-4 shrink-0 transition-colors', active ? 'text-primary' : 'opacity-80')}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold">{t.label}</span>
                </span>
                <span className="pl-6 text-[11px] leading-snug text-muted-foreground sm:text-xs">{t.hint}</span>
              </button>
            );
          })}
          </div>
        </div>
      </div>

      {tab === 'hesap' && (
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 dark:ring-zinc-800/60">
            <CardHeader className="border-b border-border/40 bg-muted/15 pb-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                <div>
                  <CardTitle className="text-base">Profil</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Görünen adınız panoda ve bildirimlerde kullanılır.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <EditProfileForm
                token={token}
                displayName={me.display_name ?? ''}
                avatarKey={me.avatar_key ?? null}
                onSuccess={refetchMe}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 dark:ring-zinc-800/60">
            <CardHeader className="border-b border-border/40 bg-muted/15 pb-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-xs font-bold text-amber-700 dark:text-amber-400">
                  2
                </span>
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                    Güvenlik — şifre
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Güçlü bir şifre kullanın; paylaşmayın.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              <ChangePasswordForm token={token} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 dark:ring-zinc-800/60">
            <CardHeader className="border-b border-border/40 bg-muted/15 pb-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  3
                </span>
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="size-4 text-muted-foreground" aria-hidden />
                    Hesabı kapat
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Veri indirme için <strong>Yedek</strong> sekmesini kullanın.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 md:p-6">
              <DeleteAccountButton token={token} />
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'yedek' && (
        <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 dark:ring-zinc-800/60">
          <CardHeader className="border-b border-border/40 bg-muted/15 pb-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileDown className="size-4 text-primary" aria-hidden />
              Veri indirme ve yedek
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Modül seçerek JSON yedeği indirin. Henüz tam yedeklenmeyen modüller dosyada işaretlenir.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <BackupExportPanel token={token} enabledModules={me?.school?.enabled_modules ?? null} />
          </CardContent>
        </Card>
      )}

      {tab === 'okul' && (
        <div className="space-y-6">
          {OKUL_GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="px-0.5">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
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
                        'group relative flex items-center gap-3 rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm',
                        'transition-all duration-200 hover:border-primary/45 hover:bg-primary/4 hover:shadow-md',
                        'active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-950/80 dark:hover:border-primary/40',
                      )}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/80 text-foreground ring-1 ring-border/50 transition-colors group-hover:bg-primary/10 group-hover:text-primary dark:bg-zinc-900 dark:ring-zinc-800">
                        <ItemIcon className="size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
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
