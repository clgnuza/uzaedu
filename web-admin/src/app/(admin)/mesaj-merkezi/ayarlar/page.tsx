'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { msgQ } from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Save, Wifi } from 'lucide-react';

type Provider = 'mock' | 'meta' | 'twilio' | 'netgsm' | 'custom' | 'whatsapp_link';
type Settings = {
  provider: Provider; apiKey: string; apiSecret: string;
  phoneNumberId: string; fromNumber: string; apiEndpoint: string; isActive: boolean;
  extraConfig: { policyComplianceAck: boolean; waManualPolicyAck: boolean };
};

const PROVIDER_DOCS: Record<Provider, { label: string; helpUrl: string; fields: string[] }> = {
  mock:   { label: 'Test (Mock)',            helpUrl: '',                                                        fields: [] },
  meta:   { label: 'Meta Business API',      helpUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api', fields: ['apiKey', 'phoneNumberId'] },
  twilio: { label: 'Twilio WhatsApp',        helpUrl: 'https://www.twilio.com/en-us/whatsapp',                  fields: ['apiKey', 'apiSecret', 'fromNumber'] },
  netgsm: { label: 'Netgsm WhatsApp',        helpUrl: 'https://www.netgsm.com.tr/whatsapp-api',                 fields: ['apiKey', 'apiSecret'] },
  custom: { label: 'Özel API (HTTP POST)',   helpUrl: '',                                                        fields: ['apiKey', 'apiEndpoint'] },
  whatsapp_link: {
    label: 'WhatsApp Web (API yok)',
    helpUrl: '',
    fields: [],
  },
};

const FIELD_LABELS: Record<string, string> = {
  apiKey: 'API Anahtarı / Access Token',
  apiSecret: 'API Secret / Auth Token',
  phoneNumberId: 'Phone Number ID (Meta)',
  fromNumber: 'Gönderici Numara (+905XX...)',
  apiEndpoint: 'API Endpoint URL',
};

export default function AyarlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [form, setForm]       = useState<Settings>({
    provider: 'mock', apiKey: '', apiSecret: '', phoneNumberId: '', fromNumber: '', apiEndpoint: '', isActive: false,
    extraConfig: { policyComplianceAck: false, waManualPolicyAck: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const s = await apiFetch<Settings & { extraConfig?: Record<string, unknown> } | null>(`/messaging/settings${q}`, { token });
        if (s) {
          const ex = s.extraConfig ?? {};
          setForm((f) => ({
            ...f,
            ...s,
            extraConfig: {
              policyComplianceAck: ex.policyComplianceAck === true,
              waManualPolicyAck: ex.waManualPolicyAck === true,
            },
          }));
        }
      } catch { /* 404 = no settings yet */ }
      finally { setLoading(false); }
    })();
  }, [token, q]);

  const save = async () => {
    setSaving(true);
    try {
      const s = (v: string | null | undefined) => (v == null ? '' : String(v));
      await apiFetch(`/messaging/settings${q}`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          provider: form.provider,
          apiKey: s(form.apiKey),
          apiSecret: s(form.apiSecret),
          phoneNumberId: s(form.phoneNumberId),
          fromNumber: s(form.fromNumber),
          apiEndpoint: s(form.apiEndpoint),
          isActive: form.isActive,
          extraConfig: {
            policyComplianceAck: form.extraConfig.policyComplianceAck,
            waManualPolicyAck: form.extraConfig.waManualPolicyAck,
          },
        }),
      });
      toast.success('Ayarlar kaydedildi');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSaving(false); }
  };

  const test = async () => {
    if (!testPhone.trim()) return toast.error('Test numarası gerekli');
    setTesting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(`/messaging/settings/test${q}`, { method: 'POST', token, body: JSON.stringify({ testPhone: testPhone.trim() }) });
      if (res.ok) {
        if (form.provider === 'whatsapp_link') {
          const m = res.message.match(/(https:\/\/wa\.me\/[^\s]+)/);
          if (m) window.open(m[1], '_blank', 'noopener,noreferrer');
          toast.success(
            m
              ? 'wa.me açıldı. Bu modda sunucudan mesaj gitmez; sohbeti WhatsApp’ta siz başlatırsınız.'
              : res.message,
          );
        } else {
          toast.success(`✅ Bağlantı başarılı: ${res.message}`);
        }
      } else toast.error(`❌ ${res.message}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setTesting(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const provDoc = PROVIDER_DOCS[form.provider];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-4">
        <p className="font-bold">WhatsApp Entegrasyon Ayarları</p>

        {/* Sağlayıcı seçimi */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">WhatsApp Sağlayıcısı</label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(PROVIDER_DOCS) as Provider[]).map((p) => (
              <button key={p} onClick={() => setForm((f) => ({ ...f, provider: p }))}
                className={`rounded-xl border py-2 px-3 text-xs font-semibold transition-colors ${form.provider === p ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-input bg-white/60 hover:bg-indigo-50 dark:bg-zinc-900/50'}`}>
                {PROVIDER_DOCS[p].label}
              </button>
            ))}
          </div>
          {provDoc.helpUrl && (
            <a href={provDoc.helpUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-indigo-600 underline dark:text-indigo-400">
              {provDoc.label} Dokümantasyonu →
            </a>
          )}
        </div>

        {/* Sağlayıcı özel alanlar */}
        {provDoc.fields.length > 0 && (
          <div className="space-y-3">
            {provDoc.fields.map((field) => (
              <div key={field}>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">{FIELD_LABELS[field]}</label>
                <Input
                  type={field.toLowerCase().includes('secret') || field.toLowerCase().includes('key') ? 'password' : 'text'}
                  value={(form as unknown as Record<string, string>)[field] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  placeholder={FIELD_LABELS[field]}
                />
              </div>
            ))}
          </div>
        )}

        {/* Aktif/Pasif */}
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/40">
          <div className={`relative h-5 w-9 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-slate-300 dark:bg-zinc-600'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm font-semibold">{form.isActive ? '✅ Entegrasyon Aktif' : '⏸ Entegrasyon Pasif'}</span>
          <input type="checkbox" className="sr-only" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
        </label>

        {form.isActive && ['meta', 'twilio', 'netgsm', 'custom'].includes(form.provider) ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.extraConfig.policyComplianceAck}
              onChange={(e) => setForm((f) => ({
                ...f,
                extraConfig: { ...f.extraConfig, policyComplianceAck: e.target.checked },
              }))}
            />
            <span className="text-xs leading-relaxed text-amber-950 dark:text-amber-100">
              Okul olarak WhatsApp Business Platform / ilgili sağlayıcı koşullarını okuduk:{' '}
              <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noreferrer" className="font-semibold underline">
                WhatsApp Business Policy
              </a>
              ,{' '}
              <a href="https://developers.facebook.com/docs/whatsapp/overview" target="_blank" rel="noreferrer" className="font-semibold underline">
                Geliştirici kuralları
              </a>
              . Yalnızca meşru ve izinli iletişim için kullanacağız.
            </span>
          </label>
        ) : null}

        {form.isActive && form.provider === 'whatsapp_link' ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.extraConfig.waManualPolicyAck}
              onChange={(e) => setForm((f) => ({
                ...f,
                extraConfig: { ...f.extraConfig, waManualPolicyAck: e.target.checked },
              }))}
            />
            <span className="text-xs leading-relaxed text-amber-950 dark:text-amber-100">
              wa.me ile manuel gönderimde veli/alıcıdan iletişim izni ve{' '}
              <a href="https://www.kvkk.gov.tr/" target="_blank" rel="noreferrer" className="font-semibold underline">
                KVKK
              </a>
              {' '}yükümlülüklerine uyacağımızı beyan ederiz.
            </span>
          </label>
        ) : null}

        <Button className="w-full gap-1.5" disabled={saving} onClick={save}>
          {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
          Kaydet
        </Button>
      </div>

      {/* Bağlantı testi */}
      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-3">
        <p className="font-bold">Bağlantı Testi</p>
        <p className="text-xs text-muted-foreground">
          {form.provider === 'whatsapp_link'
            ? 'API yok: test sunucudan mesaj göndermez; wa.me açılır, gönderimi WhatsApp’ta siz yaparsınız.'
            : 'Ayarları kaydettikten sonra test mesajı gönderin.'}
        </p>
        <div className="flex gap-2">
          <Input placeholder="Test telefon (+905XXXXXXXXX)" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          <Button variant="outline" className="gap-1.5 shrink-0" disabled={testing} onClick={test}>
            {testing ? <LoadingSpinner className="size-4" /> : <Wifi className="size-4" />}
            Test
          </Button>
        </div>
      </div>

      {/* Kılavuz */}
      <div className="rounded-2xl border border-indigo-200/50 bg-indigo-50/50 p-4 dark:border-indigo-800/30 dark:bg-indigo-950/20 space-y-2">
        <p className="font-semibold text-sm text-indigo-900 dark:text-indigo-100">Hızlı Kurulum Kılavuzu</p>
        <div className="space-y-1.5 text-xs text-indigo-800 dark:text-indigo-200">
          <p><strong>Mock (Test):</strong> Gerçek gönderim yoktur; geliştirme ortamı için idealdir.</p>
          <p><strong>Meta Business API:</strong> Meta Developer Console → WhatsApp → API Setup → Access Token + Phone Number ID</p>
          <p><strong>Twilio:</strong> Twilio Console → Account SID (API Key) + Auth Token + WhatsApp sandbox numarası</p>
          <p><strong>Netgsm:</strong> Netgsm panelinden WhatsApp Business API paketi alınır; Kullanıcı adı = API Key, Şifre = Secret</p>
          <p><strong>Özel API:</strong> Kendi WhatsApp gateway'inizin POST endpoint'ini girin. Body: {`{ to, text }`}</p>
          <p>
            <strong>WhatsApp Web (API yok):</strong> Meta/Twilio/Netgsm anahtarı gerekmez. Kampanya ekranında her alıcı için{' '}
            <code className="rounded bg-indigo-100 px-1 dark:bg-indigo-900/50">wa.me</code> bağlantısı açılır; gönderimi WhatsApp Web veya telefondaki uygulamada siz yaparsınız (sunucudan toplu otomatik gönderim yok). WAMS, WARocket, Prime Sender gibi Chrome eklentilerinde de ayrı API ayarı yoktur: toplu gönderim, açık WhatsApp Web oturumunuza{' '}
            <em>browser automation</em> (tarayıcı otomasyonu) ile mümkün olur — bu uygulama ise oturumu otomatikleştirmez, yalnızca hazır metin ve numara ile{' '}
            <code className="rounded bg-indigo-100 px-1 dark:bg-indigo-900/50">wa.me</code> üretir. İletişim izni ve{' '}
            <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" rel="noreferrer" className="underline">
              WhatsApp Business Policy
            </a>
            /KVKK sorumluluğu okuldadır.
          </p>
        </div>
      </div>
    </div>
  );
}
