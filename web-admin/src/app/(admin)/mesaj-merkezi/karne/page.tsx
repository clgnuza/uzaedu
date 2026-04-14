'use client';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import PdfSplitFlow from '../components/PdfSplitFlow';

export default function KarnePage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <PdfSplitFlow
      apiEndpoint="/messaging/campaigns/karne/pdf"
      icon="🎓"
      title="Karne Dağıtımı"
      description="E-Okul'dan alınan karne PDF'ini yükleyin. Her öğrencinin karnesi otomatik ayrıştırılır ve velisine WhatsApp üzerinden gönderilir. Her veliye yalnızca kendi öğrencisinin bilgileri iletilir."
      defaultTemplate={`📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n\n- Açıklama: Öğrencimize ait karnesi ekte sunulmuştur. İyi tatiller dileriz.\n\n📚 {OKUL}`}
      token={token}
      q={q}
    />
  );
}
