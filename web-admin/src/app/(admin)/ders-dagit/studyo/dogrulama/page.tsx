'use client';

import Link from 'next/link';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { StudioIssueCards } from '@/components/ders-dagit/StudioIssueCards';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import { Button } from '@/components/ui/button';
import { DdCard, CardContent, CardHeader, CardTitle, DD_PAGE, DD_GRID, DD_CARD_HEADER, DD_CARD_CONTENT, ddVariantAt } from '@/components/ders-dagit/dd-ui';

export default function DogrulamaPage() {
  const { studio, overview } = useDersDagitStudio();
  const { issues, refresh, canProceed } = useStudioValidation(studio?.id);
  const r = computeStudioReadiness(overview);

  return (
    <div className="space-y-4">
      <DdCard>
        <CardHeader>
          <CardTitle className="text-base">Kontrol listesi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void refresh({ force: true })}>
            Yenile
          </Button>
          <Button type="button" size="sm" disabled={!canProceed} asChild>
            <Link href="/ders-dagit/studyo/uret">Program oluştur</Link>
          </Button>
          {!canProceed && r.blockReason && (
            <p className="w-full text-sm text-destructive">{r.blockReason}</p>
          )}
        </CardContent>
      </DdCard>
      <StudioIssueCards issues={issues} onRefresh={() => void refresh({ force: true })} />
    </div>
  );
}
