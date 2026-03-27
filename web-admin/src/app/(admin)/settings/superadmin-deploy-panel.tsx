'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, Loader2, Rocket } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
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
};

function statusMessage(reason: DeployStatusPayload['reason']): string {
  switch (reason) {
    case 'windows':
      return 'Bu API Windows üzerinde çalışıyor; panel dağıtımı yalnızca Linux sunucuda (/bin/bash) kullanılabilir.';
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
    apiFetch<DeployStatusPayload>('/deploy/status', { token })
      .then(setStatus)
      .catch(() =>
        setStatus({
          canDeploy: false,
          reason: 'misconfigured',
          requiresHeaderToken: false,
          requiresIpAllowlist: false,
        }),
      );
  }, [token, me?.role]);

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

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Rocket className="size-4 text-muted-foreground" aria-hidden />
            <CardTitle className="text-base">Sunucuyu güncelle</CardTitle>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            Şifre + onay ile sunucudaki dağıtım betiği çalışır (git pull, build, yeniden başlatma). Sürekli otomatik
            dağıtım yoktur.
            {status?.requiresIpAllowlist ? (
              <span className="mt-1 block text-amber-800/90 dark:text-amber-200/90">
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
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-100/90">
              {statusMessage(status.reason)}
            </p>
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
