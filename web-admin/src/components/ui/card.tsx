import * as React from 'react';
import { cn } from '@/lib/utils';

export type CardPastelVariant =
  | 'mint'
  | 'lavender'
  | 'peach'
  | 'sky'
  | 'rose'
  | 'amber'
  | 'teal'
  | 'indigo'
  | 'violet'
  | 'default';

const PASTEL_VARIANT_CLASSES: Record<CardPastelVariant, string> = {
  mint: 'card-pastel-mint',
  lavender: 'card-pastel-lavender',
  peach: 'card-pastel-peach',
  sky: 'card-pastel-sky',
  rose: 'card-pastel-rose',
  amber: 'card-pastel-amber',
  teal: 'card-pastel-teal',
  indigo: 'card-pastel-indigo',
  violet: 'card-pastel-violet',
  default: '',
};

const PASTEL_SOFT_CLASSES: Record<Exclude<CardPastelVariant, 'default'>, string> = {
  mint: 'card-pastel-soft-mint',
  lavender: 'card-pastel-soft-lavender',
  peach: 'card-pastel-soft-peach',
  sky: 'card-pastel-soft-sky',
  rose: 'card-pastel-soft-rose',
  amber: 'card-pastel-soft-amber',
  teal: 'card-pastel-soft-teal',
  indigo: 'card-pastel-soft-indigo',
  violet: 'card-pastel-soft-violet',
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Pastel varyant – göz yormayan, ayırt edilebilir kutucuk rengi */
  variant?: CardPastelVariant;
  /** Yumuşak arka plan (kalın sol çizgi yok) */
  soft?: boolean;
}

/** Metronic kt-card benzeri kart: rounded-xl, border, shadow. Pastel varyantlarla göz yormayan tasarım. */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', soft, ...props }, ref) => {
    const pastelClass =
      variant === 'default'
        ? ''
        : soft
          ? PASTEL_SOFT_CLASSES[variant]
          : PASTEL_VARIANT_CLASSES[variant];
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md',
          pastelClass,
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1.5 p-5 pb-2', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref as React.Ref<HTMLParagraphElement>}
    className={cn('text-sm font-semibold leading-none text-foreground', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-5 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
