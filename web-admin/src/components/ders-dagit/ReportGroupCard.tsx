'use client';

import Link from 'next/link';
import type { ReportGroupDef, ReportItemDef } from '@/lib/ders-dagit-reports-catalog';
import { DdCard, CardContent, CardHeader, CardTitle, DD_CARD_CONTENT, DD_CARD_HEADER } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download, ExternalLink, Eye, Lock, Printer } from 'lucide-react';

export type ReportItemHandler = (item: ReportItemDef) => void;

export function ReportGroupCard({
  group,
  disabled,
  onAction,
}: {
  group: ReportGroupDef;
  disabled?: boolean;
  onAction: ReportItemHandler;
}) {
  return (
    <DdCard variant="indigo">
      <CardHeader className={DD_CARD_HEADER}>
        <CardTitle className="text-base">{group.title}</CardTitle>
        <p className="text-xs font-normal text-muted-foreground">{group.description}</p>
      </CardHeader>
      <CardContent className={`${DD_CARD_CONTENT} space-y-2`}>
        {group.items.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{item.title}</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    item.status === 'soon'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
                  )}
                >
                  {item.status === 'soon' ? 'Yakında' : 'Hazır'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {item.status === 'soon' ? (
                <Button type="button" size="sm" variant="outline" disabled>
                  <Lock className="mr-1 size-3.5" />
                  Yakında
                </Button>
              ) : item.kind === 'link' && item.href ? (
                <Button type="button" size="sm" variant="secondary" asChild disabled={disabled}>
                  <Link href={disabled ? '#' : item.href}>
                    <ExternalLink className="mr-1 size-3.5" />
                    Aç
                  </Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onAction(item)}
                >
                  {item.kind === 'download' || item.kind === 'parent-zip' || item.kind === 'parent-pdf' ? (
                    <Download className="mr-1 size-3.5" />
                  ) : item.kind === 'print-cover' || item.kind === 'print-approval' ? (
                    <Eye className="mr-1 size-3.5" />
                  ) : item.kind === 'program-print' ? (
                    <Printer className="mr-1 size-3.5" />
                  ) : (
                    <ExternalLink className="mr-1 size-3.5" />
                  )}
                  {actionLabel(item)}
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </DdCard>
  );
}

function actionLabel(item: ReportItemDef): string {
  switch (item.kind) {
    case 'download':
      return 'İndir';
    case 'print-cover':
    case 'print-approval':
      return 'Önizle / Yazdır';
    case 'program-print':
      return 'Yazdır (editör)';
    case 'parent-pdf':
      return 'PDF indir';
    case 'parent-zip':
      return 'ZIP indir';
    default:
      return 'Çalıştır';
  }
}
