'use client';

import { InfoHintDialog } from '@/components/market/info-hint-dialog';
import { cn } from '@/lib/utils';

export function DdInfoHint({
  label,
  title,
  children,
  className,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <InfoHintDialog
      label={label}
      title={title ?? label}
      className={className}
      buttonClassName="size-7"
    >
      {children}
    </InfoHintDialog>
  );
}

export function DdLabelWithHint({
  htmlFor,
  label,
  hintTitle,
  hint,
  className,
}: {
  htmlFor?: string;
  label: string;
  hintTitle?: string;
  hint: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <label htmlFor={htmlFor} className="min-w-0 text-xs leading-snug">
        {label}
      </label>
      <DdInfoHint label={`${label} hakkında`} title={hintTitle ?? label}>
        {hint}
      </DdInfoHint>
    </span>
  );
}
