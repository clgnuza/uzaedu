'use client';

import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { DdInfoHint } from '@/components/ders-dagit/dd-info-hint';
import { StudioSettingsLinks } from '@/components/ders-dagit/studio-settings-links';
import { SlidersHorizontal } from 'lucide-react';

export default function StudioAyarlarPage() {
  return (
    <div className={DD_PAGE}>
      <div className="flex items-start gap-2">
        <DdPageHeader
          icon={SlidersHorizontal}
          title="Ayarlar"
          description="Kurulum, veri ve program adımlarına kısayollar."
          className="flex-1"
        />
        <DdInfoHint label="Ayarlar sayfası" title="Program merkezi ayarları">
          <p>Modül sayfalarına buradan hızlı geçiş yapılır. Öğretmen müsaitlik onayı Tercihler sayfasındadır.</p>
        </DdInfoHint>
      </div>

      <StudioSettingsLinks />
    </div>
  );
}
