'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import ExcelUploadFlow from '../components/ExcelUploadFlow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2, Send } from 'lucide-react';

type ManualRow = { name: string; phone: string; message: string };

export default function VeliIletisimPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [mode, setMode]     = useState<'excel' | 'manual'>('excel');
  const [manualTitle, setManualTitle] = useState('');
  const [manualMsg, setManualMsg]     = useState('Sayın veli, {AD}, bilgilendirme amacıyla iletilmiştir. — OgretmenPro');
  const [rows, setRows]     = useState<ManualRow[]>([{ name: '', phone: '', message: '' }]);
  const [sending, setSending] = useState(false);

  const addRow = () => setRows((r) => [...r, { name: '', phone: '', message: '' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof ManualRow, v: string) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: v } : row));

  const sendManual = async () => {
    if (!manualTitle.trim()) return toast.error('Başlık gerekli');
    const filled = rows.map((r) => ({ name: r.name.trim(), phone: r.phone.trim(), message: r.message.trim() || manualMsg.replace('{AD}', r.name.trim()) })).filter((r) => r.name && r.phone);
    if (!filled.length) return toast.error('En az bir geçerli alıcı gerekli');
    setSending(true);
    try {
      const c = await apiFetch<{ id: string; title: string }>(`/messaging/campaigns/toplu-mesaj/manual${q}`, { method: 'POST', token, body: JSON.stringify({ title: manualTitle, recipients: filled }) });
      toast.success(`"${c.title}" oluşturuldu. Genel Bakış'tan gönderin.`);
      setRows([{ name: '', phone: '', message: '' }]); setManualTitle('');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant={mode === 'excel' ? 'default' : 'outline'} onClick={() => setMode('excel')}>Excel ile Yükle</Button>
        <Button size="sm" variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}>Manuel Giriş</Button>
      </div>

      {mode === 'excel' && (
        <ExcelUploadFlow
          endpoint="/messaging/campaigns/toplu-mesaj/excel"
          pageTitle="Toplu Mesaj — Excel"
          description="Excel'den veli/öğrenci listesi yükleyin. Sütunlar: Adı Soyadı | Telefon (WhatsApp) | Mesaj (isteğe bağlı)"
          defaultTemplate="Sayın {AD}, bilgilendirme mesajınız iletilmiştir. — OgretmenPro"
          templateHelp="{AD} = alıcı adı"
          token={token} q={q}
        />
      )}

      {mode === 'manual' && (
        <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-3">
          <p className="font-bold">Manuel Alıcı Girişi</p>
          <Input placeholder="Kampanya başlığı *" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} />
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Varsayılan Mesaj</label>
            <textarea rows={2} value={manualMsg} onChange={(e) => setManualMsg(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-zinc-900 resize-y" />
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center">
                <Input placeholder="Ad Soyad" value={r.name} onChange={(e) => updateRow(i, 'name', e.target.value)} className="h-8 text-sm" />
                <Input placeholder="+905XX..." value={r.phone} onChange={(e) => updateRow(i, 'phone', e.target.value)} className="h-8 text-sm" />
                <Input placeholder="Mesaj (boş = varsayılan)" value={r.message} onChange={(e) => updateRow(i, 'message', e.target.value)} className="h-8 text-sm" />
                <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-red-600"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={addRow}><Plus className="size-4" /> Satır Ekle</Button>
            <Button size="sm" className="gap-1 ml-auto" disabled={sending} onClick={sendManual}><Send className="size-4" /> Kampanya Oluştur</Button>
          </div>
        </div>
      )}
    </div>
  );
}
