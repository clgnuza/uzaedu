'use client';

import { cn } from '@/lib/utils';
import { getChannelTheme, getThemeForEventTypeDetailed, type NotificationChannelId } from '@/lib/notification-channel-theme';

type Size = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<Size, { box: string; icon: string }> = {
  sm: { box: 'size-8 rounded-lg sm:size-9 sm:rounded-xl', icon: 'size-[0.9375rem] sm:size-4' },
  md: { box: 'size-10 rounded-xl', icon: 'size-5' },
  lg: { box: 'size-12 rounded-2xl', icon: 'size-6' },
  xl: { box: 'size-14 rounded-2xl', icon: 'size-7' },
};

type Props = {
  channelId?: NotificationChannelId | string;
  eventType?: string;
  size?: Size;
  className?: string;
};

export function NotificationChannelIcon({ channelId, eventType, size = 'sm', className }: Props) {
  const theme = eventType
    ? getThemeForEventTypeDetailed(eventType)
    : getChannelTheme(channelId ?? 'genel');
  const Icon = theme.icon;
  const s = SIZE[size];
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center ring-1 sm:ring-2',
        s.box,
        theme.tileClass,
        className,
      )}
      aria-hidden
    >
      <Icon className={s.icon} strokeWidth={2} />
    </div>
  );
}
