'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Headphones, Plus, ChevronRight, MessageSquare, Tag, Clock3, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { apiFetch, isSupportModuleDisabledError } from '@/lib/api';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Alert } from '@/components/ui/alert';
import { SupportStatusBadge } from '@/components/support/support-status-badge';
import { SupportNotificationHint } from '@/components/support/support-notification-hint';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { cn } from '@/lib/utils';

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
    <div className="support-page space-y-3 pb-4 sm:space-y-5 sm:pb-8">
      <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2.5 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-cyan-400/18 blur-3xl dark:bg-cyan-500/10"
          aria-hidden
        />
        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-10">
              <Headphones className="size-[1.05rem] sm:size-[1.2rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
                Destek taleplerim
              </h1>
              <div className="mt-0.5">
                <ToolbarIconHints
                  compact
                  showOnMobile
                  className="text-[11px] sm:text-xs"
                  items={[
                    { label: 'Talepler', icon: MessageSquare },
                    { label: 'Bildirimler', icon: Bell },
                  ]}
                  summary="Açtığınız talepler burada. Yanıtlar Bildirimler sayfasında."
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <SupportNotificationHint />
            <Button size="sm" className="h-8 gap-1 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" onClick={() => router.push('/support/new')}>
              <Plus className="size-3.5 sm:size-4" />
              Yeni talep
            </Button>
          </div>
        </div>
      </div>

      {error && <Alert variant="error" message={error} className="py-2 text-sm" />}
      {(supportEnabled === false || supportBlocked) && me?.role !== 'superadmin' && (
        <Alert
          variant="warning"
          message="Destek modülü şu anda kapalı. Talep görüntüleme ve oluşturma geçici olarak devre dışı."
          className="py-2 text-xs sm:text-sm"
        />
      )}

      {supportEnabled !== false && !supportBlocked && (
        <>
          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_min(100%,280px)] lg:gap-3">
            <div className="overflow-hidden rounded-xl border border-border/50 bg-linear-to-br from-sky-500/6 via-background to-background shadow-sm sm:rounded-2xl">
              <div className="flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/20 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm dark:text-sky-300 sm:text-xs">
                      <Bell className="size-3 shrink-0" />
                      Canlı destek akışı
                    </div>
                    <h2 className="text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
                      Taleplerinizi tek ekranda takip edin
                    </h2>
                    <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                      Son yanıtlar ve durum değişiklikleri burada listelenir.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 shrink-0 gap-1 px-2.5 text-xs shadow-md shadow-sky-500/15 sm:h-9 sm:px-3 sm:text-sm"
                    onClick={() => router.push('/support/new')}
                  >
                    <Plus className="size-3.5" />
                    Yeni talep
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                  <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">
                        Açık / işlemde
                      </span>
                      <MessageSquare className="size-3.5 shrink-0 text-sky-600 sm:size-4" />
                    </div>
                    <p className="mt-1.5 text-lg font-semibold tabular-nums sm:mt-2 sm:text-xl">{openCount}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">
                        Bilgi bekleyen
                      </span>
                      <Clock3 className="size-3.5 shrink-0 text-amber-500 sm:size-4" />
                    </div>
                    <p className="mt-1.5 text-lg font-semibold tabular-nums sm:mt-2 sm:text-xl">{waitingCount}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">
                        Sonuçlanan
                      </span>
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 sm:size-4" />
                    </div>
                    <p className="mt-1.5 text-lg font-semibold tabular-nums sm:mt-2 sm:text-xl">{resolvedCount}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-card/90 p-3 shadow-sm sm:rounded-2xl sm:p-4">
              <p className="text-xs font-semibold sm:text-sm">Akış özeti</p>
              <div className="mt-2 space-y-2 text-[11px] text-muted-foreground sm:mt-3 sm:space-y-2.5 sm:text-xs">
                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 sm:rounded-xl sm:p-3">
                  <p className="font-medium text-foreground">Hızlı yönetim</p>
                  <p className="mt-0.5 leading-snug">Yeni talep oluşturun; mevcut talepleri açıp son aktiviteye göre izleyin.</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 sm:rounded-xl sm:p-3">
                  <p className="font-medium text-foreground">Bildirimler</p>
                  <p className="mt-0.5 leading-snug">Yeni yanıtlar bildirimlere düşer; liste burada kalır.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-sm sm:rounded-2xl">
            {loading && <LoadingSpinner label="Yükleniyor…" className="py-5 sm:py-6" />}
            {!loading &&
              !error &&
              (!data?.items?.length ? (
                <EmptyState
                  icon={<MessageSquare className="size-8 text-muted-foreground sm:size-10" />}
                  title="Henüz talep yok"
                  description="Destek talebi açmak için Yeni talep’e tıklayın."
                  action={
                    <Button size="sm" onClick={() => router.push('/support/new')}>
                      <Plus className="size-4" />
                      Yeni talep
                    </Button>
                  }
                  className="py-7 sm:py-10"
                />
              ) : (
                <div className="grid gap-1.5 p-2 sm:gap-2 sm:p-3 md:p-4">
                  {data?.items?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => router.push(`/support/${t.id}`)}
                      className={cn(
                        'group flex w-full items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/80 px-2.5 py-2.5 text-left shadow-sm transition-all',
                        'hover:-translate-y-px hover:border-sky-500/25 hover:shadow-md sm:gap-3 sm:rounded-xl sm:px-3 sm:py-3',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                          <SupportStatusBadge status={t.status} size="xs" />
                          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:px-2 sm:text-[11px]">
                            {t.ticket_number}
                          </span>
                          {t.target_type === 'PLATFORM_SUPPORT' && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 sm:text-[10px]">
                              <Tag className="size-2.5" /> Platform
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-xs font-semibold text-foreground sm:text-sm">{t.subject}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
                          <span className="truncate">{t.module?.name ?? '—'}</span>
                          <span className="shrink-0">·</span>
                          <span className="shrink-0">{new Date(t.last_activity_at).toLocaleDateString('tr-TR')}</span>
                        </p>
                      </div>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:size-4" />
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
