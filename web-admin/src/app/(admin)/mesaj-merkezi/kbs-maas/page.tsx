'use client';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import BordroUploadFlow from '../components/BordroUploadFlow';

export default function KbsMaasPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <BordroUploadFlow
      type="maas_bordro"
      icon="💵"
      title="KBS Maaş Bordro Gönderimi"
      description="KBS Personel modülü maaş bordro Excel'i (brüt / kesinti / net sütunları)."
      privacyNote="Tam gizlilik: Her kişiye yalnızca kendi maaş özeti iletilir."
      sourceHints={[
        'KBS → Personel → maaş bordro / ödeme listesi Excel dışa aktarımı',
        'Brüt maaş, kesinti ve net ödenecek sütunları içeren tablolar',
      ]}
      token={token}
      q={q}
    />
  );
}
