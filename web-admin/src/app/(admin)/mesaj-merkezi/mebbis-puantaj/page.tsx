'use client';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import BordroUploadFlow from '../components/BordroUploadFlow';

export default function MebbisPuantajPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));
  return (
    <BordroUploadFlow
      type="mebbis_puantaj"
      icon="📋"
      title="MEBBİS Puantaj Gönderimi"
      description="MEBBİS üzerinde oluşturulan puantaj Excel'ini yükleyin. Sistem otomatik ayrıştırma yaparak her öğretmene sadece kendi puantaj bilgilerini WhatsApp üzerinden gönderir."
      token={token}
      q={q}
    />
  );
}
