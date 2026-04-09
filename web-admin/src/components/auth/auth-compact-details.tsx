import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AuthCompactDetailsProps = {
  icon?: ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
};

/** Mobil auth sayfalarında uzun uyarı/bilgiyi tek satır özet + genişlet ile gösterir */
export function AuthCompactDetails({ icon, title, children, className }: AuthCompactDetailsProps) {
  return (
    <details
      className={cn(
        'group rounded-xl border border-border/60 bg-muted/15 text-left dark:bg-muted/10',
        className,
      )}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground',
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background/80 text-foreground/80 shadow-sm">
          {icon}
        </span>
        <span className="min-w-0 flex-1 leading-snug">{title}</span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground/80 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border/40 px-2.5 pb-2.5 pt-0 text-[10px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}
