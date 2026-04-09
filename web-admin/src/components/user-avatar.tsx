'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarPresetSvg, isAvatarPresetId } from '@/lib/avatar-presets';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const wrap: Record<Size, string> = {
  xs: 'size-9',
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-20 sm:size-24',
  xl: 'size-[100px]',
};

const text: Record<Size, string> = {
  xs: 'text-sm',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-2xl sm:text-3xl',
  xl: 'text-3xl',
};

const badgeOuter: Record<Size, string> = {
  xs: 'size-3',
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-6',
  xl: 'size-7',
};

const badgeIcon: Record<Size, string> = {
  xs: 'size-2',
  sm: 'size-2.5',
  md: 'size-2.5',
  lg: 'size-3.5',
  xl: 'size-4',
};

export function UserAvatarBubble({
  avatarKey,
  avatarUrl,
  displayName,
  email,
  size = 'md',
  className,
  verified,
}: {
  avatarKey?: string | null;
  avatarUrl?: string | null;
  displayName: string;
  email?: string | null;
  size?: Size;
  className?: string;
  verified?: boolean;
}) {
  const label = (displayName || email || '?').trim();
  const initial = label.charAt(0).toUpperCase();
  const ariaLabel = verified ? `${label}, okul onaylı` : label;

  const base = cn(
    'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-primary-foreground ring-2 ring-background',
    wrap[size],
    text[size],
    className,
  );

  const face = isAvatarPresetId(avatarKey) ? (
    <span className={cn(base, 'bg-transparent p-0')}>
      <AvatarPresetSvg id={avatarKey} className="size-full" />
    </span>
  ) : avatarUrl?.trim() ? (
    // eslint-disable-next-line @next/next/no-img-element -- harici URL, küçük avatar
    <img src={avatarUrl.trim()} alt="" className={cn(base, 'object-cover')} />
  ) : (
    <span className={base}>{initial}</span>
  );

  if (verified) {
    return (
      <span className="relative inline-flex shrink-0" role="img" aria-label={ariaLabel} title="Okul onaylı">
        <span aria-hidden className="inline-flex">
          {face}
        </span>
        <span
          className={cn(
            'pointer-events-none absolute bottom-0 right-0 z-[2] flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background',
            badgeOuter[size],
          )}
          aria-hidden
        >
          <Check className={cn(badgeIcon[size], 'stroke-[2.75]')} aria-hidden />
        </span>
      </span>
    );
  }

  if (isAvatarPresetId(avatarKey)) {
    return (
      <span role="img" aria-label={ariaLabel} className={cn(base, 'bg-transparent p-0')}>
        <AvatarPresetSvg id={avatarKey} className="size-full" />
      </span>
    );
  }
  if (avatarUrl?.trim()) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl.trim()} alt="" className={cn(base, 'object-cover')} />
    );
  }
  return (
    <span className={base} role="img" aria-label={ariaLabel}>
      {initial}
    </span>
  );
}
