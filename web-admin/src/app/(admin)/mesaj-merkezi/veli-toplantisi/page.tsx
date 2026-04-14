'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { msgQ, Campaign, loadRecipients, Recipient } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload, X, RefreshCw } from 'lucide-react';
import CampaignPreviewTable from '../components/CampaignPreviewTable';
import SendPanel from '../components/SendPanel';

type Group = { id: string; name: string; memberCount: number };
type Source = 'excel' | 'group' | 'manual';

export default function VeliToplantisiPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [source, setSource]       = useState<Source>('excel');
  const [groups, setGroups]       = useState<Group[]>([]);
  const [title, setTitle]         = useState('');
  const [selectedGroup, setSelGroup] = useState('');
  const [message, setMessage]     = useState('Sayın {AD} Veli, \n\nOkul veli toplantımız aşağıdaki bilgiler dahilinde gerçekleştirilecektir:\n\n📅 Tarih: \n🕐 Saat: \n📍 Yer: \n\nKatılımınızı bekliyoruz. — OgretmenPro');
  const [campaign, setCampaign]   = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep]           = useState<'form' | 'preview'>('form');
  const [manualRows, setManualRows] = useState([{ name: '', phone: '' }]);
  const fileRef = useRef<HTMLInputElement>(null);
  const attRef  = useRef<HTMLInputElement>(null);
  const [attFile, setAttFile]     = useState<File | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiFetch<Group[]>(`/messaging/groups${q}`, { token }).then(setGroups).catch(() => {});
  }, [token, q]);

  const submit = async (excelFile?: File) => {
    if (!title.trim()) return toast.error('Başlık gerekli');
    if (source === 'group' && !selectedGroup) return toast.error('Grup seçin');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', title); fd.append('message', message); fd.append('source', source);
      if (source === 'group') fd.append('groupId', selectedGroup);
      if (source === 'manual') fd.append('recipients', JSON.stringify(manualRows.filter((r) => r.phone)));
      if (excelFile) fd.append('file', excelFile);
      if (attFile) fd.append('attachment', attFile);
      const endpoint = source === 'excel' ? '/messaging/campaigns/veli-toplantisi/excel' : '/messaging/campaigns/veli-toplantisi';
      const c = await apiFetch<Campaign>(endpoint + q, { method: 'POST', token, body: fd });
      setCampaign(c);
      setRecipients(await loadRecipients(token ?? '', c.id, q));
      setStep('preview');
      toast.success('Kampanya oluşturuldu');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setUploading(false); }
  };

  const refreshAll = async () => {
    if (!campaign) return;
    const [c, r] = await Promise.all([apiFetch<Campaign>(`/messaging/campaigns/${campaign.id}${q}`, { token }), loadRecipients(token ?? '', campaign.id, q)]);
    setCampaign(c); setRecipients(r);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-4">
        <div>
          <p className="font-bold text-base">Veli Toplantısı Bilgilendirme</p>
          <p className="text-xs text-muted-foreground mt-0.5">Toplantı tarihi, saati ve yeri bilgilerini otomatik iletin. Davetiye veya belge ekleyebilirsiniz.</p>
        </div>

        {step === 'form' && (
          <>
            {/* Kaynak seçimi */}
            <div className="flex gap-2 flex-wrap">
              {(['excel', 'group', 'manual'] as Source[]).map((s) => (
                <button key={s} onClick={() => setSource(s)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${source === s ? 'border-indigo-400 bg-indigo-600 text-white' : 'bg-white/60 hover:bg-indigo-50 dark:bg-zinc-900/50'}`}>
                  {s === 'excel' ? '📊 Excel' : s === 'group' ? '👥 Gruptan' : '✍️ Manuel'}
                </button>
              ))}
            </div>

            <Input placeholder="Kampanya başlığı *" value={title} onChange={(e) => setTitle(e.target.value)} />

            {source === 'group' && (
              <select value={selectedGroup} onChange={(e) => setSelGroup(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900">
                <option value="">— Grup seçin —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberCount} üye)</option>)}
              </select>
            )}

            {source === 'manual' && (
              <div className="space-y-1.5">
                {manualRows.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Ad" value={r.name} onChange={(e) => setManualRows((rows) => rows.map((row, idx) => idx === i ? { ...row, name: e.target.value } : row))} className="h-8 text-sm" />
                    <Input placeholder="+905XX..." value={r.phone} onChange={(e) => setManualRows((rows) => rows.map((row, idx) => idx === i ? { ...row, phone: e.target.value } : row))} className="h-8 text-sm" />
                    <button onClick={() => setManualRows((rows) => rows.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-600"><X className="size-4" /></button>
                  </div>
                ))}
                <button onClick={() => setManualRows((rows) => [...rows, { name: '', phone: '' }])} className="text-xs text-indigo-600 hover:underline">+ Satır ekle</button>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mesaj Şablonu</label>
              <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-y" />
              <p className="mt-1 text-[10px] text-muted-foreground">Değişkenler: {'{AD}'} = veli adı</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-zinc-800">
                <Upload className="size-3.5" />{attFile ? attFile.name.slice(0, 24) : 'Dosya Ekle (davetiye PDF/resim)'}
                <input ref={attRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setAttFile(e.target.files?.[0] ?? null)} />
              </label>
              {attFile && <button onClick={() => setAttFile(null)} className="text-muted-foreground hover:text-red-600"><X className="size-3.5" /></button>}
            </div>

            {source === 'excel' ? (
              <Button className="w-full gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <LoadingSpinner className="size-4" /> : <Upload className="size-4" />}
                Excel Yükle ve Ön İzleme
              </Button>
            ) : (
              <Button className="w-full gap-1.5" disabled={uploading} onClick={() => submit()}>
                {uploading ? <LoadingSpinner className="size-4" /> : null}
                Kampanya Oluştur
              </Button>
            )}

            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void submit(f); e.target.value = ''; }} />
          </>
        )}

        {step === 'preview' && campaign && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{recipients.length} alıcı</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStep('form')}><Upload className="size-4 mr-1" /> Yeniden</Button>
                <Button size="sm" variant="outline" onClick={refreshAll}><RefreshCw className="size-4" /></Button>
              </div>
            </div>
            <SendPanel campaign={campaign} token={token} q={q} onSent={refreshAll} />
            <CampaignPreviewTable campaignId={campaign.id} recipients={recipients} token={token} q={q} onChange={refreshAll} />
          </div>
        )}
      </div>
    </div>
  );
}
