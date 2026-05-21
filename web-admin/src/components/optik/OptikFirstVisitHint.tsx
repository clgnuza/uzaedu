'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { OptikTeacherGuide } from '@/components/optik/OptikTeacherGuide';

const STORAGE_KEY = 'optik_teacher_hint_v1';

/** İlk ziyaret: kompakt akış şeridi; metin yok */
export function OptikFirstVisitHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="relative rounded-xl border border-cyan-500/20 bg-cyan-500/6 py-1.5 pl-2 pr-8">
      <OptikTeacherGuide />
      <button
        type="button"
        className="absolute right-1 top-1 rounded-md p-1 text-muted-foreground hover:bg-muted"
        onClick={dismiss}
        aria-label="Kapat"
        title="Anladım"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
