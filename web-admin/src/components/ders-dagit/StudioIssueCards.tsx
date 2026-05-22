'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';

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
  const errors = issues.filter((i) => i.severity === 'error').slice(0, max);
  const warns = issues.filter((i) => i.severity !== 'error').slice(0, Math.max(0, max - errors.length));

  if (!errors.length && !warns.length) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-emerald-700 dark:text-emerald-300">
          Hata yok — üretime ve yayına hazırsınız.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {onRefresh && (
          <Button type="button" size="sm" variant="ghost" onClick={onRefresh}>
            Yenile
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
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
          <div key={`w-${i}`} className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-3 py-2 text-sm dark:bg-amber-950/20">
            <p className="text-amber-900 dark:text-amber-100">{v.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
