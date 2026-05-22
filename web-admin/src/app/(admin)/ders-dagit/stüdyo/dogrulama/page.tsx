'use client';

import Link from 'next/link';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { StudioIssueCards } from '@/components/ders-dagit/StudioIssueCards';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DogrulamaPage() {
  const { studio, overview } = useDersDagitStudio();
  const { issues, refresh, canProceed } = useStudioValidation(studio?.id);
  const r = computeStudioReadiness(overview);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ön doğrulama</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
            Yenile
          </Button>
          <Button type="button" size="sm" disabled={!canProceed} asChild>
            <Link href="/ders-dagit/stüdyo/uret">Üretime geç</Link>
          </Button>
          {!canProceed && r.blockReason && (
            <p className="w-full text-sm text-destructive">{r.blockReason}</p>
          )}
        </CardContent>
      </Card>
      <StudioIssueCards issues={issues} onRefresh={() => void refresh()} />
    </div>
  );
}
