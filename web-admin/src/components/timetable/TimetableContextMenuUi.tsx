'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function clampContextMenuPosition(x: number, y: number, w: number, h: number) {
  return {
    x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w)),
    y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h)),
  };
}

export function useContextMenuDismiss(onClose: () => void, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const t = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown, true);
    }, 0);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, containerRef]);
}

export function MenuItem({
  children,
  onClick,
  destructive,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted disabled:opacity-40',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
      onClick={onClick}
    >
      {icon ? <span className="size-3.5 shrink-0 opacity-70">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function MenuSep() {
  return <div className="my-1 h-px bg-border/70" role="separator" />;
}

export function MenuSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function ContextActionBtn({
  icon,
  label,
  hint,
  onClick,
  destructive,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'group mx-1 flex w-[calc(100%-0.5rem)] items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-all',
        'hover:bg-accent/70 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40',
        destructive && 'hover:bg-destructive/10',
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border shadow-sm',
          destructive
            ? 'border-destructive/20 bg-destructive/10 text-destructive'
            : 'border-border/60 bg-background text-primary group-hover:border-primary/30 group-hover:bg-primary/10',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] font-medium leading-snug', destructive && 'text-destructive')}>
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

export function SubMenu({ label, icon, children, wide }: { label: string; icon?: ReactNode; children: ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted">
        {icon ? <span className="size-3.5 shrink-0 opacity-70">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden />
      </button>
      {open ? (
        <div
          className={cn(
            'absolute left-full top-0 z-[210] ml-0.5 max-h-[min(360px,75vh)] overflow-y-auto rounded-md border border-border bg-popover py-1 text-xs shadow-lg',
            wide ? 'min-w-[240px]' : 'min-w-[168px]',
          )}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ContextMenuShell({
  x,
  y,
  widthClass,
  onClose,
  header,
  children,
}: {
  x: number;
  y: number;
  widthClass?: string;
  onClose: () => void;
  header?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    const w = el?.offsetWidth ?? 220;
    const h = el?.offsetHeight ?? 320;
    setPos(clampContextMenuPosition(x, y, w, h));
  }, [x, y, children]);

  useContextMenuDismiss(onClose, ref);

  const panel = (
    <div
      ref={ref}
      className={cn(
        'fixed z-[200] overflow-hidden rounded-xl border border-border/80 bg-popover py-1 text-xs shadow-xl shadow-black/10',
        widthClass ?? 'w-[min(100vw-1rem,280px)]',
      )}
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      {header}
      {children}
    </div>
  );

  if (typeof document === 'undefined') return panel;
  return createPortal(panel, document.body);
}
