'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  ChevronRight,
  Database,
  FileDown,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Puzzle,
  School,
  Server,
  Settings,
  Shield,
  Sparkles,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EditProfileForm, ChangePasswordForm } from '@/components/account/profile-account-forms';
import { DataExportButton, DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/api';
import { SuperadminDevopsSettings } from './superadmin-devops-settings';

type TabId = 'hesap' | 'platform' | 'kaynak';

const TABS: { id: TabId; label: string; hint: string; icon: React.ElementType }[] = [
  { id: 'hesap', label: 'Hesap', hint: 'Profil, şifre ve veri hakları', icon: User },
  { id: 'platform', label: 'Platform', hint: 'Yönetim linkleri ve sistem', icon: LayoutDashboard },
  { id: 'kaynak', label: 'Kaynak & dağıtım', hint: 'Git ve canlı ortam referansı', icon: GitBranch },
];

const PLATFORM_GROUPS: {
  title: string;
  description: string;
  items: { href: string; label: string; sub: string; icon: React.ElementType }[];
}[] = [
  {
    title: 'Genel yönetim',
    description: 'Pano, kurumlar ve kullanıcılar',
    items: [
      { href: '/dashboard', label: 'Genel pano', sub: 'Özet ve grafikler', icon: BarChart3 },
      { href: '/schools', label: 'Okullar', sub: 'Liste ve kota', icon: School },
      { href: '/users', label: 'Kullanıcılar', sub: 'Roller ve filtreler', icon: Users },
      { href: '/modules', label: 'Modüller', sub: 'Okul bazlı aç/kapa', icon: Puzzle },
    ],
  },
  {
    title: 'Politika ve içerik',
    description: 'Mağaza, duyuru ve site',
    items: [
      { href: '/market', label: 'Market', sub: 'Jeton ve yükleme', icon: Building2 },
      { href: '/market-policy', label: 'Market politikası', sub: 'Ürün ve fiyatlar', icon: Settings },
      { href: '/announcements', label: 'Duyurular', sub: 'İçerik yönetimi', icon: Megaphone },
      { href: '/web-ayarlar', label: 'Web ayarları', sub: 'Site ve entegrasyon', icon: Wrench },
    ],
  },
  {
    title: 'Operasyon',
    description: 'Destek ve parametreler',
    items: [
      { href: '/support/platform', label: 'Platform desteği', sub: 'Talepler', icon: BookOpen },
      { href: '/extra-lesson-params', label: 'Hesaplama parametreleri', sub: 'Ek ders bütçe kuralları', icon: Calculator },
      { href: '/bilsem-sablon', label: 'BİLSEM altyapı', sub: 'Takvim ve şablon', icon: BookOpen },
    ],
  },
];

type HealthResponse = { status: string; service: string };

export function SuperadminAccountTabs() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { token, me, refetchMe } = useAuth();
  const [tab, setTab] = useState<TabId>('hesap');
  const [backendStatus, setBackendStatus] = useState<'ok' | 'error' | 'checking'>('checking');

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q === 'hesap' || q === 'platform' || q === 'kaynak') setTab(q);
  }, [searchParams]);

  const checkHealth = useCallback(() => {
    setBackendStatus('checking');
    fetch(getApiUrl('/health'), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('fail'))))
      .then((d: HealthResponse) => (d?.status === 'ok' ? setBackendStatus('ok') : setBackendStatus('error')))
      .catch(() => setBackendStatus('error'));
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const goTab = (id: TabId) => {
    if (tab === id) return;
    setTab(id);
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    const meta = TABS.find((t) => t.id === id);
    toast.success(meta?.label ?? id, {
      id: 'superadmin-tab',
      description: meta?.hint,
      duration: 2200,
    });
  };

  if (!me || me.role !== 'superadmin') return null;

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-linear-to-br from-violet-500/10 via-card to-sky-500/10 p-1 shadow-sm ring-1 ring-border/30 dark:from-violet-950/40 dark:via-zinc-950 dark:to-sky-950/30 dark:ring-zinc-800/80">
        <div className="flex flex-col gap-3 p-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Süper yönetici — hesap merkezi</p>
              <p className="text-pretty text-xs text-muted-foreground sm:text-sm">
                {tab === 'hesap'
                  ? 'Görünen ad, şifre ve KVKK işlemleri; profil sayfasıyla aynı hesap.'
                  : tab === 'platform'
                    ? 'Platform sayfalarına geçiş ve canlı sistem durumu.'
                    : 'Git deposu ve canlı ortam URL’leri; dağıtım notları (referans).'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-border/40 bg-muted/20 p-1 dark:bg-zinc-900/50">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goTab(t.id)}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-stretch gap-0.5 rounded-lg px-3 py-2.5 text-left transition-all duration-200 sm:min-w-[140px] sm:flex-initial',
                  active
                    ? 'bg-background text-foreground shadow-md ring-1 ring-border/50 dark:bg-zinc-800'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className={cn('size-4 shrink-0', active ? 'text-primary' : 'opacity-80')} aria-hidden />
                  <span className="text-sm font-semibold">{t.label}</span>
                </span>
                <span className="pl-6 text-[11px] leading-snug text-muted-foreground sm:text-xs">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'hesap' && (
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 dark:border-zinc-800 dark:bg-zinc-950/90">
            <CardHeader className="border-b border-border/40 bg-muted/15 pb-3">
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

          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 dark:border-zinc-800 dark:bg-zinc-950/90">
            <CardHeader className="border-b border-border/40 bg-muted/15 pb-3">
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

          <Card className="overflow-hidden rounded-2xl border-border/50 bg-card/95 shadow-sm ring-1 ring-border/30 dark:border-zinc-800 dark:bg-zinc-950/90">
            <CardHeader className="border-b border-border/40 bg-muted/15 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  3
                </span>
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="size-4 text-muted-foreground" aria-hidden />
                    Veri ve hesap hakları
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    KVKK kapsamında veri indirme ve hesabı kapatma.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-4 md:p-6">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <FileDown className="size-3.5 shrink-0 text-primary" aria-hidden />
                İndirme tamamlanınca ve hesap kapanınca bildirim alırsınız.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch [&_button]:min-h-11 [&_button]:rounded-xl [&_button]:border-border/60 [&_button]:shadow-sm">
                <DataExportButton token={token} />
                <DeleteAccountButton token={token} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'platform' && (
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Server className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">Sistem durumu</CardTitle>
                {backendStatus === 'ok' && (
                  <span className="size-1.5 rounded-full bg-green-500" title="Bağlı" aria-label="Bağlı" />
                )}
                {backendStatus === 'error' && (
                  <span className="size-1.5 rounded-full bg-destructive" title="Sorun" aria-label="Sorun" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Backend API:</span>
                {backendStatus === 'checking' && <span className="text-muted-foreground">Kontrol…</span>}
                {backendStatus === 'ok' && (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-medium text-green-700 dark:text-green-400">
                    Bağlı
                  </span>
                )}
                {backendStatus === 'error' && (
                  <>
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 font-medium text-destructive">
                      Bağlantı yok
                    </span>
                    <button
                      type="button"
                      onClick={checkHealth}
                      className="rounded border border-border bg-muted px-2 py-0.5 text-xs hover:bg-muted/80"
                    >
                      Yenile
                    </button>
                  </>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                  <Database className="size-3.5" />
                  Yerel geliştirme
                </div>
                <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px]">docker compose up -d</code>
                <code className="mt-1 block text-[11px]">cd backend &amp;&amp; npm run start:dev</code>
              </div>
            </CardContent>
          </Card>

          {PLATFORM_GROUPS.map((group) => (
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
                        'transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md',
                      )}
                    >
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted/80 ring-1 ring-border/50 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <ItemIcon className="size-5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'kaynak' && (
        <div className="space-y-6">
          <SuperadminDevopsSettings />
        </div>
      )}
    </div>
  );
}
