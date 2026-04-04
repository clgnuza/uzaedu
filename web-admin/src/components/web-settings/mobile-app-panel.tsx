'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Smartphone, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { normalizePublicSiteUrl } from '@/lib/site-url';
import type { MobileAppPublic } from '@/lib/mobile-config-public';
import type { WebPublicConfig } from './web-public-panel';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT, WEB_SETTINGS_TEXTAREA } from './web-settings-shell';

type WebExtrasHelp = { help_center_url: string | null };

const empty: MobileAppPublic = {
  cache_ttl_mobile_config: 60,
  ios_min_version: null,
  android_min_version: null,
  ios_latest_version: null,
  android_latest_version: null,
  force_update_ios: false,
  force_update_android: false,
  update_message: null,
  ios_bundle_id: null,
  android_application_id: null,
  ios_app_store_id: null,
  app_store_url: null,
  play_store_url: null,
  marketing_url: null,
  faq_url: null,
  privacy_policy_url: null,
  terms_url: null,
  help_center_url: null,
  support_email: null,
  universal_link_host: null,
  url_scheme: null,
  api_base_url_public: null,
  config_schema_version: '1',
  default_locale: 'tr',
  supported_locales: ['tr', 'en'],
  mobile_maintenance_enabled: false,
  mobile_maintenance_message: null,
  in_app_review_enabled: false,
  push_notifications_enabled: true,
  ads_enabled: true,
  feature_flags: {},
};

function siteBaseUrl(): string {
  return normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, '');
}

export function MobileAppPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [urlSyncBusy, setUrlSyncBusy] = useState(false);
  const [form, setForm] = useState<MobileAppPublic>(empty);
  const [flagsJson, setFlagsJson] = useState('{}');
  const [localesText, setLocalesText] = useState('tr, en');

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<MobileAppPublic>('/app-config/mobile', { token });
      const merged = {
        ...empty,
        ...data,
        feature_flags: data?.feature_flags ?? {},
        supported_locales: data?.supported_locales?.length ? data.supported_locales : empty.supported_locales,
      };
      setForm(merged);
      setFlagsJson(JSON.stringify(merged.feature_flags ?? {}, null, 2));
      setLocalesText((merged.supported_locales ?? []).join(', '));
    } catch {
      setForm(empty);
      setFlagsJson('{}');
      setLocalesText(empty.supported_locales.join(', '));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const applySuggestedLegalUrls = () => {
    const base = siteBaseUrl();
    if (!base) {
      toast.error('NEXT_PUBLIC_SITE_URL tanımlı değil.');
      return;
    }
    setForm((f) => ({
      ...f,
      privacy_policy_url: `${base}/gizlilik`,
      terms_url: `${base}/kullanim-sartlari`,
    }));
    toast.success('Gizlilik ve şartlar URL’leri yazıldı; kaydedin.');
  };

  const pullUrlsFromWebSettings = async () => {
    if (!token) return;
    setUrlSyncBusy(true);
    try {
      const [wp, wx] = await Promise.all([
        apiFetch<WebPublicConfig>('/app-config/web-public', { token }),
        apiFetch<WebExtrasHelp>('/app-config/web-extras', { token }),
      ]);
      setForm((f) => ({
        ...f,
        ...(wp.privacy_policy_url ? { privacy_policy_url: wp.privacy_policy_url } : {}),
        ...(wp.terms_url ? { terms_url: wp.terms_url } : {}),
        ...(wx.help_center_url ? { help_center_url: wx.help_center_url } : {}),
        ...(wp.contact_email ? { support_email: wp.contact_email } : {}),
      }));
      const n = [wp.privacy_policy_url, wp.terms_url, wx.help_center_url, wp.contact_email].filter(Boolean).length;
      toast.success(n ? `${n} alan güncellendi; kaydedin.` : 'Kopyalanacak dolu alan yoktu.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Alınamadı.');
    } finally {
      setUrlSyncBusy(false);
    }
  };

  const save = async () => {
    if (!token) return;
    let feature_flags: Record<string, boolean> = {};
    try {
      const parsed = JSON.parse(flagsJson || '{}') as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('feature_flags geçerli bir JSON nesnesi olmalıdır.');
      }
      feature_flags = parsed as Record<string, boolean>;
      for (const v of Object.values(feature_flags)) {
        if (typeof v !== 'boolean') {
          throw new Error('Tüm bayrak değerleri true veya false olmalıdır.');
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'feature_flags JSON hatası.');
      return;
    }
    const supported_locales = localesText
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (supported_locales.length === 0) {
      toast.error('En az bir dil kodu girin (örn. tr, en).');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/app-config/mobile', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ ...form, feature_flags, supported_locales }),
      });
      toast.success('Mobil ayarlar kaydedildi.');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebSettingsPanel
      icon={Smartphone}
      title="Mobil uygulama"
      description="iOS/Android uzaktan yapılandırma. Kamu: GET /content/mobile-config"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-10">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Önbellek</p>
            <WebSettingsField
              label="Kamu API TTL (sn)"
              hint="GET /content/mobile-config Cache-Control max-age"
              htmlFor="mob-ttl"
            >
              <Input
                id="mob-ttl"
                type="number"
                min={10}
                max={86400}
                className={WEB_SETTINGS_INPUT}
                value={form.cache_ttl_mobile_config}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    cache_ttl_mobile_config: parseInt(e.target.value, 10) || f.cache_ttl_mobile_config,
                  }))
                }
              />
            </WebSettingsField>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sürüm ve güncelleme
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField label="iOS minimum sürüm" hint="Örn. 1.0.0 — altı engellenir" htmlFor="mob-ios-min">
                <Input
                  id="mob-ios-min"
                  className={WEB_SETTINGS_INPUT}
                  value={form.ios_min_version ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, ios_min_version: e.target.value.trim() || null }))}
                  placeholder="1.0.0"
                />
              </WebSettingsField>
              <WebSettingsField label="Android minimum sürüm" htmlFor="mob-and-min">
                <Input
                  id="mob-and-min"
                  className={WEB_SETTINGS_INPUT}
                  value={form.android_min_version ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, android_min_version: e.target.value.trim() || null }))}
                  placeholder="1.0.0"
                />
              </WebSettingsField>
              <WebSettingsField label="iOS güncel (önerilen)" htmlFor="mob-ios-lat">
                <Input
                  id="mob-ios-lat"
                  className={WEB_SETTINGS_INPUT}
                  value={form.ios_latest_version ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, ios_latest_version: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="Android güncel (önerilen)" htmlFor="mob-and-lat">
                <Input
                  id="mob-and-lat"
                  className={WEB_SETTINGS_INPUT}
                  value={form.android_latest_version ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, android_latest_version: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
            </div>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.force_update_ios}
                  onChange={(e) => setForm((f) => ({ ...f, force_update_ios: e.target.checked }))}
                />
                iOS zorunlu güncelleme
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.force_update_android}
                  onChange={(e) => setForm((f) => ({ ...f, force_update_android: e.target.checked }))}
                />
                Android zorunlu güncelleme
              </label>
            </div>
            <div className="mt-4">
            <WebSettingsField
              label="Güncelleme mesajı (HTML)"
              hint="Mağaza yönlendirmesi öncesi metin"
              htmlFor="mob-upd-msg"
            >
              <textarea
                id="mob-upd-msg"
                className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[80px]')}
                value={form.update_message ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, update_message: e.target.value || null }))}
              />
            </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mağaza ve paket kimliği
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField label="App Store URL" htmlFor="mob-as">
                <Input
                  id="mob-as"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.app_store_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, app_store_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="Google Play URL" htmlFor="mob-gp">
                <Input
                  id="mob-gp"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.play_store_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, play_store_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="iOS bundle ID" htmlFor="mob-bid">
                <Input
                  id="mob-bid"
                  className={WEB_SETTINGS_INPUT}
                  value={form.ios_bundle_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, ios_bundle_id: e.target.value.trim() || null }))}
                  placeholder="com.ornek.app"
                />
              </WebSettingsField>
              <WebSettingsField label="Android applicationId" htmlFor="mob-aid">
                <Input
                  id="mob-aid"
                  className={WEB_SETTINGS_INPUT}
                  value={form.android_application_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, android_application_id: e.target.value.trim() || null }))}
                  placeholder="com.ornek.app"
                />
              </WebSettingsField>
              <WebSettingsField
                label="iOS App Store ID"
                hint="App Store Connect sayısal ID (itunes.apple.com/app/id…)"
                htmlFor="mob-asid"
              >
                <Input
                  id="mob-asid"
                  inputMode="numeric"
                  className={WEB_SETTINGS_INPUT}
                  value={form.ios_app_store_id ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      ios_app_store_id: e.target.value.replace(/\D/g, '').slice(0, 20) || null,
                    }))
                  }
                  placeholder="1234567890"
                />
              </WebSettingsField>
              <WebSettingsField label="Pazarlama / tanıtım URL" htmlFor="mob-mkt">
                <Input
                  id="mob-mkt"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.marketing_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, marketing_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="SSS (FAQ) URL" htmlFor="mob-faq">
                <Input
                  id="mob-faq"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.faq_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, faq_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Yerelleştirme ve uyumluluk
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField
                label="Varsayılan dil (locale)"
                hint="Örn. tr"
                htmlFor="mob-locale"
              >
                <Input
                  id="mob-locale"
                  className={WEB_SETTINGS_INPUT}
                  value={form.default_locale ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, default_locale: e.target.value.trim().toLowerCase() || 'tr' }))}
                  placeholder="tr"
                />
              </WebSettingsField>
              <WebSettingsField
                label="Yapılandırma şema sürümü"
                hint="İstemci önbelleğini geçersiz kılmak için artırın"
                htmlFor="mob-cfgv"
              >
                <Input
                  id="mob-cfgv"
                  className={WEB_SETTINGS_INPUT}
                  value={form.config_schema_version ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, config_schema_version: e.target.value.trim() || '1' }))}
                  placeholder="1"
                />
              </WebSettingsField>
              <div className="sm:col-span-2">
                <WebSettingsField
                  label="Desteklenen diller"
                  hint="Virgül veya boşlukla: tr, en, de"
                  htmlFor="mob-locales"
                >
                  <Input
                    id="mob-locales"
                    className={WEB_SETTINGS_INPUT}
                    value={localesText}
                    onChange={(e) => setLocalesText(e.target.value)}
                    placeholder="tr, en"
                  />
                </WebSettingsField>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Reklam API meta: <code className="rounded bg-muted px-1">privacy_policy_url</code> (yasal bölümdeki gizlilik
              URL), <code className="rounded bg-muted px-1">non_personalized_ads_recommended</code>, UMP (AdMob).
            </p>
            <div className="mt-4 flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.in_app_review_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, in_app_review_enabled: e.target.checked }))}
                />
                Mağaza içi değerlendirme istemi (Store API)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.push_notifications_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, push_notifications_enabled: e.target.checked }))}
                />
                Push bildirimleri (istemci varsayılanı)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border"
                  checked={form.ads_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, ads_enabled: e.target.checked }))}
                />
                Reklam API (iOS/Android) açık
              </label>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Yasal ve destek
            </p>
            <div className="mb-5 space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4 text-sm">
              <p className="text-[13px] leading-relaxed text-foreground/90">
                <strong>İçerik metinleri</strong> Web ayarlarında düzenlenir; kamu sayfalar{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/gizlilik</code>,{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/kullanim-sartlari</code>,{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/cerez</code> üzerinden yayınlanır.
              </p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-primary">
                <Link href="/web-ayarlar?tab=gizlilik" className="underline-offset-2 hover:underline">
                  Gizlilik içeriği
                </Link>
                <Link href="/web-ayarlar?tab=sartlar" className="underline-offset-2 hover:underline">
                  Şartlar içeriği
                </Link>
                <Link href="/web-ayarlar?tab=cerez" className="underline-offset-2 hover:underline">
                  Çerez içeriği
                </Link>
                <Link href="/web-ayarlar?tab=site" className="underline-offset-2 hover:underline">
                  Site (footer URL’leri)
                </Link>
                <Link href="/web-ayarlar?tab=ekstra" className="underline-offset-2 hover:underline">
                  Gelişmiş (yardım URL)
                </Link>
              </p>
              {siteBaseUrl() ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Örnek tam adresler:{' '}
                  <span className="font-mono text-[10px]">
                    {siteBaseUrl()}/gizlilik · {siteBaseUrl()}/kullanim-sartlari
                  </span>
                </p>
              ) : (
                <p className="text-[11px] text-amber-700 dark:text-amber-500">
                  Tam URL üretmek için ortamda <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> tanımlı olmalı.
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-lg"
                  disabled={!siteBaseUrl()}
                  onClick={applySuggestedLegalUrls}
                >
                  <Link2 className="mr-1.5 size-3.5" />
                  Önerilen kamu URL’leri yaz
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-lg"
                  disabled={urlSyncBusy}
                  onClick={() => void pullUrlsFromWebSettings()}
                >
                  {urlSyncBusy ? 'Çekiliyor…' : 'Site + Gelişmiş’ten al'}
                </Button>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField
                label="Gizlilik politikası URL"
                hint="Uygulamada açılacak tam adres"
                htmlFor="mob-privacy"
              >
                <Input
                  id="mob-privacy"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.privacy_policy_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, privacy_policy_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField
                label="Kullanım şartları URL"
                hint="Uygulamada açılacak tam adres"
                htmlFor="mob-terms"
              >
                <Input
                  id="mob-terms"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.terms_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, terms_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField
                label="Yardım merkezi URL"
                hint="Gelişmiş’teki yardım linkiyle eşlenebilir"
                htmlFor="mob-help"
              >
                <Input
                  id="mob-help"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.help_center_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, help_center_url: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="Destek e-posta" htmlFor="mob-mail">
                <Input
                  id="mob-mail"
                  type="email"
                  className={WEB_SETTINGS_INPUT}
                  value={form.support_email ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bağlantı ve API
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField
                label="Universal Links host"
                hint="Örn. app.ornek.com (sızısız)"
                htmlFor="mob-ul"
              >
                <Input
                  id="mob-ul"
                  className={WEB_SETTINGS_INPUT}
                  value={form.universal_link_host ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, universal_link_host: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <WebSettingsField label="URL scheme" hint="Örn. ogretmenpro" htmlFor="mob-scheme">
                <Input
                  id="mob-scheme"
                  className={WEB_SETTINGS_INPUT}
                  value={form.url_scheme ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, url_scheme: e.target.value.trim() || null }))}
                />
              </WebSettingsField>
              <div className="sm:col-span-2">
                <WebSettingsField
                  label="Kamu API tabanı (opsiyonel)"
                  hint="İstemci ortam geçersizlemesi için; boş bırakılabilir"
                  htmlFor="mob-api"
                >
                  <Input
                    id="mob-api"
                    type="url"
                    className={WEB_SETTINGS_INPUT}
                    value={form.api_base_url_public ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, api_base_url_public: e.target.value.trim() || null }))}
                    placeholder="https://api.ornek.com/api"
                  />
                </WebSettingsField>
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Uygulama bakımı
            </p>
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.mobile_maintenance_enabled}
                onChange={(e) => setForm((f) => ({ ...f, mobile_maintenance_enabled: e.target.checked }))}
              />
              Mobil bakım modu (istemci mesaj gösterir)
            </label>
            <WebSettingsField label="Bakım mesajı (HTML)" htmlFor="mob-mm">
              <textarea
                id="mob-mm"
                className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[88px]')}
                value={form.mobile_maintenance_message ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, mobile_maintenance_message: e.target.value || null }))}
              />
            </WebSettingsField>
          </div>

          <div className="border-t border-border/30 pt-8">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Özellik bayrakları
            </p>
            <WebSettingsField
              label="feature_flags (JSON)"
              hint='Yalnızca boolean değerler: { "beta_panel": true }'
              htmlFor="mob-ff"
            >
              <textarea
                id="mob-ff"
                className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[120px] font-mono text-xs')}
                value={flagsJson}
                onChange={(e) => setFlagsJson(e.target.value)}
                spellCheck={false}
              />
            </WebSettingsField>
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
