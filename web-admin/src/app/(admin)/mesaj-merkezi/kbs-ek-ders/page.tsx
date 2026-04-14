'use client';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import BordroUploadFlow from '../components/BordroUploadFlow';

export default function KbsEkDersPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <BordroUploadFlow
      type="ek_ders_bordro"
      icon="📄"
      title="KBS Ek Ders Bordro Gönderimi"
      description="KBS üzerinde oluşturulan ek ders bordro Excel'ini yükleyin. Her öğretmene yalnızca kendi ek ders detayları ve toplam tutarı WhatsApp üzerinden iletilir."
      privacyNote="Gizlilik güvencesi: Her öğretmen yalnızca kendi ek ders bilgilerini görebilir. Kimse başkasının bilgilerine erişemez."
      token={token}
      q={q}
    />
  );
}
