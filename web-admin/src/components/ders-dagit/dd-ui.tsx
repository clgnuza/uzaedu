'use client';

import type { HTMLAttributes, ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, type CardPastelVariant, type CardProps } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
export type { CardProps, CardPastelVariant };

export const DD_PAGE = 'space-y-3 sm:space-y-4';
export const DD_GRID = 'grid gap-3 sm:gap-4 md:gap-5';
export const DD_GRID_2 = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
export const DD_CARD_HEADER = 'p-3 pb-1.5 sm:p-5 sm:pb-2';
export const DD_CARD_CONTENT = 'p-3 pt-0 sm:p-5 sm:pt-0';
export const DD_PAGE_TITLE = 'dd-page-title';
export const DD_DIALOG_GLASS = 'dd-dialog-glass';

const VARIANT_CYCLE: CardPastelVariant[] = ['indigo', 'violet', 'teal', 'sky', 'lavender', 'mint'];

export function ddVariantAt(index: number): CardPastelVariant {
  return VARIANT_CYCLE[index % VARIANT_CYCLE.length] ?? 'indigo';
}

export function DdCard({
  variant = 'indigo',
  soft = true,
  glass = true,
  className,
  ...props
}: CardProps & { glass?: boolean }) {
  return (
    <Card
      variant={variant}
      soft={soft}
      className={cn(glass && 'dd-card-glass', className)}
      {...props}
    />
  );
}

export function DdGlassPanel({
  className,
  strong,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn('dd-glass-panel', strong && 'dd-glass-strong', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { DdSelect, DdSelectField, DdMultiSelect, DD_SELECT_TRIGGER } from '@/components/ders-dagit/dd-select';
export type { DdSelectOption, DdSelectProps } from '@/components/ders-dagit/dd-select';

export function DdDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn(DD_DIALOG_GLASS, className)} {...props} />;
}

export function DdAccentButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn('dd-accent-btn', className)} {...props} />;
}

export function DdPageHeader({
  title,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <header className={cn('flex items-start gap-3', className)}>
      {Icon ? (
        <span className="dd-icon-badge shrink-0">
          <Icon className="size-5" strokeWidth={2} />
        </span>
      ) : null}
      <div className="min-w-0 space-y-0.5">
        <h1 className={DD_PAGE_TITLE}>{title}</h1>
        {description ? (
          <p className="text-xs text-muted-foreground sm:text-sm">{description}</p>
        ) : null}
      </div>
    </header>
  );
}
