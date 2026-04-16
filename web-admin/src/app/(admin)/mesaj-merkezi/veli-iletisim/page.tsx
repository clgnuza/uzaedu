'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { msgQ } from '@/lib/messaging-api';
import { TPL_VELI_ILETISIM } from '@/lib/messaging-default-templates';
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
  const [manualMsg, setManualMsg]     = useState(TPL_VELI_ILETISIM);
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        <Button size="sm" variant={mode === 'excel' ? 'default' : 'outline'} className="h-8 flex-1 text-xs sm:h-9 sm:flex-none sm:text-sm" onClick={() => setMode('excel')}>Excel ile Yükle</Button>
        <Button size="sm" variant={mode === 'manual' ? 'default' : 'outline'} className="h-8 flex-1 text-xs sm:h-9 sm:flex-none sm:text-sm" onClick={() => setMode('manual')}>Manuel Giriş</Button>
      </div>

      {mode === 'excel' && (
        <ExcelUploadFlow
          endpoint="/messaging/campaigns/toplu-mesaj/excel"
          pageTitle="Toplu Mesaj — Excel"
          description="Excel'den veli/öğrenci listesi yükleyin. Sütunlar: Adı Soyadı | Telefon (WhatsApp) | Mesaj (isteğe bağlı)"
          defaultTemplate={TPL_VELI_ILETISIM}
          templateHelp="{AD} = alıcı adı"
          token={token} q={q}
        />
      )}

      {mode === 'manual' && (
        <div className="rounded-xl border bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60 space-y-2.5 sm:rounded-2xl sm:p-5 sm:space-y-3">
          <p className="text-sm font-bold sm:text-base">Manuel Alıcı Girişi</p>
          <Input placeholder="Kampanya başlığı *" value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} className="h-9 text-sm" />
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-muted-foreground sm:text-xs">Varsayılan Mesaj</label>
            <textarea rows={6} value={manualMsg} onChange={(e) => setManualMsg(e.target.value)}
              className="min-h-[120px] w-full resize-y rounded-lg border bg-white px-2.5 py-1.5 font-mono text-xs leading-relaxed dark:bg-zinc-900 sm:min-h-[180px] sm:px-3 sm:py-2 sm:text-sm" />
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border/60 p-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-center sm:border-0 sm:p-0">
                <Input placeholder="Ad Soyad" value={r.name} onChange={(e) => updateRow(i, 'name', e.target.value)} className="h-9 text-sm" />
                <Input placeholder="+905XX..." value={r.phone} onChange={(e) => updateRow(i, 'phone', e.target.value)} className="h-9 text-sm" />
                <Input placeholder="Mesaj (boş = varsayılan)" value={r.message} onChange={(e) => updateRow(i, 'message', e.target.value)} className="h-9 text-sm" />
                <button type="button" onClick={() => removeRow(i)} className="justify-self-end text-muted-foreground hover:text-red-600 sm:justify-self-center" aria-label="Satırı sil"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <Button size="sm" variant="outline" className="h-9 w-full gap-1 text-xs sm:w-auto sm:text-sm" onClick={addRow}><Plus className="size-4" /> Satır Ekle</Button>
            <Button size="sm" className="h-9 w-full gap-1 text-xs sm:ml-auto sm:w-auto sm:text-sm" disabled={sending} onClick={sendManual}><Send className="size-4" /> Kampanya Oluştur</Button>
          </div>
        </div>
      )}
    </div>
  );
}
