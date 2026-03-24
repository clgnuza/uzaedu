'use client';

import { cn } from '@/lib/utils';

export function Container({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('container', className)} {...props}>
      {children}
    </div>
  );
}
