'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Globe } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT, WEB_SETTINGS_TEXTAREA } from './web-settings-shell';

export type YayinSeoConfig = {
  title: string;
  description: string;
  og_image: string | null;
  robots: 'index' | 'noindex';
  keywords: string;
  site_url: string | null;
  site_name: string | null;
};

export function YayinSeoPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<YayinSeoConfig>({
    title: 'Haber Yayını – Uzaedu Öğretmen',
    description: '',
    og_image: null,
    robots: 'noindex',
    keywords: '',
    site_url: null,
    site_name: null,
  });

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<YayinSeoConfig>('/app-config/yayin-seo', { token });
      setForm({
        title: data?.title ?? 'Haber Yayını – Uzaedu Öğretmen',
        description: data?.description ?? '',
        og_image: data?.og_image ?? null,
        robots: data?.robots === 'index' ? 'index' : 'noindex',
        keywords: data?.keywords ?? '',
        site_url: data?.site_url ?? null,
        site_name: data?.site_name ?? null,
      });
    } catch {
      /* defaults */
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
      await apiFetch('/app-config/yayin-seo', {
        method: 'PATCH',
        token,
        body: JSON.stringify(form),
      });
      toast.success('SEO kaydedildi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebSettingsPanel
      icon={Globe}
      title="Yayın ve SEO"
      description="Haber yayını meta bilgileri. Kamu metadata: GET /content/yayin-seo"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px] lg:items-start">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField label="Site URL (canonical)" hint="og:url ve canonical." htmlFor="seo-site-url">
                <Input
                  id="seo-site-url"
                  type="url"
                  className={WEB_SETTINGS_INPUT}
                  value={form.site_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value.trim() || null }))}
                  placeholder="https://…"
                />
              </WebSettingsField>
              <WebSettingsField label="Site adı" hint="og:site_name" htmlFor="seo-site-name">
                <Input
                  id="seo-site-name"
                  className={WEB_SETTINGS_INPUT}
                  value={form.site_name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value.trim() || null }))}
                  placeholder="Uzaedu Öğretmen"
                />
              </WebSettingsField>
            </div>
            <WebSettingsField label="Sayfa başlığı" htmlFor="seo-title">
              <div className="relative">
                <Input
                  id="seo-title"
                  className={cn(WEB_SETTINGS_INPUT, 'pr-14')}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Haber Yayını – …"
                  maxLength={70}
                />
                <span
                  className={cn(
                    'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums',
                    form.title.length > 60 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground',
                  )}
                >
                  {form.title.length}/60
                </span>
              </div>
            </WebSettingsField>
            <WebSettingsField label="Meta açıklama" htmlFor="seo-desc">
              <div className="relative">
                <textarea
                  id="seo-desc"
                  className={cn(WEB_SETTINGS_TEXTAREA, 'pr-14')}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Kısa özet"
                  rows={3}
                  maxLength={320}
                />
                <span
                  className={cn(
                    'pointer-events-none absolute bottom-2.5 right-3 text-[11px] tabular-nums',
                    form.description.length > 160 ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground',
                  )}
                >
                  {form.description.length}/160
                </span>
              </div>
            </WebSettingsField>
            <WebSettingsField label="OG görsel URL" hint="1200×630 önerilir." htmlFor="seo-og">
              <Input
                id="seo-og"
                type="url"
                className={WEB_SETTINGS_INPUT}
                value={form.og_image ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, og_image: e.target.value.trim() || null }))}
                placeholder="https://…"
              />
            </WebSettingsField>
            <div className="grid gap-5 sm:grid-cols-2">
              <WebSettingsField label="Robots" htmlFor="seo-robots">
                <select
                  id="seo-robots"
                  value={form.robots}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, robots: e.target.value === 'index' ? 'index' : 'noindex' }))
                  }
                  className={WEB_SETTINGS_INPUT}
                >
                  <option value="noindex">noindex</option>
                  <option value="index">index</option>
                </select>
              </WebSettingsField>
              <WebSettingsField label="Anahtar kelimeler" htmlFor="seo-kw">
                <Input
                  id="seo-kw"
                  className={WEB_SETTINGS_INPUT}
                  value={form.keywords}
                  onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                  placeholder="haber, duyuru"
                />
              </WebSettingsField>
            </div>
            <div className="flex justify-end border-t border-border/30 pt-4">
              <Button type="button" onClick={save} disabled={saving} className="rounded-xl">
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
            </div>
          </div>
          <aside className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-4 lg:sticky lg:top-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Önizleme</p>
            <div className="mt-3 space-y-2 rounded-xl border border-border/40 bg-background p-3 shadow-sm">
              <p className="text-xs font-medium text-primary line-clamp-2">{form.title || 'Başlık'}</p>
              <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">
                {form.description || 'Arama sonuçlarında görünecek açıklama…'}
              </p>
              <div className="flex gap-2 pt-1">
                <div className="h-12 w-[88px] shrink-0 rounded-md bg-muted" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-[10px] text-muted-foreground">{form.site_name || 'Site adı'}</p>
                  <p className="truncate text-[10px] text-muted-foreground/80">{form.site_url || 'https://…'}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </WebSettingsPanel>
  );
}
