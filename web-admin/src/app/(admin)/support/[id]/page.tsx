'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Headphones, ArrowLeft, Send, ArrowUpCircle, StickyNote } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { apiFetch } from '@/lib/api';
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

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const { token, me } = useAuth();
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

  const isStaff = me?.role === 'school_admin' || me?.role === 'moderator' || me?.role === 'superadmin';
  const canEscalate =
    me?.role === 'school_admin' &&
    ticket?.target_type === 'SCHOOL_SUPPORT' &&
    !ticket?.escalated_to_ticket_id;

  const load = () => {
    if (!token || !id) return;
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
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setTicket(null);
        setMessages(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [token, id]);

  useEffect(() => {
    if (isStaff && token && ticket) {
      const schoolId = (ticket as { school_id?: string }).school_id;
      const q = schoolId ? `?school_id=${encodeURIComponent(schoolId)}` : '';
      apiFetch<AssignableUser[]>(`/tickets/assignable-users${q}`, { token })
        .then(setAssignableUsers)
        .catch(() => setAssignableUsers([]));
    }
  }, [isStaff, token, ticket?.id, ticket?.school_id]);

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

  return (
    <div className="space-y-4">
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
      {!loading && ticket && (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') && (
        <Alert variant="info" showIcon className="py-2">
          Bu talep {ticket.status === 'CLOSED' ? 'kapatıldı' : 'çözüldü'}. Yeni yanıt ekleyemezsiniz.
        </Alert>
      )}
      {loading && <LoadingSpinner label="Yükleniyor…" className="py-6" />}
      {!loading && ticket && messages && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <div className="space-y-2">
              {messages.items.map((m) => (
                <Card key={m.id} className={m.message_type === 'INTERNAL_NOTE' ? 'border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                  <CardContent className="pt-3 pb-3">
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
              <form onSubmit={handleReply} className="space-y-2">
                {isStaff && (
                  <div className="flex gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        checked={messageType === 'PUBLIC'}
                        onChange={() => setMessageType('PUBLIC')}
                      />
                      Yanıt (görünür)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
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
                    className="min-h-[80px] flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    disabled={submitting}
                  />
                  <Button type="submit" disabled={submitting || !reply.trim()} size="icon" className="shrink-0">
                    <Send className="size-4" />
                  </Button>
                </div>
              </form>
            )}
          </div>
          <div>
            <Card>
              <CardContent className="pt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Durum</p>
                  {isStaff ? (
                    <select
                      value={ticket.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                      className="select-input mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-[inherit]"
                    >
                      <option value="OPEN">Açık</option>
                      <option value="IN_PROGRESS">İşlemde</option>
                      <option value="WAITING_REQUESTER">Bilgi bekleniyor</option>
                      <option value="RESOLVED">Çözüldü</option>
                      <option value="CLOSED">Kapatıldı</option>
                    </select>
                  ) : (
                    <SupportStatusBadge status={ticket.status} size="sm" />
                  )}
                  {!isStaff && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
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
                  {isStaff && assignableUsers.length > 0 ? (
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
                    className="w-full"
                    onClick={() => setEscalateOpen(true)}
                  >
                    <ArrowUpCircle className="size-4 mr-2" />
                    Üst birime aktar (Platform)
                  </Button>
                )}
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
