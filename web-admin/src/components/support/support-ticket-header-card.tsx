'use client';

import type { ReactNode } from 'react';
import { ArrowLeft, Building2, Headphones, Info, Layers3, MessageSquare, UserRound, Users } from 'lucide-react';
import { SupportStatusBadge } from '@/components/support/support-status-badge';
import { cn } from '@/lib/utils';

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  URGENT: 'Acil',
};

const TARGET_LABEL: Record<string, string> = {
  SCHOOL_SUPPORT: 'Okul desteği',
  PLATFORM_SUPPORT: 'Platform desteği',
};

export type SupportTicketHeaderData = {
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  target_type: string;
  module?: { name: string | null } | null;
  requester?: { display_name: string | null } | null;
  assignedTo?: { display_name: string | null } | null;
  school?: { name?: string | null; city?: string | null; district?: string | null } | null;
};

export function SupportTicketHeaderCard({
  ticket,
  messageCount,
  className,
  onBack,
  actions,
  showMetaGrid = true,
}: {
  ticket: SupportTicketHeaderData;
  messageCount?: number;
  className?: string;
  onBack?: () => void;
  actions?: ReactNode;
  showMetaGrid?: boolean;
}) {
  const schoolMeta = [ticket.school?.city, ticket.school?.district].filter(Boolean).join(' · ');
  const isClosed = ticket.status === 'CLOSED' || ticket.status === 'RESOLVED';
  const closedLabel = ticket.status === 'CLOSED' ? 'kapatıldı' : 'çözüldü';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-sky-400/30 bg-linear-to-br from-sky-500/14 via-cyan-500/10 to-violet-500/8 shadow-lg ring-1 ring-sky-500/15 dark:border-sky-500/25 dark:from-sky-950/50 dark:via-cyan-950/25 dark:to-violet-950/30',
        className,
      )}
    >
      <div className="relative p-3 sm:p-4">
        <div
          className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
          aria-hidden
        />

        <div className="relative flex items-start gap-2 sm:gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-background/90 text-foreground shadow-sm transition-colors hover:bg-muted sm:size-10"
              aria-label="Geri"
            >
              <ArrowLeft className="size-4" />
            </button>
          ) : null}

          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/25 dark:ring-white/10 sm:size-11">
            <Headphones className="size-4 sm:size-[1.1rem]" aria-hidden />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-800/90 dark:text-sky-200/90">
              {TARGET_LABEL[ticket.target_type] ?? 'Destek talebi'}
            </p>
            <h1 className="mt-0.5 text-lg font-bold leading-tight tracking-tight text-foreground sm:text-xl">
              {ticket.subject}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground shadow-sm sm:text-[11px]">
                {ticket.ticket_number}
              </span>
              <SupportStatusBadge status={ticket.status} size="sm" />
              {ticket.module?.name ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-background/75 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
                  <Layers3 className="size-3 shrink-0 opacity-70" />
                  {ticket.module.name}
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                  ticket.priority === 'URGENT'
                    ? 'border-rose-400/50 bg-rose-500/15 text-rose-800 dark:text-rose-200'
                    : ticket.priority === 'HIGH'
                      ? 'border-orange-400/50 bg-orange-500/15 text-orange-900 dark:text-orange-200'
                      : 'border-border/60 bg-background/70 text-muted-foreground',
                )}
              >
                {PRIORITY_LABEL[ticket.priority] ?? ticket.priority}
              </span>
            </div>
          </div>

          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>

        {isClosed ? (
          <div className="relative mt-3 flex items-start gap-2 rounded-xl border border-sky-300/45 bg-sky-50/90 px-3 py-2.5 text-[11px] leading-snug text-sky-950 dark:border-sky-700/40 dark:bg-sky-950/40 dark:text-sky-100 sm:text-xs">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            <p>
              Bu talep <strong className="font-semibold">{closedLabel}</strong>. Yeni yanıt ekleyemezsiniz.
            </p>
          </div>
        ) : null}

        {showMetaGrid ? (
          <div className="relative mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetaCell icon={UserRound} label="Talep sahibi" value={ticket.requester?.display_name ?? '—'} />
            <MetaCell icon={Users} label="Atanan" value={ticket.assignedTo?.display_name ?? 'Atanmamış'} />
            <MetaCell icon={Layers3} label="Modül" value={ticket.module?.name ?? '—'} />
            <MetaCell icon={MessageSquare} label="Mesaj" value={String(messageCount ?? 0)} emphasize />
          </div>
        ) : null}

        {ticket.school?.name ? (
          <div className="relative mt-2 flex items-start gap-2 rounded-xl border border-border/45 bg-background/80 px-2.5 py-2 text-[11px] shadow-sm sm:px-3 sm:text-xs">
            <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">{ticket.school.name}</p>
              {schoolMeta ? <p className="text-muted-foreground">{schoolMeta}</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetaCell({
  icon: Icon,
  label,
  value,
  emphasize,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/92 px-2.5 py-2 shadow-sm backdrop-blur-sm sm:px-3 sm:py-2.5">
      <p className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground sm:text-[10px]">
        <Icon className="size-3" />
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate font-semibold text-foreground',
          emphasize ? 'text-base tabular-nums sm:text-lg' : 'text-[11px] sm:text-xs',
        )}
      >
        {value}
      </p>
    </div>
  );
}
