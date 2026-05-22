'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { createAcilCampaign, msgQ } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function AcilPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, useSearchParams().get('school_id'));
  const [title, setTitle] = useState('🚨 Acil bilgilendirme');
  const [message, setMessage] = useState('');
  const [phones, setPhones] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const recipients = phones.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean).map((phone) => ({ phone }));
    if (!message.trim() || !recipients.length) return toast.error('Mesaj ve telefon gerekli');
    setBusy(true);
    try {
      const c = await createAcilCampaign(token!, q, { title, message, recipients });
      toast.success('Önizleme oluşturuldu');
      router.push(`/mesaj-merkezi/kampanya/${c.id}${q}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/40 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <h2 className="font-bold text-sm text-red-900 dark:text-red-100">Acil duyuru</h2>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Başlık" />
      <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Duyuru metni" />
      <textarea className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px]" value={phones} onChange={(e) => setPhones(e.target.value)} placeholder="Telefonlar (satır veya virgül)" />
      <Button className="bg-red-600 hover:bg-red-700" disabled={busy} onClick={() => void send()}>Önizleme oluştur</Button>
    </div>
  );
}
