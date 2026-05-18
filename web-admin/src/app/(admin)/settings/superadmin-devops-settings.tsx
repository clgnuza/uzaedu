'use client';

import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SuperadminDeployPanel } from './superadmin-deploy-panel';

export type DevOpsConfig = {
  git_repo_url: string | null;
  git_default_branch: string | null;
  cicd_url: string | null;
  production_api_url: string | null;
  production_web_url: string | null;
  deploy_notes: string | null;
};

type TeacherTimetableGptConfig = {
  gpt_enabled: boolean;
  gpt_model: string;
  gpt_retry_enabled: boolean;
  gpt_retry_model: string | null;
  gpt_timeout_ms: number;
  gpt_parallel: number;
  gpt_max_teachers: number;
};

const MODEL_OPTIONS = [
  'gpt-4o-mini',
  'gpt-4o',
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-5.1',
  'gpt-5.2',
];

export function SuperadminDevopsSettings() {
  const { token, me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gptSaving, setGptSaving] = useState(false);
  const [form, setForm] = useState<DevOpsConfig>({
    git_repo_url: 'https://github.com/clgnuza/uzaedu.git',
    git_default_branch: 'main',
    cicd_url: 'https://github.com/clgnuza/uzaedu/actions',
    production_api_url: 'https://api.uzaedu.com',
    production_web_url: 'https://uzaedu.com',
    deploy_notes: null,
  });
  const [gptForm, setGptForm] = useState<TeacherTimetableGptConfig>({
    gpt_enabled: true,
    gpt_model: 'gpt-4o-mini',
    gpt_retry_enabled: false,
    gpt_retry_model: 'gpt-5.2',
    gpt_timeout_ms: 20000,
    gpt_parallel: 4,
    gpt_max_teachers: 60,
  });

  const load = useCallback(() => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    Promise.all([
      apiFetch<DevOpsConfig>('/app-config/devops', { token }),
      apiFetch<TeacherTimetableGptConfig>('/app-config/teacher-timetable-gpt', { token }),
    ])
      .then(([d, g]) => {
        setForm({
          git_repo_url: d.git_repo_url ?? null,
          git_default_branch: d.git_default_branch ?? 'main',
          cicd_url: d.cicd_url ?? null,
          production_api_url: d.production_api_url ?? null,
          production_web_url: d.production_web_url ?? null,
          deploy_notes: d.deploy_notes ?? null,
        });
        setGptForm({
          gpt_enabled: !!g.gpt_enabled,
          gpt_model: g.gpt_model || 'gpt-4o-mini',
          gpt_retry_enabled: !!g.gpt_retry_enabled,
          gpt_retry_model: g.gpt_retry_model || 'gpt-5.2',
          gpt_timeout_ms: Math.max(3000, Math.min(60000, Number(g.gpt_timeout_ms) || 20000)),
          gpt_parallel: Math.max(1, Math.min(8, Number(g.gpt_parallel) || 4)),
          gpt_max_teachers: Math.max(5, Math.min(120, Number(g.gpt_max_teachers) || 60)),
        });
      })
      .catch(() => toast.error('Kaynak ayarları yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [token, me?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const save = () => {
    if (!token) return;
    setSaving(true);
    apiFetch<{ success: boolean }>('/app-config/devops', {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        git_repo_url: form.git_repo_url || null,
        git_default_branch: form.git_default_branch?.trim() || 'main',
        cicd_url: form.cicd_url || null,
        production_api_url: form.production_api_url || null,
        production_web_url: form.production_web_url || null,
        deploy_notes: form.deploy_notes || null,
      }),
    })
      .then(() => {
        toast.success('Kaydedildi');
        load();
      })
      .catch((e: Error) => toast.error(e.message || 'Kaydedilemedi'))
      .finally(() => setSaving(false));
  };

  const saveGpt = () => {
    if (!token) return;
    setGptSaving(true);
    apiFetch<{ success: boolean }>('/app-config/teacher-timetable-gpt', {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        gpt_enabled: !!gptForm.gpt_enabled,
        gpt_model: gptForm.gpt_model?.trim() || 'gpt-4o-mini',
        gpt_retry_enabled: !!gptForm.gpt_retry_enabled,
        gpt_retry_model: gptForm.gpt_retry_model?.trim() || null,
        gpt_timeout_ms: Math.max(3000, Math.min(60000, Number(gptForm.gpt_timeout_ms) || 20000)),
        gpt_parallel: Math.max(1, Math.min(8, Number(gptForm.gpt_parallel) || 4)),
        gpt_max_teachers: Math.max(5, Math.min(120, Number(gptForm.gpt_max_teachers) || 60)),
      }),
    })
      .then(() => {
        toast.success('Ders programı GPT ayarları kaydedildi');
        load();
      })
      .catch((e: Error) => toast.error(e.message || 'Kaydedilemedi'))
      .finally(() => setGptSaving(false));
  };

  if (!me || me.role !== 'superadmin') return null;

  return (
    <>
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">Kaynak kod ve canlı ortam</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Depo adresi, CI/CD bağlantısı, canlı API ve web adresleri ile dağıtım notları. Gizli anahtar, SSH veya token
          eklemeyin; yalnızca ekip içi referans. Varsayılanlar uzaedu.com / GitHub ile uyumludur; kaydedince veritabanına
          yazılır.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Yükleniyor…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="devops-git-repo">Git deposu (HTTPS)</Label>
                <Input
                  id="devops-git-repo"
                  type="url"
                  placeholder="https://github.com/clgnuza/uzaedu.git"
                  value={form.git_repo_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, git_repo_url: e.target.value || null }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="devops-branch">Varsayılan dal</Label>
                <Input
                  id="devops-branch"
                  placeholder="main"
                  value={form.git_default_branch ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, git_default_branch: e.target.value || 'main' }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="devops-cicd">CI/CD veya Actions sayfası</Label>
                <Input
                  id="devops-cicd"
                  type="url"
                  placeholder="https://github.com/clgnuza/uzaedu/actions"
                  value={form.cicd_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, cicd_url: e.target.value || null }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="devops-api">Canlı API kökü</Label>
                <Input
                  id="devops-api"
                  type="url"
                  placeholder="https://api.uzaedu.com"
                  value={form.production_api_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, production_api_url: e.target.value || null }))}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="devops-web">Canlı web (Next) adresi</Label>
                <Input
                  id="devops-web"
                  type="url"
                  placeholder="https://uzaedu.com"
                  value={form.production_web_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, production_web_url: e.target.value || null }))}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="devops-notes">Dağıtım notları (checklist)</Label>
              <textarea
                id="devops-notes"
                rows={8}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[120px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Sunucu yolu, Docker DB, DNS, certbot, manuel SSH (API varsayılan notunu kullanmak için alanı boş kaydedin)."
                value={form.deploy_notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, deploy_notes: e.target.value || null }))}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                Kaydet
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" aria-hidden />
          <CardTitle className="text-base">Ders programı PDF GPT ayarları</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          PDF düşük güven olduğunda GPT fallback hız/kalite ayarları.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Yükleniyor…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-enabled">GPT fallback</Label>
                <select
                  id="tt-gpt-enabled"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={gptForm.gpt_enabled ? 'true' : 'false'}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_enabled: e.target.value === 'true' }))}
                >
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-model">Model</Label>
                <select
                  id="tt-gpt-model"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={gptForm.gpt_model}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_model: e.target.value }))}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-retry-enabled">Düşük güvende 2. model</Label>
                <select
                  id="tt-gpt-retry-enabled"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={gptForm.gpt_retry_enabled ? 'true' : 'false'}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_retry_enabled: e.target.value === 'true' }))}
                >
                  <option value="false">Kapalı</option>
                  <option value="true">Açık</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-retry-model">2. model</Label>
                <select
                  id="tt-gpt-retry-model"
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  value={gptForm.gpt_retry_model || 'gpt-5.2'}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_retry_model: e.target.value }))}
                  disabled={!gptForm.gpt_retry_enabled}
                >
                  {MODEL_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-timeout">Timeout (ms)</Label>
                <Input
                  id="tt-gpt-timeout"
                  type="number"
                  min={3000}
                  max={60000}
                  step={1000}
                  value={gptForm.gpt_timeout_ms}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_timeout_ms: Number(e.target.value) || 20000 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-parallel">Paralel öğretmen batch</Label>
                <Input
                  id="tt-gpt-parallel"
                  type="number"
                  min={1}
                  max={8}
                  step={1}
                  value={gptForm.gpt_parallel}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_parallel: Number(e.target.value) || 4 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-gpt-max-teachers">Maks öğretmen bloğu</Label>
                <Input
                  id="tt-gpt-max-teachers"
                  type="number"
                  min={5}
                  max={120}
                  step={1}
                  value={gptForm.gpt_max_teachers}
                  onChange={(e) => setGptForm((f) => ({ ...f, gpt_max_teachers: Number(e.target.value) || 60 }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveGpt} disabled={gptSaving} className="gap-2">
                {gptSaving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                GPT Ayarlarını Kaydet
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    <SuperadminDeployPanel />
    </>
  );
}
