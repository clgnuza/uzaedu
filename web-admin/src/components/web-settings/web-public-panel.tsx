'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getApiUrl } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  LayoutPanelTop,
  LayoutTemplate,
  Link2,
  Mail,
  Plus,
  Scale,
  Share2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { FOOTER_CONSENT_HREF } from '@/lib/footer-consent-href';
import { cn } from '@/lib/utils';
import { WebSettingsField, WebSettingsPanel, WebSettingsSection, WEB_SETTINGS_INPUT } from './web-settings-shell';

export type WebPublicFooterNavItem = {
  label: string;
  href: string;
};

export type WebPublicHeaderShellStyle = 'glass' | 'solid' | 'minimal' | 'brand';

export type WebPublicHeaderShellDensity = 'compact' | 'default' | 'comfortable';

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
  footer_copyright_suffix: string | null;
  footer_nav_items: WebPublicFooterNavItem[];
  header_brand_subtitle: string | null;
  header_shell_style: WebPublicHeaderShellStyle;
  header_shell_density: WebPublicHeaderShellDensity;
  header_shell_accent: boolean;
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
  footer_copyright_suffix: '© Öğretmen Pro Web Admin',
  footer_nav_items: [
    { label: 'Gizlilik', href: '/gizlilik' },
    { label: 'Kullanım Şartları', href: '/kullanim-sartlari' },
    { label: 'Çerez politikası', href: '/cerez' },
    { label: 'Rıza ayarları', href: FOOTER_CONSENT_HREF },
  ],
  header_brand_subtitle: null,
  header_shell_style: 'glass',
  header_shell_density: 'default',
  header_shell_accent: true,
};

/** Footer bileşeni için sunucu yanıtı yoksa kullanılır (backend varsayılanları ile uyumlu). */
export const WEB_PUBLIC_DEFAULT_FOOTER: Pick<WebPublicConfig, 'footer_copyright_suffix' | 'footer_nav_items'> = {
  footer_copyright_suffix: empty.footer_copyright_suffix,
  footer_nav_items: empty.footer_nav_items.map((x) => ({ ...x })),
};

export const WEB_PUBLIC_DEFAULT_HEADER: Pick<
  WebPublicConfig,
  'header_brand_subtitle' | 'header_shell_style' | 'header_shell_density' | 'header_shell_accent'
> = {
  header_brand_subtitle: empty.header_brand_subtitle,
  header_shell_style: empty.header_shell_style,
  header_shell_density: empty.header_shell_density,
  header_shell_accent: empty.header_shell_accent,
};

function newNavItem(): WebPublicFooterNavItem {
  return { label: '', href: '/' };
}

export function WebPublicPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<WebPublicConfig>(empty);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/content/web-public'), { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error('fetch');
      const data = (await res.json()) as WebPublicConfig;
      setForm({ ...empty, ...data });
    } catch {
      setForm(empty);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/app-config/web-public', {
        method: 'PATCH',
        token: token ?? undefined,
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

  const updateNav = (i: number, patch: Partial<WebPublicFooterNavItem>) => {
    setForm((f) => {
      const next = [...f.footer_nav_items];
      next[i] = { ...next[i], ...patch };
      return { ...f, footer_nav_items: next };
    });
  };

  return (
    <WebSettingsPanel
      icon={LayoutTemplate}
      title="Kamuya açık site"
      description="Aşağıdaki sırayla üst çubuk, iletişim, alt bilgi, sosyal ve yasal adresleri düzenleyin. Kaydet ile sunucuya yazılır; kamu API: GET /content/web-public."
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-6">
          <WebSettingsSection
            icon={LayoutPanelTop}
            title="1 · Üst şerit (header)"
            description="Pano ve misafir sayfalarındaki sabit üst çubuk. Görünüm ve yoğunluk tüm siteye uygulanır."
          >
            <div className="space-y-3">
              <p className="text-[12px] font-medium text-foreground">Görünüm</p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {(
                  [
                    { id: 'glass' as const, t: 'Cam', d: 'Bulanık cam, hafif gölge' },
                    { id: 'solid' as const, t: 'Düz', d: 'Opak arka plan' },
                    { id: 'minimal' as const, t: 'Minimal', d: 'İnce çizgi, hafif blur' },
                    { id: 'brand' as const, t: 'Marka', d: 'Hafif marka rengi geçişi' },
                  ] as const
                ).map((opt) => {
                  const active = form.header_shell_style === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, header_shell_style: opt.id }))}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-left transition-colors',
                        active
                          ? 'border-primary bg-primary/8 ring-2 ring-primary/25'
                          : 'border-border/60 bg-background/60 hover:bg-muted/40 dark:bg-background/40',
                      )}
                    >
                      <span className="block text-[13px] font-semibold text-foreground">{opt.t}</span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{opt.d}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-medium text-foreground">Yükseklik</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'compact' as const, label: 'Sıkı', hint: 'Daha az dikey alan' },
                    { id: 'default' as const, label: 'Varsayılan', hint: 'Tema ölçüsü' },
                    { id: 'comfortable' as const, label: 'Rahat', hint: 'Daha geniş dokunma alanı' },
                  ] as const
                ).map((opt) => {
                  const active = form.header_shell_density === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, header_shell_density: opt.id }))}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors',
                        active
                          ? 'border-primary bg-primary/10 text-foreground ring-2 ring-primary/20'
                          : 'border-border/60 bg-muted/25 text-muted-foreground hover:bg-muted/45',
                      )}
                      title={opt.hint}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5 dark:bg-muted/10">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 rounded border-border text-primary"
                checked={form.header_shell_accent}
                onChange={(e) => setForm((f) => ({ ...f, header_shell_accent: e.target.checked }))}
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-foreground">Üst vurgu çizgisi</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  Cam ve Marka görünümünde ince renkli çizgi (isteğe bağlı kapatılabilir).
                </span>
              </span>
            </label>

            <WebSettingsField
              label="Logo altı metin"
              hint="Mobil logo alt satırı. Boş: girişte «Panel», misafirde sayfa adı."
              htmlFor="wp-header-sub"
            >
              <Input
                id="wp-header-sub"
                className={WEB_SETTINGS_INPUT}
                value={form.header_brand_subtitle ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, header_brand_subtitle: e.target.value.trim() || null }))}
                placeholder="Örn. Web yönetim"
                maxLength={120}
              />
            </WebSettingsField>
          </WebSettingsSection>

          <WebSettingsSection
            icon={Mail}
            title="2 · İletişim ve slogan"
            description="E-posta ve telefon iletişim alanlarında kullanılabilir. Slogan isteğe bağlı kısa metindir."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <WebSettingsField label="E-posta" htmlFor="wp-email">
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
            <WebSettingsField label="Kısa slogan" hint="İsteğe bağlı; iletişim bloklarında kullanılabilir." htmlFor="wp-tagline">
              <Input
                id="wp-tagline"
                className={WEB_SETTINGS_INPUT}
                value={form.footer_tagline ?? ''}
                onChange={(e) => set('footer_tagline', e.target.value)}
                placeholder="Öğretmenler için dijital işler"
              />
            </WebSettingsField>
          </WebSettingsSection>

          <WebSettingsSection
            icon={Link2}
            title="3 · Alt bilgi (footer)"
            description="Sayfa sonundaki şerit: solda yıl + telif, sağda bağlantılar. Çerez tercihi için URL alanına özel değer kullanın."
          >
            <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground dark:bg-muted/10">
              <span className="font-medium text-foreground/90">İpucu:</span> Rıza / çerez penceresi için URL olarak{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{FOOTER_CONSENT_HREF}</code> yazın.
            </div>
            <WebSettingsField
              label="Telif satırı (yıl otomatik eklenir)"
              hint="Örn. © Öğretmen Pro Web Admin"
              htmlFor="wp-footer-copy"
            >
              <Input
                id="wp-footer-copy"
                className={WEB_SETTINGS_INPUT}
                value={form.footer_copyright_suffix ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, footer_copyright_suffix: e.target.value.trim() || null }))}
                placeholder="© Öğretmen Pro Web Admin"
              />
            </WebSettingsField>
            <div>
              <p className="mb-3 text-[12px] font-medium text-foreground">Gezinme bağlantıları</p>
              <div className="space-y-2.5">
                {form.footer_nav_items.map((row, i) => (
                  <div
                    key={`fn-${i}`}
                    className="flex flex-col gap-3 rounded-xl border border-border/50 bg-background/60 p-3 sm:flex-row sm:items-end sm:gap-2 dark:bg-background/40"
                  >
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <WebSettingsField label="Etiket" htmlFor={`wp-fn-l-${i}`}>
                        <Input
                          id={`wp-fn-l-${i}`}
                          className={WEB_SETTINGS_INPUT}
                          value={row.label}
                          onChange={(e) => updateNav(i, { label: e.target.value })}
                          placeholder="Gizlilik"
                        />
                      </WebSettingsField>
                      <WebSettingsField
                        label="URL"
                        hint={`İç: /yol · Dış: https://… · Çerez: ${FOOTER_CONSENT_HREF}`}
                        htmlFor={`wp-fn-h-${i}`}
                      >
                        <Input
                          id={`wp-fn-h-${i}`}
                          className={WEB_SETTINGS_INPUT}
                          value={row.href}
                          onChange={(e) => updateNav(i, { href: e.target.value })}
                          placeholder="/gizlilik"
                        />
                      </WebSettingsField>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 self-end sm:self-auto"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          footer_nav_items: f.footer_nav_items.filter((_, j) => j !== i),
                        }))
                      }
                      aria-label="Bağlantıyı kaldır"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full gap-1.5 sm:w-auto"
                  disabled={form.footer_nav_items.length >= 8}
                  onClick={() => setForm((f) => ({ ...f, footer_nav_items: [...f.footer_nav_items, newNavItem()] }))}
                >
                  <Plus className="size-4" />
                  Bağlantı ekle ({form.footer_nav_items.length}/8)
                </Button>
              </div>
            </div>
          </WebSettingsSection>

          <WebSettingsSection
            icon={Share2}
            title="4 · Sosyal ağlar"
            description="Harici profil veya sayfa adresleri. Boş bırakılanlar gösterilmez."
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
          </WebSettingsSection>

          <WebSettingsSection
            icon={Scale}
            title="5 · Yasal (harici URL)"
            description="Gizlilik ve kullanım şartları için tam adres. Uygulama içi yasal sayfalar yerine harici site kullanıyorsanız doldurun."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <WebSettingsField label="Gizlilik politikası" htmlFor="wp-privacy">
                <Input
                  id="wp-privacy"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.privacy_policy_url ?? ''}
                  onChange={(e) => set('privacy_policy_url', e.target.value)}
                  placeholder="https://…"
                />
              </WebSettingsField>
              <WebSettingsField label="Kullanım şartları" htmlFor="wp-terms">
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
          </WebSettingsSection>

          <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-muted/15 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/10">
            <p className="text-[12px] text-muted-foreground">
              Tüm bölümler tek kayıtta sunucuya gider. Önizleme için sayfayı yenileyin.
            </p>
            <Button type="button" onClick={save} disabled={saving} className="w-full shrink-0 sm:w-auto">
              {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
            </Button>
          </div>
        </div>
      )}
    </WebSettingsPanel>
  );
}
