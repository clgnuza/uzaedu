'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT } from './web-settings-shell';

type MailConfigForAdmin = {
  mail_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string | null;
  smtp_from: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  mail_app_base_url: string | null;
  contact_form_notify_email: string | null;
};

/** Gizli alan yok; kullanıcı/uygulama şifresi elle girilir. */
function buildGmailTemplateForm(origin: string): Record<string, string | number | boolean | null> {
  return {
    mail_enabled: true,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_from_name: 'Uzaedu Öğretmen',
    mail_app_base_url: origin.replace(/\/$/, ''),
  };
}

export function MailSettingsPanel() {
  const { token, me } = useAuth();
  const [config, setConfig] = useState<MailConfigForAdmin | null>(null);
  const [form, setForm] = useState<Record<string, string | number | boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const didAutofillGmailRef = useRef(false);

  const handleChange = (key: string, value: string | number | boolean | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fetchConfig = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    try {
      const data = await apiFetch<MailConfigForAdmin>('/app-config/mail', { token });
      setConfig(data);
    } catch (e) {
      setConfig(null);
      toast.error(e instanceof Error ? e.message : 'Mail ayarları yüklenemedi');
    }
  }, [token, me?.role]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /** İlk yüklemede DB’de SMTP boşsa Gmail şablonunu forma yazar (Kaydet ile kalıcı). */
  useEffect(() => {
    if (!config || didAutofillGmailRef.current) return;
    if (config.smtp_host?.trim()) return;
    didAutofillGmailRef.current = true;
    if (typeof window === 'undefined') return;
    setForm((prev) => ({ ...buildGmailTemplateForm(window.location.origin), ...prev }));
  }, [config]);

  const applyGmailTemplate = () => {
    if (typeof window === 'undefined') return;
    setForm((prev) => ({ ...prev, ...buildGmailTemplateForm(window.location.origin) }));
  };

  const handleSave = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        mail_enabled: form.mail_enabled ?? config?.mail_enabled ?? false,
        smtp_host: (form.smtp_host ?? config?.smtp_host ?? '').toString().trim() || null,
        smtp_port: form.smtp_port ?? config?.smtp_port ?? 587,
        smtp_user: (form.smtp_user ?? config?.smtp_user ?? '').toString().trim() || null,
        smtp_from: (form.smtp_from ?? config?.smtp_from ?? '').toString().trim() || null,
        smtp_from_name: (form.smtp_from_name ?? config?.smtp_from_name ?? 'Uzaedu Öğretmen').toString().trim() || null,
        smtp_secure: form.smtp_secure ?? config?.smtp_secure ?? false,
        mail_app_base_url: (form.mail_app_base_url ?? config?.mail_app_base_url ?? '').toString().trim() || null,
        contact_form_notify_email:
          (form.contact_form_notify_email ?? config?.contact_form_notify_email ?? '').toString().trim() || null,
      };
      if ((form.smtp_pass ?? '').toString().trim()) {
        (body as Record<string, string>).smtp_pass = form.smtp_pass!.toString().trim();
      }
      await apiFetch('/app-config/mail', { method: 'PATCH', token, body: JSON.stringify(body) });
      toast.success('Mail ayarları kaydedildi');
      setForm({});
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setTesting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/app-config/mail/test', {
        method: 'POST',
        token,
      });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'SMTP test edilemedi');
    } finally {
      setTesting(false);
    }
  };

  if (me?.role !== 'superadmin') return null;

  return (
    <WebSettingsPanel
      icon={Mail}
      title="Mail (SMTP)"
      description="Bildirim, şifre sıfırlama ve iletişim yanıtları. İletişim yanıtı e-postaları gönderen adı (Gönderen adı), imza (yanıtlayan moderatör) ve konu + alıntı ile gider. Gmail: smtp.gmail.com, 587, güvenli kapalı."
    >
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground/90">
        <input
          type="checkbox"
          checked={!!(form.mail_enabled ?? config?.mail_enabled ?? false)}
          onChange={(e) => handleChange('mail_enabled', e.target.checked)}
          className="size-4 rounded border-input"
        />
        E-posta bildirimlerini aç
      </label>
      <div className="grid gap-5 sm:grid-cols-2">
        <WebSettingsField label="SMTP sunucu" htmlFor="smtp-host">
          <Input
            id="smtp-host"
            type="text"
            className={WEB_SETTINGS_INPUT}
            value={String(form.smtp_host ?? config?.smtp_host ?? '')}
            onChange={(e) => handleChange('smtp_host', e.target.value)}
            placeholder="smtp.gmail.com"
          />
        </WebSettingsField>
        <WebSettingsField label="Port" htmlFor="smtp-port">
          <Input
            id="smtp-port"
            type="number"
            min={1}
            max={65535}
            className={WEB_SETTINGS_INPUT}
            value={Number(form.smtp_port ?? config?.smtp_port ?? 587)}
            onChange={(e) => handleChange('smtp_port', parseInt(e.target.value, 10) || 587)}
            placeholder="587"
          />
        </WebSettingsField>
        <WebSettingsField label="Kullanıcı" htmlFor="smtp-user">
          <Input
            id="smtp-user"
            type="text"
            className={WEB_SETTINGS_INPUT}
            value={String(form.smtp_user ?? config?.smtp_user ?? '')}
            onChange={(e) => handleChange('smtp_user', e.target.value)}
            placeholder="tam@gmail.com (Gmail adresi)"
          />
        </WebSettingsField>
        <WebSettingsField label="Şifre" hint="Değiştirmek için yeni girin." htmlFor="smtp-pass">
          <Input
            id="smtp-pass"
            type="password"
            className={WEB_SETTINGS_INPUT}
            value={String(form.smtp_pass ?? '')}
            onChange={(e) => handleChange('smtp_pass', e.target.value)}
            placeholder={config?.smtp_pass ? '••••••••' : 'Google uygulama şifresi'}
          />
        </WebSettingsField>
        <WebSettingsField label="Gönderen adresi" htmlFor="smtp-from">
          <Input
            id="smtp-from"
            type="email"
            className={WEB_SETTINGS_INPUT}
            value={String(form.smtp_from ?? config?.smtp_from ?? '')}
            onChange={(e) => handleChange('smtp_from', e.target.value)}
            placeholder="çoğu zaman kullanıcı ile aynı Gmail"
          />
        </WebSettingsField>
        <WebSettingsField label="Gönderen adı" htmlFor="smtp-from-name">
          <Input
            id="smtp-from-name"
            type="text"
            className={WEB_SETTINGS_INPUT}
            value={String(form.smtp_from_name ?? config?.smtp_from_name ?? 'Uzaedu Öğretmen')}
            onChange={(e) => handleChange('smtp_from_name', e.target.value)}
            placeholder="Uzaedu Öğretmen"
          />
        </WebSettingsField>
        <div className="sm:col-span-2">
          <WebSettingsField label="Web panel taban URL" hint="E-postadaki linkler için." htmlFor="mail-app-base-url">
            <Input
              id="mail-app-base-url"
              type="url"
              className={WEB_SETTINGS_INPUT}
              value={String(form.mail_app_base_url ?? config?.mail_app_base_url ?? '')}
              onChange={(e) => handleChange('mail_app_base_url', e.target.value)}
              placeholder="http://localhost:3000 veya https://uzaedu.com"
            />
          </WebSettingsField>
        </div>
        <div className="sm:col-span-2">
          <WebSettingsField
            label="İletişim formu bildirim e-postası"
            hint="Form gönderildiğinde kopyanın gideceği adres. Boşsa sunucu varsayılanı."
            htmlFor="contact-form-notify-email"
          >
            <Input
              id="contact-form-notify-email"
              type="email"
              className={WEB_SETTINGS_INPUT}
              value={String(form.contact_form_notify_email ?? config?.contact_form_notify_email ?? '')}
              onChange={(e) => handleChange('contact_form_notify_email', e.target.value)}
              placeholder="ornek@gmail.com"
            />
          </WebSettingsField>
        </div>
      </div>
      <div className="space-y-1">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={!!(form.smtp_secure ?? config?.smtp_secure ?? false)}
            onChange={(e) => handleChange('smtp_secure', e.target.checked)}
            className="size-4 rounded border-input"
          />
          Doğrudan SSL (SMTPS, çoğunlukla port 465)
        </label>
        <p className="pl-7 text-[11px] leading-snug text-muted-foreground">
          Port <strong className="text-foreground">587</strong> için işaretlemeyin — STARTTLS kullanılır (Gmail vb.). İşaretli + 587 bağlantı hatası verir.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/30 pt-4">
        <Button type="button" variant="secondary" className="rounded-xl" onClick={applyGmailTemplate}>
          Gmail şablonunu doldur
        </Button>
        <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={handleTest} disabled={testing}>
          {testing ? 'Test…' : 'SMTP test'}
        </Button>
        <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
        </div>
      </div>
    </WebSettingsPanel>
  );
}
