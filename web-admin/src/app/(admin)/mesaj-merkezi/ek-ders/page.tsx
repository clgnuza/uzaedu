'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import { TPL_EK_DERS } from '@/lib/messaging-default-templates';
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
      defaultTemplate={TPL_EK_DERS}
      templateHelp="{AD} = öğretmen adı, {BRANS} = branş, {SAAT} = ders saati, {TUTAR} = tutar TL, {AY} = dönem/ay"
      token={token} q={q}
    />
  );
}
