'use client';

import Link from 'next/link';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DD_CARD_HEADER,
  DD_CARD_CONTENT,
} from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { sortValidationIssues } from '@/lib/class-section-sort';

export function StudioIssueCards({
  issues,
  title = 'Doğrulama',
  max = 20,
  onRefresh,
}: {
  issues: ValidationIssue[];
  title?: string;
  max?: number;
  onRefresh?: () => void;
}) {
  const sorted = sortValidationIssues(issues);
  const errors = sorted.filter((i) => i.severity === 'error').slice(0, max);
  const warns = sorted.filter((i) => i.severity !== 'error').slice(0, Math.max(0, max - errors.length));

  if (!errors.length && !warns.length) {
    return (
      <DdCard variant="mint">
        <CardContent className="py-4 text-sm text-emerald-700 sm:py-6 dark:text-emerald-300">
          Hata yok — üretime ve yayına hazırsınız.
        </CardContent>
      </DdCard>
    );
  }

  return (
    <DdCard variant="rose">
      <CardHeader className={`${DD_CARD_HEADER} flex flex-row items-center justify-between`}>
        <CardTitle className="text-base">{title}</CardTitle>
        {onRefresh && (
          <Button type="button" size="sm" variant="ghost" onClick={onRefresh}>
            Yenile
          </Button>
        )}
      </CardHeader>
      <CardContent className={`${DD_CARD_CONTENT} space-y-2`}>
        {errors.map((v, i) => (
          <div key={`e-${i}`} className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <p className="font-medium text-destructive">{v.message}</p>
            {v.fix_hint && (
              <p className="mt-1 text-xs text-muted-foreground">
                {v.href ? (
                  <Link href={v.href} className="text-primary underline">
                    {v.fix_hint}
                  </Link>
                ) : (
                  v.fix_hint
                )}
              </p>
            )}
          </div>
        ))}
        {warns.map((v, i) => (
          <div
            key={`w-${i}`}
            className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-3 py-2 text-sm dark:bg-amber-950/20"
          >
            <p className="text-amber-900 dark:text-amber-100">{v.message}</p>
          </div>
        ))}
      </CardContent>
    </DdCard>
  );
}
