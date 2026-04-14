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
      description="KBS üzerinde oluşturulan maaş bordro Excel'ini yükleyin. Her öğretmene yalnızca kendi maaş dökümü WhatsApp üzerinden gönderilir."
      privacyNote="Tam gizlilik: Hiçbir öğretmen başkasının maaş bilgilerine erişemez. Her kişiye sadece kendi özeli iletilir."
      token={token}
      q={q}
    />
  );
}
