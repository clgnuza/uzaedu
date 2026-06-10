'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used within Dialog');
  return ctx;
}

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { onOpenChange } = useDialog();
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }
  return (
    <button type="button" className={cn(className)} onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  );
}

export function DialogContent({
  title,
  descriptionId,
  scrollBody = true,
  priority = false,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  title?: string;
  descriptionId?: string;
  /** false: children kendi flex/scroll düzenini yönetir (sabit bilgi kartı + footer için) */
  scrollBody?: boolean;
  /** Toast / onboarding üstünde (bildirim izni vb.) */
  priority?: boolean;
}) {
  const { open, onOpenChange } = useDialog();
  const [mounted, setMounted] = React.useState(false);
  const blockBackdropClose = React.useRef(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    blockBackdropClose.current = true;
    const t = window.setTimeout(() => {
      blockBackdropClose.current = false;
    }, 250);
    return () => window.clearTimeout(t);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('keydown', onEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onEscape);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!mounted || typeof document === 'undefined' || !open) return null;

  const zOverlay = priority ? 10050 : 100;
  const zPanel = priority ? 10051 : 101;

  const content = (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-all duration-200 print:hidden"
        style={{ zIndex: zOverlay }}
        onClick={() => {
          if (!blockBackdropClose.current) onOpenChange(false);
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 flex items-center justify-center p-3 sm:p-4 print:static print:block print:p-0"
        style={{ zIndex: zPanel }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'dialog-title' : undefined}
          aria-describedby={descriptionId}
          className={cn(
            'pointer-events-auto flex max-h-[min(92dvh,calc(100dvh-1.5rem))] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-2xl ring-1 ring-black/5 dark:ring-white/10 sm:max-h-[min(90vh,calc(100dvh-2rem))] sm:rounded-2xl print:static print:max-h-none print:min-h-0 print:w-full print:max-w-none print:overflow-visible print:shadow-none print:ring-0',
            className,
          )}
          {...props}
        >
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-muted/15 px-4 py-2.5 sm:gap-3 sm:px-5 sm:py-3.5">
            <h2 id="dialog-title" className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {title}
            </h2>
            <button
              type="button"
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground sm:p-1"
              onClick={() => onOpenChange(false)}
              aria-label="Kapat"
            >
              <X className="size-4 sm:size-5" />
            </button>
          </div>
        )}
        {scrollBody ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 print:overflow-visible">
            {children}
          </div>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col print:overflow-visible">{children}</div>
        )}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}

export function DialogHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex shrink-0 flex-col gap-2 border-b border-border pb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 id="dialog-title" className={cn('text-lg font-semibold text-foreground', className)} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p id="dialog-description" className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}

export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex justify-end gap-2 pt-4', className)} {...props}>
      {children}
    </div>
  );
}
