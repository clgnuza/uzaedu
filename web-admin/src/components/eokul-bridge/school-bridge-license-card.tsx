'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  fetchEokulBridgeSchoolAccessAdmin,
  regenerateEokulBridgeSchoolCode,
  type EokulBridgeSchoolAccessAdmin,
} from '@/lib/eokul-bridge-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { Copy, KeyRound, RefreshCw, ShoppingBag, ShieldCheck } from 'lucide-react';

function LicensePill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:text-xs',
        className,
      )}
    >
      {children}
    </span>
  );
}

type Props = {
  token: string | null;
};

export function SchoolBridgeLicenseCard({ token }: Props) {
  const [data, setData] = useState<EokulBridgeSchoolAccessAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [revealedCode, setRevealedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setErr(null);
    try {
      const d = await fetchEokulBridgeSchoolAccessAdmin(token);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRegenerate = async (tier: 'free' | 'paid') => {
    if (!token) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await regenerateEokulBridgeSchoolCode(token, tier);
      setRevealedCode(r.code);
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const displayCode = revealedCode || data?.code;

  if (loading) {
    return (
      <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm">
        <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoadingSpinner className="h-5 w-5" />
          Okul lisansı yükleniyor…
        </CardContent>
      </Card>
    );
  }

  if (!token) return null;

  return (
    <Card className="overflow-hidden rounded-2xl border-violet-500/20 shadow-sm">
      <CardHeader className="border-b border-violet-500/10 bg-linear-to-r from-violet-500/10 via-transparent to-teal-500/5 px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <KeyRound className="h-4 w-4" />
          </span>
          Okul aktivasyonu
        </CardTitle>
        <CardDescription className="text-xs leading-relaxed sm:text-sm">
          Market modülü açıksa eklenti doğrudan çalışır. İsteğe bağlı okul kodu (paylaşım / denetim).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-6">
        {err && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </p>
        )}

        {data?.school && (
          <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
            <p className="text-base font-semibold tracking-tight">{data.school.name}</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {[data.school.district, data.school.city].filter(Boolean).join(' / ')}
              {data.school.institutionCode ? ` · Kurum ${data.school.institutionCode}` : ''}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <LicensePill
                className={
                  data.moduleEnabled
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {data.moduleEnabled ? 'Modül açık' : 'Modül kapalı'}
              </LicensePill>
              {data.canUseBridge && (
                <LicensePill className="gap-1 border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200">
                  <ShieldCheck className="h-3 w-3" />
                  Köprü hazır
                </LicensePill>
              )}
            </div>
          </div>
        )}

        {!data?.moduleEnabled && (
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/market?module=okul_koprusu">
              <ShoppingBag className="mr-2 h-3.5 w-3.5" />
              Market — Okul Köprüsü modülünü aç
            </Link>
          </Button>
        )}

        {displayCode ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Aktivasyon kodu</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="flex-1 break-all rounded-xl border bg-muted/50 px-3 py-3 text-center font-mono text-sm tracking-wide sm:text-left">
                {displayCode}
              </code>
              <Button
                type="button"
                size="sm"
                variant={copied ? 'default' : 'secondary'}
                className="w-full shrink-0 sm:w-auto"
                onClick={() => void onCopy(displayCode)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {copied ? 'Kopyalandı' : 'Kopyala'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            Henüz kod yok. İsterseniz aşağıdan oluşturun.
          </p>
        )}

        {data?.codeMasked && !displayCode && (
          <p className="text-xs text-muted-foreground">Kayıtlı kod: {data.codeMasked}</p>
        )}

        <Button type="button" size="sm" className="w-full sm:w-auto" disabled={busy} onClick={() => void onRegenerate('paid')}>
          <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', busy && 'animate-spin')} />
          {data?.license ? 'Kodu yenile' : 'Kod oluştur'}
        </Button>

        {data?.message && (
          <p className="text-xs leading-relaxed text-muted-foreground">{data.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
