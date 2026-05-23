'use client';

import Link from 'next/link';
import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { StudioTransferPanel } from '@/components/ders-dagit/studio-transfer-panel';
import { ArrowRightLeft } from 'lucide-react';

export default function StudioAktarimPage() {
  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={ArrowRightLeft}
        title="İçe / dışa aktar"
        description="aSc, Bilsa/e-Okul Excel ve ÖğretmenPro yedek — stüdyo verisi."
      />
      <p className="text-xs text-muted-foreground">
        <Link href="/ders-dagit/studyo/ayarlar" className="text-primary underline">
          ← Ayarlar
        </Link>
      </p>
      <StudioTransferPanel />
    </div>
  );
}
