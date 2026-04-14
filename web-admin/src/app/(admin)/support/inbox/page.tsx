'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox as InboxIcon, ChevronRight, Send, ArrowUpCircle, StickyNote, Users, Clock3, CheckCircle2, Building2, MapPinned, Layers3, UserRound, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch, isSupportModuleDisabledError } from '@/lib/api';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { TicketAttachmentInput, type AttachmentItem } from '@/components/ticket-attachment-input';
import { SupportStatusBadge } from '@/components/support/support-status-badge';
import { SupportNotificationHint } from '@/components/support/support-notification-hint';
import { SupportTeamDialog } from '@/components/support/support-team-dialog';
import { cn } from '@/lib/utils';
import { formatSchoolTypeLabel } from '@/lib/school-labels';

type TicketMessage = {
  id: string;
  body: string;
  message_type: 'PUBLIC' | 'INTERNAL_NOTE';
  created_at: string;
  author?: { display_name: string | null } | null;
};

type TicketItem = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  target_type: string;
  school_id?: string;
  assigned_to_user_id?: string | null;
  escalated_to_ticket_id?: string | null;
  last_activity_at: string;
  requester?: { display_name: string | null } | null;
  assignedTo?: { display_name: string | null } | null;
  module?: { name: string } | null;
  school?: { name: string | null; city?: string | null; district?: string | null; type?: string | null; segment?: string | null } | null;
};

type AssignableUser = { id: string; display_name: string | null; email: string; role: string };
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REQUESTER' | 'RESOLVED' | 'CLOSED';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'İşlemde',
  WAITING_REQUESTER: 'Bilgi bekleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapatıldı',
};

function getAllowedStatusOptions(status: TicketStatus) {
  const transitions: Record<TicketStatus, TicketStatus[]> = {
    OPEN: ['IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['WAITING_REQUESTER', 'RESOLVED', 'CLOSED'],
    WAITING_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    RESOLVED: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: ['IN_PROGRESS'],
  };

  return [status, ...transitions[status]];
}

export default function SupportInboxPage() {
  const { token, me } = useAuth();
  const { supportEnabled, loading: supportLoading } = useSupportModuleAvailability();
  const [data, setData] = useState<{ total: number; items: TicketItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('OPEN');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [messages, setMessages] = useState<{ items: TicketMessage[] } | null>(null);
  const [reply, setReply] = useState('');
  const [messageType, setMessageType] = useState<'PUBLIC' | 'INTERNAL_NOTE'>('PUBLIC');
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateExtra, setEscalateExtra] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [supportBlocked, setSupportBlocked] = useState(false);
  const formatSchoolMeta = (school?: TicketItem['school']) =>
    [school?.city, school?.district, school?.type ? formatSchoolTypeLabel(school.type) : null, school?.segment]
      .filter(Boolean)
      .join(' • ');
  const statusOptions = selectedTicket ? getAllowedStatusOptions(selectedTicket.status as TicketStatus) : [];

  const allowed = me?.role === 'school_admin' || (me?.role === 'moderator' && (me as { moderator_modules?: string[] })?.moderator_modules?.includes('support'));
  const isSchoolAdmin = me?.role === 'school_admin';
  const schoolId = (me as { school_id?: string })?.school_id ?? (me as { school?: { id?: string } })?.school?.id ?? selectedTicket?.school_id ?? null;
  const canEscalate = me?.role === 'school_admin' && selectedTicket?.target_type === 'SCHOOL_SUPPORT' && !selectedTicket?.escalated_to_ticket_id;
  const activeCount = data?.items?.filter((item) => item.status === 'OPEN' || item.status === 'IN_PROGRESS').length ?? 0;
  const waitingCount = data?.items?.filter((item) => item.status === 'WAITING_REQUESTER').length ?? 0;
  const resolvedCount = data?.items?.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length ?? 0;

  useEffect(() => {
    if (supportEnabled === false || supportBlocked) {
      setLoading(false);
      return;
    }
    if (!allowed || supportEnabled !== true) return;
    const params = new URLSearchParams({ page: '1', limit: '50', list_mode: 'school_inbox' });
    if (filter) params.set('status', filter);
    setLoading(true);
    setError(null);
    apiFetch<{ total: number; page: number; limit: number; items: TicketItem[] }>(`/tickets?${params}`, { token })
      .then((r) => setData({ total: r.total, items: r.items }))
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
  }, [token, allowed, filter, supportEnabled, supportBlocked]);

  const loadSelected = useCallback(() => {
    if (!token || !selectedId || supportEnabled !== true || supportBlocked) return;
    Promise.all([
      apiFetch<TicketItem>(`/tickets/${selectedId}`, { token }),
      apiFetch<{ items: TicketMessage[] }>(`/tickets/${selectedId}/messages?page=1&limit=100`, { token }),
    ])
      .then(([t, m]) => {
        setSelectedTicket(t);
        setMessages(m);
        const schoolId = (t as { school_id?: string }).school_id;
        const q = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : '';
        apiFetch<AssignableUser[]>(`/tickets/assignable-users${q}`, { token }).then(setAssignableUsers).catch(() => setAssignableUsers([]));
      })
      .catch((e) => {
        if (isSupportModuleDisabledError(e)) {
          setSupportBlocked(true);
          setError(null);
        }
        setSelectedTicket(null);
        setMessages(null);
      });
  }, [token, selectedId, supportEnabled, supportBlocked]);

  useEffect(() => {
    if (selectedId && token) {
      loadSelected();
    } else {
      setSelectedTicket(null);
      setMessages(null);
    }
  }, [selectedId, token, loadSelected]);

  useEffect(() => {
    if (!allowed) window.location.replace('/403');
  }, [allowed]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedId || !reply.trim() || selectedTicket?.status === 'CLOSED' || selectedTicket?.status === 'RESOLVED') return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${selectedId}/messages`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          message_type: messageType,
          body: reply.trim(),
          ...(attachments.length ? { attachments } : {}),
        }),
      });
      setReply('');
      setMessageType('PUBLIC');
      setAttachments([]);
      loadSelected();
      setData((d) => d ? { ...d, items: d.items.map((t) => t.id === selectedId ? { ...t, last_activity_at: new Date().toISOString() } : t) } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!token || !selectedId || !escalateReason.trim()) return;
    setEscalating(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${selectedId}/escalate`, {
        method: 'POST',
        token,
        body: JSON.stringify({ reason: escalateReason.trim(), extra_info: escalateExtra.trim() || undefined }),
      });
      setEscalateOpen(false);
      setEscalateReason('');
      setEscalateExtra('');
      loadSelected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eskalasyon yapılamadı');
    } finally {
      setEscalating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !selectedId) return;
    setUpdatingStatus(true);
    try {
      await apiFetch(`/tickets/${selectedId}`, { method: 'PATCH', token, body: JSON.stringify({ status: newStatus }) });
      loadSelected();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignmentChange = async (userId: string) => {
    if (!token || !selectedId) return;
    setUpdatingAssignment(true);
    try {
      await apiFetch(`/tickets/${selectedId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ assigned_to_user_id: userId || null }),
      });
      loadSelected();
    } finally {
      setUpdatingAssignment(false);
    }
  };

  if (!allowed) return null;
  if (supportLoading) return <LoadingSpinner label="Yükleniyor…" className="py-8" />;

  const statusFilters = ['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'] as const;

  return (
    <div className="support-page flex min-h-0 flex-1 flex-col gap-2 pb-3 sm:gap-3 sm:pb-5 lg:h-[calc(100vh-8rem)]">
      <div className="relative shrink-0 overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2.5 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-cyan-400/18 blur-3xl dark:bg-cyan-500/10 sm:size-32"
          aria-hidden
        />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-10">
              <InboxIcon className="size-[1.05rem] sm:size-[1.2rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
                Destek gelen kutusu
              </h1>
              <div className="mt-0.5">
                <ToolbarIconHints
                  compact
                  showOnMobile
                  className="text-[11px] sm:text-xs"
                  items={[
                    { label: 'Gelen kutusu', icon: InboxIcon },
                    { label: 'Yanıt', icon: Send },
                    { label: 'Atama', icon: Users },
                  ]}
                  summary="Okula gelen talepleri listeden seçin; ortada yanıtlayın, sağda durum ve atama."
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            <SupportNotificationHint />
            {isSchoolAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-sky-500/25 bg-background/80 px-2.5 text-xs hover:bg-sky-500/10 sm:h-9 sm:px-3 sm:text-sm"
                onClick={() => setTeamDialogOpen(true)}
              >
                <Users className="size-3.5 sm:size-4" />
                Destek ekibi
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <Alert variant="error" message={error} className="mt-2 py-2" />}
      {(supportEnabled === false || supportBlocked) && me?.role !== 'superadmin' && (
        <Alert variant="warning" message="Destek modülü şu anda kapalı. Okul destek gelen kutusu geçici olarak kullanılamıyor." className="mt-2 py-2" />
      )}
      {supportEnabled !== false && !supportBlocked && (
      <>
      <div className="grid shrink-0 gap-2 lg:grid-cols-[minmax(0,1fr)_min(100%,280px)] lg:gap-3">
        <div className="overflow-hidden rounded-xl border border-border/50 bg-linear-to-br from-sky-500/6 via-background to-background shadow-sm sm:rounded-2xl">
          <div className="flex flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/20 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm dark:text-sky-300 sm:text-xs">
                  <MessageSquare className="size-3 shrink-0" />
                  Okul destek akışı
                </div>
                <h2 className="text-sm font-semibold leading-snug tracking-tight text-foreground sm:text-base">
                  Gelen talepleri tek ekranda yönetin
                </h2>
                <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Liste, yazışma ve atama aynı akışta; mobilde sütunlar alta dizilir.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">Aktif</span>
                  <InboxIcon className="size-3.5 shrink-0 text-sky-600 sm:size-4" />
                </div>
                <p className="mt-1.5 text-lg font-semibold tabular-nums sm:mt-2 sm:text-xl">{activeCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">Bekleyen</span>
                  <Clock3 className="size-3.5 shrink-0 text-amber-500 sm:size-4" />
                </div>
                <p className="mt-1.5 text-lg font-semibold tabular-nums sm:mt-2 sm:text-xl">{waitingCount}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">Sonuçlanan</span>
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
              <p className="font-medium text-foreground">Liste ve yanıt</p>
              <p className="mt-0.5 leading-snug">Durum filtresiyle daraltın; talebi seçip ortada yanıtlayın.</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/15 p-2.5 sm:rounded-xl sm:p-3">
              <p className="font-medium text-foreground">Atama</p>
              <p className="mt-0.5 leading-snug">Sağ panelden durum ve atanan kişi; destek ekibi için üstteki kısayol.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-row lg:gap-3">
        {/* Sol: Liste */}
        <div className="flex max-h-[min(42vh,300px)] min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-sm sm:max-h-[min(40vh,340px)] lg:max-h-none lg:h-auto lg:w-80 lg:rounded-3xl">
          <div className="border-b border-border/50 bg-linear-to-r from-sky-500/8 via-muted/20 to-violet-500/6 p-2 sm:p-2.5">
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {statusFilters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={cn(
                  'rounded-full px-2 py-1 text-center text-[10px] font-semibold transition-all sm:px-3 sm:py-1.5 sm:text-[11px]',
                  filter === s
                    ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-400/40 dark:bg-sky-500'
                    : 'border border-sky-200/70 bg-sky-500/10 text-sky-950 hover:bg-sky-500/18 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/55',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && <LoadingSpinner label="Yükleniyor…" className="py-5 sm:py-6" />}
            {!loading && (!data?.items?.length ? (
              <div className="p-3 text-center text-[11px] text-muted-foreground sm:p-4 sm:text-sm">Bu filtrede talep yok</div>
            ) : (
              data?.items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'group mx-1.5 mb-1.5 flex w-[calc(100%-0.75rem)] flex-col gap-1.5 rounded-xl border px-2.5 py-2 text-left transition-all sm:mx-2 sm:mb-2 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-2.5',
                    selectedId === t.id
                      ? 'border-sky-500/35 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/20 dark:bg-sky-950/30'
                      : 'border-border/50 bg-background/80 hover:-translate-y-px hover:border-sky-500/25 hover:shadow-md',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <SupportStatusBadge status={t.status} size="xs" />
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:px-2 sm:text-[10px]">{t.ticket_number}</span>
                  </div>
                  <p className="truncate text-xs font-semibold sm:text-sm">{t.subject}</p>
                  <p className="text-[10px] text-muted-foreground sm:text-[11px]">
                    {t.requester?.display_name ?? '-'} · {new Date(t.last_activity_at).toLocaleDateString('tr-TR')}
                  </p>
                  <p className="line-clamp-1 text-[10px] text-muted-foreground sm:text-[11px]">{t.school?.name ?? 'Okul bilgisi yok'}</p>
                  {!!formatSchoolMeta(t.school) && (
                    <p className="line-clamp-2 text-[9px] leading-snug text-muted-foreground sm:text-[10px]">{formatSchoolMeta(t.school)}</p>
                  )}
                  <ChevronRight className="size-3.5 self-end text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:size-4" />
                </button>
              ))
            ))}
          </div>
        </div>

        {/* Orta: Konuşma */}
        <div className="flex min-h-[min(52vh,420px)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-sm sm:min-h-[360px] lg:min-h-0 lg:rounded-3xl">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground sm:p-8">
              <div className="rounded-2xl border border-dashed border-sky-500/25 bg-linear-to-br from-sky-500/5 to-background px-4 py-8 text-center text-xs sm:rounded-3xl sm:px-8 sm:py-12 sm:text-sm">
                Listeden bir talep seçin
              </div>
            </div>
          ) : !selectedTicket || !messages ? (
            <LoadingSpinner label="Yükleniyor…" className="py-8 sm:py-12" />
          ) : (
            <>
              {(selectedTicket?.status === 'CLOSED' || selectedTicket?.status === 'RESOLVED') && (
                <Alert variant="warning" showIcon className="m-1.5 py-1.5 text-[11px] sm:m-2 sm:text-xs">
                  Bu talep {selectedTicket.status === 'CLOSED' ? 'kapatıldı' : 'çözüldü'}. Yeni yanıt eklenemez.
                </Alert>
              )}
              <div className="border-b border-border/50 bg-linear-to-r from-sky-500/10 via-background/90 to-violet-500/8 px-3 py-2.5 sm:p-4">
                <p className="text-sm font-semibold sm:text-base">{selectedTicket.subject}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                  {selectedTicket.ticket_number} · {selectedTicket.module?.name ?? '-'}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">
                  {selectedTicket.school?.name ?? 'Okul bilgisi yok'}
                  {!!formatSchoolMeta(selectedTicket.school) ? ` · ${formatSchoolMeta(selectedTicket.school)}` : ''}
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 sm:space-y-3 sm:p-4">
                {messages.items.map((m) => (
                  <Card
                    key={m.id}
                    className={m.message_type === 'INTERNAL_NOTE'
                      ? 'ml-auto max-w-[94%] rounded-2xl border-amber-300/45 bg-linear-to-br from-amber-50/90 to-amber-100/40 shadow-sm dark:border-amber-800/40 dark:from-amber-950/35 dark:to-amber-950/15 sm:max-w-[92%] sm:rounded-3xl'
                      : 'max-w-[94%] rounded-2xl border-sky-200/50 bg-linear-to-br from-sky-50/70 to-background/95 shadow-sm dark:border-sky-900/40 dark:from-sky-950/25 dark:to-background sm:max-w-[92%] sm:rounded-3xl'}
                  >
                    <CardContent className="px-3 py-3 sm:px-4 sm:pb-4 sm:pt-4">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{m.author?.display_name ?? 'Sistem'}</span>
                        <span>{new Date(m.created_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {m.message_type === 'INTERNAL_NOTE' && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] dark:bg-amber-800/50">
                          <StickyNote className="size-2.5" /> İç not
                        </span>
                      )}
                      <p className="mt-1.5 whitespace-pre-wrap text-xs sm:text-sm">{m.body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED' && (
                <form onSubmit={handleReply} className="space-y-2 border-t border-border/50 bg-muted/10 p-2.5 sm:space-y-3 sm:p-4">
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-sky-200/70 bg-sky-500/8 px-2.5 py-1.5 text-[11px] font-medium sm:px-3 sm:py-2 sm:text-sm dark:border-sky-800/50 dark:bg-sky-950/30">
                      <input type="radio" checked={messageType === 'PUBLIC'} onChange={() => setMessageType('PUBLIC')} className="size-3.5" />
                      Yanıt
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium sm:px-3 sm:py-2 sm:text-sm dark:border-amber-800/50 dark:bg-amber-950/25">
                      <input type="radio" checked={messageType === 'INTERNAL_NOTE'} onChange={() => setMessageType('INTERNAL_NOTE')} className="size-3.5" />
                      <StickyNote className="size-3.5" /> İç not
                    </label>
                  </div>
                  <TicketAttachmentInput value={attachments} onChange={setAttachments} token={token} disabled={submitting} />
                  <div className="flex gap-1.5 sm:gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Yanıtınızı yazın…"
                      className="min-h-[88px] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs shadow-sm sm:min-h-[110px] sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm"
                      disabled={submitting}
                    />
                    <Button type="submit" disabled={submitting || !reply.trim()} size="icon" className="h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11 sm:rounded-2xl">
                      <Send className="size-4" />
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Sağ: Metadata */}
        <div className="flex max-h-[min(38vh,280px)] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-violet-500/15 bg-linear-to-b from-card via-card to-violet-500/5 shadow-sm dark:to-violet-950/20 lg:max-h-none lg:w-72 lg:rounded-3xl">
          {!selectedTicket ? (
            <div className="flex flex-1 items-center justify-center p-3 text-center text-[11px] text-muted-foreground sm:p-4 sm:text-sm">
              Talep seçin
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:space-y-4 sm:p-5">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Durum</p>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="select-input mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-[inherit] sm:px-3 sm:py-2 sm:text-sm"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Atanan kişi</p>
                {assignableUsers.length > 0 ? (
                  <select
                    value={selectedTicket.assigned_to_user_id ?? ''}
                    onChange={(e) => handleAssignmentChange(e.target.value)}
                    disabled={updatingAssignment}
                    className="select-input mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-[inherit] sm:px-3 sm:py-2 sm:text-sm"
                  >
                    <option value="">Atanmamış</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-xs font-medium sm:text-sm">{selectedTicket.assignedTo?.display_name ?? '—'}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Okul</p>
                <p className="text-xs font-medium sm:text-sm">{selectedTicket.school?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">İl / İlçe</p>
                <p className="text-xs font-medium sm:text-sm">{[selectedTicket.school?.city, selectedTicket.school?.district].filter(Boolean).join(' / ') || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Okul grubu</p>
                <p className="text-xs font-medium sm:text-sm">{[
                  selectedTicket.school?.type ? formatSchoolTypeLabel(selectedTicket.school.type) : null,
                  selectedTicket.school?.segment,
                ].filter(Boolean).join(' • ') || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Öncelik</p>
                <p className="text-xs font-medium sm:text-sm">{({ LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Acil' } as Record<string, string>)[selectedTicket.priority] ?? selectedTicket.priority}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground sm:text-xs">Talep açan</p>
                <p className="text-xs font-medium sm:text-sm">{selectedTicket.requester?.display_name ?? '-'}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-sky-500/15 bg-linear-to-br from-sky-500/6 to-muted/20 p-2.5 sm:rounded-2xl sm:p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground sm:text-xs">
                  <Building2 className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                  Talep özeti
                </div>
                <div className="grid gap-1.5 text-xs sm:gap-2 sm:text-sm">
                  <div className="flex items-start gap-2">
                    <MapPinned className="mt-0.5 size-3.5 text-muted-foreground" />
                    <span>{[selectedTicket.school?.city, selectedTicket.school?.district].filter(Boolean).join(' / ') || 'İl ve ilçe yok'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Layers3 className="mt-0.5 size-3.5 text-muted-foreground" />
                    <span>{[
                      selectedTicket.school?.type ? formatSchoolTypeLabel(selectedTicket.school.type) : null,
                      selectedTicket.school?.segment,
                    ].filter(Boolean).join(' • ') || 'Okul grubu yok'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <UserRound className="mt-0.5 size-3.5 text-muted-foreground" />
                    <span>{selectedTicket.requester?.display_name ?? 'Talep açan yok'}</span>
                  </div>
                </div>
              </div>
              {canEscalate && (
                <Button variant="outline" className="h-9 w-full gap-1.5 border-violet-500/25 px-2 text-xs sm:h-10 sm:text-sm" onClick={() => setEscalateOpen(true)}>
                  <ArrowUpCircle className="size-3.5 shrink-0 sm:size-4" />
                  Üst birime aktar (Platform)
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      <SupportTeamDialog
        open={teamDialogOpen}
        onOpenChange={setTeamDialogOpen}
        token={token}
        schoolId={schoolId}
      />
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Üst birime aktar</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Talep neden platform ekibine iletilmeli? (zorunlu)</Label>
              <textarea
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Neden platforma aktarıyorsunuz?"
                className="mt-1.5 min-h-[80px] w-full rounded border px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <Label>Ek bilgi (isteğe bağlı)</Label>
              <textarea
                value={escalateExtra}
                onChange={(e) => setEscalateExtra(e.target.value)}
                placeholder="Ek notlar…"
                className="mt-1.5 min-h-[60px] w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>İptal</Button>
            <Button onClick={handleEscalate} disabled={escalating || !escalateReason.trim()}>
              {escalating ? 'Gönderiliyor…' : 'Platform ekibine ile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
