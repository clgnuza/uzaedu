'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpCircle, Headphones, Inbox, Send, StickyNote, Building2, MapPinned, Layers3, UserRound, Power } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { TicketAttachmentInput, type AttachmentItem } from '@/components/ticket-attachment-input';
import { SupportStatusBadge } from '@/components/support/support-status-badge';
import { SupportNotificationHint } from '@/components/support/support-notification-hint';
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
  WAITING_REQUESTER: 'Bekleniyor',
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

export default function SupportPlatformPage() {
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
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [updatingAssignment, setUpdatingAssignment] = useState(false);
  const [supportEnabled, setSupportEnabled] = useState(true);
  const [togglingSupport, setTogglingSupport] = useState(false);

  const formatSchoolMeta = (school?: TicketItem['school']) =>
    [school?.city, school?.district, school?.type ? formatSchoolTypeLabel(school.type) : null, school?.segment]
      .filter(Boolean)
      .join(' • ');
  const statusOptions = selectedTicket ? getAllowedStatusOptions(selectedTicket.status as TicketStatus) : [];

  useEffect(() => {
    if (me?.role !== 'superadmin') return;
    apiFetch<{ support_enabled: boolean }>('/app-config/web-extras', { token })
      .then((cfg) => setSupportEnabled(cfg.support_enabled))
      .catch(() => setSupportEnabled(true));
  }, [token, me?.role]);

  useEffect(() => {
    if (me?.role !== 'superadmin') return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: '1', limit: '50', target_type: 'PLATFORM_SUPPORT' });
    if (filter) params.set('status', filter);
    apiFetch<{ total: number; page: number; limit: number; items: TicketItem[] }>(`/tickets?${params}`, { token })
      .then((r) => setData({ total: r.total, items: r.items }))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [token, me?.role, filter]);

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
    if (selectedId && token) loadSelected();
    else { setSelectedTicket(null); setMessages(null); }
  }, [selectedId, token, loadSelected]);

  useEffect(() => {
    if (me?.role !== 'superadmin') window.location.replace('/403');
  }, [me?.role]);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mesaj gönderilemedi');
    } finally {
      setSubmitting(false);
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

  const handleSupportToggle = async () => {
    if (!token) return;
    setTogglingSupport(true);
    setError(null);
    try {
      const next = !supportEnabled;
      await apiFetch('/app-config/web-extras', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ support_enabled: next }),
      });
      setSupportEnabled(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Destek modülü güncellenemedi');
    } finally {
      setTogglingSupport(false);
    }
  };

  if (me?.role !== 'superadmin') return null;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <Toolbar>
        <ToolbarHeading>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Headphones className="size-5 text-primary" />
              </div>
              <div>
                <ToolbarPageTitle className="text-base">Platform Destek</ToolbarPageTitle>
                <ToolbarIconHints
                  compact
                  items={[
                    { label: 'Eskalasyon', icon: ArrowUpCircle },
                    { label: 'Gelen kutusu', icon: Inbox },
                  ]}
                  summary="Okullardan eskale edilen talepler."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={supportEnabled ? 'outline' : 'default'}
                size="sm"
                onClick={handleSupportToggle}
                disabled={togglingSupport}
              >
                <Power className="size-4 mr-1.5" />
                {supportEnabled ? 'Destek Açık' : 'Destek Kapalı'}
              </Button>
              <SupportNotificationHint />
            </div>
          </div>
        </ToolbarHeading>
      </Toolbar>

      {error && <Alert variant="error" message={error} className="mt-2 py-2" />}
      <div className="flex flex-1 min-h-0 gap-3 mt-2">
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
              <div className="p-4 text-sm text-muted-foreground">Platform talebi yok</div>
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
                  <p className="text-xs text-muted-foreground">
                    {t.school?.name ?? '-'} • {t.requester?.display_name ?? '-'} • {new Date(t.last_activity_at).toLocaleDateString('tr-TR')}
                  </p>
                  {!!formatSchoolMeta(t.school) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatSchoolMeta(t.school)}</p>
                  )}
                </button>
              ))
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          {!selectedId ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">Sol listeden bir talep seçin</div>
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
                  {selectedTicket.ticket_number} • {selectedTicket.school?.name ?? '-'} • {selectedTicket.module?.name ?? '-'}
                </p>
                {!!formatSchoolMeta(selectedTicket.school) && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{formatSchoolMeta(selectedTicket.school)}</p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.items.map((m) => (
                  <Card key={m.id} className={m.message_type === 'INTERNAL_NOTE' ? 'border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                    <CardContent className="pt-3">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{m.author?.display_name ?? 'Sistem'}</span>
                        <span>{new Date(m.created_at).toLocaleString('tr-TR')}</span>
                      </div>
                      {m.message_type === 'INTERNAL_NOTE' && (
                        <span className="mr-2 inline-block rounded bg-amber-200 px-1.5 py-0.5 text-xs dark:bg-amber-800/50">İç not</span>
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
                      <input type="radio" checked={messageType === 'PUBLIC'} onChange={() => setMessageType('PUBLIC')} /> Yanıt
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

        <div className="w-64 shrink-0 flex flex-col border rounded-lg bg-card overflow-hidden">
          {!selectedTicket ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm p-4">Talep seçin</div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Durum</p>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atanan</p>
                {assignableUsers.length > 0 ? (
                  <select
                    value={selectedTicket.assigned_to_user_id ?? ''}
                    onChange={(e) => handleAssignmentChange(e.target.value)}
                    disabled={updatingAssignment}
                    className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                  >
                    <option value="">— Atanmamış —</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name || u.email} ({u.role})</option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 font-medium text-sm">{selectedTicket.assignedTo?.display_name ?? '—'}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Okul</p>
                <p className="font-medium text-sm">{selectedTicket.school?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">İl / İlçe</p>
                <p className="font-medium text-sm">{[selectedTicket.school?.city, selectedTicket.school?.district].filter(Boolean).join(' / ') || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Okul grubu</p>
                <p className="font-medium text-sm">{[
                  selectedTicket.school?.type ? formatSchoolTypeLabel(selectedTicket.school.type) : null,
                  selectedTicket.school?.segment,
                ].filter(Boolean).join(' • ') || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Talep açan</p>
                <p className="font-medium text-sm">{selectedTicket.requester?.display_name ?? '-'}</p>
              </div>
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Building2 className="size-3.5" />
                  Okul bilgisi
                </div>
                <div className="grid gap-2 text-sm">
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
              <div>
                <p className="text-xs text-muted-foreground">Öncelik</p>
                <p className="font-medium text-sm">{selectedTicket.priority}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
