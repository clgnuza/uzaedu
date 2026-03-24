'use client';

import { useCallback, useEffect, useState } from 'react';
import { Inbox as InboxIcon, ChevronRight, Send, ArrowUpCircle, StickyNote, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch } from '@/lib/api';
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
};

type AssignableUser = { id: string; display_name: string | null; email: string; role: string };

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'İşlemde',
  WAITING_REQUESTER: 'Bilgi bekleniyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapatıldı',
};

export default function SupportInboxPage() {
  const { token, me } = useAuth();
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

  const allowed = me?.role === 'school_admin' || (me?.role === 'moderator' && (me as { moderator_modules?: string[] })?.moderator_modules?.includes('support'));
  const isSchoolAdmin = me?.role === 'school_admin';
  const schoolId = (me as { school_id?: string })?.school_id ?? (me as { school?: { id?: string } })?.school?.id ?? selectedTicket?.school_id ?? null;
  const canEscalate = me?.role === 'school_admin' && selectedTicket?.target_type === 'SCHOOL_SUPPORT' && !selectedTicket?.escalated_to_ticket_id;

  useEffect(() => {
    if (!allowed) return;
    const params = new URLSearchParams({ page: '1', limit: '50', list_mode: 'school_inbox' });
    if (filter) params.set('status', filter);
    setLoading(true);
    setError(null);
    apiFetch<{ total: number; page: number; limit: number; items: TicketItem[] }>(`/tickets?${params}`, { token })
      .then((r) => setData({ total: r.total, items: r.items }))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, allowed, filter]);

  const loadSelected = useCallback(() => {
    if (!token || !selectedId) return;
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
      .catch(() => {
        setSelectedTicket(null);
        setMessages(null);
      });
  }, [token, selectedId]);

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

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <Toolbar>
        <ToolbarHeading>
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <InboxIcon className="size-5 text-primary" />
              </div>
              <div>
                <ToolbarPageTitle className="text-base">Destek gelen kutusu</ToolbarPageTitle>
                <ToolbarIconHints
                  compact
                  items={[
                    { label: 'Gelen kutusu', icon: InboxIcon },
                    { label: 'Yanıt', icon: Send },
                    { label: 'Atama', icon: Users },
                  ]}
                  summary="Okula gelen talepleri sol listeden seçin, orta alanda yanıtlayın."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSchoolAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTeamDialogOpen(true)}
                >
                  <Users className="size-4 mr-1.5" />
                  Destek ekibi
                </Button>
              )}
              <SupportNotificationHint />
            </div>
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && <Alert variant="error" message={error} className="mt-2 py-2" />}
      <div className="flex flex-1 min-h-0 gap-3 mt-2">
        {/* Sol: Liste */}
        <div className="w-72 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          <div className="flex flex-wrap gap-1 p-2 border-b bg-muted/20">
            {['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={cn(
                  'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                  filter === s ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <LoadingSpinner label="Yükleniyor…" className="py-6" />}
            {!loading && (!data?.items?.length ? (
              <div className="p-4 text-sm text-muted-foreground">Bu filtrede talep yok</div>
            ) : (
              data?.items.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors border-b last:border-0',
                    selectedId === t.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <SupportStatusBadge status={t.status} size="xs" />
                    <span className="font-mono text-[10px] text-muted-foreground">{t.ticket_number}</span>
                  </div>
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.requester?.display_name ?? '-'} • {new Date(t.last_activity_at).toLocaleDateString('tr-TR')}
                  </p>
                </button>
              ))
            ))}
          </div>
        </div>

        {/* Orta: Konuşma */}
        <div className="flex-1 min-w-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Sol listeden bir talep seçin
            </div>
          ) : !selectedTicket || !messages ? (
            <LoadingSpinner label="Yükleniyor…" className="py-12" />
          ) : (
            <>
              {(selectedTicket?.status === 'CLOSED' || selectedTicket?.status === 'RESOLVED') && (
                <Alert variant="warning" showIcon className="m-2 py-1.5 text-xs">
                  Bu talep {selectedTicket.status === 'CLOSED' ? 'kapatıldı' : 'çözüldü'}. Yeni yanıt eklenemez.
                </Alert>
              )}
              <div className="p-3 border-b bg-muted/20">
                <p className="font-medium">{selectedTicket.subject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedTicket.ticket_number} • {selectedTicket.module?.name ?? '-'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.items.map((m) => (
                  <Card key={m.id} className={m.message_type === 'INTERNAL_NOTE' ? 'border-amber-300/40 bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                    <CardContent className="pt-2.5 pb-2.5">
                      <div className="flex justify-between text-xs text-muted-foreground">
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
              {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED' && (
                <form onSubmit={handleReply} className="p-4 border-t space-y-2">
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="radio" checked={messageType === 'PUBLIC'} onChange={() => setMessageType('PUBLIC')} />
                      Yanıt
                    </label>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="radio" checked={messageType === 'INTERNAL_NOTE'} onChange={() => setMessageType('INTERNAL_NOTE')} />
                      <StickyNote className="size-3.5" /> İç not
                    </label>
                  </div>
                  <TicketAttachmentInput value={attachments} onChange={setAttachments} token={token} disabled={submitting} />
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Yanıtınızı yazın…"
                      className="min-h-[72px] flex-1 rounded-lg border px-3 py-2 text-sm"
                      disabled={submitting}
                    />
                    <Button type="submit" disabled={submitting || !reply.trim()} size="icon" className="shrink-0">
                      <Send className="size-4" />
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Sağ: Metadata */}
        <div className="w-64 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          {!selectedTicket ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm p-4">
              Talep seçin
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Durum</p>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="select-input mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-[inherit]"
                >
                  {['OPEN', 'IN_PROGRESS', 'WAITING_REQUESTER', 'RESOLVED', 'CLOSED'].map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Atanan kişi</p>
                {assignableUsers.length > 0 ? (
                  <select
                    value={selectedTicket.assigned_to_user_id ?? ''}
                    onChange={(e) => handleAssignmentChange(e.target.value)}
                    disabled={updatingAssignment}
                    className="select-input mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-[inherit]"
                  >
                    <option value="">Atanmamış</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 font-medium text-sm">{selectedTicket.assignedTo?.display_name ?? '—'}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Öncelik</p>
                <p className="font-medium text-sm">{({ LOW: 'Düşük', MEDIUM: 'Orta', HIGH: 'Yüksek', URGENT: 'Acil' } as Record<string, string>)[selectedTicket.priority] ?? selectedTicket.priority}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Talep açan</p>
                <p className="font-medium text-sm">{selectedTicket.requester?.display_name ?? '-'}</p>
              </div>
              {canEscalate && (
                <Button variant="outline" className="w-full" onClick={() => setEscalateOpen(true)}>
                  <ArrowUpCircle className="size-4 mr-2" /> Üst birime aktar (Platform)
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

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
