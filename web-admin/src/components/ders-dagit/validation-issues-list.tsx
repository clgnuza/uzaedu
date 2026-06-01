'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { formatValidationIssueDetail } from '@/lib/ders-dagit-validation-display';
import { sortValidationIssues } from '@/lib/class-section-sort';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type Filter = 'all' | 'error' | 'warning';

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const d = formatValidationIssueDetail(issue);
  return (
    <li
      className={cn(
        'rounded-md px-2 py-1.5 text-xs',
        issue.severity === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-amber-500/10 text-amber-900 dark:text-amber-100',
      )}
    >
      <p>{d.text}</p>
      {d.hint ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {d.href ? (
            <Link href={d.href} className="text-primary underline">
              {d.hint}
            </Link>
          ) : (
            d.hint
          )}
        </p>
      ) : null}
    </li>
  );
}

export function ValidationIssuesList({
  issues,
  className,
  compact,
}: {
  issues: ValidationIssue[];
  className?: string;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [grouped, setGrouped] = useState(!compact);

  const sorted = useMemo(() => sortValidationIssues(issues), [issues]);

  const filtered = useMemo(() => {
    if (filter === 'error') return sorted.filter((i) => i.severity === 'error');
    if (filter === 'warning') return sorted.filter((i) => i.severity !== 'error');
    return sorted;
  }, [sorted, filter]);

  const byCode = useMemo(() => {
    const map = new Map<string, ValidationIssue[]>();
    for (const i of filtered) {
      const arr = map.get(i.code) ?? [];
      arr.push(i);
      map.set(i.code, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const errN = sorted.filter((i) => i.severity === 'error').length;
  const warnN = sorted.length - errN;

  if (!sorted.length) {
    return <p className="text-sm text-muted-foreground">Kayıt yok.</p>;
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border p-0.5 text-xs">
          {(
            [
              ['all', `Tümü (${sorted.length})`],
              ['error', `Hata (${errN})`],
              ['warning', `Uyarı (${warnN})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors',
                filter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {filtered.length > 8 ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setGrouped((g) => !g)}>
            {grouped ? 'Satır satır' : 'Türe göre grupla'}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border bg-muted/20 p-2',
          compact ? 'max-h-52' : 'max-h-[min(70vh,720px)]',
        )}
      >
        {grouped && byCode.length > 1 ? (
          <ul className="space-y-3">
            {byCode.map(([code, list]) => (
              <li key={code}>
                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
                  {list[0]?.severity === 'error' ? 'Hata' : 'Uyarı'} · {list.length} kayıt
                </p>
                <ul className="space-y-1">
                  {list.map((issue, i) => (
                    <IssueRow key={`${code}-${i}`} issue={issue} />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-1">
            {filtered.map((issue, i) => (
              <IssueRow key={`${issue.code}-${i}-${issue.message.slice(0, 24)}`} issue={issue} />
            ))}
          </ul>
        )}
        {!filtered.length ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Bu filtrede kayıt yok.</p>
        ) : null}
      </div>
    </div>
  );
}
