'use client';

import { useEffect } from 'react';
import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';

export function TimetableCellMenu({
  entry,
  x,
  y,
  onClose,
  onLock,
  onDelete,
  onEdit,
}: {
  entry: EditorEntry;
  x: number;
  y: number;
  onClose: () => void;
  onLock: (locked: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover py-1 text-xs shadow-lg"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-muted" onClick={onEdit}>
        Düzenle…
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left hover:bg-muted"
        onClick={() => onLock(!entry.is_locked)}
      >
        {entry.is_locked ? 'Kilidi aç' : 'Kilitle'}
      </button>
      <button
        type="button"
        className="block w-full px-3 py-1.5 text-left text-destructive hover:bg-destructive/10"
        onClick={onDelete}
      >
        Sil
      </button>
    </div>
  );
}
