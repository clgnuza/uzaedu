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
      description="MEBBİS Ek Ders Modülü veya KBS puantaj Excel'i. TC + veri tipi + saat satırları kişiye özel WhatsApp mesajına dönüştürülür."
      privacyNote="Puantaj mesajları yalnızca ilgili öğretmene gider; TC numarası maskelenir."
      sourceHints={[
        'MEBBİS → Ek Ders Modülü → Raporlar → Ek Ders Listesi (KBS) → Excele Aktar (.xls/.xlsx)',
        'KBS Ek Ders V2 → puantaj yükleme şablonu (T.C., Veri Tip, Gün1…GünN)',
        'Okul yardımcı programları (KBS uyumlu puantaj) — aynı sütun yapısı',
      ]}
      token={token}
      q={q}
    />
  );
}
