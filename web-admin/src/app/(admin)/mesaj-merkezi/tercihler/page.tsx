'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { msgQ } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

type OptOut = { id: string; phone: string; reason: string | null; createdAt: string };
type Pref = {
  id: string;
  phone: string;
  name: string | null;
  preferredChannel: string;
  noSms: boolean;
  noWhatsapp: boolean;
};

export default function TercihlerPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [prefPhone, setPrefPhone] = useState('');
  const [prefName, setPrefName] = useState('');
  const [prefChannel, setPrefChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [noSms, setNoSms] = useState(false);
  const [noWa, setNoWa] = useState(false);
  const [quietNote, setQuietNote] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [o, p] = await Promise.all([
        apiFetch<OptOut[]>(`/messaging/opt-outs${q}`, { token }),
        apiFetch<Pref[]>(`/messaging/contact-preferences${q}`, { token }),
      ]);
      setOptOuts(o);
      setPrefs(p);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, q]);

  const addOptOut = async () => {
    try {
      await apiFetch(`/messaging/opt-outs${q}`, { method: 'POST', token, body: JSON.stringify({ phone, reason }) });
      setPhone('');
      setReason('');
      toast.success('Opt-out eklendi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-bold text-base">Veli tercihleri & opt-out</p>
        <p className="text-xs text-muted-foreground">İYS dışı okul içi iletişim reddi ve kanal tercihi</p>
      </div>

      <div className="rounded-2xl border p-4 space-y-3 bg-white/80 dark:bg-zinc-900/60">
        <p className="text-sm font-semibold">İletişim reddi (opt-out)</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)} className="max-w-[200px]" />
          <Input placeholder="Not (opsiyonel)" value={reason} onChange={(e) => setReason(e.target.value)} className="flex-1 min-w-[140px]" />
          <Button size="sm" className="gap-1" onClick={() => void addOptOut()}>
            <Plus className="size-4" />
            Ekle
          </Button>
        </div>
        <ul className="space-y-1 max-h-48 overflow-y-auto text-xs">
          {optOuts.map((o) => (
            <li key={o.id} className="flex justify-between rounded-lg border px-2 py-1.5">
              <span>{o.phone}{o.reason ? ` — ${o.reason}` : ''}</span>
              <button
                type="button"
                className="text-red-500"
                onClick={async () => {
                  await apiFetch(`/messaging/opt-outs/${o.id}${q}`, { method: 'DELETE', token });
                  void load();
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border p-4 bg-white/80 dark:bg-zinc-900/60 space-y-3">
        <p className="text-sm font-semibold">Kanal tercihi ekle</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Telefon" value={prefPhone} onChange={(e) => setPrefPhone(e.target.value)} className="max-w-[160px]" />
          <Input placeholder="Ad" value={prefName} onChange={(e) => setPrefName(e.target.value)} className="max-w-[140px]" />
          <select className="h-9 rounded-md border px-2 text-xs" value={prefChannel} onChange={(e) => setPrefChannel(e.target.value as 'whatsapp' | 'sms')}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
          </select>
          <Button size="sm" onClick={async () => {
            await apiFetch(`/messaging/contact-preferences${q}`, {
              method: 'POST', token,
              body: JSON.stringify({ phone: prefPhone, name: prefName, preferredChannel: prefChannel, noSms, noWhatsapp: noWa, quietHoursNote: quietNote }),
            });
            toast.success('Tercih kaydedildi');
            void load();
          }}>Kaydet</Button>
        </div>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={noSms} onChange={(e) => setNoSms(e.target.checked)} /> SMS istemiyor</label>
        <label className="flex gap-2 text-xs"><input type="checkbox" checked={noWa} onChange={(e) => setNoWa(e.target.checked)} /> WhatsApp istemiyor</label>
        <Input placeholder="Sessiz saat notu" value={quietNote} onChange={(e) => setQuietNote(e.target.value)} className="h-8 text-xs" />
        <p className="text-sm font-semibold mb-2">Kayıtlı ({prefs.length})</p>
        <ul className="space-y-1 text-xs max-h-40 overflow-y-auto">
          {prefs.map((p) => (
            <li key={p.id} className="rounded border px-2 py-1">
              {p.phone} · {p.preferredChannel}
              {p.noSms ? ' · SMS kapalı' : ''}
              {p.noWhatsapp ? ' · WA kapalı' : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
