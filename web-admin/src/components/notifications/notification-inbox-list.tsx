'use client';

import Link from 'next/link';
import {
  ArrowRightLeft,
  Banknote,
  Check,
  ClipboardList,
  ExternalLink,
  MessageSquare,
  Monitor,
  Trash2,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { NotificationChannelIcon } from '@/components/notification-channel-icon';
import {
  eventTypeToChannelId,
  getChannelTheme,
  getThemeForEventTypeDetailed,
  type ChannelTheme,
} from '@/lib/notification-channel-theme';
import { formatNotificationRelativeTime } from '@/lib/notification-relative-time';
import { notificationEventLabel } from '@/lib/notification-event-label';
import { YollukFinalizedNotificationBody } from '@/components/notifications/yolluk-finalized-notification-body';
import {
  BELIRLI_GUN_EVENT_TYPES,
  BILSEM_CALENDAR_EVENT_TYPES,
  DUTY_DAILY_EVENT_TYPES,
  DUTY_PLAN_EVENT_TYPES,
  EXAM_DUTY_EVENT_TYPES,
  EXAM_DUTY_SYNC_EVENT_TYPES,
  MARKET_EVENT_TYPES,
  SMART_BOARD_EVENT_TYPES,
  SUPPORT_EVENT_TYPES,
  SWAP_EVENT_TYPES,
  TIMETABLE_EVENT_TYPES,
  YOLLUK_EVENT_TYPES,
} from '@/lib/notification-event-groups';

export type InboxNotificationItem = {
  id: string;
  event_type: string;
  event_label?: string;
  entity_id?: string | null;
  target_screen?: string | null;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
  metadata?: { date?: string } | Record<string, unknown> | null;
};

type Group = {
  channelId: string;
  theme: ChannelTheme;
  items: InboxNotificationItem[];
};

function chipLabel(item: InboxNotificationItem): string {
  return item.event_label ?? notificationEventLabel(item.event_type);
}

function isExamSchoolModuleNotification(eventType: string): boolean {
  return eventType?.startsWith('butterfly_exam.') || eventType?.startsWith('sorumluluk_exam.');
}

function isMessageCenterGroupNotification(eventType: string): boolean {
  return eventType?.startsWith('messaging.') || eventType?.startsWith('admin_message.');
}

function isYollukNotification(eventType: string): boolean {
  return eventType?.startsWith('yolluk.');
}

function groupItems(items: InboxNotificationItem[]): Group[] {
  const map = new Map<string, InboxNotificationItem[]>();
  for (const item of items) {
    const ch = eventTypeToChannelId(item.event_type);
    const list = map.get(ch) ?? [];
    list.push(item);
    map.set(ch, list);
  }
  return Array.from(map.entries())
    .map(([channelId, groupItems]) => {
      const sorted = [...groupItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return {
        channelId,
        theme: getChannelTheme(channelId),
        items: sorted,
        latest: sorted[0]?.created_at ?? '',
      };
    })
    .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime())
    .map(({ channelId, theme, items: groupItems }) => ({ channelId, theme, items: groupItems }));
}

function LockScreenClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="pointer-events-none mb-4 text-center sm:mb-5">
      <p className="text-sm font-medium text-white/75 dark:text-white/70">{date}</p>
      <p className="mt-0.5 text-[2.75rem] font-extralight leading-none tracking-tight text-white tabular-nums sm:text-5xl">
        {time}
      </p>
    </div>
  );
}

function NotificationBubble({
  item,
  theme,
  href,
  onLinkClick,
  actionBar,
}: {
  item: InboxNotificationItem;
  theme: ChannelTheme;
  href: string;
  onLinkClick: (e: React.MouseEvent, item: InboxNotificationItem) => void;
  actionBar: React.ReactNode;
}) {
  const unread = !item.read_at;
  const isYolluk = isYollukNotification(item.event_type);
  const isExamDutySync = EXAM_DUTY_SYNC_EVENT_TYPES.includes(item.event_type);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-[1.35rem] border shadow-lg backdrop-blur-2xl transition-all',
        'active:scale-[0.995]',
        unread
          ? 'border-white/55 bg-white/88 shadow-black/12 dark:border-white/22 dark:bg-white/14 dark:shadow-black/40'
          : 'border-white/35 bg-white/62 shadow-black/6 dark:border-white/10 dark:bg-white/8',
      )}
    >
      <Link
        href={href}
        className="block px-3.5 py-3.5 transition-colors hover:bg-white/10 sm:px-4 sm:py-4"
        onClick={(e) => onLinkClick(e, item)}
      >
        <div className="flex gap-3">
          <NotificationChannelIcon eventType={item.event_type} size="md" className="mt-0.5 shadow-md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  'truncate text-[13px] font-semibold',
                  unread ? 'text-foreground' : 'text-foreground/70',
                )}
              >
                {theme.shortLabel}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                {formatNotificationRelativeTime(item.created_at)}
              </span>
            </div>
            <p
              className={cn(
                'mt-1 text-[15px] font-semibold leading-snug tracking-tight',
                unread ? 'text-foreground' : 'text-foreground/75',
              )}
            >
              {item.title}
            </p>
            {item.body ? (
              <p
                className={cn(
                  'mt-1.5 text-[13px] leading-relaxed text-muted-foreground',
                  isExamDutySync ? 'max-h-24 overflow-y-auto whitespace-pre-wrap [scrollbar-width:thin]' : 'line-clamp-4',
                )}
              >
                {item.body}
              </p>
            ) : null}
            {isYolluk ? <YollukFinalizedNotificationBody metadata={item.metadata} /> : null}
            <span
              className={cn(
                'mt-2 inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-[10px] font-semibold',
                getThemeForEventTypeDetailed(item.event_type).chipClass,
              )}
            >
              {chipLabel(item)}
            </span>
          </div>
          {unread ? (
            <span
              className="mt-1 size-2.5 shrink-0 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.65)]"
              aria-label="Okunmadı"
            />
          ) : null}
        </div>
      </Link>
      {actionBar}
    </article>
  );
}

function NotificationActions({
  item,
  onLinkClick,
  onMarkRead,
  onDelete,
  markingRead,
  deletingId,
}: {
  item: InboxNotificationItem;
  onLinkClick: (e: React.MouseEvent, item: InboxNotificationItem) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  markingRead: string | null;
  deletingId: string | null;
}) {
  const isSwap = SWAP_EVENT_TYPES.includes(item.event_type);
  const isTimetable = TIMETABLE_EVENT_TYPES.includes(item.event_type);
  const isDutyPlan = DUTY_PLAN_EVENT_TYPES.includes(item.event_type);
  const isDutyDaily =
    DUTY_DAILY_EVENT_TYPES.includes(item.event_type) &&
    Boolean((item.metadata as { date?: string } | null | undefined)?.date);
  const isExamDutySync = EXAM_DUTY_SYNC_EVENT_TYPES.includes(item.event_type);

  const navBtn = (label: string, icon: React.ReactNode) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1 rounded-full bg-white/40 px-2.5 text-[11px] font-medium text-foreground hover:bg-white/60 dark:bg-white/10 dark:hover:bg-white/20"
      onClick={(e) => onLinkClick(e, item)}
    >
      {icon}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-white/25 bg-white/25 px-2 py-2 dark:border-white/10 dark:bg-black/15">
      {isSwap && navBtn('Takas', <ArrowRightLeft className="size-3.5" />)}
      {isTimetable && navBtn('Program', <ExternalLink className="size-3.5" />)}
      {isDutyPlan && navBtn('Planlar', <ExternalLink className="size-3.5" />)}
      {isDutyDaily && navBtn('Günlük', <ExternalLink className="size-3.5" />)}
      {(BELIRLI_GUN_EVENT_TYPES.includes(item.event_type) ||
        BILSEM_CALENDAR_EVENT_TYPES.includes(item.event_type)) &&
        navBtn('Takvim', <ExternalLink className="size-3.5" />)}
      {SMART_BOARD_EVENT_TYPES.includes(item.event_type) && navBtn('Tahta', <Monitor className="size-3.5" />)}
      {SUPPORT_EVENT_TYPES.includes(item.event_type) && navBtn('Destek', <ExternalLink className="size-3.5" />)}
      {isExamDutySync && navBtn('Sınav görevleri', <ClipboardList className="size-3.5" />)}
      {EXAM_DUTY_EVENT_TYPES.includes(item.event_type) &&
        navBtn('Görevlerim', <ClipboardList className="size-3.5" />)}
      {isExamSchoolModuleNotification(item.event_type) && navBtn('Aç', <ExternalLink className="size-3.5" />)}
      {isMessageCenterGroupNotification(item.event_type) &&
        navBtn('Mesajlar', <MessageSquare className="size-3.5" />)}
      {YOLLUK_EVENT_TYPES.includes(item.event_type) && navBtn('Yolluk', <Banknote className="size-3.5" />)}
      {MARKET_EVENT_TYPES.includes(item.event_type) && navBtn('Market', <Wallet className="size-3.5" />)}
      <div className="ml-auto flex items-center gap-0.5">
        {!item.read_at ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full text-foreground/80 hover:bg-white/50 dark:hover:bg-white/15"
            onClick={(e) => {
              e.preventDefault();
              onMarkRead(item.id);
            }}
            disabled={!!markingRead}
            title="Okundu"
          >
            {markingRead === item.id ? <LoadingSpinner className="size-4" /> : <Check className="size-4" />}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 rounded-full text-muted-foreground hover:bg-white/50 hover:text-destructive dark:hover:bg-white/15"
          onClick={(e) => {
            e.preventDefault();
            onDelete(item.id);
          }}
          disabled={!!deletingId}
          title="Sil"
        >
          {deletingId === item.id ? <LoadingSpinner className="size-4" /> : <Trash2 className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function ChannelGroupHeader({ theme, unread }: { theme: ChannelTheme; unread: number }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-0.5">
      <NotificationChannelIcon channelId={theme.id} size="sm" />
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/85 dark:text-white/80">
        {theme.label}
      </span>
      {unread > 0 ? (
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums backdrop-blur-sm">
          {unread}
        </span>
      ) : null}
    </div>
  );
}

export function NotificationInboxList({
  items,
  groupByChannel,
  getLink,
  onLinkClick,
  onMarkRead,
  onDelete,
  markingRead,
  deletingId,
}: {
  items: InboxNotificationItem[];
  groupByChannel?: boolean;
  getLink: (item: InboxNotificationItem) => string;
  onLinkClick: (e: React.MouseEvent, item: InboxNotificationItem) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  markingRead: string | null;
  deletingId: string | null;
}) {
  const groups = groupByChannel ? groupItems(items) : null;

  const renderItem = (item: InboxNotificationItem, theme: ChannelTheme) => (
    <NotificationBubble
      key={item.id}
      item={item}
      theme={theme}
      href={getLink(item)}
      onLinkClick={onLinkClick}
      actionBar={
        <NotificationActions
          item={item}
          onLinkClick={onLinkClick}
          onMarkRead={onMarkRead}
          onDelete={onDelete}
          markingRead={markingRead}
          deletingId={deletingId}
        />
      }
    />
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl p-3 sm:p-5',
        'bg-linear-to-b from-indigo-600 via-violet-700 to-slate-900',
        'dark:from-indigo-950 dark:via-violet-950 dark:to-black',
        'sm:from-indigo-200/90 sm:via-violet-100/80 sm:to-slate-200/90',
        'sm:dark:from-indigo-950 sm:dark:via-violet-950 sm:dark:to-slate-950',
      )}
    >
      <div
        className="pointer-events-none absolute -left-20 -top-24 size-64 rounded-full bg-cyan-400/30 blur-3xl dark:bg-cyan-500/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 size-72 rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-600/12"
        aria-hidden
      />
      <div className="relative">
        <LockScreenClock />
        {groups ? (
          <div className="space-y-5">
            {groups.map((group) => {
              const unread = group.items.filter((i) => !i.read_at).length;
              return (
                <section key={group.channelId}>
                  <ChannelGroupHeader theme={group.theme} unread={unread} />
                  <div className="space-y-2.5">{group.items.map((item) => renderItem(item, group.theme))}</div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) =>
              renderItem(item, getThemeForEventTypeDetailed(item.event_type)),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
