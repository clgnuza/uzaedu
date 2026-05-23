'use client';

import { cn } from '@/lib/utils';
import {
  loadReportPrintMode,
  saveReportPrintMode,
  type ReportPrintMode,
} from '@/lib/ders-dagit-report-settings';
import { useEffect, useState } from 'react';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { Palette, Printer } from 'lucide-react';

export function applyDocumentPrintMode(mode: ReportPrintMode) {
  if (typeof document === 'undefined') return;
  document.body.classList.remove('print-bw', 'print-color');
  document.body.classList.add(mode === 'bw' ? 'print-bw' : 'print-color');
}

export function ReportPrintSettings({ className }: { className?: string }) {
  const [mode, setMode] = useState<ReportPrintMode>('color');

  useEffect(() => {
    const m = loadReportPrintMode();
    setMode(m);
    applyDocumentPrintMode(m);
  }, []);

  function select(next: ReportPrintMode) {
    setMode(next);
    saveReportPrintMode(next);
    applyDocumentPrintMode(next);
  }

  return (
    <DdCard variant="sky" className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Printer className="size-4" />
          Yazdırma görünümü
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Program tablosu ve önizleme pencerelerinde renkli veya siyah-beyaz çıktı.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => select('color')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'color' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/60',
            )}
          >
            <Palette className="size-3.5" />
            Renkli
          </button>
          <button
            type="button"
            onClick={() => select('bw')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              mode === 'bw' ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted/60',
            )}
          >
            <Printer className="size-3.5" />
            Siyah-beyaz
          </button>
        </div>
      </CardContent>
    </DdCard>
  );
}
