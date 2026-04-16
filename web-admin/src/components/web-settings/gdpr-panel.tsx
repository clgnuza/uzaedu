'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Eye, ToggleLeft, Mail, FileText, Gauge, ShieldCheck, Palette } from 'lucide-react';
import { GdprBannerPreview } from './gdpr-banner-preview';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GdprPublic } from '@/lib/gdpr-public';
import { buildGdprBannerExampleHtml } from '@/lib/gdpr-banner-example';
import { GDPR_BANNER_VISUALS, normalizeGdprBannerVisual } from '@/lib/gdpr-banner-visual';
import {
  WebSettingsField,
  WebSettingsPanel,
  WebSettingsSection,
  WEB_SETTINGS_INPUT,
  WEB_SETTINGS_TEXTAREA,
} from './web-settings-shell';

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
  cookie_banner_visual: 'gradient',
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
        'flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 bg-muted/20 p-3.5 transition-colors hover:bg-muted/35 sm:items-center sm:justify-between sm:gap-4 sm:p-4',
        'dark:bg-muted/10 dark:hover:bg-muted/20',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{description}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-checked={checked}
        className="mt-0.5 size-4 shrink-0 rounded-md border-border text-primary accent-primary sm:mt-0 sm:size-5"
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
      setForm({
        ...empty,
        ...data,
        cookie_banner_visual: normalizeGdprBannerVisual(data.cookie_banner_visual),
      });
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
      icon={ShieldCheck}
      title="Çerez ve rıza (KVKK / GDPR)"
      description="Kamuya açık site ile aynı kart düzeni. Görünüm şablonu canlı şeritte kullanılır; API: GET /content/gdpr."
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-6">
          <WebSettingsSection
            icon={Palette}
            title="1 · Görünüm şablonu"
            description="Kamu sitesindeki çerez şeridinin çerçeve ve üst şerit stili. Kaydet ile yayınlanır."
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {GDPR_BANNER_VISUALS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, cookie_banner_visual: opt.id }))}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition-colors',
                    form.cookie_banner_visual === opt.id
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                      : 'border-border/55 bg-muted/15 hover:bg-muted/28',
                  )}
                >
                  <span className="block text-[13px] font-medium text-foreground">{opt.label}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          </WebSettingsSection>

          <WebSettingsSection
            icon={Eye}
            title="2 · Canlı önizleme"
            description="Şablon ve metin anında yansır; kaydetmeden önce kontrol edin."
          >
            <GdprBannerPreview form={form} />
          </WebSettingsSection>

          <WebSettingsSection
            icon={ToggleLeft}
            title="3 · Görünürlük"
            description="Kamu sitesinde çerez şeridinin açılıp kapanması ve ret düğmesi."
          >
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
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
            </div>
          </WebSettingsSection>

          <WebSettingsSection
            icon={Mail}
            title="4 · İletişim ve kimlik"
            description="Bannerda görünebilecek veri sorumlusu ve başvuru adresi."
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>
          </WebSettingsSection>

          <WebSettingsSection
            icon={FileText}
            title="5 · İçerik ve bağlantı"
            description="Başlık, düğme etiketleri, çerez politikası yolu ve isteğe bağlı HTML gövde."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <WebSettingsField
                label="Banner başlığı"
                hint="Mobil üst satır. Boş: Çerez tercihleri"
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
                  Boşsa sitede politikalara uyumlu küçük punto varsayılan metin kullanılır. Yayın öncesi hukuk onayı
                  önerilir.
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
                  Örnek metni yükle
                </Button>
              </div>
              <textarea
                id="gdpr-body"
                className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[100px] font-mono text-[12px] leading-relaxed')}
                value={form.cookie_banner_body_html ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, cookie_banner_body_html: e.target.value || null }))}
                placeholder='<p>…</p>'
              />
            </WebSettingsField>
          </WebSettingsSection>

          <WebSettingsSection
            icon={Gauge}
            title="6 · Teknik"
            description="Kamu uç noktası önbelleği (saniye)."
          >
            <WebSettingsField label="GET /content/gdpr önbellek (sn)" htmlFor="gdpr-ttl">
              <Input
                id="gdpr-ttl"
                type="number"
                min={10}
                max={86400}
                className={cn(WEB_SETTINGS_INPUT, 'sm:max-w-xs')}
                value={form.cache_ttl_gdpr}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cache_ttl_gdpr: Math.min(86400, Math.max(10, parseInt(e.target.value, 10) || f.cache_ttl_gdpr)),
                  }))
                }
              />
            </WebSettingsField>
          </WebSettingsSection>

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
