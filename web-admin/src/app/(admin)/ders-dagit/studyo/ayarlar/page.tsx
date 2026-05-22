'use client';

import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { SlidersHorizontal } from 'lucide-react';
import { StudioSettingsPanel } from '@/components/ders-dagit/StudioSettingsPanel';

export default function StudioAyarlarPage() {
  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={SlidersHorizontal}
        title="Ayarlar"
        description="Tüm modül sayfalarına kısayol — kurulum, dönem, atama, kurallar ve program."
      />
      <StudioSettingsPanel />
    </div>
  );
}
