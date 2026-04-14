'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import ExcelUploadFlow from '../components/ExcelUploadFlow';

export default function MaasPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-300/50 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-800/30 dark:bg-amber-950/20 dark:text-amber-300">
        🔒 <strong>Gizlilik:</strong> Her öğretmene yalnızca kendi maaş bilgisi iletilir. Kimse başkasının bilgisini göremez.
      </div>
      <ExcelUploadFlow
        endpoint="/messaging/campaigns/maas/excel"
        pageTitle="Maaş Mesaj Gönderimi"
        description="KBS'den indirilen maaş Excel dosyasını yükleyin. Her personele kişiye özel maaş dökümü WhatsApp ile iletilir."
        defaultTemplate="Sayın {AD}, {AY} ayı maaş bilginiz: Brüt {BRUT} TL / Net {NET} TL. Sağlıklı günler. — OgretmenPro"
        templateHelp="{AD}, {AY}, {BRUT}, {NET}"
        token={token} q={q}
      />
    </div>
  );
}
