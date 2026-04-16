'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { msgQ, Campaign, loadRecipients, Recipient } from '@/lib/messaging-api';
import { DAVETIYE_PRESETS } from '@/lib/messaging-default-templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload, X, RefreshCw, Send } from 'lucide-react';
import CampaignPreviewTable from '../components/CampaignPreviewTable';
import SendPanel from '../components/SendPanel';

type Group = { id: string; name: string; memberCount: number };

export default function DavetiyePage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [groups, setGroups]         = useState<Group[]>([]);
  const [title, setTitle]           = useState('');
  const [message, setMessage]       = useState(DAVETIYE_PRESETS[0].msg);
  const [source, setSource]         = useState<'excel' | 'group'>('excel');
  const [selectedGroup, setSelGroup] = useState('');
  const [campaign, setCampaign]     = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [step, setStep]             = useState<'form' | 'preview'>('form');
  const fileRef = useRef<HTMLInputElement>(null);
  const attRef  = useRef<HTMLInputElement>(null);
  const [attFile, setAttFile]       = useState<File | null>(null);

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
      fd.append('title', title); fd.append('message', message);
      if (source === 'group') { fd.append('source', 'group'); fd.append('groupId', selectedGroup); }
      if (excelFile) fd.append('file', excelFile);
      if (attFile) fd.append('attachment', attFile);
      const endpoint = source === 'excel' ? '/messaging/campaigns/davetiye/excel' : '/messaging/campaigns/veli-toplantisi';
      const c = await apiFetch<Campaign>(endpoint + q, { method: 'POST', token, body: fd });
      setCampaign(c);
      setRecipients(await loadRecipients(token ?? '', c.id, q));
      setStep('preview'); toast.success('Kampanya oluşturuldu');
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
          <p className="font-bold text-base">Davetiye Gönderimi</p>
          <p className="text-xs text-muted-foreground mt-0.5">Özel günler, mezuniyet, kermes ve etkinlikler için kişiselleştirilmiş davetiye + belge gönderin.</p>
        </div>

        {step === 'form' && (
          <>
            {/* Şablon seçici */}
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Şablon Seç</p>
              <div className="flex flex-wrap gap-2">
                {DAVETIYE_PRESETS.map((t) => (
                  <button key={t.label} onClick={() => { if (t.msg) setMessage(t.msg); }}
                    className="rounded-xl border bg-white/60 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition-colors dark:bg-zinc-900/50">
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <Input placeholder="Davetiye başlığı *" value={title} onChange={(e) => setTitle(e.target.value)} />

            {/* Kaynak */}
            <div className="flex gap-2">
              <button onClick={() => setSource('excel')} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${source === 'excel' ? 'border-indigo-400 bg-indigo-600 text-white' : 'bg-white/60 hover:bg-indigo-50 dark:bg-zinc-900/50'}`}>
                📊 Excel ile Yükle
              </button>
              <button onClick={() => setSource('group')} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${source === 'group' ? 'border-indigo-400 bg-indigo-600 text-white' : 'bg-white/60 hover:bg-indigo-50 dark:bg-zinc-900/50'}`}>
                👥 Gruptan Gönder
              </button>
            </div>

            {source === 'group' && (
              <select value={selectedGroup} onChange={(e) => setSelGroup(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900">
                <option value="">— Grup seçin —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberCount} üye)</option>)}
              </select>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mesaj</label>
              <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-y" />
              <p className="mt-1 text-[10px] text-muted-foreground">{'{AD}'} = alıcı adı. Boş bırakabilirsiniz.</p>
            </div>

            {/* Dosya eki */}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 dark:border-indigo-800/50 dark:bg-indigo-950/10">
              <Upload className="size-4 text-indigo-500 shrink-0" />
              <div className="flex-1 text-xs text-indigo-700 dark:text-indigo-300">
                {attFile ? <span className="font-semibold">{attFile.name}</span> : <span>Davetiye veya program dosyası ekle (PDF, JPG, PNG)</span>}
              </div>
              <label className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700">
                Seç
                <input ref={attRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setAttFile(e.target.files?.[0] ?? null)} />
              </label>
              {attFile && <button onClick={() => setAttFile(null)} className="text-muted-foreground hover:text-red-600"><X className="size-4" /></button>}
            </div>

            {source === 'excel' ? (
              <Button className="w-full gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <LoadingSpinner className="size-4" /> : <Upload className="size-4" />}
                Excel Yükle
              </Button>
            ) : (
              <Button className="w-full gap-1.5 bg-indigo-600 hover:bg-indigo-700" disabled={uploading} onClick={() => submit()}>
                {uploading ? <LoadingSpinner className="size-4" /> : <Send className="size-4" />}
                Kampanya Oluştur ({groups.find((g) => g.id === selectedGroup)?.memberCount ?? 0} kişi)
              </Button>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void submit(f); e.target.value = ''; }} />
          </>
        )}

        {step === 'preview' && campaign && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{recipients.length} alıcı önizleme</p>
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
