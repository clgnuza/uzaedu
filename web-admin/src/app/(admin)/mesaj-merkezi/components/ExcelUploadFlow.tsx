'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Campaign, loadRecipients, Recipient } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import CampaignPreviewStep from './CampaignPreviewStep';
import TemplateEditorWithPreview from './TemplateEditorWithPreview';

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
              <TemplateEditorWithPreview
                value={template}
                onChange={setTemplate}
                rows={7}
                help={`Değişkenler: ${templateHelp}`}
              />
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
          <CampaignPreviewStep
            campaign={campaign}
            recipients={recipients}
            token={token}
            q={q}
            onRefresh={refreshCampaign}
            onBack={() => setStep('upload')}
            backLabel="Yeniden yükle"
          />
        )}
      </div>
    </div>
  );
}
