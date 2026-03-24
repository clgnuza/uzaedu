import type { ComponentProps } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Giriş / kayıt / şifre unuttum kartları için ortak yüzey — dark modda ring biraz güçlü. */
export const AUTH_CARD_CLASS =
  'overflow-hidden rounded-2xl border-0 bg-linear-to-b from-card via-card to-muted/25 shadow-[0_22px_48px_-14px_rgba(15,23,42,0.14)] ring-1 ring-border/50 backdrop-blur-sm transition-[box-shadow,ring-color] duration-300 hover:shadow-[0_26px_56px_-14px_rgba(15,23,42,0.18)] hover:ring-border/60 dark:from-card dark:via-card dark:to-muted/90 dark:shadow-none dark:ring-border/50 dark:hover:shadow-[0_22px_48px_-14px_rgba(0,0,0,0.35)] dark:hover:ring-primary/25';

export function AuthCardAccent() {
  return (
    <div
      className="h-[3px] w-full bg-linear-to-r from-primary/15 via-primary/50 to-primary/15 dark:from-primary/25 dark:via-primary/45 dark:to-primary/25"
      aria-hidden
    />
  );
}

type AuthCardProps = ComponentProps<typeof Card>;

export function AuthCard({ className, children, ...props }: AuthCardProps) {
  return (
    <Card className={cn(AUTH_CARD_CLASS, className)} {...props}>
      <AuthCardAccent />
      {children}
    </Card>
  );
}
