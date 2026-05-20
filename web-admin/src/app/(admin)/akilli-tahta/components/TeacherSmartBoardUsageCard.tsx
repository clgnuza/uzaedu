'use client';

import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, TriangleAlert } from 'lucide-react';
import {
  SMART_BOARD_TEACHER_USAGE_STEPS,
  SMART_BOARD_TEACHER_WARNINGS,
} from '@/lib/smart-board-teacher-usage';

export function TeacherSmartBoardUsageCard({ authorized }: { authorized: boolean }) {
  if (!authorized) {
    return (
      <Alert variant="warning" className="mb-3 sm:mb-4">
        <p className="text-sm font-medium">Tahta yetkisi yok</p>
        <p className="mt-1 text-xs text-muted-foreground">
          QR onayı ve oturum için okul idarenizden Akıllı Tahta yetkisi isteyin. Otomatik yetki açıksa kısa süre sonra
          yenileyin.
        </p>
      </Alert>
    );
  }

  return (
    <Card className="mb-3 border-sky-200/50 bg-sky-500/5 dark:border-sky-900/40 sm:mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Info className="size-4 text-sky-600" />
          Nasıl kullanılır?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground sm:text-sm">
          {SMART_BOARD_TEACHER_USAGE_STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="rounded-lg border border-amber-200/60 bg-amber-500/8 px-3 py-2 dark:border-amber-900/50">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-100 sm:text-xs">
            <TriangleAlert className="size-3.5 shrink-0" />
            Dikkat
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground sm:text-xs">
            {SMART_BOARD_TEACHER_WARNINGS.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
