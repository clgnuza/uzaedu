'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Headphones, ArrowLeft, Send, ArrowUpCircle, StickyNote, Sparkles, Clock3, Layers3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
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

type TicketMessage = {
  id: string;
  body: string;
  message_type: 'PUBLIC' | 'INTERNAL_NOTE';
  created_at: string;
  author?: { display_name: string | null } | null;
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
    <div className="space-y-5">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => router.push('/support')}
              className="rounded-lg p-1.5 hover:bg-muted"
              aria-label="Geri"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Headphones className="size-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <ToolbarPageTitle className="text-base">{ticket?.subject ?? 'Talep Detayı'}</ToolbarPageTitle>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{ticket?.ticket_number ?? id}</span>
                {ticket && <SupportStatusBadge status={ticket.status} size="xs" />}
                <span className="text-xs text-muted-foreground">{ticket?.module?.name ?? '-'}</span>
              </div>
            </div>
            <SupportNotificationHint />
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && <Alert variant="error" message={error} className="py-2" />}
      {(supportEnabled === false || supportBlocked) && me?.role !== 'superadmin' && (
        <Alert variant="warning" message="Destek modülü şu anda kapalı. Talep detayı ve yazışmalar geçici olarak görüntülenemiyor." className="py-2" />
      )}
      {!loading && ticket && (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') && (
        <Alert variant="info" showIcon className="py-2">
          Bu talep {ticket.status === 'CLOSED' ? 'kapatıldı' : 'çözüldü'}. Yeni yanıt ekleyemezsiniz.
        </Alert>
      )}
      {loading && <LoadingSpinner label="Yükleniyor…" className="py-6" />}
      {!loading && supportEnabled !== false && !supportBlocked && ticket && messages && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="rounded-3xl border border-border/60 bg-linear-to-br from-primary/8 via-background to-background p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-primary shadow-sm">
                    <Sparkles className="size-3.5" />
                    Talep akışı
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">{ticket.subject}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ticket.ticket_number} • {ticket.module?.name ?? 'Modül yok'}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                    <p className="text-[11px] text-muted-foreground">Durum</p>
                    <div className="mt-2">{ticket && <SupportStatusBadge status={ticket.status} size="sm" />}</div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                    <p className="text-[11px] text-muted-foreground">Oncelik</p>
                    <p className="mt-2 text-sm font-semibold">{({ LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Acil' } as Record<string, string>)[ticket.priority] ?? ticket.priority}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 shadow-sm">
                    <p className="text-[11px] text-muted-foreground">Mesaj</p>
                    <p className="mt-2 text-sm font-semibold">{messages.items.length}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-3xl border border-border/60 bg-card/95 p-4 shadow-sm">
              {messages.items.map((m) => (
                <Card
                  key={m.id}
                  className={m.message_type === 'INTERNAL_NOTE'
                    ? 'ml-auto max-w-[92%] rounded-3xl border-amber-300/40 bg-amber-50/70 shadow-sm dark:bg-amber-950/20'
                    : 'max-w-[92%] rounded-3xl border-border/60 bg-background/90 shadow-sm'}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{m.author?.display_name ?? 'Sistem'}</span>
                      <span>{new Date(m.created_at).toLocaleString('tr-TR')}</span>
                    </div>
                    {m.message_type === 'INTERNAL_NOTE' && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] dark:bg-amber-800/50">
                        <StickyNote className="size-2.5" /> İç not
                      </span>
                    )}
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{m.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
              <form onSubmit={handleReply} className="space-y-3 rounded-3xl border border-border/60 bg-card/95 p-4 shadow-sm">
                {canManageTicket && (
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                      <input
                        type="radio"
                        checked={messageType === 'PUBLIC'}
                        onChange={() => setMessageType('PUBLIC')}
                      />
                      Yanıt (görünür)
                    </label>
                    <label className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-2 text-sm">
                      <input
                        type="radio"
                        checked={messageType === 'INTERNAL_NOTE'}
                        onChange={() => setMessageType('INTERNAL_NOTE')}
                      />
                      <StickyNote className="size-3.5" />
                      İç not
                    </label>
                  </div>
                )}
                <TicketAttachmentInput
                  value={attachments}
                  onChange={setAttachments}
                  token={token}
                  disabled={submitting}
                />
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={messageType === 'INTERNAL_NOTE' ? 'Sadece destek ekibine görünür not…' : 'Yanıtınızı yazın…'}
                    className="min-h-[110px] flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow-sm"
                    disabled={submitting}
                  />
                  <Button type="submit" disabled={submitting || !reply.trim()} size="icon" className="h-11 w-11 shrink-0 rounded-2xl">
                    <Send className="size-4" />
                  </Button>
                </div>
              </form>
            )}
          </div>
          <div className="space-y-4">
            <Card className="rounded-3xl border-border/60 shadow-sm">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Layers3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Talep detaylari</p>
                    <p className="text-xs text-muted-foreground">Durum ve yönetim alanları</p>
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
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl"
                    onClick={() => setEscalateOpen(true)}
                  >
                    <ArrowUpCircle className="size-4 mr-2" />
                    Üst birime aktar (Platform)
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="rounded-3xl border-border/60 shadow-sm">
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
                    <Clock3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Akis notu</p>
                    <p className="text-xs text-muted-foreground">Yanıtlar sırayla burada görünür</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Talep çözüldüğünde durumu güncelleyin; gerekirse aynı ekrandan yeni yanıt veya iç not bırakın.
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
