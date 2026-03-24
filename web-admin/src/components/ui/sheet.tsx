'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error('Sheet components must be used within Sheet');
  return ctx;
}

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  return (
    <SheetContext.Provider value={{ open, onOpenChange }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  children,
  asChild,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { onOpenChange } = useSheet();
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }
  return (
    <button
      type="button"
      className={cn(className)}
      onClick={() => onOpenChange(true)}
      {...props}
    >
      {children}
    </button>
  );
}

interface SheetContentProps {
  side?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

export function SheetContent({ side = 'left', className, children }: SheetContentProps) {
  const { open, onOpenChange } = useSheet();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

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

  if (!mounted || typeof document === 'undefined') return null;

  const content = (
    <>
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed inset-y-0 z-50 flex w-full max-w-[280px] flex-col bg-background shadow-lg transition-transform duration-300 ease-in-out',
          side === 'left' && 'left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
          side === 'right' && 'right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          !open && (side === 'left' ? '-translate-x-full' : 'translate-x-full'),
          open && 'translate-x-0',
          className,
        )}
        data-state={open ? 'open' : 'closed'}
      >
        {children}
      </div>
    </>
  );

  return createPortal(content, document.body);
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center border-b px-4 py-3', className)} {...props} />;
}

export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex-1 overflow-y-auto p-4', className)} {...props} />;
}

export function SheetClose({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { onOpenChange } = useSheet();
  return (
    <button
      type="button"
      className={cn('rounded-md p-1 hover:bg-muted', className)}
      onClick={() => onOpenChange(false)}
      {...props}
    >
      <X className="size-5" />
    </button>
  );
}
