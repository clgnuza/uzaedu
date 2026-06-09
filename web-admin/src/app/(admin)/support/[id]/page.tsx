'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Send, ArrowUpCircle, StickyNote, Clock3, Layers3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, isSupportModuleDisabledError } from '@/lib/api';
import { useSupportModuleAvailability } from '@/hooks/use-support-module-availability';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
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
import { SupportTicketHeaderCard } from '@/components/support/support-ticket-header-card';
import { SupportMessageThread } from '@/components/support/support-message-thread';
import { cn } from '@/lib/utils';

type TicketMessage = {
  id: string;
  body: string;
  message_type: 'PUBLIC' | 'INTERNAL_NOTE';
  created_at: string;
  author_user_id?: string;
  author?: { display_name: string | null; role?: string | null } | null;
};

type AssignableUser = { id: string; display_name: string | null; email: string; role: string };
type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_REQUESTER' | 'RESOLVED' | 'CLOSED';

type Ticket = {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  target_type: string;
  requester_user_id?: string;
  school_id?: string;
  escalated_to_ticket_id?: string | null;
  assigned_to_user_id?: string | null;
  module?: { name: string } | null;
  requester?: { display_name: string | null } | null;
  assignedTo?: { display_name: string | null } | null;
};

function isStaffForTicket(ticket: Ticket | null, role?: string) {
  if (!ticket) return false;
  if (role === 'superadmin') return true;
  return ticket.target_type === 'SCHOOL_SUPPORT' && (role === 'school_admin' || role === 'moderator');
}

function getAllowedStatusOptions(status: TicketStatus, canManageTicket: boolean) {
  if (!canManageTicket) return [status];

  const transitions: Record<TicketStatus, TicketStatus[]> = {
    OPEN: ['IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['WAITING_REQUESTER', 'RESOLVED', 'CLOSED'],
    WAITING_REQUESTER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    RESOLVED: ['IN_PROGRESS', 'CLOSED'],
    CLOSED: ['IN_PROGRESS'],
  };

  return [status, ...transitions[status].filter((item) => item !== status)];
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { token, me } = useAuth();
  const { supportEnabled, loading: supportLoading } = useSupportModuleAvailability();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<{ items: TicketMessage[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [messageType, setMessageType] = useState<'PUBLIC' | 'INTERNAL_NOTE'>('PUBLIC');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateExtra, setEscalateExtra] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [supportBlocked, setSupportBlocked] = useState(false);

  const canManageTicket = isStaffForTicket(ticket, me?.role);
  const canEscalate =
    me?.role === 'school_admin' &&
    ticket?.target_type === 'SCHOOL_SUPPORT' &&
    !ticket?.escalated_to_ticket_id;
  const statusOptions = ticket ? getAllowedStatusOptions(ticket.status as TicketStatus, canManageTicket) : [];

  const load = () => {
    if (!token || !id || supportEnabled !== true || supportBlocked) return;
    setLoading(true);
    Promise.all([
      apiFetch<Ticket>(`/tickets/${id}`, { token }),
      apiFetch<{ items: TicketMessage[] }>(`/tickets/${id}/messages?page=1&limit=100`, { token }),
    ])
      .then(([t, m]) => {
        setTicket(t);
        setMessages(m);
      })
      .catch((e) => {
        if (isSupportModuleDisabledError(e)) {
          setSupportBlocked(true);
          setError(null);
          setTicket(null);
          setMessages(null);
          return;
        }
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setTicket(null);
        setMessages(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (supportEnabled === false || supportBlocked) {
      setLoading(false);
      return;
    }
    load();
  }, [token, id, supportEnabled, supportBlocked]);

  useEffect(() => {
    if (canManageTicket && token && ticket && supportEnabled === true && !supportBlocked) {
      const schoolId = (ticket as { school_id?: string }).school_id;
      const q = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : '';
      apiFetch<AssignableUser[]>(`/tickets/assignable-users${q}`, { token })
        .then(setAssignableUsers)
        .catch(() => setAssignableUsers([]));
    }
  }, [canManageTicket, token, ticket?.id, ticket?.school_id, supportEnabled, supportBlocked]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id || !reply.trim() || ticket?.status === 'CLOSED' || ticket?.status === 'RESOLVED') return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${id}/messages`, {
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
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEscalate = async () => {
    if (!token || !id || !escalateReason.trim()) return;
    setEscalating(true);
    setError(null);
    try {
      const res = await apiFetch<{ ticket: Ticket; original_ticket_id: string }>(
        `/tickets/${id}/escalate`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ reason: escalateReason.trim(), extra_info: escalateExtra.trim() || undefined }),
        },
      );
      setEscalateOpen(false);
      setEscalateReason('');
      setEscalateExtra('');
      router.push(`/support/${res.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eskalasyon yapılamadı');
    } finally {
      setEscalating(false);
    }
  };

  const handleAssignmentChange = async (userId: string) => {
    if (!token || !id) return;
    setUpdatingAssignment(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ assigned_to_user_id: userId || null }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Atama güncellenemedi');
    } finally {
      setUpdatingAssignment(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !id) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      await apiFetch(`/tickets/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: newStatus }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Durum güncellenemedi');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (!id) return null;
  if (supportLoading) return <LoadingSpinner label="Yükleniyor…" className="py-8" />;

  return (
    <div className="support-ticket-page space-y-3 pb-4 sm:space-y-5 sm:pb-8">
      {!loading && ticket ? (
        <SupportTicketHeaderCard
          ticket={ticket}
          messageCount={messages?.items.length}
          onBack={() => router.push('/support')}
          actions={<SupportNotificationHint />}
        />
      ) : (
        <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {loading ? 'Yükleniyor…' : 'Talep detayı'}
        </div>
      )}

      {error && <Alert variant="error" message={error} className="py-2" />}
      {(supportEnabled === false || supportBlocked) && me?.role !== 'superadmin' && (
        <Alert variant="warning" message="Destek modülü şu anda kapalı. Talep detayı ve yazışmalar geçici olarak görüntülenemiyor." className="py-2" />
      )}
      {loading && <LoadingSpinner label="Yükleniyor…" className="py-6" />}
      {!loading && supportEnabled !== false && !supportBlocked && ticket && messages && (
        <div className="grid gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_min(100%,300px)]">
          <div className="space-y-3 sm:space-y-4">
            <SupportMessageThread
              messages={messages.items}
              ticket={{ requester_user_id: ticket.requester_user_id, target_type: ticket.target_type }}
            />

            {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
              <form
                onSubmit={handleReply}
                className="space-y-2.5 rounded-xl border border-border/50 bg-card/95 p-2.5 shadow-sm sm:space-y-3 sm:rounded-2xl sm:p-4"
              >
                {canManageTicket && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm">
                      <input type="radio" checked={messageType === 'PUBLIC'} onChange={() => setMessageType('PUBLIC')} />
                      Yanıt (görünür)
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1.5 text-[11px] sm:gap-2 sm:px-3 sm:py-2 sm:text-sm">
                      <input type="radio" checked={messageType === 'INTERNAL_NOTE'} onChange={() => setMessageType('INTERNAL_NOTE')} />
                      <StickyNote className="size-3 sm:size-3.5" />
                      İç not
                    </label>
                  </div>
                )}
                <TicketAttachmentInput value={attachments} onChange={setAttachments} token={token} disabled={submitting} />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={messageType === 'INTERNAL_NOTE' ? 'Sadece destek ekibine görünür not…' : 'Yanıtınızı yazın…'}
                    className="min-h-[96px] flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm sm:min-h-[110px] sm:rounded-2xl sm:px-4 sm:py-3"
                    disabled={submitting}
                  />
                  <Button
                    type="submit"
                    disabled={submitting || !reply.trim()}
                    className="h-10 w-full shrink-0 gap-2 rounded-xl sm:h-11 sm:w-auto sm:rounded-2xl"
                  >
                    <Send className="size-4" />
                    Gönder
                  </Button>
                </div>
              </form>
            )}
          </div>
          <div className="space-y-3 sm:space-y-4">
            <Card className="rounded-xl border-border/50 shadow-sm sm:rounded-2xl">
              <CardContent className="space-y-3 pt-4 sm:space-y-4 sm:pt-5">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300 sm:size-10 sm:rounded-2xl">
                    <Layers3 className="size-4 sm:size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold sm:text-sm">Talep detayları</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Durum ve yönetim</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Durum</p>
                  {canManageTicket ? (
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                      className="select-input mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-[inherit]"
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status === 'OPEN' ? 'Açık' : status === 'IN_PROGRESS' ? 'İşlemde' : status === 'WAITING_REQUESTER' ? 'Bilgi bekleniyor' : status === 'RESOLVED' ? 'Çözüldü' : 'Kapatıldı'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <SupportStatusBadge status={ticket.status} size="sm" />
                  )}
                  {!canManageTicket && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleStatusChange('RESOLVED')}
                      disabled={updatingStatus}
                    >
                      Çözüldü işaretle
                    </Button>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Öncelik</p>
                  <p className="font-medium">{({ LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Acil' } as Record<string, string>)[ticket.priority] ?? ticket.priority}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Modül</p>
                  <p className="font-medium">{ticket.module?.name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Atanan kişi</p>
                  {canManageTicket && assignableUsers.length > 0 ? (
                    <select
                      value={ticket.assigned_to_user_id ?? ''}
                      onChange={(e) => handleAssignmentChange(e.target.value)}
                      disabled={updatingAssignment}
                      className="select-input mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-[inherit]"
                    >
                      <option value="">Atanmamış</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name || u.email} ({u.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="font-medium">{ticket.assignedTo?.display_name ?? '—'}</p>
                  )}
                </div>
                {canEscalate && (
                  <Button variant="outline" className="w-full rounded-xl text-xs sm:rounded-2xl sm:text-sm" onClick={() => setEscalateOpen(true)}>
                    <ArrowUpCircle className="mr-2 size-4" />
                    Üst birime aktar (Platform)
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-xl border-border/50 shadow-sm sm:rounded-2xl">
              <CardContent className="space-y-2 pt-4 sm:space-y-3 sm:pt-5">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-400 sm:size-10 sm:rounded-2xl">
                    <Clock3 className="size-4 sm:size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold sm:text-sm">Akış notu</p>
                    <p className="text-[10px] text-muted-foreground sm:text-xs">Mesajlar kronolojik sıradadır</p>
                  </div>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground sm:rounded-xl sm:p-3 sm:text-xs">
                  Çözüldüğünde durumu güncelleyin; gerekirse yeni yanıt veya iç not ekleyin.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Üst birime aktar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="escalate-reason">Talep neden platform ekibine iletilmeli? (zorunlu)</Label>
              <textarea
                id="escalate-reason"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                placeholder="Bu talebi neden platforma aktardığınızı kısaca açıklayın…"
                className="mt-1.5 min-h-[80px] w-full rounded border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <Label htmlFor="escalate-extra">Ek bilgi (isteğe bağlı)</Label>
              <textarea
                id="escalate-extra"
                value={escalateExtra}
                onChange={(e) => setEscalateExtra(e.target.value)}
                placeholder="Platform ekibine iletmek istediğiniz ek notlar…"
                className="mt-1.5 min-h-[60px] w-full rounded border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleEscalate} disabled={escalating || !escalateReason.trim()}>
              {escalating ? 'Gönderiliyor…' : 'Platform ekibine ile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
