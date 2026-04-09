'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ToggleLeft, Mail, FileText, Gauge, Eye } from 'lucide-react';
import { GdprBannerPreview } from './gdpr-banner-preview';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GdprPublic } from '@/lib/gdpr-public';
import { buildGdprBannerExampleHtml } from '@/lib/gdpr-banner-example';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT, WEB_SETTINGS_TEXTAREA } from './web-settings-shell';

const empty: GdprPublic = {
  cookie_banner_enabled: true,
  cookie_banner_title: null,
  accept_button_label: null,
  reject_button_label: null,
  cookie_banner_body_html: null,
  consent_version: '1',
  data_controller_name: null,
  dpo_email: null,
  cookie_policy_path: '/cerez',
  reject_button_visible: true,
  cache_ttl_gdpr: 120,
};

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 transition-colors hover:bg-muted/35 sm:items-center sm:justify-between sm:gap-4',
        'dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        className="mt-0.5 size-5 shrink-0 rounded-md border-border text-primary accent-primary sm:mt-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function GdprPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GdprPublic>(empty);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<GdprPublic>('/app-config/gdpr', { token });
      setForm({ ...empty, ...data });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'GDPR ayarları yüklenemedi.');
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
      await apiFetch('/app-config/gdpr', {
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

  return (
    <WebSettingsPanel
      icon={Shield}
      title="GDPR / çerez"
      description="Çerez bildirimi ve iletişim. Kamu: GET /content/gdpr"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-6 sm:space-y-8">
          <Card variant="indigo" soft className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                <Eye className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle>Canlı önizleme</CardTitle>
                <CardDescription className="mt-1">
                  Formdaki değişiklikler anında yansır; kaydetmeden önce kontrol edin.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <GdprBannerPreview form={form} />
            </CardContent>
          </Card>

          <Card variant="sky" soft className="overflow-hidden border-border/50 shadow-sm">
            <CardHeader className="space-y-1 pb-3 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ToggleLeft className="size-4" strokeWidth={2} />
                </div>
                <div>
                  <CardTitle>Görünürlük</CardTitle>
                  <CardDescription className="mt-1 max-w-xl">
                    Kamu sitesinde çerez çubuğunun davranışı
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 sm:grid-cols-2 sm:gap-4">
              <ToggleRow
                id="gdpr-banner-on"
                title="Çerez bildirimi"
                description="Ziyaretçilere altta şerit gösterilir."
                checked={form.cookie_banner_enabled}
                onChange={(v) => setForm((f) => ({ ...f, cookie_banner_enabled: v }))}
              />
              <ToggleRow
                id="gdpr-reject-on"
                title="Reddet seçeneği"
                description="Kabul dışında ret düğmesi gösterilir."
                checked={form.reject_button_visible}
                onChange={(v) => setForm((f) => ({ ...f, reject_button_visible: v }))}
              />
            </CardContent>
          </Card>

          <Card variant="lavender" soft className="border-border/50 shadow-sm">
            <CardHeader className="space-y-1 pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300">
                <Mail className="size-4" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <CardTitle>İletişim ve kimlik</CardTitle>
                <CardDescription className="mt-1">Banner üzerinde gösterilebilir alanlar</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-0 sm:grid-cols-2">
              <WebSettingsField
                label="Onay sürümü"
                hint="Artırıldığında kullanıcıdan yeniden onay istenir."
                htmlFor="gdpr-ver"
              >
                <Input
                  id="gdpr-ver"
                  className={WEB_SETTINGS_INPUT}
                  value={form.consent_version}
                  onChange={(e) => setForm((f) => ({ ...f, consent_version: e.target.value.trim().slice(0, 32) }))}
                  placeholder="1"
                />
              </WebSettingsField>
              <WebSettingsField label="Veri sorumlusu (görünen ad)" htmlFor="gdpr-dc">
                <Input
                  id="gdpr-dc"
                  className={WEB_SETTINGS_INPUT}
                  value={form.data_controller_name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, data_controller_name: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <div className="sm:col-span-2">
                <WebSettingsField label="KVKK / DPO e-posta" htmlFor="gdpr-dpo">
                  <Input
                    id="gdpr-dpo"
                    type="email"
                    className={WEB_SETTINGS_INPUT}
                    value={form.dpo_email ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, dpo_email: e.target.value.trim() || null }))}
                  />
                </WebSettingsField>
              </div>
            </CardContent>
          </Card>

          <Card variant="mint" soft className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-800 dark:text-emerald-300">
                <FileText className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle>İçerik ve bağlantı</CardTitle>
                <CardDescription className="mt-1">Metin ve çerez sayfası yolu</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <WebSettingsField
                  label="Banner başlığı"
                  hint="Mobil üst satır ve iletişim kutusu adı. Boş: Çerez tercihleri"
                  htmlFor="gdpr-banner-title"
                >
                  <Input
                    id="gdpr-banner-title"
                    className={WEB_SETTINGS_INPUT}
                    value={form.cookie_banner_title ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, cookie_banner_title: e.target.value.trim() || null }))
                    }
                    placeholder="Çerez tercihleri"
                    maxLength={120}
                  />
                </WebSettingsField>
                <WebSettingsField label="Kabul düğmesi" hint="Boş: Kabul et" htmlFor="gdpr-accept-lbl">
                  <Input
                    id="gdpr-accept-lbl"
                    className={WEB_SETTINGS_INPUT}
                    value={form.accept_button_label ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accept_button_label: e.target.value.trim() || null }))
                    }
                    placeholder="Kabul et"
                    maxLength={64}
                  />
                </WebSettingsField>
                <WebSettingsField label="Reddet düğmesi" hint="Boş: Reddet" htmlFor="gdpr-reject-lbl">
                  <Input
                    id="gdpr-reject-lbl"
                    className={WEB_SETTINGS_INPUT}
                    value={form.reject_button_label ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, reject_button_label: e.target.value.trim() || null }))
                    }
                    placeholder="Reddet"
                    maxLength={64}
                  />
                </WebSettingsField>
              </div>
              <WebSettingsField label="Çerez politikası path" hint="Örn. /cerez" htmlFor="gdpr-cookie-path">
                <Input
                  id="gdpr-cookie-path"
                  className={WEB_SETTINGS_INPUT}
                  value={form.cookie_policy_path}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cookie_policy_path: e.target.value.trim().replace(/\s/g, '') || '/cerez',
                    }))
                  }
                />
              </WebSettingsField>
              <WebSettingsField
                label="Banner metni (HTML, isteğe bağlı)"
                hint={
                  <>
                    Boşsa sitede GDPR/KVKK uyumlu varsayılan metin gösterilir. Aşağıdaki örnek şablondur; yayın öncesi hukuk
                    onayı önerilir.
                  </>
                }
                htmlFor="gdpr-body"
              >
                <div className="mb-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-xs"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        cookie_banner_body_html: buildGdprBannerExampleHtml(f.cookie_policy_path),
                      }))
                    }
                  >
                    Örnek GDPR metnini yükle
                  </Button>
                </div>
                <textarea
                  id="gdpr-body"
                  className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[120px] sm:min-h-[100px]')}
                  value={form.cookie_banner_body_html ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cookie_banner_body_html: e.target.value || null }))}
                  placeholder='<p><strong>Çerezler…</strong> <a href="/cerez">Çerez Politikası</a></p>'
                />
              </WebSettingsField>
            </CardContent>
          </Card>

          <Card variant="amber" soft className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 sm:flex-row sm:items-center sm:gap-3 sm:pb-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-600/10 text-amber-900 dark:text-amber-200">
                <Gauge className="size-4" strokeWidth={2} />
              </div>
              <div>
                <CardTitle>Teknik</CardTitle>
                <CardDescription className="mt-1">Kamu API önbelleği</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0 sm:max-w-xs">
              <WebSettingsField label="GET /content/gdpr önbellek (sn)" htmlFor="gdpr-ttl">
                <Input
                  id="gdpr-ttl"
                  type="number"
                  min={10}
                  max={86400}
                  className={WEB_SETTINGS_INPUT}
                  value={form.cache_ttl_gdpr}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cache_ttl_gdpr: Math.min(86400, Math.max(10, parseInt(e.target.value, 10) || f.cache_ttl_gdpr)),
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
