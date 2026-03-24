'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Cloud } from 'lucide-react';
import { toast } from 'sonner';
import { WebSettingsField, WebSettingsPanel, WEB_SETTINGS_INPUT } from './web-settings-shell';

const UPLOAD_TYPE_OPTIONS = [
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/gif', label: 'GIF' },
] as const;

type R2ConfigForAdmin = {
  r2_account_id: string;
  r2_access_key_id: string;
  r2_secret_access_key: string | null;
  r2_bucket: string;
  r2_public_url: string;
  upload_max_size_mb?: number;
  upload_allowed_types?: string[];
};

export function R2SettingsPanel() {
  const { token, me } = useAuth();
  const [config, setConfig] = useState<R2ConfigForAdmin | null>(null);
  const [form, setForm] = useState<Record<string, string | number | string[]>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleChange = (key: string, value: string | number | string[]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fetchConfig = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    try {
      const data = await apiFetch<R2ConfigForAdmin>('/app-config/r2', { token });
      setConfig(data);
    } catch {
      setConfig(null);
    }
  }, [token, me?.role]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleTest = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setTesting(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/app-config/r2/test', {
        method: 'POST',
        token,
      });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bağlantı test edilemedi');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!token || me?.role !== 'superadmin') return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        r2_account_id: (form.r2_account_id ?? config?.r2_account_id)?.toString().trim() || null,
        r2_access_key_id: (form.r2_access_key_id ?? config?.r2_access_key_id)?.toString().trim() || null,
        r2_bucket: (form.r2_bucket ?? config?.r2_bucket)?.toString().trim() || null,
        r2_public_url: (form.r2_public_url ?? config?.r2_public_url)?.toString().trim() || null,
      };
      if ((form.r2_secret_access_key ?? '').toString().trim()) {
        (body as Record<string, string>).r2_secret_access_key = form.r2_secret_access_key!.toString().trim();
      }
      const maxMb = form.upload_max_size_mb ?? config?.upload_max_size_mb ?? 5;
      body.upload_max_size_mb = typeof maxMb === 'number' ? maxMb : parseFloat(String(maxMb)) || 5;
      const types = form.upload_allowed_types ?? config?.upload_allowed_types ?? UPLOAD_TYPE_OPTIONS.map((o) => o.value);
      body.upload_allowed_types = Array.isArray(types) ? types : [types];
      await apiFetch('/app-config/r2', { method: 'PATCH', token, body: JSON.stringify(body) });
      toast.success('R2 kaydedildi');
      setForm({});
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  if (me?.role !== 'superadmin') return null;

  return (
    <WebSettingsPanel
      icon={Cloud}
      title="Cloudflare R2"
      description="Görsel yükleme. Boş secret alanı mevcut anahtarı korur."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <WebSettingsField label="Account ID" htmlFor="r2-account">
          <Input
            id="r2-account"
            type="text"
            className={WEB_SETTINGS_INPUT}
            value={form.r2_account_id ?? config?.r2_account_id ?? ''}
            onChange={(e) => handleChange('r2_account_id', e.target.value)}
            placeholder="Cloudflare hesap ID"
          />
        </WebSettingsField>
        <WebSettingsField label="Bucket" htmlFor="r2-bucket">
          <Input
            id="r2-bucket"
            type="text"
            className={WEB_SETTINGS_INPUT}
            value={form.r2_bucket ?? config?.r2_bucket ?? ''}
            onChange={(e) => handleChange('r2_bucket', e.target.value)}
            placeholder="bucket-adı"
          />
        </WebSettingsField>
        <WebSettingsField label="Access Key ID" htmlFor="r2-access-key">
          <Input
            id="r2-access-key"
            type="text"
            className={WEB_SETTINGS_INPUT}
            value={form.r2_access_key_id ?? config?.r2_access_key_id ?? ''}
            onChange={(e) => handleChange('r2_access_key_id', e.target.value)}
          />
        </WebSettingsField>
        <WebSettingsField label="Secret Access Key" hint="Yeni değer girilmezse değişmez." htmlFor="r2-secret">
          <Input
            id="r2-secret"
            type="password"
            className={WEB_SETTINGS_INPUT}
            value={form.r2_secret_access_key ?? ''}
            onChange={(e) => handleChange('r2_secret_access_key', e.target.value)}
            placeholder={config?.r2_secret_access_key ? '••••••••' : 'Secret'}
          />
        </WebSettingsField>
        <div className="sm:col-span-2">
          <WebSettingsField label="Public URL" hint="Custom domain veya public bucket URL." htmlFor="r2-public-url">
            <Input
              id="r2-public-url"
              type="url"
              className={WEB_SETTINGS_INPUT}
              value={form.r2_public_url ?? config?.r2_public_url ?? ''}
              onChange={(e) => handleChange('r2_public_url', e.target.value)}
              placeholder="https://…"
            />
          </WebSettingsField>
        </div>
      </div>
      <div className="rounded-2xl border border-border/40 bg-muted/15 p-4">
        <p className="text-xs font-medium text-foreground">Yükleme limitleri</p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Max MB</span>
            <Input
              id="upload-max-size"
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              className="h-9 w-20 rounded-xl border-border/60 text-sm"
              value={form.upload_max_size_mb ?? config?.upload_max_size_mb ?? 5}
              onChange={(e) => handleChange('upload_max_size_mb', parseFloat(e.target.value) || 1)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {UPLOAD_TYPE_OPTIONS.map((opt) => {
              const current = form.upload_allowed_types ?? config?.upload_allowed_types ?? UPLOAD_TYPE_OPTIONS.map((o) => o.value);
              const checked = Array.isArray(current) ? current.includes(opt.value) : current === opt.value;
              return (
                <label key={opt.value} className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground/90">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const prev = form.upload_allowed_types ?? config?.upload_allowed_types ?? UPLOAD_TYPE_OPTIONS.map((o) => o.value);
                      const arr = Array.isArray(prev) ? [...prev] : [prev];
                      if (e.target.checked) {
                        if (!arr.includes(opt.value)) arr.push(opt.value);
                      } else {
                        const i = arr.indexOf(opt.value);
                        if (i >= 0) arr.splice(i, 1);
                      }
                      handleChange(
                        'upload_allowed_types',
                        (arr.length > 0 ? arr : UPLOAD_TYPE_OPTIONS.map((o) => o.value)) as string[],
                      );
                    }}
                    className="size-3.5 rounded border-input"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">0,1–50 MB. En az bir format.</p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border/30 pt-4">
        <Button type="button" variant="outline" className="rounded-xl" onClick={handleTest} disabled={testing}>
          {testing ? 'Test…' : 'Bağlantı testi'}
        </Button>
        <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </WebSettingsPanel>
  );
}
