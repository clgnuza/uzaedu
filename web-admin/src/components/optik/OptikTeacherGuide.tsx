'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  BarChart3,
  ClipboardList,
  Info,
  KeyRound,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';

const OTURUM_STEPS: Array<{
  n: 1 | 2 | 3 | 4;
  short: string;
  desc: string;
  icon: LucideIcon;
}> = [
  { n: 1, short: 'Oturum', desc: 'Sınıf, ders, form şablonu', icon: ClipboardList },
  { n: 2, short: 'Anahtar', desc: 'MC şık + açık rubrik', icon: KeyRound },
  { n: 3, short: 'Tara', desc: 'Öğrenci kağıdı', icon: ScanLine },
  { n: 4, short: 'Sonuç', desc: 'Net, matris, export', icon: BarChart3 },
];

export function OptikTeacherGuide({
  activeStep,
}: {
  activeStep?: 1 | 2 | 3 | 4;
}) {
  return (
    <div
      className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-2 py-2"
      title="Sınav akışı: oturum → anahtar → tara → sonuç"
    >
      <div className="mb-1.5 flex items-center gap-1 text-[10px] font-medium text-violet-800/90 dark:text-violet-200">
        <Info className="size-3 shrink-0" />
        <span className="truncate">Akış</span>
      </div>
      <ol className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {OTURUM_STEPS.map((s) => {
          const on = activeStep === s.n;
          const done = activeStep != null && activeStep > s.n;
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              title={`${s.n}. ${s.short} — ${s.desc}`}
              className={cn(
                'flex min-w-[3.75rem] shrink-0 flex-col items-center gap-0.5 rounded-lg px-1.5 py-1.5',
                on && 'bg-violet-600 text-white shadow-sm',
                !on && done && 'text-muted-foreground',
                !on && !done && 'bg-muted/50 text-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-lg',
                  on ? 'bg-white/20' : 'bg-background/80',
                )}
              >
                <Icon className="size-3.5" strokeWidth={2.2} />
              </span>
              <span className="text-[9px] font-semibold leading-none">{s.short}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function OptikFreeScanNotice() {
  return (
    <Link
      href="/optik-oturumlar"
      title="Sınav için oturum açın: anahtar, sınıf neti, matris"
      className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-2.5 py-2 transition-colors hover:bg-amber-500/12"
    >
      <ClipboardList className="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-amber-950 dark:text-amber-100">
        Sınav → oturumlar
      </span>
      <span className="text-[10px] text-muted-foreground">önerilen</span>
    </Link>
  );
}

export function OptikFormsNotice() {
  return (
    <Link
      href="/optik-oturumlar"
      title="PDF indir → oturum → anahtar → tara"
      className="flex items-center gap-2 rounded-xl border bg-muted/40 px-2.5 py-2 text-[11px] hover:bg-muted/60"
    >
      <ScanLine className="size-4 shrink-0 text-primary" />
      <span className="truncate text-muted-foreground">PDF → oturum → tara</span>
    </Link>
  );
}
