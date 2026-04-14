'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import ExcelUploadFlow from '../components/ExcelUploadFlow';

export default function EkDersPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <ExcelUploadFlow
      endpoint="/messaging/campaigns/ek-ders/excel"
      pageTitle="Ek Ders Mesaj Gönderimi"
      description="KBS veya MEBBİS uyumlu ek ders Excel dosyasını yükleyin. Her öğretmene kişiye özel mesaj otomatik oluşturulur ve WhatsApp ile iletilir."
      defaultTemplate="Sayın {AD}, {AY} ayına ait ek ders bilginiz: {SAAT} saat — {TUTAR} TL. Sağlıklı günler. — OgretmenPro"
      templateHelp="{AD} = öğretmen adı, {BRANS} = branş, {SAAT} = ders saati, {TUTAR} = tutar TL, {AY} = dönem/ay"
      token={token} q={q}
    />
  );
}
