'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useEffect, useState } from 'react';

type Issue = { code: string; severity: string; message: string };

export default function DogrulamaPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [issues, setIssues] = useState<Issue[]>([]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setIssues(await apiFetch<Issue[]>(`/ders-dagit/studios/${studio.id}/validation`, { token }));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity !== 'error');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Ön doğrulama (Faz 18)</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
          Yenile
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {errors.length === 0 && warns.length === 0 ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Hata yok — üretime geçebilirsiniz.</p>
        ) : (
          <>
            {errors.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive">
                {errors.map((v, i) => (
                  <li key={i}>{v.message}</li>
                ))}
              </ul>
            )}
            {warns.length > 0 && (
              <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                {warns.map((v, i) => (
                  <li key={i}>{v.message}</li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href="/ders-dagit/stüdyo/kurulum">Kurulum</Link>
          </Button>
          <Button type="button" size="sm" variant="secondary" asChild>
            <Link href="/ders-dagit/stüdyo/atamalar">Atamalar</Link>
          </Button>
          <Button type="button" size="sm" asChild disabled={errors.length > 0}>
            <Link href="/ders-dagit/stüdyo/uret">Üret</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
