'use client';

import { Alert } from '@/components/ui/alert';
import { ChevronDown, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SMART_BOARD_TEACHER_USAGE_STEPS,
  SMART_BOARD_TEACHER_WARNINGS,
} from '@/lib/smart-board-teacher-usage';

export function TeacherSmartBoardUsageCard({ authorized }: { authorized: boolean }) {
  if (!authorized) {
    return (
      <Alert variant="warning" className="mb-2 sm:mb-3">
        <p className="text-sm font-medium">Tahta yetkisi yok</p>
        <p className="mt-1 text-xs text-muted-foreground">
          QR onayı için okul idarenizden Akıllı Tahta yetkisi isteyin.
        </p>
      </Alert>
    );
  }

  return (
    <details className="group mb-2 rounded-xl border border-border/60 bg-muted/20 sm:mb-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Info className="size-4 text-sky-600" />
          Nasıl kullanılır?
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2">
        <ol className="list-decimal space-y-1 pl-4 text-xs leading-snug text-muted-foreground">
          {SMART_BOARD_TEACHER_USAGE_STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="rounded-lg border border-amber-200/50 bg-amber-500/8 px-2.5 py-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-900 dark:text-amber-100">
            <TriangleAlert className="size-3 shrink-0" />
            Dikkat
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground">
            {SMART_BOARD_TEACHER_WARNINGS.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
