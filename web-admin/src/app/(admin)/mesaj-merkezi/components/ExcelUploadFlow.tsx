'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Campaign, loadRecipients, Recipient } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload, RefreshCw, Eye } from 'lucide-react';
import CampaignPreviewTable from './CampaignPreviewTable';
import SendPanel from './SendPanel';
import { applyWaTemplateSamples } from '@/lib/messaging-template-samples';

interface Props {
  endpoint: string;       // e.g. /messaging/campaigns/ek-ders/excel
  pageTitle: string;
  description: string;
  defaultTemplate: string;
  templateHelp: string;    // {AD}, {BRANS} gibi değişken açıklaması
  showTemplate?: boolean;
  showTarih?: boolean;
  token: string | null | undefined;
  q: string;
  onDone?: () => void;
}

export default function ExcelUploadFlow({ endpoint, pageTitle, description, defaultTemplate, templateHelp, showTemplate = true, showTarih = false, token, q }: Props) {
  const fileRef    = useRef<HTMLInputElement>(null);
  const [title, setTitle]       = useState('');
  const [template, setTemplate] = useState(defaultTemplate);
  const [showPrev, setShowPrev] = useState(false);
  const [tarih, setTarih]       = useState(new Date().toISOString().slice(0, 10));
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [step, setStep]           = useState<'upload' | 'preview'>('upload');

  const upload = async (file: File) => {
    if (!title.trim()) return toast.error('Kampanya başlığı gerekli');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      if (showTemplate) fd.append('template', template);
      if (showTarih) fd.append('tarih', tarih);
      const c = await apiFetch<Campaign>(endpoint + q, { method: 'POST', token, body: fd });
      setCampaign(c);
      const r = await loadRecipients(token ?? '', c.id, q);
      setRecipients(r);
      setStep('preview');
      toast.success(`${r.length} alıcı yüklendi`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Yükleme hatası'); }
    finally { setUploading(false); }
  };

  const refreshRecipients = async () => {
    if (!campaign) return;
    const r = await loadRecipients(token ?? '', campaign.id, q);
    setRecipients(r);
  };

  const refreshCampaign = async () => {
    if (!campaign) return;
    const c = await apiFetch<Campaign>(`/messaging/campaigns/${campaign.id}${q}`, { token });
    setCampaign(c);
    void refreshRecipients();
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-xl border border-white/50 bg-white/80 p-3 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 sm:rounded-2xl sm:p-5">
        <p className="text-sm font-bold sm:text-base">{pageTitle}</p>
        <p className="mt-0.5 mb-3 text-[11px] leading-snug text-muted-foreground sm:mb-4 sm:text-xs">{description}</p>

        {step === 'upload' && (
          <div className="space-y-3">
            <Input placeholder="Kampanya başlığı *" value={title} onChange={(e) => setTitle(e.target.value)} />
            {showTarih && (
              <Input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            )}
            {showTemplate && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-muted-foreground">Mesaj Şablonu</label>
                  <button onClick={() => setShowPrev((v) => !v)} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800">
                    <Eye className="size-3" />{showPrev ? 'Gizle' : 'Önizle'}
                  </button>
                </div>
                <textarea rows={6} value={template} onChange={(e) => setTemplate(e.target.value)}
                  className="min-h-[140px] w-full resize-y rounded-lg border border-input bg-white px-2.5 py-1.5 font-mono text-xs leading-relaxed dark:bg-zinc-900 sm:min-h-[200px] sm:px-3 sm:py-2 sm:text-sm" />
                <p className="mt-1 text-[10px] text-muted-foreground">Değişkenler: {templateHelp}</p>
                {showPrev && (
                  <div className="mt-2 flex justify-start">
                    <div className="relative max-w-[280px] sm:max-w-xs">
                      <div className="rounded-2xl rounded-tl-none bg-[#d9fdd3] shadow px-3.5 py-2.5 text-[12px] leading-[1.65] text-slate-800 whitespace-pre-line border border-green-100 dark:bg-[#1a3a2a] dark:text-slate-100 dark:border-green-900/30">
                        {applyWaTemplateSamples(template)}
                      </div>
                      <div className="absolute -left-1.5 top-0 size-0 border-t-[10px] border-t-[#d9fdd3] dark:border-t-[#1a3a2a] border-r-[8px] border-r-transparent" />
                      <p className="mt-0.5 text-right text-[9px] text-muted-foreground">17:25 ✓✓</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Button className="w-full gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <LoadingSpinner className="size-4" /> : <Upload className="size-4" />}
              Excel Dosyası Yükle
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          </div>
        )}

        {step === 'preview' && campaign && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{recipients.length} alıcı önizleme</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStep('upload')}>
                  <Upload className="size-4" /> Yeniden Yükle
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={refreshRecipients}>
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            </div>
            <SendPanel campaign={campaign} token={token} q={q} onSent={refreshCampaign} />
            <CampaignPreviewTable campaignId={campaign.id} recipients={recipients} token={token} q={q} onChange={refreshRecipients} />
          </div>
        )}
      </div>
    </div>
  );
}
