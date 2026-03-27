'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getApiUrl } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { LayoutPanelLeft, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { OGRETMEN_PRO_GUEST_SHELL_NAV } from '@/lib/guest-web-shell-preset';
import type { GuestPublicWebShellNav, GuestPublicWebShellNavItem, WebExtrasPublic } from '@/lib/web-extras-public';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT } from './web-settings-shell';

const ICON_KEYS = [
  { value: '', label: 'Simge yok' },
  { value: 'home', label: 'Ana sayfa (home)' },
  { value: 'newspaper', label: 'Haber / duyuru (newspaper)' },
  { value: 'calculator', label: 'Hesaplama (calculator)' },
  { value: 'star', label: 'Yıldız (star)' },
  { value: 'layout', label: 'Pano (layout)' },
  { value: 'book-open', label: 'Kitap / içerik (book-open)' },
  { value: 'graduation-cap', label: 'Mezuniyet / sınav (graduation-cap)' },
  { value: 'help-circle', label: 'Yardım (help-circle)' },
  { value: 'mail', label: 'E-posta (mail)' },
  { value: 'link', label: 'Bağlantı (link)' },
] as const;

function defaultShell(): GuestPublicWebShellNav {
  return {
    ...OGRETMEN_PRO_GUEST_SHELL_NAV,
    top_bar_items: OGRETMEN_PRO_GUEST_SHELL_NAV.top_bar_items.map((x) => ({ ...x })),
    bottom_bar_items: OGRETMEN_PRO_GUEST_SHELL_NAV.bottom_bar_items.map((x) => ({ ...x })),
  };
}

function newItem(): GuestPublicWebShellNavItem {
  return { label: 'Yeni bağlantı', href: '/', icon_key: 'link' };
}

export function WebShellNavPanel() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<GuestPublicWebShellNav>(defaultShell);

  /** Kamu GET — admin JWT gerektirmez (401 / “Oturum açmanız gerekiyor” önlenir). */
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/content/web-extras'), { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error('fetch');
      const data = (await res.json()) as WebExtrasPublic;
      setForm({ ...defaultShell(), ...(data.guest_public_web_shell_nav ?? {}) });
    } catch {
      setForm(defaultShell());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const applyOgretmenProPreset = () => {
    setForm(defaultShell());
    toast.message('Öğretmen Pro önerisi yüklendi', {
      description: 'Kaydetmediğiniz sürece sunucuya yazılmaz.',
      duration: 3200,
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch('/app-config/web-extras', {
        method: 'PATCH',
        token: token ?? undefined,
        body: JSON.stringify({ guest_public_web_shell_nav: form }),
      });
      toast.success('Kaydedildi.');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt hatası.');
    } finally {
      setSaving(false);
    }
  };

  const updateTop = (i: number, patch: Partial<GuestPublicWebShellNavItem>) => {
    setForm((f) => {
      const next = [...f.top_bar_items];
      next[i] = { ...next[i], ...patch };
      return { ...f, top_bar_items: next };
    });
  };

  const updateBottom = (i: number, patch: Partial<GuestPublicWebShellNavItem>) => {
    setForm((f) => {
      const next = [...f.bottom_bar_items];
      next[i] = { ...next[i], ...patch };
      return { ...f, bottom_bar_items: next };
    });
  };

  return (
    <WebSettingsPanel
      icon={LayoutPanelLeft}
      title="Misafir web kabuğu"
      description="Giriş yapmadan görülen Öğretmen Pro sayfalarında (haberler, hesaplamalar, ek ders, sınav görev ücretleri) üst link şeridi ve alt sekme çubuğu. Veri kamuya GET /content/web-extras → guest_public_web_shell_nav ile gider."
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-10">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Ne zaman görünür?</p>
            <p className="mt-1.5">
              Bu bağlantılar yalnızca <strong className="text-foreground">giriş yapılmamış</strong> ziyaretçiler için, sitede
              herkese açık tutulan sayfalarda gösterilir. Üst şerit başlıkta; alt çubuk ekranın altına sabittir (çoğunlukla
              mobilde kullanılır).
            </p>
            <p className="mt-3 font-medium text-foreground">Desteklenen iç sayfalar (Öğretmen Pro)</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 font-mono text-xs">
              <li>/haberler · /haberler/yayin</li>
              <li>/hesaplamalar · /extra-lesson-calc</li>
              <li>/sinav-gorev-ucretleri</li>
            </ul>
            <p className="mt-3 text-xs">
              <strong className="text-foreground">URL:</strong> Site içi için <code className="rounded bg-muted px-1">/</code> ile
              başlayın. Dış bağlantı yalnızca <code className="rounded bg-muted px-1">https://</code> ile. En fazla 8 öğe / şerit.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={applyOgretmenProPreset}>
              <RotateCcw className="size-4" />
              Öğretmen Pro önerisini yükle
            </Button>
            <span className="text-xs text-muted-foreground">Haberler + hesaplamalar + ek ders + sınav görev ücretleri</span>
          </div>

          <div>
            <label className="mb-1 flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.top_bar_enabled}
                onChange={(e) => setForm((f) => ({ ...f, top_bar_enabled: e.target.checked }))}
              />
              Üst şerit (yatay linkler)
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Logo ile giriş butonları arasında kaydırılabilir alan. Masaüstünde hızlı gezinme; dar ekranda yatay kaydırma.
            </p>
            <div className="space-y-3">
              {form.top_bar_items.map((row, i) => (
                <div
                  key={`t-${i}`}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 sm:flex-row sm:items-end"
                >
                  <WebSettingsField
                    label="Etiket"
                    hint="Kısa metin (menüde görünür)"
                    htmlFor={`shell-t-l-${i}`}
                  >
                    <Input
                      id={`shell-t-l-${i}`}
                      className={WEB_SETTINGS_INPUT}
                      value={row.label}
                      onChange={(e) => updateTop(i, { label: e.target.value })}
                      placeholder="Örn. Haberler"
                    />
                  </WebSettingsField>
                  <WebSettingsField
                    label="URL"
                    hint="İç: /haberler — Dış: https://…"
                    htmlFor={`shell-t-h-${i}`}
                  >
                    <Input
                      id={`shell-t-h-${i}`}
                      className={WEB_SETTINGS_INPUT}
                      value={row.href}
                      onChange={(e) => updateTop(i, { href: e.target.value })}
                      placeholder="/haberler"
                    />
                  </WebSettingsField>
                  <WebSettingsField label="Simge" hint="Lucide anahtarı" htmlFor={`shell-t-ik-${i}`}>
                    <select
                      id={`shell-t-ik-${i}`}
                      className={WEB_SETTINGS_INPUT}
                      value={row.icon_key ?? ''}
                      onChange={(e) => updateTop(i, { icon_key: e.target.value ? e.target.value : null })}
                    >
                      {ICON_KEYS.map((o) => (
                        <option key={o.value || 'none'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </WebSettingsField>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        top_bar_items: f.top_bar_items.filter((_, j) => j !== i),
                      }))
                    }
                    aria-label="Satırı sil"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={form.top_bar_items.length >= 8}
                onClick={() => setForm((f) => ({ ...f, top_bar_items: [...f.top_bar_items, newItem()] }))}
              >
                <Plus className="size-4" />
                Üst satır ekle (en fazla 8)
              </Button>
            </div>
          </div>

          <div className="border-t border-border/30 pt-8">
            <label className="mb-1 flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.bottom_bar_enabled}
                onChange={(e) => setForm((f) => ({ ...f, bottom_bar_enabled: e.target.checked }))}
              />
              Alt sekme çubuğu (sabit)
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Ekranın altına yapışık bar; parmakla tek dokunuşla sayfa değişimi. İçerik altında kalmaması için sayfaya alt boşluk
              eklenir.
            </p>
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={form.bottom_bar_mobile_only}
                onChange={(e) => setForm((f) => ({ ...f, bottom_bar_mobile_only: e.target.checked }))}
              />
              Alt çubuğu yalnızca mobil / dar ekranda göster
            </label>
            <p className="mb-3 text-xs text-muted-foreground">
              Açıkken masaüstünde alt çubuk gizlenir; üst şerit tüm genişliklerde kullanılabilir.
            </p>
            <div className="space-y-3">
              {form.bottom_bar_items.map((row, i) => (
                <div
                  key={`b-${i}`}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 sm:flex-row sm:items-end"
                >
                  <WebSettingsField label="Etiket" hint="Kısa (2–3 kelime önerilir)" htmlFor={`shell-b-l-${i}`}>
                    <Input
                      id={`shell-b-l-${i}`}
                      className={WEB_SETTINGS_INPUT}
                      value={row.label}
                      onChange={(e) => updateBottom(i, { label: e.target.value })}
                      placeholder="Örn. Hesaplamalar"
                    />
                  </WebSettingsField>
                  <WebSettingsField label="URL" hint="Genelde üst şerit ile aynı hedefler" htmlFor={`shell-b-h-${i}`}>
                    <Input
                      id={`shell-b-h-${i}`}
                      className={WEB_SETTINGS_INPUT}
                      value={row.href}
                      onChange={(e) => updateBottom(i, { href: e.target.value })}
                      placeholder="/hesaplamalar"
                    />
                  </WebSettingsField>
                  <WebSettingsField label="Simge" htmlFor={`shell-b-ik-${i}`}>
                    <select
                      id={`shell-b-ik-${i}`}
                      className={WEB_SETTINGS_INPUT}
                      value={row.icon_key ?? ''}
                      onChange={(e) => updateBottom(i, { icon_key: e.target.value ? e.target.value : null })}
                    >
                      {ICON_KEYS.map((o) => (
                        <option key={o.value || 'none-b'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </WebSettingsField>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        bottom_bar_items: f.bottom_bar_items.filter((_, j) => j !== i),
                      }))
                    }
                    aria-label="Satırı sil"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                disabled={form.bottom_bar_items.length >= 8}
                onClick={() => setForm((f) => ({ ...f, bottom_bar_items: [...f.bottom_bar_items, newItem()] }))}
              >
                <Plus className="size-4" />
                Alt satır ekle (en fazla 8)
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-border/30 pt-6">
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </div>
      )}
    </WebSettingsPanel>
  );
}
