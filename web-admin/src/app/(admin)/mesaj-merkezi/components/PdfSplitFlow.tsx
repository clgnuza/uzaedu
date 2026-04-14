'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Campaign, Recipient, loadRecipients } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload, Plus, Trash2, RefreshCw, FileText, Info, Eye } from 'lucide-react';
import CampaignPreviewTable from './CampaignPreviewTable';
import SendPanel from './SendPanel';

type RecipRow = { name: string; phone: string; studentName: string; studentNumber: string; className: string };

interface Props {
  apiEndpoint: string;           // e.g. '/messaging/campaigns/karne/pdf'
  icon: string;
  title: string;
  description: string;
  defaultTemplate: string;
  defaultTitle?: string;
  token: string | null;
  q: string;
}

export default function PdfSplitFlow({
  apiEndpoint, icon, title, description,
  defaultTemplate, defaultTitle = '', token, q,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep]         = useState<'form' | 'preview'>('form');
  const [campaignTitle, setTitle2] = useState(defaultTitle);
  const [template, setTemplate] = useState(defaultTemplate);
  const [pagesPerStudent, setPPS] = useState(1);
  const [rows, setRows]         = useState<RecipRow[]>([{ name: '', phone: '', studentName: '', studentNumber: '', className: '' }]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [uploading, setUploading] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const addRow    = () => setRows((r) => [...r, { name: '', phone: '', studentName: '', studentNumber: '', className: '' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, f: keyof RecipRow, v: string) => setRows((r) => r.map((row, idx) => idx === i ? { ...row, [f]: v } : row));

  const upload = async (file: File) => {
    if (!campaignTitle.trim()) return toast.error('Başlık gerekli');
    const filled = rows.filter((r) => r.name && r.phone);
    if (!filled.length) return toast.error('En az bir alıcı gerekli');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', campaignTitle.trim());
      fd.append('template', template);
      fd.append('pagesPerStudent', String(pagesPerStudent));
      fd.append('recipients', JSON.stringify(filled));
      const c = await apiFetch<Campaign>(apiEndpoint + q, { method: 'POST', token, body: fd });
      setCampaign(c);
      const r = await loadRecipients(token ?? '', c.id, q);
      setRecipients(r); setStep('preview');
      toast.success(`${r.length} alıcı — PDF ${pagesPerStudent > 1 ? `${pagesPerStudent} sayfalık gruplar halinde` : 'sayfalar halinde'} bölündü`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Yükleme hatası'); }
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
        {/* Başlık */}
        <div className="flex items-start gap-3">
          <div className="text-3xl">{icon}</div>
          <div>
            <p className="font-bold text-base">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        {step === 'form' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Kampanya Başlığı *</label>
                <Input placeholder="Başlık giriniz" value={campaignTitle} onChange={(e) => setTitle2(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Öğrenci Başına Sayfa Sayısı</label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={1} max={20} value={pagesPerStudent} onChange={(e) => setPPS(Number(e.target.value))} className="w-24" />
                  <span className="text-xs text-muted-foreground">sayfa/öğrenci</span>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground">Mesaj Şablonu</label>
                <button onClick={() => setShowPreview((v) => !v)} className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-800">
                  <Eye className="size-3" />{showPreview ? 'Gizle' : 'Önizle'}
                </button>
              </div>
              <textarea rows={4} value={template} onChange={(e) => setTemplate(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-y font-mono" />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {'{AD}'} = veli &nbsp;|&nbsp; {'{OGRENCI}'} = öğrenci &nbsp;|&nbsp; {'{SINIF}'} = sınıf
              </p>
              {showPreview && (
                <div className="mt-2 flex justify-start">
                  <div className="relative max-w-[280px] sm:max-w-xs">
                    <div className="rounded-2xl rounded-tl-none bg-[#d9fdd3] shadow px-3.5 py-2.5 text-[12px] leading-[1.55] text-slate-800 whitespace-pre-line border border-green-100 dark:bg-[#1a3a2a] dark:text-slate-100 dark:border-green-900/30">
                      {template
                        .replace(/{AD}/g, 'AHMET YILMAZ')
                        .replace(/{OGRENCI}/g, 'Ali YILMAZ')
                        .replace(/{SINIF}/g, '10. Sınıf / A Şubesi')
                        .replace(/{OKUL}/g, 'Okulunuzun Adı')
                      }
                    </div>
                    <div className="absolute -left-1.5 top-0 size-0 border-t-[10px] border-t-[#d9fdd3] dark:border-t-[#1a3a2a] border-r-[8px] border-r-transparent" />
                    <p className="mt-0.5 text-right text-[9px] text-muted-foreground">📎 ogrenci_belgesi.pdf &nbsp; 17:25 ✓✓</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bilgi kutusu */}
            <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 dark:border-blue-900/40 dark:bg-blue-950/10">
              <Info className="size-4 text-blue-500 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5">
                <p className="font-semibold">PDF + Alıcı Listesi Eşleşmesi</p>
                <p>Alıcı listesindeki sıra, PDF'teki sayfa sırasıyla birebir uymalıdır.</p>
                <p>Öğrenci başına sayfa = PDF toplam sayfa ÷ öğrenci sayısı</p>
              </div>
            </div>

            {/* Alıcı listesi */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">
                  Alıcı Listesi
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">({rows.filter((r) => r.name && r.phone).length} geçerli)</span>
                </p>
                <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={addRow}><Plus className="size-3.5" /> Satır</Button>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-xl border bg-white/60 p-2 dark:bg-zinc-900/40">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-1 items-center">
                    <Input placeholder="Veli Adı" value={r.name} onChange={(e) => updateRow(i, 'name', e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="+905XX..." value={r.phone} onChange={(e) => updateRow(i, 'phone', e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="Öğrenci" value={r.studentName} onChange={(e) => updateRow(i, 'studentName', e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="No" value={r.studentNumber} onChange={(e) => updateRow(i, 'studentNumber', e.target.value)} className="h-7 text-xs" />
                    <Input placeholder="Sınıf" value={r.className} onChange={(e) => updateRow(i, 'className', e.target.value)} className="h-7 text-xs" />
                    <button onClick={() => removeRow(i)} className="shrink-0 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 className="size-3.5" /></button>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">Toplam {rows.filter((r) => r.name && r.phone).length} alıcı × {pagesPerStudent} sayfa = {rows.filter((r) => r.name && r.phone).length * pagesPerStudent} sayfalık PDF bekleniyor.</p>
            </div>

            <Button className="w-full gap-2" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <LoadingSpinner className="size-4" /> : <FileText className="size-4" />}
              PDF Yükle ve Böl
            </Button>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
          </>
        )}

        {step === 'preview' && campaign && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{recipients.length} alıcı — PDF bölündü</p>
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
