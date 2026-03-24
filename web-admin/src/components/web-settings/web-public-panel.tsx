'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT } from './web-settings-shell';

export type WebPublicConfig = {
  contact_email: string | null;
  contact_phone: string | null;
  footer_tagline: string | null;
  social_x: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_youtube: string | null;
  privacy_policy_url: string | null;
  terms_url: string | null;
};

const empty: WebPublicConfig = {
  contact_email: null,
  contact_phone: null,
  footer_tagline: null,
  social_x: null,
  social_facebook: null,
  social_instagram: null,
  social_youtube: null,
  privacy_policy_url: null,
  terms_url: null,
};

export function WebPublicPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WebPublicConfig>(empty);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<WebPublicConfig>('/app-config/web-public', { token });
      setForm({ ...empty, ...data });
    } catch {
      setForm(empty);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch('/app-config/web-public', {
        method: 'PATCH',
        token,
        body: JSON.stringify(form),
      });
      toast.success('Kaydedildi.');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof WebPublicConfig, v: string) => {
    setForm((f) => ({ ...f, [k]: v.trim() || null }));
  };

  return (
    <WebSettingsPanel
      icon={LayoutTemplate}
      title="Kamuya açık site"
      description="Footer, iletişim ve sosyal bağlantılar. GET /content/web-public ile yayın sayfası ve web istemcileri kullanır."
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <WebSettingsField label="İletişim e-posta" hint="İletişim bloklarında kullanılabilir." htmlFor="wp-email">
              <Input
                id="wp-email"
                type="email"
                className={WEB_SETTINGS_INPUT}
                value={form.contact_email ?? ''}
                onChange={(e) => set('contact_email', e.target.value)}
                placeholder="destek@ornek.com"
              />
            </WebSettingsField>
            <WebSettingsField label="Telefon" htmlFor="wp-phone">
              <Input
                id="wp-phone"
                type="tel"
                className={WEB_SETTINGS_INPUT}
                value={form.contact_phone ?? ''}
                onChange={(e) => set('contact_phone', e.target.value)}
                placeholder="+90 …"
              />
            </WebSettingsField>
          </div>
          <WebSettingsField
            label="Kısa slogan / alt satır"
            hint="Alt bilgi satırı için kısa metin."
            htmlFor="wp-tagline"
          >
            <Input
              id="wp-tagline"
              className={WEB_SETTINGS_INPUT}
              value={form.footer_tagline ?? ''}
              onChange={(e) => set('footer_tagline', e.target.value)}
              placeholder="Öğretmenler için dijital işler"
            />
          </WebSettingsField>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Sosyal bağlantılar</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <WebSettingsField label="X (Twitter)" htmlFor="wp-x">
              <Input
                id="wp-x"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.social_x ?? ''}
                onChange={(e) => set('social_x', e.target.value)}
                placeholder="https://x.com/…"
              />
            </WebSettingsField>
            <WebSettingsField label="Facebook" htmlFor="wp-fb">
              <Input
                id="wp-fb"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.social_facebook ?? ''}
                onChange={(e) => set('social_facebook', e.target.value)}
                placeholder="https://…"
              />
            </WebSettingsField>
            <WebSettingsField label="Instagram" htmlFor="wp-ig">
              <Input
                id="wp-ig"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.social_instagram ?? ''}
                onChange={(e) => set('social_instagram', e.target.value)}
                placeholder="https://…"
              />
            </WebSettingsField>
            <WebSettingsField label="YouTube" htmlFor="wp-yt">
              <Input
                id="wp-yt"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.social_youtube ?? ''}
                onChange={(e) => set('social_youtube', e.target.value)}
                placeholder="https://…"
              />
            </WebSettingsField>
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Yasal</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <WebSettingsField label="Gizlilik politikası URL" htmlFor="wp-privacy">
              <Input
                id="wp-privacy"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.privacy_policy_url ?? ''}
                onChange={(e) => set('privacy_policy_url', e.target.value)}
                placeholder="https://…"
              />
            </WebSettingsField>
            <WebSettingsField label="Kullanım şartları URL" htmlFor="wp-terms">
              <Input
                id="wp-terms"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.terms_url ?? ''}
                onChange={(e) => set('terms_url', e.target.value)}
                placeholder="https://…"
              />
            </WebSettingsField>
          </div>
          <div className="flex justify-end border-t border-border/30 pt-4">
            <Button type="button" onClick={save} disabled={saving} className="rounded-xl">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </>
      )}
    </WebSettingsPanel>
  );
}
