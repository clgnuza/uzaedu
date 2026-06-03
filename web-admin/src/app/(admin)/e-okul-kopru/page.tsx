'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchEokulBridgeBootstrap,
  fetchEokulBridgeStatus,
  type EokulBridgeBootstrap,
  type EokulBridgeStatus,
} from '@/lib/eokul-bridge-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Puzzle, Chrome, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';

const EXT_DIR = 'chrome-extension/uzaedu-eokul-bridge';

export default function EOkulKopruPage() {
  const { token, me } = useAuth();
  const [status, setStatus] = useState<EokulBridgeStatus | null>(null);
  const [bootstrap, setBootstrap] = useState<EokulBridgeBootstrap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [s, b] = await Promise.all([
          fetchEokulBridgeStatus(token),
          fetchEokulBridgeBootstrap(token),
        ]);
        if (!cancelled) {
          setStatus(s);
          setBootstrap(b);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/25">
          <Puzzle className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">E-Okul Köprüsü</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chrome eklentisi ile E-Okul verilerini panele alın ve panelden E-Okul işlemlerini yürütün.
          </p>
        </div>
      </div>

      <Card variant="teal" className="border-teal-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Chrome className="h-4 w-4" />
            Kurulum
          </CardTitle>
          <CardDescription>Geliştirme ortamı — paketlenmemiş eklenti</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Backend ve web-admin çalışır durumda olsun.</li>
            <li>
              Chrome →{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">chrome://extensions</code> → Geliştirici
              modu.
            </li>
            <li>
              <strong className="text-foreground">Paketlenmemiş öğe yükle</strong> → repo içinde{' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{EXT_DIR}</code>
            </li>
            <li>
              <a href="https://e-okul.meb.gov.tr/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                E-Okul
              </a>{' '}
              ve bu panelde oturum açık kalsın; eklenti simgesine tıklayın.
            </li>
          </ol>
          <Button variant="outline" size="sm" asChild>
            <a href="https://e-okul.meb.gov.tr/" target="_blank" rel="noopener noreferrer">
              E-Okul&apos;u aç
              <ExternalLink className="ml-2 h-3.5 w-3.5" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sunucu durumu</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoadingSpinner className="h-4 w-4" />
              Kontrol ediliyor…
            </div>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
          {!loading && status && (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                {status.extensionEnabled ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                Köprü API: {status.extensionEnabled ? 'Açık' : 'Kapalı'}
              </li>
              <li className="text-muted-foreground">
                Min. eklenti sürümü: <strong className="text-foreground">{status.minExtensionVersion}</strong>
              </li>
              <li className="text-muted-foreground">
                Panel kökü: <code className="text-xs">{status.portalOrigin}</code>
              </li>
              {me && (
                <li className="text-muted-foreground">
                  Oturum: {me.display_name || me.email} {me.school_id ? `(okul: ${me.school_id.slice(0, 8)}…)` : ''}
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PDF ve raporlar</CardTitle>
          <CardDescription>OBS / EduPanel karşılaştırması — Uzaedu 0.3.1</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-foreground">Devamsızlık mektubu:</strong> köprü alıcı listesini çeker →{' '}
              <a href="/mesaj-merkezi/devamsizlik-mektup" className="text-primary underline">
                mesaj merkezi
              </a>{' '}
              PDF üretir (OBS ile aynı mantık, PDF eklentide değil).
            </li>
            <li>
              <strong className="text-foreground">Karne / ara karne:</strong> yalnız panel (
              <a href="/mesaj-merkezi/karne" className="text-primary underline">
                karne
              </a>
              , ara karne).
            </li>
            <li>
              <strong className="text-foreground">Veli izin dilekçesi PDF:</strong> özürsüz→özürlü menüsü (neden
              İ/1); API <code className="text-xs">POST /api/eokul-bridge/v1/ozur/veli-izin-pdf</code>
            </li>
            <li>
              <strong className="text-foreground">Sesli rapor:</strong> E-Okul sayfasında temel komutlar (köprü content script).
            </li>
            <li>
              <strong className="text-foreground">MEBBİS / KBS bordro:</strong> eklentide 3 modül — Excel →{' '}
              <code className="text-xs">/messaging/bordro/*</code> (panel ile aynı)
            </li>
            <li>
              <strong className="text-foreground">Ders dağıtım veli PDF:</strong> panel export (
              <a href="/ders-dagit/studyo/atamalar" className="text-primary underline">
                atamalar
              </a>
              ).
            </li>
          </ul>
          <p className="text-xs">
            Tam modül matrisi: repo{' '}
            <code className="rounded bg-muted px-1 py-0.5">{EXT_DIR}/README.md</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referans eklentiler</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">OBS 3.12.7</strong> — portal + offscreen; veli PDF, geniş öğrenci
            dosyası, okul öncesi.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">EduPanel 2.0.8</strong> — E-Okul içi günlük panel, sesli rapor,
            confirm bypass; veri çoğunlukla E-Okul’da kalır.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">Uzaedu köprü</strong> — veri panele, kampanya / kelebek / rehber;
            yazma işlemleri SW fetch.
          </p>
        </CardContent>
      </Card>

      {bootstrap && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktif modüller</CardTitle>
            <CardDescription>Eklenti menüsünde kullanılabilir</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(bootstrap.menuIds ?? []).map((id) => {
                if (id === 'oturumAcik') return null;
                const m = bootstrap.extensionUi?.menus?.[id];
                const meta = bootstrap.menusMeta?.[id as keyof typeof bootstrap.menusMeta] as
                  | { supportedKurumKeys?: string[] }
                  | undefined;
                if (!m) return null;
                const kurum =
                  meta?.supportedKurumKeys?.length === 2
                    ? 'İlk + orta'
                    : meta?.supportedKurumKeys?.includes('ortaOgretim')
                      ? 'Orta'
                      : 'İlk';
                return (
                  <li key={id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
                    <span className={`text-xs font-medium ${m.enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {m.enabled ? 'Aktif' : `Faz ${m.phase}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{kurum}</span>
                    <span className="min-w-0 flex-1 font-medium">{m.label}</span>
                    <span className="w-full text-xs text-muted-foreground sm:w-auto">{m.description}</span>
                    {m.panelPath && (
                      <a href={m.panelPath} className="text-xs text-primary underline">
                        Panel
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
