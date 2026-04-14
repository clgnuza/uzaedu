'use client';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import PdfSplitFlow from '../components/PdfSplitFlow';

export default function DevamsizlikMektupPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <PdfSplitFlow
      apiEndpoint="/messaging/campaigns/devamsizlik-mektup/pdf"
      icon="✉️"
      title="Devamsızlık Mektubu Dağıtımı"
      description="E-Okul'dan çıktı alınan devamsızlık mektubu PDF'ini yükleyin. PDF otomatik olarak öğrenci başına ayrıştırılır ve her veliye yalnızca kendi çocuğuna ait mektup WhatsApp üzerinden iletilir."
      defaultTemplate={`📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n\n- Açıklama: Öğrencimize ait devamsızlık mektubu ektedir. İncelemenizi rica ederiz.\n\n📚 {OKUL}`}
      token={token}
      q={q}
    />
  );
}
