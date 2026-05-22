'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { Button } from '@/components/ui/button';

export function StudioValidationGate({
  overview,
  action,
  children,
}: {
  overview: StudioOverview | null;
  action: 'generate' | 'publish';
  children: React.ReactNode;
}) {
  const r = computeStudioReadiness(overview);
  const ok = action === 'generate' ? r.canGenerate : r.canPublish;

  if (ok) return <>{children}</>;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-sm dark:bg-amber-950/30">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {action === 'generate' ? 'Üretim kilitli' : 'Yayın kilitli'}
          </p>
          <p className="text-xs text-muted-foreground">{r.blockReason ?? 'Kurulum tamamlanmadı'}</p>
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/stüdyo/dogrulama">Doğrulamayı düzelt</Link>
      </Button>
      <div className="pointer-events-none opacity-50">{children}</div>
    </div>
  );
}
