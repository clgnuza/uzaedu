'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Headphones, Plus, ChevronRight, MessageSquare, Tag } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch } from '@/lib/api';
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
  const [data, setData] = useState<{ total: number; page: number; limit: number; items: TicketItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allowed = me?.role === 'teacher' || me?.role === 'school_admin' || me?.role === 'superadmin';
  useEffect(() => {
    if (!allowed) router.replace('/403');
  }, [allowed, router]);

  useEffect(() => {
    if (!token || !allowed) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: '1', limit: '50' });
    if (me?.role === 'school_admin') params.set('list_mode', 'owned');
    apiFetch<{ total: number; page: number; limit: number; items: TicketItem[] }>(`/tickets?${params}`, {
      token,
    })
      .then(setData)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, allowed]);

  if (!allowed) return null;

  return (
    <div className="space-y-4">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
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

      <div className="rounded-xl border border-border bg-card">
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
          <div className="divide-y divide-border">
            {data?.items?.map((t) => (
              <button
                key={t.id}
                onClick={() => router.push(`/support/${t.id}`)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SupportStatusBadge status={t.status} size="xs" />
                    <span className="font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                    {t.target_type === 'PLATFORM_SUPPORT' && (
                      <span className="inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                        <Tag className="size-2.5" /> Platform
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{t.subject}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="truncate">{t.module?.name ?? '-'}</span>
                    <span>•</span>
                    <span>{new Date(t.last_activity_at).toLocaleDateString('tr-TR')}</span>
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
