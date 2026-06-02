'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { UnplacedRow } from './TimetableUnplacedTray';

function Item({
  children,
  onClick,
  disabled,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'block w-full px-3 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function TimetableUnplacedMenu({
  row,
  x,
  y,
  onClose,
  onSelectForPlacement,
  onFocusClass,
  onFocusTeacher,
  onAutoPlace,
  onOpenAssignments,
  onCopyInfo,
}: {
  row: UnplacedRow;
  x: number;
  y: number;
  onClose: () => void;
  onSelectForPlacement: () => void;
  onFocusClass: () => void;
  onFocusTeacher: () => void;
  onAutoPlace: () => void;
  onOpenAssignments: () => void;
  onCopyInfo: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
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
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[60] min-w-[168px] rounded-md border border-border bg-popover py-1 text-xs shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      role="menu"
    >
      <Item onClick={onSelectForPlacement}>Yerleştirme için seç</Item>
      <div className="my-1 border-t border-border" role="separator" />
      <Item onClick={onFocusClass}>Sınıf programını göster</Item>
      <Item onClick={onFocusTeacher} disabled={!row.user_id}>
        Öğretmen programını göster
      </Item>
      <div className="my-1 border-t border-border" role="separator" />
      <Item onClick={onAutoPlace}>İlk uygun saate yerleştir</Item>
      <Item onClick={onOpenAssignments}>Atamalar sayfasında aç</Item>
      <div className="my-1 border-t border-border" role="separator" />
      <Item onClick={onCopyInfo}>Bilgiyi kopyala</Item>
    </div>
  );
}
