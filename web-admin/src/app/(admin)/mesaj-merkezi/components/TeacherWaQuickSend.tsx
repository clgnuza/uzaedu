'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Campaign,
  createManualMessagingCampaign,
  getDeliveryHint,
  getMyMessagingPreferences,
} from '@/lib/messaging-api';
import { buildWaMeUrl, augmentMessageBody } from '@/lib/wa-me-url';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { ExternalLink, MessageCirclePlus, Plus, Trash2 } from 'lucide-react';
import ManualWhatsappSendPanel from './ManualWhatsappSendPanel';

const PRESETS = [
  { label: 'Bilgilendirme', text: 'Sayın {AD},\n\nOkul ile ilgili kısa bir bilgilendirme mesajıdır.\n\nİyi günler.' },
  { label: 'Veli görüşmesi', text: 'Sayın {AD},\n\nVeli görüşmesi / görüşme talebi için yazıyorum. Uygun olduğunuz zamanı iletebilir misiniz?\n\nSaygılarımla.' },
  { label: 'Hatırlatma', text: 'Sayın {AD},\n\nHatırlatma: …\n\nİyi günler.' },
];

type Row = { name: string; phone: string };

interface Props {
  token: string | null | undefined;
  /** msgQ(me?.role, school_id) */
  q: string;
  onCampaignCreated?: () => void;
}

export default function TeacherWaQuickSend({ token, q, onCampaignCreated }: Props) {
  const [hint, setHint] = useState<{ whatsappLinkMode: boolean } | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(PRESETS[0].text);
  const [rows, setRows] = useState<Row[]>([{ name: '', phone: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [fallbackUrls, setFallbackUrls] = useState<Array<{ name: string; phone: string; url: string; text: string }>>([]);

  const loadHint = useCallback(async () => {
    if (!token) return;
    try {
      setHint(await getDeliveryHint(token, q));
    } catch {
      setHint({ whatsappLinkMode: false });
    }
  }, [token, q]);

  useEffect(() => {
    void loadHint();
  }, [loadHint]);

  const addRow = () => setRows((r) => [...r, { name: '', phone: '' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof Row, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));

  const buildRecipients = () => {
    const filled = rows
      .map((r) => {
        const name = r.name.trim();
        const phone = r.phone.trim();
        const msg = body.replace(/\{AD\}/g, name || 'Veli').trim();
        return { name, phone, message: msg };
      })
      .filter((r) => r.name && r.phone);
    return filled;
  };

  const openWa = async (url: string) => {
    if (!url) return;
    let newTab = true;
    try {
      if (token) {
        const p = await getMyMessagingPreferences(token, q);
        newTab = p.openWaInNewTab !== false;
      }
    } catch { /* default */ }
    if (newTab) window.open(url, '_blank', 'noopener,noreferrer');
    else window.location.assign(url);
  };

  const submit = async () => {
    if (!token) return;
    const t = title.trim();
    if (!t) return toast.error('Başlık girin');
    const rec = buildRecipients();
    if (!rec.length) return toast.error('En az bir alıcı (ad ve telefon) girin');
    setSubmitting(true);
    setCampaign(null);
    setFallbackUrls([]);
    try {
      const c = await createManualMessagingCampaign(token, q, { title: t, recipients: rec });
      setCampaign(c);
      const h = await getDeliveryHint(token, q);
      setHint(h);
      toast.success('Liste hazır — aşağıdan WhatsApp bağlantılarını kullanın');
      onCampaignCreated?.();

      if (!h.whatsappLinkMode) {
        const prefs = await getMyMessagingPreferences(token, q).catch(() => ({ appendSignature: '', openWaInNewTab: true }));
        const sig = prefs.appendSignature ?? '';
        setFallbackUrls(
          rec.map((r) => {
            const text = augmentMessageBody(r.message, sig);
            return { name: r.name, phone: r.phone, text, url: buildWaMeUrl(r.phone, text) };
          }),
        );
      } else {
        setFallbackUrls([]);
      }
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
          <p className="text-xs font-semibold text-teal-950 dark:text-teal-100 sm:text-sm">WhatsApp Web ile gönder (wa.me)</p>
          <p className="mt-0.5 text-[11px] leading-snug text-teal-900/85 dark:text-teal-200/85 sm:text-xs">
            Kendi tarayıcı/WhatsApp oturumunuzla gönderirsiniz. Mesaj metninde {'{AD}'} alıcı adıyla değişir. Ayarlardan imza ve yeni sekme tercihinizi kullanırız.
          </p>
          {hint && !hint.whatsappLinkMode ? (
            <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200/90">
              Okul şu an otomatik API gönderiminde olabilir; yine de aşağıdan wa.me ile elle gönderebilirsiniz.
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
        Hazırla ve WhatsApp bağlantılarını göster
      </Button>

      {campaign && hint?.whatsappLinkMode ? (
        <div className="pt-2 border-t border-teal-200/50 dark:border-teal-900/40">
          <ManualWhatsappSendPanel campaign={campaign} token={token} q={q} onUpdate={onCampaignCreated} />
        </div>
      ) : null}

      {campaign && !hint?.whatsappLinkMode && fallbackUrls.length > 0 ? (
        <div className="pt-2 border-t border-teal-200/50 space-y-2 dark:border-teal-900/40">
          <p className="text-xs font-medium text-teal-900 dark:text-teal-100">wa.me bağlantıları (kişisel oturumunuz)</p>
          <ul className="space-y-2">
            {fallbackUrls.map((row, idx) => (
              <li key={idx} className="flex flex-col gap-1 rounded-lg border bg-white/90 p-2 text-sm dark:bg-zinc-900/70 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium truncate">{row.name}</span>
                <Button type="button" size="sm" variant="secondary" className="gap-1 shrink-0" disabled={!row.url} onClick={() => void openWa(row.url)}>
                  <ExternalLink className="size-3.5" />
                  WhatsApp
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
