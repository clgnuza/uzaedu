'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Campaign, loadRecipients, Recipient } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Upload, Phone, Send, RefreshCw, AlertTriangle, ShieldCheck, Eye } from 'lucide-react';
import CampaignPreviewTable from './CampaignPreviewTable';
import SendPanel from './SendPanel';

type BordroType = 'mebbis_puantaj' | 'ek_ders_bordro' | 'maas_bordro';

type ParsedTeacher = {
  name: string;
  tc?: string;
  phone?: string;
  messageText: string;
};

type ParseResult = {
  matched: ParsedTeacher[];
  unmatched: ParsedTeacher[];
};

interface Props {
  type: BordroType;
  title: string;
  description: string;
  icon: string;
  privacyNote?: string;
  token: string | null;
  q: string;
}

/** TC maskeler: 123***456 */
function maskTc(tc?: string): string {
  if (!tc || tc.length < 6) return tc ?? '';
  return tc.slice(0, 3) + '*'.repeat(tc.length - 6) + tc.slice(-3);
}

/** Örnek mesaj önizleme */
function buildPreview(type: BordroType, okulAdi: string, iletisimNotu: string, donem: string): string {
  const footer = `${iletisimNotu}\nİyi Çalışmalar...\n${okulAdi || 'OgretmenPro'}`;

  if (type === 'mebbis_puantaj') {
    return [
      '👤 Sayın Ahmet Yılmaz,',
      '',
      '- T.C. Kimlik No: 123***901',
      `- Dönem: ${donem || 'Kasım 2025'}`,
      '- Toplam Saat: 126 saat',
      '',
      `Ek ders kontrol amaçlı puantaj ekte sunulmuştur. Hata olması durumunda${okulAdi ? ' ' + okulAdi + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`,
      footer,
    ].join('\n');
  }
  if (type === 'ek_ders_bordro') {
    return [
      '👤 Sayın Ahmet Yılmaz,',
      '',
      '- T.C. Kimlik No: 123***901',
      '- Bordro Türü: Ek Ders',
      `- Dönem: ${donem || 'Eylül 2025'}`,
      '- Net Ödenecek Tutar: 25.261,48 ₺',
      '',
      `Ek ders bordro detayları ekte sunulmuştur. Hata olması durumunda${okulAdi ? ' ' + okulAdi + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`,
      footer,
    ].join('\n');
  }
  return [
    '👤 Sayın Ahmet Yılmaz,',
    '',
    '- T.C. Kimlik No: 123***901',
    '- Bordro Türü: Maaş',
    `- Dönem: ${donem || 'Eylül 2025'}`,
    '- Net Ödenecek Tutar: 42.752,13 ₺',
    '',
    `Maaş bordro detayları ekte sunulmuştur. Hata olması durumunda${okulAdi ? ' ' + okulAdi + ' yönetimi' : ' okul yönetimi'} ile iletişime geçiniz.`,
    footer,
  ].join('\n');
}

export default function BordroUploadFlow({ type, title, description, icon, privacyNote, token, q }: Props) {
  const [step, setStep]             = useState<'form' | 'match' | 'preview'>('form');
  const [donem, setDonem]           = useState('');
  const [campaignTitle, setCampaignTitle] = useState('');
  const [okulAdi, setOkulAdi]       = useState('');
  const [iletisimNotu, setIletisimNotu] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [manualPhones, setManualPhones] = useState<Record<string, string>>({});
  const [campaign, setCampaign]     = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Okul adını me.school'dan al
  useEffect(() => {
    if (okulAdi) return;
    try {
      const stored = localStorage.getItem('me');
      if (stored) {
        const me = JSON.parse(stored) as { school?: { name?: string } };
        if (me.school?.name) setOkulAdi(me.school.name);
      }
    } catch { /* ignore */ }
  }, []);

  const sid = q.startsWith('?') ? '&' + q.slice(1) : '';

  const doParseStep = async (f: File) => {
    setFile(f);
    if (!donem.trim()) return toast.error('Dönem/ay bilgisi giriniz');
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await apiFetch<ParseResult>(`/messaging/bordro/parse?type=${type}&donem=${encodeURIComponent(donem)}${sid}`, { method: 'POST', token, body: fd });
      setParseResult(res);
      setStep('match');
      toast.success(`${res.matched.length} öğretmen eşleşti, ${res.unmatched.length} eşleşmedi`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setLoading(false); }
  };

  const createCampaign = async () => {
    if (!file) return;
    const t = campaignTitle || `${donem} — ${type}`;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', t);
      fd.append('donem', donem);
      if (okulAdi) fd.append('schoolName', okulAdi);
      if (iletisimNotu) fd.append('footerNote', iletisimNotu);
      if (Object.keys(manualPhones).length) fd.append('manualPhones', JSON.stringify(manualPhones));
      const c = await apiFetch<Campaign>(`/messaging/bordro/campaign?type=${type}${sid}`, { method: 'POST', token, body: fd });
      setCampaign(c);
      setRecipients(await loadRecipients(token ?? '', c.id, q));
      setStep('preview');
      toast.success('Kampanya oluşturuldu');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setLoading(false); }
  };

  const refreshAll = async () => {
    if (!campaign) return;
    const [c, r] = await Promise.all([apiFetch<Campaign>(`/messaging/campaigns/${campaign.id}${q}`, { token }), loadRecipients(token ?? '', campaign.id, q)]);
    setCampaign(c); setRecipients(r);
  };

  const previewText = buildPreview(type, okulAdi, iletisimNotu, donem);

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

        {privacyNote && (
          <div className="flex gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <ShieldCheck className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <p className="text-xs text-emerald-800 dark:text-emerald-300">{privacyNote}</p>
          </div>
        )}

        {/* ADIM 1: Form */}
        {step === 'form' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Dönem / Ay *</label>
                <Input placeholder="Örn: Kasım 2025" value={donem} onChange={(e) => setDonem(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Kampanya Başlığı</label>
                <Input placeholder="Otomatik oluşturulur" value={campaignTitle} onChange={(e) => setCampaignTitle(e.target.value)} />
              </div>
            </div>

            {/* Okul adı & iletişim notu */}
            <div className="rounded-xl border bg-slate-50/70 p-3 space-y-2 dark:bg-zinc-900/40 dark:border-zinc-700/50">
              <p className="text-xs font-semibold text-muted-foreground">Mesaj Özelleştirme</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">Okul Adı (mesajda görünür)</label>
                  <Input placeholder="Erzurum Çok Programlı Anadolu Lisesi" value={okulAdi} onChange={(e) => setOkulAdi(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-muted-foreground">İletişim Notu (opsiyonel)</label>
                  <Input placeholder="Hata varsa yönetimle iletişime geçiniz." value={iletisimNotu} onChange={(e) => setIletisimNotu(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>

            {/* Mesaj önizleme — mobil WhatsApp style */}
            <div>
              <button onClick={() => setShowPreview((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                <Eye className="size-3.5" />
                {showPreview ? 'Önizlemeyi Gizle' : 'Mesaj Önizleme'}
              </button>

              {showPreview && (
                <div className="mt-2 flex justify-start">
                  <div className="relative max-w-[280px] sm:max-w-xs">
                    {/* WhatsApp bubble */}
                    <div className="rounded-2xl rounded-tl-none bg-white shadow px-3.5 py-2.5 text-[12px] leading-[1.55] text-slate-800 whitespace-pre-line border border-slate-100 dark:bg-zinc-800 dark:text-slate-100 dark:border-zinc-700">
                      {previewText}
                    </div>
                    <div className="absolute -left-1.5 top-0 size-0 border-t-[10px] border-t-white dark:border-t-zinc-800 border-r-[8px] border-r-transparent" />
                    <p className="mt-1 text-right text-[10px] text-muted-foreground">17:25 ✓✓</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer dark:border-zinc-700 dark:bg-zinc-900/30"
              onClick={() => donem.trim() ? fileRef.current?.click() : toast.error('Önce dönem bilgisi giriniz')}>
              <Upload className="mx-auto mb-2 size-7 text-indigo-400" />
              <p className="font-semibold text-sm">Excel Dosyasını Yükle</p>
              <p className="text-xs text-muted-foreground mt-1">MEBBİS/KBS'den indirilen Excel (.xlsx, .xls)</p>
              {loading && <div className="mt-2 flex justify-center"><LoadingSpinner className="size-5" /></div>}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void doParseStep(f); e.target.value = ''; }} />

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 space-y-1 dark:border-amber-900/40 dark:bg-amber-950/10">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Nasıl çalışır?</p>
              <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside">
                <li>Excel yüklenir; öğretmenler otomatik ayrıştırılır</li>
                <li>TC kimlik numarası mesajda maskelenir (123***901)</li>
                <li>Okul öğretmen listesiyle telefon eşleştirmesi yapılır</li>
                <li>Eksik telefonlar için manuel giriş yapabilirsiniz</li>
                <li>Her öğretmene sadece kendi bilgileri gönderilir</li>
              </ul>
            </div>
          </>
        )}

        {/* ADIM 2: Eşleştirme */}
        {step === 'match' && parseResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center dark:bg-emerald-950/20 dark:border-emerald-800/40">
                <p className="text-2xl font-bold text-emerald-600">{parseResult.matched.length}</p>
                <p className="text-xs text-emerald-700 mt-0.5">Telefon Eşleşti</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center dark:bg-amber-950/20 dark:border-amber-800/40">
                <p className="text-2xl font-bold text-amber-600">{parseResult.unmatched.length}</p>
                <p className="text-xs text-amber-700 mt-0.5">Telefon Eksik</p>
              </div>
            </div>

            {/* Eşleşen öğretmenlerin önizlemesi */}
            {parseResult.matched.length > 0 && (
              <div className="rounded-xl border bg-white/70 dark:bg-zinc-900/50 overflow-hidden">
                <p className="px-3 py-2 text-xs font-semibold text-emerald-700 border-b dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20">Eşleşen Öğretmenler</p>
                <div className="max-h-36 overflow-y-auto divide-y">
                  {parseResult.matched.slice(0, 8).map((t) => (
                    <div key={t.name} className="flex items-center gap-3 px-3 py-1.5">
                      <span className="flex-1 text-xs font-medium">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground">{maskTc(t.tc)}</span>
                      <span className="text-[10px] text-emerald-600">{t.phone?.slice(-4) ? '···' + t.phone.slice(-4) : ''}</span>
                    </div>
                  ))}
                  {parseResult.matched.length > 8 && <p className="px-3 py-1 text-[10px] text-muted-foreground">+ {parseResult.matched.length - 8} daha…</p>}
                </div>
              </div>
            )}

            {parseResult.unmatched.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Telefon eksik — Manuel girin</p>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-xl border bg-white/70 p-2 dark:bg-zinc-900/50">
                  {parseResult.unmatched.map((t) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-xs font-medium">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground">{maskTc(t.tc)}</span>
                      <div className="flex items-center gap-1">
                        <Phone className="size-3 text-muted-foreground" />
                        <Input
                          placeholder="+905XX..."
                          value={manualPhones[t.name] ?? ''}
                          onChange={(e) => setManualPhones((prev) => ({ ...prev, [t.name]: e.target.value }))}
                          className="h-7 w-32 text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('form')} className="gap-1.5">
                <Upload className="size-3.5" /> Yeniden Yükle
              </Button>
              <Button size="sm" className="ml-auto gap-1.5 bg-indigo-600 hover:bg-indigo-700" disabled={loading} onClick={createCampaign}>
                {loading ? <LoadingSpinner className="size-4" /> : <Send className="size-4" />}
                Kampanya Oluştur ({parseResult.matched.length + Object.values(manualPhones).filter(Boolean).length} kişi)
              </Button>
            </div>
          </div>
        )}

        {/* ADIM 3: Önizleme ve Gönderim */}
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
