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
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-50/90 to-orange-50/50 px-3 py-2 text-sm dark:from-amber-950/40 dark:to-orange-950/20">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {action === 'generate' ? 'Program oluşturma kilitli' : 'Yayınlama kilitli'}
          </p>
          <p className="text-xs text-muted-foreground">{r.blockReason ?? 'Kurulum tamamlanmadı'}</p>
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href="/ders-dagit/studyo/dogrulama">Doğrulamayı düzelt</Link>
      </Button>
      <div className="pointer-events-none opacity-50">{children}</div>
    </div>
  );
}
