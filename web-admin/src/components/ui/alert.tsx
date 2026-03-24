import * as React from 'react';
import { AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = {
  error: 'border-destructive/50 bg-destructive/10 text-destructive [&_svg]:text-destructive',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400',
  info: 'border-primary/30 bg-primary/5 text-foreground [&_svg]:text-primary',
};

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof alertVariants;
  /** Hata/uyarı mesajı; children yerine kısa kullanım */
  message?: string;
  /** İkon gösterme (varsayılan true) */
  showIcon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'error', message, showIcon = true, children, ...props }, ref) => {
    const Icon = variant === 'error' ? AlertCircle : variant === 'warning' ? AlertTriangle : Info;
    const content = message ?? children;
    return (
      <div
        ref={ref}
        role="alert"
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={cn(
          'rounded-lg border px-4 py-3 text-sm',
          alertVariants[variant],
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3">
          {showIcon && <Icon className="size-5 shrink-0 mt-0.5" aria-hidden />}
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';

export { Alert, alertVariants };
