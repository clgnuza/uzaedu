'use client';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import { TPL_ARA_KARNE } from '@/lib/messaging-default-templates';
import PdfSplitFlow from '../components/PdfSplitFlow';

export default function AraKarnePage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <PdfSplitFlow
      apiEndpoint="/messaging/campaigns/ara-karne/pdf"
      icon="📊"
      title="Ara Karne Dağıtımı"
      description="E-Okul'dan alınan ara karne PDF'ini yükleyin. Her öğrencinin ara karnesi otomatik ayrıştırılır ve velisine WhatsApp üzerinden gönderilir."
      defaultTemplate={TPL_ARA_KARNE}
      token={token}
      q={q}
    />
  );
}
