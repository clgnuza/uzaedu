'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import {
  msgQ,
  parseSmsFromExtra,
  DEFAULT_SMS_SETTINGS,
  type SmsSettingsForm,
} from '@/lib/messaging-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Save, Wifi, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type WaProvider = 'mock' | 'meta' | 'twilio' | 'netgsm' | 'custom';
type WaSettings = {
  provider: WaProvider; apiKey: string; apiSecret: string;
  phoneNumberId: string; fromNumber: string; apiEndpoint: string; isActive: boolean;
  extraConfig: {
    policyComplianceAck: boolean;
    send_delay_ms?: number;
    send_max_retries?: number;
    requireTeacherApproval?: boolean;
    sms?: Record<string, unknown>;
  };
};

const WA_PROVIDERS: Record<WaProvider, { label: string; helpUrl: string; fields: string[] }> = {
  mock:   { label: 'Test (Mock)',            helpUrl: '', fields: [] },
  meta:   { label: 'Meta Business API',      helpUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api', fields: ['apiKey', 'phoneNumberId'] },
  twilio: { label: 'Twilio WhatsApp',        helpUrl: 'https://www.twilio.com/en-us/whatsapp', fields: ['apiKey', 'apiSecret', 'fromNumber'] },
  netgsm: { label: 'Netgsm WhatsApp',        helpUrl: 'https://www.netgsm.com.tr/whatsapp-api', fields: ['apiKey', 'apiSecret'] },
  custom: { label: 'Özel API (HTTP POST)',   helpUrl: '', fields: ['apiKey', 'apiEndpoint'] },
};

const FIELD_LABELS: Record<string, string> = {
  apiKey: 'API Anahtarı / Access Token',
  apiSecret: 'API Secret / Auth Token',
  phoneNumberId: 'Phone Number ID (Meta)',
  fromNumber: 'Gönderici Numara (+905XX...)',
  apiEndpoint: 'API Endpoint URL',
};

type Tab = 'whatsapp' | 'sms';

export default function AyarlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const q = msgQ(me?.role, searchParams.get('school_id'));

  const [tab, setTab] = useState<Tab>('whatsapp');
  const [wa, setWa] = useState<WaSettings>({
    provider: 'mock', apiKey: '', apiSecret: '', phoneNumberId: '', fromNumber: '', apiEndpoint: '', isActive: false,
    extraConfig: { policyComplianceAck: false, send_delay_ms: 600, send_max_retries: 1, requireTeacherApproval: false },
  });
  const [sms, setSms] = useState<SmsSettingsForm>(DEFAULT_SMS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const s = await apiFetch<(WaSettings & { extraConfig?: Record<string, unknown> }) | null>(
          `/messaging/settings${q}`,
          { token },
        );
        if (s) {
          const ex = s.extraConfig ?? {};
          const rawProv = String(s.provider ?? 'mock');
          const legacyLink = rawProv === 'whatsapp_link';
          const prov = (legacyLink ? 'mock' : rawProv) as WaProvider;
          setWa({
            ...s,
            provider: prov,
            isActive: legacyLink ? false : s.isActive,
            extraConfig: {
              policyComplianceAck: ex.policyComplianceAck === true,
              send_delay_ms: Math.min(15000, Math.max(200, Number(ex.send_delay_ms) || 600)),
              send_max_retries: Math.min(4, Math.max(0, Number(ex.send_max_retries) || 1)),
              requireTeacherApproval: ex.requireTeacherApproval === true,
            },
          });
          const parsed = parseSmsFromExtra(ex);
          setSms(parsed);
          if (parsed.header) setSms((prev) => ({ ...prev, header: parsed.header }));
        }
      } catch { /* yok */ }
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
          provider: wa.provider,
          apiKey: s(wa.apiKey),
          apiSecret: s(wa.apiSecret),
          phoneNumberId: s(wa.phoneNumberId),
          fromNumber: s(wa.fromNumber),
          apiEndpoint: s(wa.apiEndpoint),
          isActive: wa.isActive,
          extraConfig: {
            policyComplianceAck: wa.extraConfig.policyComplianceAck,
            send_delay_ms: wa.extraConfig.send_delay_ms ?? 600,
            send_max_retries: wa.extraConfig.send_max_retries ?? 1,
            requireTeacherApproval: wa.extraConfig.requireTeacherApproval === true,
            sms: {
              provider: sms.provider,
              usercode: sms.usercode.trim(),
              password: sms.password,
              header: sms.header.trim().slice(0, 11),
              isActive: sms.isActive,
              iys: sms.iys,
              iysList: sms.iysList,
              encoding: sms.encoding,
              commercialAck: sms.commercialAck,
            },
          },
        }),
      });
      toast.success('Ayarlar kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setSaving(false);
    }
  };

  const testWa = async () => {
    if (!testPhone.trim()) return toast.error('Test numarası gerekli');
    setTesting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(`/messaging/settings/test${q}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ testPhone: testPhone.trim() }),
      });
      if (res.ok) toast.success(`WhatsApp: ${res.message}`);
      else toast.error(`WhatsApp: ${res.message}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setTesting(false);
    }
  };

  const testSms = async () => {
    if (!testPhone.trim()) return toast.error('Test numarası gerekli');
    setTesting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>(`/messaging/settings/sms/test${q}`, {
        method: 'POST',
        token,
        body: JSON.stringify({ testPhone: testPhone.trim() }),
      });
      if (res.ok) toast.success(`SMS: ${res.message}`);
      else toast.error(`SMS: ${res.message}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const waDoc = WA_PROVIDERS[wa.provider];
  const apiBase = resolveDefaultApiBase().replace(/\/$/, '');
  const metaWebhook = `${apiBase}/messaging/webhooks/meta`;
  const twilioWebhook = `${apiBase}/messaging/webhooks/twilio`;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        {(['whatsapp', 'sms'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              tab === t ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-zinc-800',
            )}
          >
            {t === 'whatsapp' ? 'WhatsApp API' : 'SMS (Netgsm)'}
          </button>
        ))}
      </div>

      {tab === 'whatsapp' ? (
        <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-4">
          <p className="font-bold">WhatsApp Business API</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(WA_PROVIDERS) as WaProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setWa((f) => ({ ...f, provider: p }))}
                className={cn(
                  'rounded-xl border py-2 px-3 text-xs font-semibold',
                  wa.provider === p ? 'border-indigo-400 bg-indigo-600 text-white' : 'border-input bg-white/60 dark:bg-zinc-900/50',
                )}
              >
                {WA_PROVIDERS[p].label}
              </button>
            ))}
          </div>
          {waDoc.helpUrl ? (
            <a href={waDoc.helpUrl} target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 underline">
              Dokümantasyon →
            </a>
          ) : null}
          {waDoc.fields.map((field) => (
            <div key={field}>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">{FIELD_LABELS[field]}</label>
              <Input
                type={field.includes('secret') || field.includes('Key') ? 'password' : 'text'}
                value={(wa as unknown as Record<string, string>)[field] ?? ''}
                onChange={(e) => setWa((f) => ({ ...f, [field]: e.target.value }))}
              />
            </div>
          ))}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3">
            <input type="checkbox" checked={wa.isActive} onChange={(e) => setWa((f) => ({ ...f, isActive: e.target.checked }))} />
            <span className="text-sm font-semibold">{wa.isActive ? 'WhatsApp aktif' : 'WhatsApp pasif'}</span>
          </label>
          {wa.isActive && ['meta', 'twilio', 'netgsm', 'custom'].includes(wa.provider) ? (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs">
              <input
                type="checkbox"
                checked={wa.extraConfig.policyComplianceAck}
                onChange={(e) => setWa((f) => ({ ...f, extraConfig: { ...f.extraConfig, policyComplianceAck: e.target.checked } }))}
              />
              <span>WhatsApp Business Policy onayı</span>
            </label>
          ) : null}
          <label className="flex items-start gap-3 rounded-xl border px-4 py-3 text-xs">
            <input
              type="checkbox"
              checked={wa.extraConfig.requireTeacherApproval === true}
              onChange={(e) => setWa((f) => ({ ...f, extraConfig: { ...f.extraConfig, requireTeacherApproval: e.target.checked } }))}
            />
            <span>Öğretmen kampanyaları gönderimden önce yönetici onayı gerektirsin</span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Bekleme (ms)</label>
              <Input type="number" min={200} max={15000} value={wa.extraConfig.send_delay_ms ?? 600}
                onChange={(e) => setWa((f) => ({ ...f, extraConfig: { ...f.extraConfig, send_delay_ms: Number(e.target.value) || 600 } }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Yeniden deneme</label>
              <Input type="number" min={0} max={4} value={wa.extraConfig.send_max_retries ?? 1}
                onChange={(e) => setWa((f) => ({ ...f, extraConfig: { ...f.extraConfig, send_max_retries: Math.min(4, Math.max(0, Number(e.target.value) || 0)) } }))} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-4">
          <p className="font-bold flex items-center gap-2">
            <MessageSquare className="size-5 text-sky-600" />
            Başlıklı SMS (Netgsm)
          </p>
          <p className="text-xs text-muted-foreground">
            Netgsm panelinden API alt kullanıcısı ve BTK onaylı gönderici adı (başlık) gerekir. Veli bilgilendirme için İYS önerilir.
          </p>
          <div className="flex gap-2">
            {(['netgsm', 'mock'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSms((f) => ({ ...f, provider: p }))}
                className={cn(
                  'rounded-xl border py-2 px-4 text-xs font-semibold',
                  sms.provider === p ? 'border-sky-500 bg-sky-600 text-white' : 'border-input',
                )}
              >
                {p === 'netgsm' ? 'Netgsm' : 'Test (Mock)'}
              </button>
            ))}
          </div>
          {sms.provider === 'netgsm' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">Netgsm kullanıcı adı (abone no, 0’sız)</label>
                <Input value={sms.usercode} onChange={(e) => setSms((f) => ({ ...f, usercode: e.target.value }))} placeholder="850xxxxxxx" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">API şifresi</label>
                <Input type="password" value={sms.password} onChange={(e) => setSms((f) => ({ ...f, password: e.target.value }))} placeholder="Değiştirmemek için boş bırakın" />
              </div>
            </>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Varsayılan SMS başlığı (max 11 karakter)</label>
            <Input
              maxLength={11}
              value={sms.header}
              onChange={(e) => setSms((f) => ({ ...f, header: e.target.value.toUpperCase() }))}
              placeholder="OKULADI"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3">
            <input type="checkbox" checked={sms.isActive} onChange={(e) => setSms((f) => ({ ...f, isActive: e.target.checked }))} />
            <span className="text-sm font-semibold">{sms.isActive ? 'SMS aktif' : 'SMS pasif'}</span>
          </label>
          <label className="flex items-start gap-3 rounded-xl border px-4 py-3 text-xs">
            <input type="checkbox" checked={sms.iys} onChange={(e) => setSms((f) => ({ ...f, iys: e.target.checked }))} />
            <span>İYS kontrollü gönderim (ticari / veli SMS için önerilir)</span>
          </label>
          {sms.iys ? (
            <div className="flex gap-2">
              {(['BIREYSEL', 'TACIR'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSms((f) => ({ ...f, iysList: v }))}
                  className={cn('rounded-lg border px-3 py-1 text-xs font-semibold', sms.iysList === v && 'bg-sky-100 border-sky-400')}
                >
                  {v}
                </button>
              ))}
            </div>
          ) : null}
          <label className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-xs">
            <input
              type="checkbox"
              checked={sms.commercialAck}
              onChange={(e) => setSms((f) => ({ ...f, commercialAck: e.target.checked }))}
            />
            <span>6563 / İYS uyumlu ticari SMS gönderimi için okul olarak onaylıyoruz.</span>
          </label>
        </div>
      )}

      <Button className="w-full gap-1.5" disabled={saving} onClick={save}>
        {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
        Tüm ayarları kaydet
      </Button>

      {(wa.provider === 'meta' || wa.provider === 'twilio') && (
        <div className="rounded-2xl border border-blue-200/70 bg-blue-50/40 p-4 text-xs dark:border-blue-900/50 dark:bg-blue-950/30 space-y-2">
          <p className="font-bold text-sm">Webhook (iletim + gelen mesaj)</p>
          {wa.provider === 'meta' && (
            <>
              <p>
                Meta Developer → WhatsApp → Configuration → Callback URL:
                <code className="ml-1 break-all rounded bg-white/80 px-1 py-0.5 dark:bg-zinc-900">{metaWebhook}</code>
              </p>
              <p>Verify token: <code>META_WHATSAPP_VERIFY_TOKEN</code> (backend .env, varsayılan: uzaedu_meta_verify)</p>
              <p>İmza: <code>META_WHATSAPP_APP_SECRET</code> — X-Hub-Signature-256</p>
            </>
          )}
          {wa.provider === 'twilio' && (
            <p>
              Twilio mesaj durumu URL:
              <code className="ml-1 break-all rounded bg-white/80 px-1 py-0.5 dark:bg-zinc-900">{twilioWebhook}</code>
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-white/80 p-5 shadow-sm dark:bg-zinc-900/60 space-y-3">
        <p className="font-bold">Bağlantı testi</p>
        <div className="flex gap-2">
          <Input placeholder="+905XXXXXXXXX" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
          <Button variant="outline" disabled={testing} onClick={testWa}>
            {testing ? <LoadingSpinner className="size-4" /> : <Wifi className="size-4" />}
            WA
          </Button>
          <Button variant="outline" disabled={testing} onClick={testSms}>
            {testing ? <LoadingSpinner className="size-4" /> : <MessageSquare className="size-4" />}
            SMS
          </Button>
        </div>
      </div>
    </div>
  );
}
