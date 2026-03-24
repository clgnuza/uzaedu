'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AboutRow {
  label: string;
  value: React.ReactNode;
}

interface AboutCardProps {
  rows: AboutRow[];
  className?: string;
  title?: string;
  description?: string;
}

export function AboutCard({ rows, className, title = 'Hakkında', description }: AboutCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border/60">
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid gap-1 py-3.5 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,10rem)_1fr] sm:items-baseline sm:gap-6"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 break-words text-sm font-medium text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
