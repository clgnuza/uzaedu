'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Inbox, MailWarning } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Row = {
  id: string;
  name: string;
  email: string;
  subject: string;
  created_at: string;
  status: string;
  notify_email_sent: boolean;
  first_read_at: string | null;
  reply_sent_at: string | null;
};

type ListRes = { total: number; page: number; limit: number; items: Row[] };

const STATUS_LABEL: Record<string, string> = {
  new: 'Yeni',
  replied: 'Yanıt',
  archived: 'Arşiv',
};

function formatListDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

export default function ContactInboxPage() {
  const { token, me } = useAuth();
  const [data, setData] = useState<ListRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'new' | 'replied' | 'archived'>('all');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '30', status });
      const res = await apiFetch<ListRes>(`/admin/contact-submissions?${q}`, { token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Liste yüklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const allowed = me?.role === 'superadmin' || me?.role === 'moderator';
  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1),
    [data],
  );

  if (!allowed) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-3 pb-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <Toolbar className="min-w-0 border-0 p-0 shadow-none">
          <ToolbarHeading>
            <div className="flex items-start gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
                <Inbox className="size-4" aria-hidden />
              </span>
              <div>
                <ToolbarPageTitle className="text-base sm:text-lg">Gelen kutusu</ToolbarPageTitle>
                <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  Form mesajları · en yeni üstte · tıkla aç
                </p>
              </div>
            </div>
          </ToolbarHeading>
        </Toolbar>
        <div className="flex shrink-0 flex-wrap gap-1">
          {(['all', 'new', 'replied', 'archived'] as const).map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={status === s ? 'secondary' : 'ghost'}
              className={cn(
                'h-7 rounded-md px-2.5 text-[11px] font-medium',
                status === s && 'bg-foreground/10 text-foreground ring-1 ring-border/80',
              )}
              onClick={() => {
                setPage(1);
                setStatus(s);
              }}
            >
              {s === 'all' ? 'Tümü' : STATUS_LABEL[s]}
            </Button>
          ))}
        </div>
      </div>

      {err ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">{err}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04]">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-2.5 py-1.5 sm:px-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {loading ? 'Yükleniyor…' : data ? `${data.total} kayıt` : '—'}
          </span>
          {!loading && data && data.total > data.limit ? (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </Button>
              <span className="tabular-nums">
                {page}/{totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </Button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="divide-y divide-border/40">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex gap-2 px-2 py-2 sm:gap-3 sm:px-3">
                <div className="mt-0.5 h-7 w-14 shrink-0 animate-pulse rounded bg-muted" />
                <div className="min-w-0 flex-1 space-y-1.5 py-0.5">
                  <div className="h-3.5 w-[72%] max-w-md animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-[48%] max-w-xs animate-pulse rounded bg-muted" />
                </div>
                <div className="h-4 w-9 shrink-0 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : !data ? null : data.items.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">Bu filtrede kayıt yok.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/contact-inbox/${r.id}`}
                  className="group flex items-stretch gap-2 px-2 py-2 transition-colors hover:bg-muted/40 sm:gap-3 sm:px-3 sm:py-2"
                >
                  <time
                    dateTime={r.created_at}
                    className="w-[4.75rem] shrink-0 pt-0.5 text-left font-mono text-[10px] leading-tight text-muted-foreground tabular-nums sm:w-[5.25rem] sm:text-[11px]"
                  >
                    {formatListDate(r.created_at)}
                  </time>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium leading-tight text-foreground group-hover:text-primary sm:text-sm">
                      {r.subject}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                      <span className="text-foreground/80">{r.name}</span>
                      <span className="mx-1 text-border">·</span>
                      {r.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide',
                        r.status === 'new' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                        r.status === 'replied' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                        r.status === 'archived' && 'bg-muted text-muted-foreground',
                      )}
                    >
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    {!r.notify_email_sent ? (
                      <span className="flex items-center gap-0.5 text-[9px] text-amber-700 dark:text-amber-400" title="SMTP bildirimi gitmedi">
                        <MailWarning className="size-2.5 shrink-0" aria-hidden />
                      </span>
                    ) : null}
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 self-center text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
