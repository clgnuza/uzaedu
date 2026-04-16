'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import { TPL_DEVAMSIZLIK } from '@/lib/messaging-default-templates';
import ExcelUploadFlow from '../components/ExcelUploadFlow';

export default function DevamsizlikPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <ExcelUploadFlow
      endpoint="/messaging/campaigns/devamsizlik/excel"
      pageTitle="Günlük Devamsızlık Bildirimi"
      description="E-Okul uyumlu devamsızlık Excel dosyasını yükleyin. Her veliye yalnızca kendi çocuğunun bilgisi WhatsApp ile iletilir."
      defaultTemplate={TPL_DEVAMSIZLIK}
      templateHelp="{AD} {OGRENCI} {SINIF} {TARIH} {GUN} {TUR} {OKUL}"
      showTarih
      token={token} q={q}
    />
  );
}
