import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sol üstte gösterilecek ikon (Lucide veya custom) */
  icon: React.ReactNode;
  /** Ana mesaj */
  title: string;
  /** İsteğe bağlı alt açıklama */
  description?: string;
  /** İsteğe bağlı aksiyon butonu (örn. "İlk kaydı ekle") */
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-center',
        className,
      )}
      {...props}
    >
      <div className="rounded-2xl bg-gradient-to-br from-muted to-muted/60 p-5 text-muted-foreground shadow-sm [&_svg]:size-10" aria-hidden>
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
