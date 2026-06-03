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
      description="KBS Ek Ders V2 bordro veya MEBBİS aktarım dosyası. Brüt/kesinti/net ve veri tipi saatleri kişiye özel mesaja dönüşür."
      privacyNote="Gizlilik güvencesi: Her öğretmen yalnızca kendi ek ders bilgilerini görebilir."
      sourceHints={[
        'KBS → Ek Ders V2 → Bordro Hesapla sonrası personel listesi / bordro Excel çıktısı',
        'MEBBİS Ek Ders Listesi (KBS) — ödeme öncesi saat kontrolü için',
        'KBS puantaj şablonu (TC + Veri Tip + günler) — saat özeti mesajı',
      ]}
      token={token}
      q={q}
    />
  );
}
