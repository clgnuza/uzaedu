'use client';

import { StickyNote, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  resolveSupportAuthorGroup,
  supportAuthorGroupTheme,
  SUPPORT_AUTHOR_GROUP_THEMES,
  type SupportAuthorGroup,
  type SupportMessageForGroup,
  type SupportTicketForGroup,
} from '@/lib/support-author-group';

export type SupportThreadMessage = SupportMessageForGroup & {
  id: string;
  body: string;
  created_at: string;
};

const LEGEND_GROUPS: SupportAuthorGroup[] = ['requester', 'school_staff', 'platform', 'internal'];

function AuthorLegend() {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5 sm:gap-2">
      {LEGEND_GROUPS.map((g) => {
        const t = SUPPORT_AUTHOR_GROUP_THEMES[g];
        return (
          <span
            key={g}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold sm:text-[10px]',
              t.badgeClass,
            )}
          >
            <span className={cn('size-1.5 rounded-full', t.dotClass)} aria-hidden />
            {t.shortLabel}
          </span>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  ticket,
  index,
  total,
}: {
  message: SupportThreadMessage;
  ticket: SupportTicketForGroup;
  index: number;
  total: number;
}) {
  const group = resolveSupportAuthorGroup(message, ticket);
  const theme = supportAuthorGroupTheme(group);
  const authorName = message.author?.display_name?.trim() || 'Sistem';
  const isInternal = message.message_type === 'INTERNAL_NOTE';

  return (
    <li
      className={cn(
        'flex w-full',
        theme.align === 'end' && 'justify-end',
        theme.align === 'center' && 'justify-center',
        theme.align === 'start' && 'justify-start',
      )}
    >
      <Card
        className={cn(
          'w-full max-w-[min(100%,34rem)] border shadow-sm sm:rounded-2xl',
          theme.cardClass,
          theme.align === 'end' && 'rounded-2xl rounded-br-md',
          theme.align === 'start' && 'rounded-2xl rounded-bl-md',
        )}
      >
        <CardContent className="p-3 sm:p-3.5">
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-md ring-2 ring-background/80 sm:size-9',
                theme.avatarClass,
              )}
              title={theme.label}
            >
              {isInternal ? (
                <StickyNote className="size-3.5 sm:size-4" aria-hidden />
              ) : (
                <UserRound className="size-3.5 sm:size-4" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground sm:text-[13px]">
                    {authorName}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold sm:text-[10px]',
                      theme.badgeClass,
                    )}
                  >
                    {theme.shortLabel}
                  </span>
                </div>
                <time className="shrink-0 text-[10px] tabular-nums text-muted-foreground sm:text-[11px]" dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 sm:text-sm">
                {message.body}
              </p>
              <span className="sr-only">
                Mesaj {index + 1} / {total}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </li>
  );
}

export function SupportMessageThread({
  messages,
  ticket,
  className,
  showLegend = true,
}: {
  messages: SupportThreadMessage[];
  ticket: SupportTicketForGroup;
  className?: string;
  showLegend?: boolean;
}) {
  return (
    <div className={cn('rounded-xl border border-border/50 bg-card/95 p-2.5 shadow-sm sm:rounded-2xl sm:p-3 md:p-4', className)}>
      <h2 className="sr-only">Yazışma</h2>
      {showLegend ? <AuthorLegend /> : null}
      <ol className="m-0 list-none space-y-2.5 p-0 sm:space-y-3">
        {messages.map((m, idx) => (
          <MessageBubble key={m.id} message={m} ticket={ticket} index={idx} total={messages.length} />
        ))}
      </ol>
    </div>
  );
}
