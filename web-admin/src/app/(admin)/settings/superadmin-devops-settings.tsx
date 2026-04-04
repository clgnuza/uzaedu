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

export function SuperadminDevopsSettings() {
  const { token, me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DevOpsConfig>({
    git_repo_url: 'https://github.com/clgnuza/uzaedu.git',
    git_default_branch: 'main',
    cicd_url: 'https://github.com/clgnuza/uzaedu/actions',
    production_api_url: 'https://api.uzaedu.com',
    production_web_url: 'https://admin.uzaedu.com',
    deploy_notes: null,
  });

  const load = useCallback(() => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    apiFetch<DevOpsConfig>('/app-config/devops', { token })
      .then((d) =>
        setForm({
          git_repo_url: d.git_repo_url ?? null,
          git_default_branch: d.git_default_branch ?? 'main',
          cicd_url: d.cicd_url ?? null,
          production_api_url: d.production_api_url ?? null,
          production_web_url: d.production_web_url ?? null,
          deploy_notes: d.deploy_notes ?? null,
        }),
      )
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
                  placeholder="https://admin.uzaedu.com"
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

    <SuperadminDeployPanel />
    </>
  );
}
