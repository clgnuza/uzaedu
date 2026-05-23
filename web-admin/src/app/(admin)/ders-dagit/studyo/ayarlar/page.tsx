'use client';

import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { SlidersHorizontal } from 'lucide-react';
import { StudioSettingsLinks } from '@/components/ders-dagit/studio-settings-links';
import { DdInfoHint } from '@/components/ders-dagit/dd-info-hint';

export default function StudioAyarlarPage() {
  return (
    <div className={DD_PAGE}>
      <div className="flex items-start gap-2">
        <DdPageHeader
          icon={SlidersHorizontal}
          title="Ayarlar"
          description="Modül sayfalarına kısayol — her kartın (i) açıklamasına bakın."
          className="flex-1"
        />
        <DdInfoHint label="Ayarlar sayfası" title="Program merkezi ayarları">
          <p>
            Bu sayfa üretim ve kurulum adımlarının tamamına tek yerden gider. Üst menüde görünmeyen ekranlar (gruplar, arşiv, adalet vb.) de burada listelenir.
          </p>
          <p className="mt-2">
            Asıl ayar değişiklikleri ilgili sayfada yapılır; buradan yalnızca hızlı geçiş ve kısa açıklama sunulur.
          </p>
        </DdInfoHint>
      </div>
      <StudioSettingsLinks />
    </div>
  );
}
