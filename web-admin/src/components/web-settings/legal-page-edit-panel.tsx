'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Shield, ScrollText, Cookie, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LegalPageKey, LegalPagesConfig } from './legal-pages-types';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT, WEB_SETTINGS_TEXTAREA } from './web-settings-shell';

const META: Record<
  LegalPageKey,
  { label: string; description: string; icon: typeof Shield; path: string }
> = {
  privacy: {
    label: 'Gizlilik Politikası',
    description: 'Kamu sayfa: /gizlilik — GET /content/legal-pages',
    icon: Shield,
    path: '/gizlilik',
  },
  terms: {
    label: 'Kullanım Şartları',
    description: 'Kamu sayfa: /kullanim-sartlari',
    icon: ScrollText,
    path: '/kullanim-sartlari',
  },
  cookies: {
    label: 'Çerez Politikası',
    description: 'Kamu sayfa: /cerez',
    icon: Cookie,
    path: '/cerez',
  },
};

const PREVIEW_LINKS: { key: LegalPageKey; label: string; path: string }[] = [
  { key: 'privacy', label: 'Gizlilik', path: '/gizlilik' },
  { key: 'terms', label: 'Şartlar', path: '/kullanim-sartlari' },
  { key: 'cookies', label: 'Çerez', path: '/cerez' },
];

export function LegalPageEditPanel({ pageKey }: { pageKey: LegalPageKey }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');

  const meta = META[pageKey];

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<LegalPagesConfig>('/app-config/legal-pages', { token });
      const b = data[pageKey];
      setTitle(b.title);
      setMetaDescription(b.meta_description);
      setBodyHtml(b.body_html);
      setUpdatedAt(b.updated_at);
    } catch {
      toast.error('Yüklenemedi.');
      setUpdatedAt(null);
    } finally {
      setLoading(false);
    }
  }, [token, pageKey]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch('/app-config/legal-pages', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          [pageKey]: {
            title: title.trim(),
            meta_description: metaDescription.trim(),
            body_html: bodyHtml,
          },
        }),
      });
      toast.success('Kaydedildi.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <WebSettingsPanel icon={meta.icon} title={meta.label} description={meta.description}>
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-lg gap-1.5" asChild>
                <a href={meta.path} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Önizlemeyi aç
                </a>
              </Button>
              <span className="text-xs text-muted-foreground">
                Yeni sekmede {meta.path}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3 sm:border-t-0 sm:pt-0">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Sayfalar</span>
              <div className="flex flex-wrap gap-1">
                {PREVIEW_LINKS.map((p) => (
                  <a
                    key={p.path}
                    href={p.path}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      p.key === pageKey
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {p.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
          {updatedAt && (
            <p className="text-[11px] text-muted-foreground">
              Son kayıt: {new Date(updatedAt).toLocaleString('tr-TR')}
            </p>
          )}
          <WebSettingsField label="Sayfa başlığı (H1)" htmlFor={`legal-${pageKey}-title`}>
            <Input
              id={`legal-${pageKey}-title`}
              className={WEB_SETTINGS_INPUT}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </WebSettingsField>
          <WebSettingsField label="Meta açıklama (SEO)" hint="Arama ve paylaşım önizlemesi." htmlFor={`legal-${pageKey}-meta`}>
            <Input
              id={`legal-${pageKey}-meta`}
              className={WEB_SETTINGS_INPUT}
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              maxLength={500}
            />
          </WebSettingsField>
          <WebSettingsField
            label="İçerik (HTML)"
            hint="Tailwind sınıfları kullanılabilir (h2, p, ul). Script eklemeyin."
            htmlFor={`legal-${pageKey}-body`}
          >
            <textarea
              id={`legal-${pageKey}-body`}
              className={cn(WEB_SETTINGS_TEXTAREA, 'min-h-[320px] font-mono text-[13px] leading-relaxed')}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              spellCheck={false}
            />
          </WebSettingsField>
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
