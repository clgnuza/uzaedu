'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import { TPL_IZIN } from '@/lib/messaging-default-templates';
import ExcelUploadFlow from '../components/ExcelUploadFlow';

export default function IzinPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <ExcelUploadFlow
      endpoint="/messaging/campaigns/izin/excel"
      pageTitle="Evci / Çarşı İzin Bildirimi"
      description="E-Okul uyumlu izin listesi Excel dosyasını yükleyin. Her veliye yalnızca kendi çocuğunun izin bilgisi iletilir."
      defaultTemplate={TPL_IZIN}
      templateHelp="{AD} {OGRENCI} {SINIF} {TUR} {CIKIS} {DONUS} {OKUL}"
      showTarih
      token={token} q={q}
    />
  );
}
