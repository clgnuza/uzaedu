'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Loader2, Rocket } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LIVE_DEPLOY_API_BASE, resolveDeployApiBase } from '@/lib/deploy-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type DeployStatusPayload = {
  canDeploy: boolean;
  reason: 'ready' | 'disabled' | 'misconfigured' | 'windows';
  requiresHeaderToken: boolean;
  requiresIpAllowlist: boolean;
  runtimePlatform?: string;
};

const LIVE_ADMIN_ORIGIN = 'https://admin.uzaedu.com';

function statusMessage(reason: DeployStatusPayload['reason']): string {
  switch (reason) {
    case 'windows':
      return '';
    case 'disabled':
      return 'DEPLOY_ENABLED ayarı kapalı. Canlı sunucuda backend .env içinde DEPLOY_ENABLED=true yapın.';
    case 'misconfigured':
      return 'DEPLOY_SECRET ve DEPLOY_SCRIPT_PATH birlikte tanımlı olmalı.';
    default:
      return '';
  }
}

export function SuperadminDeployPanel() {
  const { token, me } = useAuth();
  const deployApiBase = resolveDeployApiBase();
  const [status, setStatus] = useState<DeployStatusPayload | null>(null);
  const [deployPassword, setDeployPassword] = useState('');
  const [deployHeaderToken, setDeployHeaderToken] = useState('');
  const [deployRunning, setDeployRunning] = useState(false);
  const [deployOutput, setDeployOutput] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(() => {
    if (!token || me?.role !== 'superadmin') return;
    apiFetch<DeployStatusPayload>('/deploy/status', {
      token,
      ...(deployApiBase ? { apiBase: deployApiBase } : {}),
    })
      .then(setStatus)
      .catch(() =>
        setStatus({
          canDeploy: false,
          reason: 'misconfigured',
          requiresHeaderToken: false,
          requiresIpAllowlist: false,
          runtimePlatform: undefined,
        }),
      );
  }, [token, me?.role, deployApiBase]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const requestConfirm = () => {
    if (!deployPassword.trim()) {
      toast.error('Dağıtım şifresini girin.');
      return;
    }
    if ((status?.requiresHeaderToken ?? false) && !deployHeaderToken.trim()) {
      toast.error('Ek doğrulama (DEPLOY_HEADER_TOKEN) gerekli.');
      return;
    }
    setConfirmOpen(true);
  };

  const runDeploy = () => {
    if (!token) return;
    setConfirmOpen(false);
    setDeployRunning(true);
    setDeployOutput(null);
    setDurationMs(null);
    const body: { deploy_password: string; deploy_header_token?: string } = {
      deploy_password: deployPassword,
    };
    if (deployHeaderToken.trim()) body.deploy_header_token = deployHeaderToken.trim();
    apiFetch<{ success: boolean; output: string; durationMs: number }>('/deploy/run', {
      method: 'POST',
      token,
      body: JSON.stringify(body),
      ...(deployApiBase ? { apiBase: deployApiBase } : {}),
    })
      .then((r) => {
        setDeployOutput(r.output ?? '');
        setDurationMs(typeof r.durationMs === 'number' ? r.durationMs : null);
        toast.success(
          `Tamamlandı${typeof r.durationMs === 'number' ? ` (${(r.durationMs / 1000).toFixed(1)} sn)` : ''}`,
        );
        setDeployPassword('');
        setDeployHeaderToken('');
      })
      .catch((e: Error) => {
        setDeployOutput(e.message || 'Hata');
        setDurationMs(null);
        toast.error(e.message || 'Dağıtım başarısız');
      })
      .finally(() => {
        setDeployRunning(false);
        loadStatus();
      });
  };

  const copyOutput = async () => {
    if (deployOutput == null) return;
    try {
      await navigator.clipboard.writeText(deployOutput);
      setCopied(true);
      toast.message('Panoya kopyalandı');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Kopyalanamadı');
    }
  };

  if (!me || me.role !== 'superadmin') return null;

  const apiBaseDisplay = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
  const looksLikeLocalApi = /localhost|127\.0\.0\.1/i.test(apiBaseDisplay);
  const deployTargetDisplay = deployApiBase ?? apiBaseDisplay;
  const normBase = (s: string) => s.trim().replace(/\/$/, '');
  const deployOverridesMain = Boolean(
    deployApiBase && normBase(deployApiBase) !== normBase(apiBaseDisplay),
  );

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">Sunucuyu güncelle</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            <span className="block">
              Uygulama API:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] break-all">{apiBaseDisplay}</code>
            </span>
            <span className="mt-2 block">
              Sunucu güncelleme (dağıtım) istekleri:{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px] break-all">{deployTargetDisplay}</code>
              {deployOverridesMain ? (
                <span className="ml-1 text-emerald-800/90 dark:text-emerald-200/85">
                  (localhost backend kullanırken otomatik canlı API; veya{' '}
                  <code className="rounded bg-muted px-0.5 text-[10px]">NEXT_PUBLIC_DEPLOY_API_BASE_URL</code>)
                </span>
              ) : null}
            </span>
            <span className="mt-2 block">
              Canlı sunucuda <code className="rounded bg-muted px-1 py-0.5 text-[11px]">DEPLOY_ENABLED=true</code>,{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">DEPLOY_SECRET</code> ve{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                DEPLOY_SCRIPT_PATH=/opt/uzaedu/scripts/deploy/server-deploy.sh
              </code>{' '}
              tanımlı olmalı. Şifre alanına aynı <code className="rounded bg-muted px-1 py-0.5 text-[11px]">DEPLOY_SECRET</code>{' '}
              yazılır; onay ile betik çalışır. Otomatik sürekli dağıtım yoktur.
            </span>
            {status?.requiresIpAllowlist ? (
              <span className="mt-2 block text-amber-800/90 dark:text-amber-200/90">
                Sunucu yalnızca izin verilen IP adreslerinden dağıtım kabul eder.
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {status === null ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Dağıtım durumu…
            </div>
          ) : !status.canDeploy ? (
            status.reason === 'windows' ? (
              <div className="space-y-3 rounded-lg border border-sky-500/35 bg-sky-500/5 px-3 py-3 text-xs leading-relaxed text-sky-950 dark:border-sky-500/30 dark:bg-sky-950/20 dark:text-sky-50/95">
                <p>
                  Bu istek <strong>Windows</strong> üzerinde çalışan backend’e gidiyor (
                  <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{status.runtimePlatform ?? 'win32'}</code>
                  ). Dağıtım betiği Linux’ta <code className="font-mono text-[11px]">/bin/bash</code> ile çalışır; yerel
                  Windows API’de panelden güncelleme yapılamaz.
                </p>
                {looksLikeLocalApi ? (
                  <>
                    <p className="font-medium text-foreground">Canlı sunucuyu güncellemek için:</p>
                    <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
                      <li>
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">web-admin/.env.local</code> içine örn.{' '}
                        <code className="break-all rounded bg-muted px-1 py-0.5 text-[11px]">
                          NEXT_PUBLIC_DEPLOY_API_BASE_URL={LIVE_DEPLOY_API_BASE}
                        </code>
                      </li>
                      <li>
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">NEXT_PUBLIC_SITE_URL={LIVE_ADMIN_ORIGIN}</code>{' '}
                        (aynı dosyada)
                      </li>
                      <li>
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">npm run dev</code> ile yeniden başlatın; süper
                        yönetici oturumuyla tekrar girin.
                      </li>
                    </ol>
                    <p>
                      Veya doğrudan{' '}
                      <a
                        href={`${LIVE_ADMIN_ORIGIN}/profile?tab=kaynak`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline underline-offset-2"
                      >
                        canlı panel — Kaynak &amp; dağıtım
                      </a>{' '}
                      sekmesini kullanın.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    API tabanı yine de Windows’ta; canlı Linux API adresine geçin (yukarıdaki{' '}
                    <code className="text-[11px]">NEXT_PUBLIC_API_BASE_URL</code>) veya canlı siteden deneyin.
                  </p>
                )}
              </div>
            ) : (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100/90">
                {statusMessage(status.reason)}
              </p>
            )
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="deploy-pw">Dağıtım şifresi</Label>
                <Input
                  id="deploy-pw"
                  type="password"
                  autoComplete="new-password"
                  placeholder="DEPLOY_SECRET ile aynı"
                  value={deployPassword}
                  onChange={(e) => setDeployPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !deployRunning && deployPassword.trim()) {
                      e.preventDefault();
                      requestConfirm();
                    }
                  }}
                  disabled={deployRunning}
                />
              </div>
              {status.requiresHeaderToken ?? false ? (
                <div className="space-y-2">
                  <Label htmlFor="deploy-hdr">Ek doğrulama</Label>
                  <Input
                    id="deploy-hdr"
                    type="password"
                    autoComplete="new-password"
                    placeholder="DEPLOY_HEADER_TOKEN ile aynı"
                    value={deployHeaderToken}
                    onChange={(e) => setDeployHeaderToken(e.target.value)}
                    disabled={deployRunning}
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={requestConfirm}
                  disabled={
                    deployRunning ||
                    !deployPassword.trim() ||
                    ((status.requiresHeaderToken ?? false) && !deployHeaderToken.trim())
                  }
                  className="gap-2"
                >
                  {deployRunning ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Rocket className="size-4" aria-hidden />
                  )}
                  Güncelle
                </Button>
                <span className="text-[11px] text-muted-foreground">Enter ile onay penceresini açar.</span>
              </div>
              {deployOutput !== null && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Çıktı</p>
                      {durationMs != null && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {(durationMs / 1000).toFixed(1)} sn
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={copyOutput}
                    >
                      {copied ? (
                        <Check className="size-3.5 text-green-600" aria-hidden />
                      ) : (
                        <Copy className="size-3.5" aria-hidden />
                      )}
                      Kopyala
                    </Button>
                  </div>
                  <pre
                    className={cn(
                      'max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all',
                      deployOutput.includes('Betik çıkış kodu') ? 'border-destructive/40 bg-destructive/5' : '',
                    )}
                  >
                    {deployOutput}
                  </pre>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent title="Dağıtımı onayla">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sunucuda tanımlı dağıtım betiği çalıştırılacak (ör. git pull, build, servis yenileme). Kısa süreli kesinti
            olabilir. Devam edilsin mi?
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={runDeploy} className="gap-2">
              <Rocket className="size-4" aria-hidden />
              Evet, çalıştır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
