'use client';

import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
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
      defaultTemplate={`📣 Sayın {AD},\n\n- Öğr. Adı Soyadı: {OGRENCI}\n- Sınıfı: {SINIF}\n- Tarih: {TARIH}\n- Gün: {GUN}\n- Türü: {TUR} olarak devamsızlık yapmıştır.\n\n📚 {OKUL}`}
      templateHelp="{AD} {OGRENCI} {SINIF} {TARIH} {GUN} {TUR} {OKUL}"
      showTarih
      token={token} q={q}
    />
  );
}
