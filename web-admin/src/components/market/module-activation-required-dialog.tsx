'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';
import { cn } from '@/lib/utils';
import type { ModuleActivationRequiredDetail } from '@/lib/module-activation-events';
import { ArrowRight, Lock, Sparkles } from 'lucide-react';

function labelModule(key: string): string {
  return key in SCHOOL_MODULE_LABELS ? SCHOOL_MODULE_LABELS[key as SchoolModuleKey] : key;
}

function marketHref(detail: ModuleActivationRequiredDetail | null): string {
  const d = detail?.details;
  if (!d) return '/market';
  const mod = d.module as string | undefined;
  const mods = d.modules as string[] | undefined;
  const first = mod ?? (Array.isArray(mods) && mods.length ? mods[0] : undefined);
  if (first) return `/market?module=${encodeURIComponent(first)}`;
  return '/market';
}

export function ModuleActivationRequiredDialog({
  open,
  onOpenChange,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: ModuleActivationRequiredDetail | null;
}) {
  const subtitle = useMemo(() => {
    if (!detail?.details) return null;
    const d = detail.details;
    const mod = d.module as string | undefined;
    if (mod) return labelModule(mod);
    const mods = d.modules as string[] | undefined;
    if (Array.isArray(mods) && mods.length) {
      return mods.map(labelModule).join(', ');
    }
    return null;
  }, [detail]);

  const hint = detail?.details?.activate_hint as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Modül etkinleştirme gerekli"
        className="max-w-md overflow-hidden border-amber-500/25 bg-card p-0 shadow-2xl ring-2 ring-amber-500/20"
      >
        <div className="relative space-y-4 px-6 pb-2 pt-2">
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 -top-px h-24 bg-linear-to-b from-amber-500/15 via-violet-500/8 to-transparent',
            )}
          />
          <div className="relative flex gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-amber-500/25 to-violet-500/20 text-amber-900 shadow-inner ring-1 ring-amber-500/30 dark:from-amber-400/20 dark:to-violet-500/15 dark:text-amber-100">
              <Lock className="size-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                <Sparkles className="size-3.5" aria-hidden />
                Market
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {detail?.message ??
                  'Bu özelliği kullanmak için modülü Market sayfasından aylık veya yıllık tarifeye göre etkinleştirmeniz gerekir.'}
              </p>
              {subtitle ? (
                <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                  {subtitle}
                </p>
              ) : null}
              {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border/60 bg-muted/20 px-6 py-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
          <Button asChild className="gap-2 bg-linear-to-r from-amber-600 to-violet-600 text-white shadow-md hover:from-amber-600/95 hover:to-violet-600/95">
            <Link href={marketHref(detail)} onClick={() => onOpenChange(false)}>
              Market’e git — etkinleştir
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
