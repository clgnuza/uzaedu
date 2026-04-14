'use client';

import { useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { msgQ, Campaign, loadRecipients, Recipient } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload, RefreshCw, BookOpen } from 'lucide-react';
import CampaignPreviewTable from '../components/CampaignPreviewTable';
import SendPanel from '../components/SendPanel';

const DEFAULT_TEMPLATE = `📣 Sayın {AD},

- Öğr. Adı Soyadı: {OGRENCI}
- Sınıfı: {SINIF}
- Tarih: {TARIH}

- Açıklama: Öğrencimiz, belirtilen tarihte {DERSLER_INLINE} ders saatlerinde devamsızlık yapmıştır.

📚 {OKUL}`;

export default function DersDevamsizlikPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [title, setTitle]       = useState('');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [tarih, setTarih]       = useState(new Date().toLocaleDateString('tr-TR'));
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [uploading, setUploading] = useState(false);
  const [step, setStep]         = useState<'form' | 'preview'>('form');
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    if (!title.trim()) return toast.error('Başlık gerekli');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title.trim());
      fd.append('template', template);
      fd.append('tarih', tarih);
      const c = await apiFetch<Campaign>(`/messaging/campaigns/ders-devamsizlik/excel${q}`, { method: 'POST', token, body: fd });
      setCampaign(c);
      const r = await loadRecipients(token ?? '', c.id, q);
      setRecipients(r); setStep('preview');
      toast.success(`${r.length} veliye bildirim hazırlandı`);
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
        <div className="flex items-start gap-3">
          <BookOpen className="size-8 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-base">Ders Bazlı Devamsızlık Bildirimi</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              E-öğretmen uygulamasından alınan ders bazlı devamsızlık Excel'ini yükleyin.
              Aynı veliye birden fazla ders varsa tek mesajda toplu iletilir.
            </p>
          </div>
        </div>

        <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 dark:border-rose-900/40 dark:bg-rose-950/10">
          <span className="text-xs text-rose-800 dark:text-rose-300">
            <span className="font-semibold">E-öğretmen uyumlu: </span>
            Öğrencinin okula geldiği ancak hangi derse girmediği bilgisini içeren Excel dosyasını yükleyin. Sistem aynı veliye ait tüm ders devamsızlıklarını tek mesajda birleştirir.
          </span>
        </div>

        {step === 'form' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Kampanya Başlığı *</label>
                <Input placeholder="Ders Devamsızlık — Kasım 2025" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Tarih</label>
                <Input placeholder="GG.AA.YYYY" value={tarih} onChange={(e) => setTarih(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Mesaj Şablonu</label>
              <textarea rows={7} value={template} onChange={(e) => setTemplate(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-y font-mono" />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Değişkenler: {'{AD}'} {'{OGRENCI}'} {'{SINIF}'} {'{TARIH}'} {'{DERSLER_INLINE}'} = [1.Ders, 2.Ders] {'{DERSLER}'} = liste {'{OKUL}'}
              </p>
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:border-rose-300 hover:bg-rose-50/30 transition-colors cursor-pointer dark:border-zinc-700 dark:bg-zinc-900/30"
              onClick={() => fileRef.current?.click()}>
              <Upload className="mx-auto mb-2 size-7 text-rose-400" />
              <p className="font-semibold text-sm">E-öğretmen Excel Dosyasını Yükle</p>
              <p className="text-xs text-muted-foreground mt-1">Ders bazlı devamsızlık listesi (.xlsx, .xls)</p>
              {uploading && <div className="mt-2 flex justify-center"><LoadingSpinner className="size-5" /></div>}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 dark:border-zinc-700/50 dark:bg-zinc-900/30">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Beklenen Excel Sütunları:</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                <span>• Öğrenci Adı Soyadı</span>
                <span>• Sınıf</span>
                <span>• Ders Adı</span>
                <span>• Ders Saati</span>
                <span>• Veli Adı (opsiyonel)</span>
                <span>• Veli Telefon</span>
                <span>• Tarih (opsiyonel)</span>
              </div>
            </div>
          </>
        )}

        {step === 'preview' && campaign && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{recipients.length} veliye bildirim</p>
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
