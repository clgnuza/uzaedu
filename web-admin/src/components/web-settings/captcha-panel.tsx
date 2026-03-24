'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, KeyRound, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CaptchaAdmin } from '@/lib/captcha-public';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT } from './web-settings-shell';

const MASK = '••••••••';

const empty: CaptchaAdmin = {
  enabled: false,
  provider: 'none',
  site_key: null,
  secret_key: null,
  v3_min_score: 0.5,
  protect_login: true,
  protect_register: true,
  protect_forgot_password: false,
  cache_ttl_captcha: 120,
};

const PROVIDERS: { value: CaptchaAdmin['provider']; label: string }[] = [
  { value: 'none', label: 'Kapalı' },
  { value: 'recaptcha_v2', label: 'Google reCAPTCHA v2 (checkbox)' },
  { value: 'recaptcha_v3', label: 'Google reCAPTCHA v3' },
  { value: 'turnstile', label: 'Cloudflare Turnstile' },
  { value: 'hcaptcha', label: 'hCaptcha' },
];

export function CaptchaPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CaptchaAdmin>(empty);
  const [secretInput, setSecretInput] = useState('');

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<CaptchaAdmin>('/app-config/captcha', { token });
      setForm({ ...empty, ...data });
      setSecretInput('');
    } catch {
      setForm(empty);
      setSecretInput('');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = async () => {
    if (!token) return;
    if (form.enabled && form.provider !== 'none' && !form.site_key?.trim()) {
      toast.error('CAPTCHA açıkken site key zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const { secret_key: _sk, ...rest } = form;
      void _sk;
      const body: Record<string, unknown> = { ...rest };
      if (secretInput.trim()) {
        body.secret_key = secretInput.trim();
      }
      await apiFetch('/app-config/captcha', {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      });
      toast.success('Kaydedildi.');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebSettingsPanel
      icon={Bot}
      title="CAPTCHA"
      description="Bot koruması (site + gizli anahtar). Kamu: GET /content/captcha — GET /content/web-extras içinde site key birleşimi."
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          <Card variant="sky" soft className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-800 dark:text-sky-200">
                <Shield className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle>Genel</CardTitle>
                <CardDescription className="mt-1">Sağlayıcı ve anahtarlar</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                />
                CAPTCHA etkin
              </label>
              <WebSettingsField label="Sağlayıcı" htmlFor="cap-prov">
                <select
                  id="cap-prov"
                  className={cn(WEB_SETTINGS_INPUT, 'bg-background')}
                  value={form.provider}
                  onChange={(e) => {
                    const v = e.target.value as CaptchaAdmin['provider'];
                    setForm((f) => ({
                      ...f,
                      provider: v,
                      ...(v === 'none' ? { enabled: false } : {}),
                    }));
                  }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </WebSettingsField>
              <WebSettingsField label="Site key (kamu)" htmlFor="cap-site">
                <Input
                  id="cap-site"
                  className={WEB_SETTINGS_INPUT}
                  value={form.site_key ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, site_key: e.target.value.trim() || null }))}
                  autoComplete="off"
                />
              </WebSettingsField>
              <div className="sm:col-span-2 space-y-2">
                <WebSettingsField
                  label="Gizli anahtar (sunucu)"
                  hint={
                    form.secret_key === MASK
                      ? 'Kayıtlı anahtar var. Değiştirmek için yeni değer yazın veya kaldırın.'
                      : 'İstemciye gönderilmez.'
                  }
                  htmlFor="cap-secret"
                >
                  <Input
                    id="cap-secret"
                    type="password"
                    className={WEB_SETTINGS_INPUT}
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                    placeholder={form.secret_key === MASK ? 'Yeni gizli anahtar…' : 'Gizli anahtar…'}
                    autoComplete="new-password"
                  />
                </WebSettingsField>
                {form.secret_key === MASK && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    disabled={saving}
                    onClick={async () => {
                      if (!token) return;
                      setSaving(true);
                      try {
                        await apiFetch('/app-config/captcha', {
                          method: 'PATCH',
                          token,
                          body: JSON.stringify({ secret_key: '' }),
                        });
                        toast.success('Gizli anahtar kaldırıldı.');
                        setSecretInput('');
                        fetchConfig();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'İşlem hatası.');
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Gizli anahtarı kaldır
                  </Button>
                )}
              </div>
              {form.provider === 'recaptcha_v3' && (
                <WebSettingsField
                  label="v3 minimum skor"
                  hint="0–1 (yalnızca skor tabanlı sağlayıcılar)"
                  htmlFor="cap-score"
                >
                  <Input
                    id="cap-score"
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    className={WEB_SETTINGS_INPUT}
                    value={form.v3_min_score}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        v3_min_score: Math.min(1, Math.max(0, parseFloat(e.target.value) || f.v3_min_score)),
                      }))
                    }
                  />
                </WebSettingsField>
              )}
            </CardContent>
          </Card>

          <Card variant="mint" soft className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-800 dark:text-emerald-300">
                <KeyRound className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle>Korumalı akışlar</CardTitle>
                <CardDescription className="mt-1">İstemci formlarında kullanım (uygulama desteği gerekir)</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:flex-wrap">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.protect_login}
                  onChange={(e) => setForm((f) => ({ ...f, protect_login: e.target.checked }))}
                />
                Giriş
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.protect_register}
                  onChange={(e) => setForm((f) => ({ ...f, protect_register: e.target.checked }))}
                />
                Kayıt
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.protect_forgot_password}
                  onChange={(e) => setForm((f) => ({ ...f, protect_forgot_password: e.target.checked }))}
                />
                Şifre sıfırlama
              </label>
            </CardContent>
          </Card>

          <Card variant="amber" soft className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600/10 text-amber-900 dark:text-amber-200">
                <Bot className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle>Önbellek</CardTitle>
                <CardDescription className="mt-1">GET /content/captcha</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0 sm:max-w-xs">
              <WebSettingsField label="TTL (sn)" htmlFor="cap-ttl">
                <Input
                  id="cap-ttl"
                  type="number"
                  min={10}
                  max={86400}
                  className={WEB_SETTINGS_INPUT}
                  value={form.cache_ttl_captcha}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cache_ttl_captcha: Math.min(86400, Math.max(10, parseInt(e.target.value, 10) || f.cache_ttl_captcha)),
                    }))
                  }
                />
              </WebSettingsField>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" size="lg" className="w-full rounded-xl sm:w-auto" onClick={save} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}
    </WebSettingsPanel>
  );
}
