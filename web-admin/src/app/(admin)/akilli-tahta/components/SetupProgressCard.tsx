'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle2, Circle, Wrench } from 'lucide-react';
import type { SmartBoardSetupStatus } from '../types';
import { cn } from '@/lib/utils';

export function SetupProgressCard({
  schoolId,
  token,
}: {
  schoolId: string;
  token: string | null;
}) {
  const [status, setStatus] = useState<SmartBoardSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !schoolId) return;
    setLoading(true);
    apiFetch<SmartBoardSetupStatus>(`/smart-board/schools/${schoolId}/setup-status`, { token })
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [token, schoolId]);

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex justify-center py-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }
  if (!status) return null;

  const done = status.checklist.filter((c) => c.done).length;
  const total = status.checklist.length;
  const allDone = done === total && total > 0;

  if (allDone) return null;

  return (
    <Card className="border-teal-200/60 bg-teal-500/5">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm">Kurulum ilerlemesi ({done}/{total})</CardTitle>
        <Button variant="default" size="sm" asChild>
          <Link href="/akilli-tahta?tab=kurulum">
            <Wrench className="size-3.5" />
            Sihirbaz
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <p className="font-mono text-xs text-muted-foreground">
          Okul kodu: <strong className="text-foreground">{status.setup_code}</strong>
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {status.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-1.5 text-xs">
              {item.done ? (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={cn(!item.done && 'text-muted-foreground')}>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
