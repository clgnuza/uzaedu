'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Focus, Lightbulb, Pencil, ScanLine } from 'lucide-react';

const TIPS = [
  { icon: Focus, title: 'omr-v4 PDF — dört köşe kare + sol şerit' },
  { icon: Lightbulb, title: 'Düz ışık, gölgesiz; bulanık kare reddedilir' },
  { icon: Pencil, title: 'Yuvarlak balonu koyu ve tam doldurun' },
  { icon: ScanLine, title: 'Tara → ön izleme → belirsiz şıkları seç → kaydet' },
] as const;

export function OptikScanTips() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-cyan-500/25 bg-cyan-500/5">
      <button
        type="button"
        title="Tarama ipuçları"
        className="flex w-full items-center gap-2 px-2.5 py-2"
        onClick={() => setOpen((o) => !o)}
      >
        <Lightbulb className="size-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-left text-[11px] font-semibold">İpuçları</span>
        <div className="flex gap-1">
          {TIPS.map((t) => (
            <t.icon key={t.title} className="size-3.5 text-muted-foreground/80" aria-hidden />
          ))}
        </div>
        <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul className="grid grid-cols-2 gap-1.5 border-t border-cyan-500/10 px-2 pb-2 pt-1.5 md:grid-cols-4">
          {TIPS.map((t) => (
            <li
              key={t.title}
              title={t.title}
              className="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1.5"
            >
              <t.icon className="size-3.5 shrink-0 text-cyan-600" />
              <span className="line-clamp-2 text-[9px] leading-tight text-muted-foreground md:sr-only">
                {t.title}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
