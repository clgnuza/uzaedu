'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Campaign,
  createManualMessagingCampaign,
  getDeliveryHint,
} from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { MessageCirclePlus, Plus, Trash2 } from 'lucide-react';
import SendPanel from './SendPanel';

const PRESETS = [
  { label: 'Bilgilendirme', text: 'Sayın {AD},\n\nOkul ile ilgili kısa bir bilgilendirme mesajıdır.\n\nİyi günler.' },
  { label: 'Veli görüşmesi', text: 'Sayın {AD},\n\nVeli görüşmesi / görüşme talebi için yazıyorum. Uygun olduğunuz zamanı iletebilir misiniz?\n\nSaygılarımla.' },
  { label: 'Hatırlatma', text: 'Sayın {AD},\n\nHatırlatma: …\n\nİyi günler.' },
];

type Row = { name: string; phone: string };

interface Props {
  token: string | null | undefined;
  q: string;
  onCampaignCreated?: () => void;
}

export default function TeacherWaQuickSend({ token, q, onCampaignCreated }: Props) {
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(PRESETS[0].text);
  const [rows, setRows] = useState<Row[]>([{ name: '', phone: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (!token) return;
    void getDeliveryHint(token, q)
      .then((h) => setApiReady(h.apiReady))
      .catch(() => setApiReady(false));
  }, [token, q]);

  const addRow = () => setRows((r) => [...r, { name: '', phone: '' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof Row, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));

  const buildRecipients = () => {
    return rows
      .map((r) => {
        const name = r.name.trim();
        const phone = r.phone.trim();
        const msg = body.replace(/\{AD\}/g, name || 'Veli').trim();
        return { name, phone, message: msg };
      })
      .filter((r) => r.name && r.phone);
  };

  const submit = async () => {
    if (!token) return;
    const t = title.trim();
    if (!t) return toast.error('Başlık girin');
    const rec = buildRecipients();
    if (!rec.length) return toast.error('En az bir alıcı (ad ve telefon) girin');
    setSubmitting(true);
    setCampaign(null);
    try {
      const c = await createManualMessagingCampaign(token, q, { title: t, recipients: rec });
      setCampaign(c);
      toast.success('Kampanya hazır — API ile gönderin');
      onCampaignCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-teal-200/70 bg-teal-50/40 p-3 shadow-sm dark:border-teal-900/40 dark:bg-teal-950/20 space-y-3 sm:rounded-2xl sm:p-4 sm:space-y-4">
      <div className="flex items-start gap-1.5 sm:gap-2">
        <MessageCirclePlus className="mt-0.5 size-4 shrink-0 text-teal-700 dark:text-teal-400 sm:size-5" />
        <div>
          <p className="text-xs font-semibold text-teal-950 dark:text-teal-100 sm:text-sm">Hızlı toplu mesaj</p>
          <p className="mt-0.5 text-[11px] leading-snug text-teal-900/85 dark:text-teal-200/85 sm:text-xs">
            Gönderimde WhatsApp API veya SMS (başlıklı) seçilir; okul ayarlarından en az biri aktif olmalı.
          </p>
          {apiReady === false ? (
            <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200/90">
              Okul mesaj ayarları eksik.{' '}
              <Link href={`/mesaj-merkezi/ayarlar${q}`} className="underline font-semibold">
                Ayarlar
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Input placeholder="Kampanya başlığı (örn. Veli bilgilendirme — 15.04)" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm sm:h-10" />
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setBody(p.text)}
              className="rounded-full border border-teal-200 bg-white/80 px-2 py-0.5 text-[9px] font-medium text-teal-800 hover:bg-teal-100/80 dark:border-teal-800 dark:bg-zinc-900/60 dark:text-teal-200 sm:px-2.5 sm:py-1 sm:text-[10px]"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="mb-0.5 block text-[9px] font-semibold text-muted-foreground sm:text-[10px]">Mesaj şablonu ({'{AD}'} = alıcı adı)</label>
        <textarea
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[100px] w-full resize-y rounded-lg border border-input bg-white px-2.5 py-1.5 font-mono text-xs leading-relaxed dark:bg-zinc-900 sm:min-h-[120px] sm:px-3 sm:py-2 sm:text-sm"
        />
      </div>

      <div className="space-y-2">
        <p className="text-[9px] font-semibold text-muted-foreground sm:text-[10px]">Alıcılar</p>
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <Input placeholder="Ad Soyad" value={row.name} onChange={(e) => updateRow(i, 'name', e.target.value)} className="h-9 min-w-0 flex-1 text-sm sm:min-w-[140px]" />
            <Input placeholder="+90… veya 05…" value={row.phone} onChange={(e) => updateRow(i, 'phone', e.target.value)} className="h-9 min-w-0 flex-1 text-sm sm:min-w-[160px]" />
            {rows.length > 1 ? (
              <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeRow(i)} aria-label="Satırı sil">
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            ) : null}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs sm:h-9 sm:text-sm" onClick={addRow}>
          <Plus className="size-3.5" />
          Alıcı ekle
        </Button>
      </div>

      <Button type="button" className="h-10 w-full gap-1.5 bg-teal-600 text-sm hover:bg-teal-700 sm:h-11" disabled={submitting || !token} onClick={() => void submit()}>
        {submitting ? <LoadingSpinner className="size-4" /> : <MessageCirclePlus className="size-4" />}
        Kampanya oluştur
      </Button>

      {campaign ? (
        <SendPanel campaign={campaign} token={token} q={q} onSent={onCampaignCreated} />
      ) : null}
    </div>
  );
}
