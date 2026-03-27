'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Headphones, Plus, ChevronRight, MessageSquare, Tag, Clock3, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch, isSupportModuleDisabledError } from '@/lib/api';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { SupportStatusBadge } from '@/components/support/support-status-badge';
import { SupportNotificationHint } from '@/components/support/support-notification-hint';

type TicketItem = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  target_type: string;
  last_activity_at: string;
  module?: { name: string } | null;
  requester?: { display_name: string | null } | null;
};

export default function SupportPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const { supportEnabled, loading: supportLoading } = useSupportModuleAvailability();
  const [data, setData] = useState<{ total: number; page: number; limit: number; items: TicketItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportBlocked, setSupportBlocked] = useState(false);

  const allowed = me?.role === 'teacher' || me?.role === 'school_admin' || me?.role === 'superadmin';
  useEffect(() => {
    if (!allowed) router.replace('/403');
  }, [allowed, router]);

  useEffect(() => {
    if (supportEnabled === false || supportBlocked) {
      setLoading(false);
      return;
    }
    if (!token || !allowed || supportEnabled !== true) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: '1', limit: '50' });
    if (me?.role === 'school_admin') params.set('list_mode', 'owned');
    apiFetch<{ total: number; page: number; limit: number; items: TicketItem[] }>(`/tickets?${params}`, {
      token,
    })
      .then(setData)
      .catch((e) => {
        if (isSupportModuleDisabledError(e)) {
          setSupportBlocked(true);
          setError(null);
          setData(null);
          return;
        }
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, allowed, supportEnabled, supportBlocked, me?.role]);

  if (!allowed) return null;
  if (supportLoading) return <LoadingSpinner label="Yükleniyor…" className="py-8" />;

  const openCount = data?.items?.filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length ?? 0;
  const waitingCount = data?.items?.filter((item) => item.status === 'WAITING_REQUESTER').length ?? 0;
  const resolvedCount = data?.items?.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length ?? 0;

  return (
    <div className="space-y-5">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 shadow-sm ring-1 ring-primary/10">
                <Headphones className="size-5 text-primary" />
              </div>
              <div>
                <ToolbarPageTitle>Destek Taleplerim</ToolbarPageTitle>
                <ToolbarIconHints
                  compact
                  items={[
                    { label: 'Talepler', icon: MessageSquare },
                    { label: 'Bildirimler', icon: Bell },
                  ]}
                  summary="Açtığınız talepleri görüntüleyin. Yanıtlar Bildirimler sayfasında."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SupportNotificationHint />
              <button
                onClick={() => router.push('/support/new')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Yeni Talep
              </button>
            </div>
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && (
        <Alert variant="error" message={error} className="py-2" />
      )}
      {(supportEnabled === false || supportBlocked) && me?.role !== 'superadmin' && (
        <Alert variant="warning" message="Destek modülü şu anda kapalı. Talep görüntüleme ve oluşturma geçici olarak devre dışı." className="py-2" />
      )}

      {supportEnabled !== false && !supportBlocked && (
      <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-primary/8 via-background to-background shadow-sm">
          <div className="flex flex-col gap-6 px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                  <Bell className="size-3.5" />
                  Canlı destek akışı
                </div>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">Tüm taleplerinizi tek ekranda takip edin</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Son yanıtlar, modüller ve durum değişiklikleri burada anında görünür.
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push('/support/new')}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Yeni Talep
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Acik / islemde</span>
                  <MessageSquare className="size-4 text-primary" />
                </div>
                <p className="mt-3 text-2xl font-semibold">{openCount}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Bilgi bekleyen</span>
                  <Clock3 className="size-4 text-amber-500" />
                </div>
                <p className="mt-3 text-2xl font-semibold">{waitingCount}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Sonuclanan</span>
                  <CheckCircle2 className="size-4 text-emerald-500" />
                </div>
                <p className="mt-3 text-2xl font-semibold">{resolvedCount}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm">
          <p className="text-sm font-semibold">Akis ozeti</p>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="font-medium text-foreground">Hızlı yönetim</p>
              <p className="mt-1">Yeni talep olusturun, mevcut talepleri acin ve son aktivite tarihine gore ilerleyin.</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="font-medium text-foreground">Bildirim entegrasyonu</p>
              <p className="mt-1">Yeni cevaplar bildirimler alanina duser, talepler burada liste halinde kalir.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm">
        {loading && <LoadingSpinner label="Yükleniyor…" className="py-6" />}
        {!loading && !error && (!data?.items?.length ? (
          <EmptyState
            icon={<MessageSquare className="size-10 text-muted-foreground" />}
            title="Henüz talep yok"
            description="Destek talebi açmak için Yeni Talep butonuna tıklayın."
            action={
              <button
                onClick={() => router.push('/support/new')}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-4" />
                Yeni Talep
              </button>
            }
            className="py-10"
          />
        ) : (
          <div className="grid gap-3 p-3 sm:p-4">
            {data?.items?.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/support/${t.id}`)}
                className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/80 px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SupportStatusBadge status={t.status} size="xs" />
                    <span className="rounded-full bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                    {t.target_type === 'PLATFORM_SUPPORT' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        <Tag className="size-2.5" /> Platform
                      </span>
                    )}
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-foreground">{t.subject}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{t.module?.name ?? '-'}</span>
                    <span>•</span>
                    <span>{new Date(t.last_activity_at).toLocaleDateString('tr-TR')}</span>
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
