'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { OGRETMEN_PRO_GUEST_SHELL_NAV } from '@/lib/guest-web-shell-preset';
import type { WebExtrasPublic } from '@/lib/web-extras-public';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT, WEB_SETTINGS_TEXTAREA } from './web-settings-shell';

/** backend `web-extras.defaults` ile aynı — yalnızca UI referansı */
const REF_MAINT_EXACT = [
  '/login',
  '/register',
  '/bakim',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
].join('\n');

const REF_MAINT_PREFIXES = [
  '/api',
  '/_next',
  '/dashboard',
  '/web-ayarlar',
  '/reklamlar',
  '/settings',
  '/profile',
  '/schools',
  '/users',
  '/haberler',
  '/bildirimler',
  '/support',
  '/market',
  '/tv',
  '/evrak',
  '/modules',
  '/moderation',
  '/document-templates',
  '/extra-lesson-params',
  '/favoriler',
  '/kazanim-takip',
  '/duty',
  '/optik-formlar',
  '/akilli-tahta',
  '/bilsem',
  '/akademik-takvim',
  '/ogretmen-ajandasi',
  '/okul-degerlendirmeleri',
  '/school-profile',
  '/send-announcement',
  '/system-announcements',
  '/work-calendar',
  '/yillik-plan-icerik',
  '/outcome-sets',
  '/market-policy',
  '/school-reviews-settings',
  '/sinav-gorevleri',
  '/optik-okuma-ayarlar',
  '/akademik-takvim-sablonu',
  '/bilsem-sablon',
  '/school-reviews',
  '/storage',
].join('\n');

function MaintenancePathHint({ body }: { body: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-snug text-muted-foreground">Varsayılan referans (satır başına bir):</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-border/50 bg-muted/25 px-2 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        {body}
      </pre>
    </div>
  );
}

const empty: WebExtrasPublic = {
  gtm_id: null,
  ga4_measurement_id: null,
  maintenance_enabled: false,
  maintenance_message_html: null,
  maintenance_allowed_exact: [],
  maintenance_allowed_prefixes: [],
  cache_ttl_yayin_seo: 300,
  cache_ttl_web_public: 300,
  cache_ttl_legal_pages: 120,
  cache_ttl_web_extras: 30,
  global_robots_noindex: false,
  default_og_image_url: null,
  recaptcha_site_key: null,
  pwa_short_name: null,
  theme_color: null,
  favicon_url: null,
  app_store_url: null,
  play_store_url: null,
  help_center_url: null,
  support_enabled: true,
  ads_enabled: true,
  ads_web_targeting_requires_cookie_consent: true,
  guest_public_web_shell_nav: { ...OGRETMEN_PRO_GUEST_SHELL_NAV },
};

export function WebExtrasPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WebExtrasPublic>(empty);
  const [exactText, setExactText] = useState('');
  const [prefixText, setPrefixText] = useState('');

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<WebExtrasPublic>('/app-config/web-extras', { token });
      const merged = { ...empty, ...data };
      setForm(merged);
      setExactText((merged.maintenance_allowed_exact ?? []).join('\n'));
      setPrefixText((merged.maintenance_allowed_prefixes ?? []).join('\n'));
    } catch {
      setForm(empty);
      setExactText('');
      setPrefixText('');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = async () => {
    if (!token) return;
    const exact = exactText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const prefixes = prefixText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      await apiFetch('/app-config/web-extras', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          ...form,
          maintenance_allowed_exact: exact,
          maintenance_allowed_prefixes: prefixes,
        }),
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
      icon={SlidersHorizontal}
      title="Gelişmiş web"
      description="Analitik, bakım, önbellek, robots, OG, reCAPTCHA, PWA ve mağaza linkleri. Kamu: GET /content/web-extras"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Analitik</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField label="GTM container ID" hint="Örn. GTM-XXXX" htmlFor="wx-gtm">
                <Input
                  id="wx-gtm"
                  className={WEB_SETTINGS_INPUT}
                  value={form.gtm_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, gtm_id: e.target.value.trim() || null }))}
                  placeholder="GTM-…"
                />
              </WebSettingsField>
              <WebSettingsField label="GA4 measurement ID" hint="Örn. G-XXXXXXXXXX" htmlFor="wx-ga4">
                <Input
                  id="wx-ga4"
                  className={WEB_SETTINGS_INPUT}
                  value={form.ga4_measurement_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, ga4_measurement_id: e.target.value.trim() || null }))}
                  placeholder="G-…"
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Destek modülü</p>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.support_enabled}
                onChange={(e) => setForm((f) => ({ ...f, support_enabled: e.target.checked }))}
              />
              Destek modülü açık
            </label>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reklamlar (web API)</p>
            <p className="mb-4 text-xs text-muted-foreground">
              GET /api/ads-public/active?platform=web — kapalıysa boş. meta:{' '}
              <code className="rounded bg-muted px-1">privacy_policy_url</code> (kamu web),{' '}
              <code className="rounded bg-muted px-1">non_personalized_ads_recommended</code>,{' '}
              <code className="rounded bg-muted px-1">policy_links</code>. Hedeflemeli:{' '}
              <code className="rounded bg-muted px-1">targeting_allowed</code> + çerez.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.ads_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, ads_enabled: e.target.checked }))}
                />
                Web reklamları açık
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.ads_web_targeting_requires_cookie_consent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ads_web_targeting_requires_cookie_consent: e.target.checked,
                    }))
                  }
                />
                Targeting reklamlar için çerez kabulü zorunlu (cookie_consent=accepted)
              </label>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bakım</p>
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.maintenance_enabled}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_enabled: e.target.checked }))}
              />
              Bakım modu açık
            </label>
            <WebSettingsField label="Bakım mesajı (HTML)" htmlFor="wx-maint-html">
              <textarea
                id="wx-maint-html"
                className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[100px]')}
                value={form.maintenance_message_html ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, maintenance_message_html: e.target.value || null }))}
                placeholder="<p>…</p>"
              />
            </WebSettingsField>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <WebSettingsField
                label="İzinli tam path’ler (satır başına bir)"
                hint={<MaintenancePathHint body={REF_MAINT_EXACT} />}
                hintPosition="before"
                htmlFor="wx-exact"
              >
                <textarea
                  id="wx-exact"
                  className={WEB_SETTINGS_TEXTAREA}
                  value={exactText}
                  onChange={(e) => setExactText(e.target.value)}
                  rows={8}
                  spellCheck={false}
                />
              </WebSettingsField>
              <WebSettingsField
                label="İzinli path önekleri (satır başına bir)"
                hint={<MaintenancePathHint body={REF_MAINT_PREFIXES} />}
                hintPosition="before"
                htmlFor="wx-pref"
              >
                <textarea
                  id="wx-pref"
                  className={WEB_SETTINGS_TEXTAREA}
                  value={prefixText}
                  onChange={(e) => setPrefixText(e.target.value)}
                  rows={12}
                  spellCheck={false}
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Kamu API önbellek (sn)
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <WebSettingsField
                label="yayin-seo"
                hint="GET /content/yayin-seo"
                htmlFor="wx-ttl-seo"
              >
                <Input
                  id="wx-ttl-seo"
                  type="number"
                  min={10}
                  max={86400}
                  className={WEB_SETTINGS_INPUT}
                  value={form.cache_ttl_yayin_seo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cache_ttl_yayin_seo: parseInt(e.target.value, 10) || f.cache_ttl_yayin_seo }))
                  }
                />
              </WebSettingsField>
              <WebSettingsField
                label="web-public"
                hint="GET /content/web-public"
                htmlFor="wx-ttl-wp"
              >
                <Input
                  id="wx-ttl-wp"
                  type="number"
                  min={10}
                  max={86400}
                  className={WEB_SETTINGS_INPUT}
                  value={form.cache_ttl_web_public}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cache_ttl_web_public: parseInt(e.target.value, 10) || f.cache_ttl_web_public,
                    }))
                  }
                />
              </WebSettingsField>
              <WebSettingsField
                label="legal-pages"
                hint="GET /content/legal-pages"
                htmlFor="wx-ttl-legal"
              >
                <Input
                  id="wx-ttl-legal"
                  type="number"
                  min={10}
                  max={86400}
                  className={WEB_SETTINGS_INPUT}
                  value={form.cache_ttl_legal_pages}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cache_ttl_legal_pages: parseInt(e.target.value, 10) || f.cache_ttl_legal_pages,
                    }))
                  }
                />
              </WebSettingsField>
              <WebSettingsField
                label="web-extras"
                hint="GET /content/web-extras. Next: NEXT_PUBLIC_WEB_EXTRAS_ISR"
                htmlFor="wx-ttl-wx"
              >
                <Input
                  id="wx-ttl-wx"
                  type="number"
                  min={10}
                  max={86400}
                  className={WEB_SETTINGS_INPUT}
                  value={form.cache_ttl_web_extras}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      cache_ttl_web_extras: parseInt(e.target.value, 10) || f.cache_ttl_web_extras,
                    }))
                  }
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SEO / güvenlik</p>
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.global_robots_noindex}
                onChange={(e) => setForm((f) => ({ ...f, global_robots_noindex: e.target.checked }))}
              />
              robots.txt tüm siteyi disallow (noindex benzeri)
            </label>
            <div className="grid gap-5 sm:max-w-xl">
              <WebSettingsField
                label="Varsayılan OG görsel URL"
                hint="CAPTCHA / site key: Web ayarlar → CAPTCHA sekmesi."
                htmlFor="wx-ogdef"
              >
                <Input
                  id="wx-ogdef"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.default_og_image_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, default_og_image_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Marka / PWA</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <WebSettingsField label="Kısa uygulama adı" htmlFor="wx-pwa">
                <Input
                  id="wx-pwa"
                  className={WEB_SETTINGS_INPUT}
                  value={form.pwa_short_name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, pwa_short_name: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="theme-color" hint="#hex" htmlFor="wx-theme">
                <Input
                  id="wx-theme"
                  className={WEB_SETTINGS_INPUT}
                  value={form.theme_color ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, theme_color: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="Favicon URL" htmlFor="wx-fav">
                <Input
                  id="wx-fav"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.favicon_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, favicon_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bağlantılar</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <WebSettingsField label="App Store" htmlFor="wx-ios">
                <Input
                  id="wx-ios"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.app_store_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, app_store_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="Google Play" htmlFor="wx-android">
                <Input
                  id="wx-android"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.play_store_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, play_store_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="Yardım merkezi" htmlFor="wx-help">
                <Input
                  id="wx-help"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.help_center_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, help_center_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="flex justify-end border-t border-border/30 pt-4">
            <Button type="button" onClick={save} disabled={saving} className="rounded-xl">
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}
    </WebSettingsPanel>
  );
}
