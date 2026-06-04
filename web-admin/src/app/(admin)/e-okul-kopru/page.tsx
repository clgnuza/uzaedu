'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchEokulBridgeBootstrap,
  fetchEokulBridgeStatus,
  type EokulBridgeBootstrap,
  type EokulBridgeMenu,
  type EokulBridgeStatus,
} from '@/lib/eokul-bridge-api';
import { OKUL_KOPRUSU_MARKET_HREF, okulKoprusuChromeStoreUrl } from '@/lib/eokul-bridge-links';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SchoolBridgeLicenseCard } from '@/components/eokul-bridge/school-bridge-license-card';
import { cn } from '@/lib/utils';
import {
  Puzzle,
  Chrome,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  Link2,
  ChevronRight,
  Sparkles,
  School,
  MessageSquare,
  Mic,
  Wallet,
  CalendarDays,
  Download,
  Store,
} from 'lucide-react';

const FEATURE_LINKS = [
  {
    icon: MessageSquare,
    title: 'Devamsızlık mektubu',
    href: '/mesaj-merkezi/devamsizlik-mektup',
    desc: 'Köprü alıcı listesi → mesaj merkezi PDF',
  },
  {
    icon: FileText,
    title: 'Karne / ara karne',
    href: '/mesaj-merkezi/karne',
    desc: 'Yalnız panel üzerinden',
  },
  {
    icon: Mic,
    title: 'Sesli rapor',
    href: 'https://e-okul.meb.gov.tr/',
    external: true,
    desc: 'E-Okul sayfasında köprü komutları',
  },
  {
    icon: Wallet,
    title: 'MEBBİS / KBS bordro',
    href: '/mesaj-merkezi/kbs-maas',
    desc: 'Excel → panel bordro',
  },
  {
    icon: CalendarDays,
    title: 'Ders dağıtım veli PDF',
    href: '/ders-dagit/studyo/atamalar',
    desc: 'Panel export',
  },
] as const;

function StatusChip({
  ok,
  label,
  sub,
}: {
  ok: boolean | null;
  label: string;
  sub?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5',
        ok === true && 'border-emerald-500/25 bg-emerald-500/8',
        ok === false && 'border-destructive/25 bg-destructive/8',
        ok === null && 'border-border/80 bg-muted/30',
      )}
    >
      {ok === null ? (
        <LoadingSpinner className="h-4 w-4 shrink-0" />
      ) : ok ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground sm:text-sm">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground sm:text-xs">{sub}</p>}
      </div>
    </div>
  );
}

export default function EOkulKopruPage() {
  const { token, me } = useAuth();
  const [status, setStatus] = useState<EokulBridgeStatus | null>(null);
  const [bootstrap, setBootstrap] = useState<EokulBridgeBootstrap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const chromeStoreUrl = okulKoprusuChromeStoreUrl();

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

  const modules = useMemo(() => {
    if (!bootstrap?.menuIds) return [];
    return bootstrap.menuIds
      .filter((id) => id !== 'oturumAcik')
      .map((id) => {
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
        return { id, m, kurum };
      })
      .filter((x): x is { id: string; m: EokulBridgeMenu; kurum: string } => !!x);
  }, [bootstrap]);

  const schoolLabel = me?.school?.name || me?.display_name || me?.email;

  return (
    <div className="isolate min-h-0 w-full max-w-full overflow-x-hidden pb-8">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-6">
        {/* Hero */}
        <section className="relative isolate overflow-hidden rounded-2xl border border-teal-500/20 bg-linear-to-br from-teal-600 via-emerald-600 to-cyan-700 px-4 py-5 text-white shadow-md sm:px-6 sm:py-6">
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 sm:h-14 sm:w-14">
                <Puzzle className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 sm:text-xs">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Okul Köprüsü
                </p>
                <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">E-Okul Köprüsü</h1>
                <p className="mt-1.5 text-xs leading-relaxed text-white/90 sm:text-sm">
                  Chrome Web Store eklentisi ile e-Okul verilerini panele taşıyın.
                </p>
                {schoolLabel && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/75 sm:text-xs">
                    <School className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{schoolLabel}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {chromeStoreUrl ? (
                <Button
                  size="sm"
                  className="h-10 w-full border-0 bg-white text-teal-800 hover:bg-white/90 sm:flex-1"
                  asChild
                >
                  <a href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Chrome Web Store&apos;dan yükle
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5 opacity-70" />
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled
                  className="h-10 w-full border border-white/30 bg-white/10 text-white sm:flex-1"
                  title="NEXT_PUBLIC_OKUL_KOPRUSU_CHROME_STORE_URL tanımlanmalı"
                >
                  <Store className="mr-2 h-4 w-4" />
                  Mağaza bağlantısı yakında
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-10 w-full border-white/30 bg-white/10 text-white hover:bg-white/20 sm:flex-1"
                asChild
              >
                <Link href={OKUL_KOPRUSU_MARKET_HREF}>Modülü Market&apos;ten aç</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <StatusChip
                ok={loading ? null : status?.extensionEnabled ?? false}
                label="Köprü API"
                sub={loading ? '…' : status?.extensionEnabled ? 'Açık' : 'Kapalı'}
              />
              <StatusChip
                ok={loading ? null : !err}
                label="Panel"
                sub={err ? 'Hata' : loading ? '…' : 'Hazır'}
              />
              <StatusChip
                ok={true}
                label="Min. sürüm"
                sub={status?.minExtensionVersion ?? bootstrap?.minExtensionVersion ?? '—'}
              />
            </div>
          </div>
        </section>

        {err && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {err}
          </p>
        )}

        {/* Kurulum — mağaza */}
        <Card className="relative z-0 shrink-0 overflow-hidden rounded-2xl border-teal-500/20 shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Chrome className="h-4 w-4 text-teal-600" />
              Kurulum (Chrome Web Store)
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Öğretmen ve okul yöneticileri eklentiyi mağazadan yükler; paketlenmemiş kurulum gerekmez.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
            <ol className="space-y-3">
              {[
                {
                  title: 'Market modülü',
                  body: (
                    <>
                      Okulunuzda{' '}
                      <Link href={OKUL_KOPRUSU_MARKET_HREF} className="font-medium text-primary underline">
                        Okul Köprüsü modülünü
                      </Link>{' '}
                      etkinleştirin.
                    </>
                  ),
                },
                {
                  title: 'Chrome Web Store',
                  body: chromeStoreUrl ? (
                    <>
                      <strong className="text-foreground">Uzaedu Okul Köprüsü</strong> eklentisini yükleyin veya
                      güncelleyin.
                    </>
                  ) : (
                    'Mağaza yayını sonrası bu sayfadaki «Chrome Web Store\'dan yükle» düğmesi aktif olur.'
                  ),
                },
                {
                  title: 'Okul (isteğe bağlı kod)',
                  body: 'Market modülü yeterlidir. İsterseniz panelden okul kodu oluşturup paylaşabilirsiniz.',
                },
                {
                  title: 'Bağlantı',
                  body: (
                    <>
                      Bu panelde oturum açın,{' '}
                      <a
                        href="https://e-okul.meb.gov.tr/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary underline"
                      >
                        E-Okul
                      </a>{' '}
                      sekmesini açık bırakın, araç çubuğundaki eklenti simgesinden köprüyü başlatın.
                    </>
                  ),
                },
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 pt-0.5 text-sm">
                    <p className="font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-2 sm:flex-row">
              {chromeStoreUrl && (
                <Button className="w-full sm:flex-1" asChild>
                  <a href={chromeStoreUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Mağazada aç
                  </a>
                </Button>
              )}
              <Button variant="outline" className="w-full sm:flex-1" asChild>
                <a href="https://e-okul.meb.gov.tr/" target="_blank" rel="noopener noreferrer">
                  E-Okul
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative z-0">
          <SchoolBridgeLicenseCard token={token} />
        </div>

        {modules.length > 0 && (
          <Card className="relative z-0 shrink-0 overflow-hidden rounded-2xl shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-5">
              <CardTitle className="text-base font-semibold">Eklenti modülleri</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Köprü menüsündeki özellikler</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 sm:p-4">
              {modules.map(({ id, m, kurum }) => (
                <div
                  key={id}
                  className={cn(
                    'rounded-xl border p-3',
                    m.enabled ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border/70',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                        m.enabled ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {m.enabled ? 'Aktif' : `Faz ${m.phase}`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{kurum}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{m.label}</p>
                  {m.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{m.description}</p>
                  )}
                  {m.panelPath && (
                    <Link
                      href={m.panelPath}
                      className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
                    >
                      Panele git
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="relative z-0 shrink-0 overflow-hidden rounded-2xl shadow-sm">
          <CardHeader className="border-b border-border/60 bg-muted/30 px-4 py-4 sm:px-5">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Link2 className="h-4 w-4 text-primary" />
              Panel entegrasyonları
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-3 sm:p-4">
            {FEATURE_LINKS.map((f) => {
              const Icon = f.icon;
              const cls =
                'flex w-full items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition-colors hover:bg-muted/40';
              const inner = (
                <>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              );
              return 'external' in f && f.external ? (
                <a key={f.title} href={f.href} target="_blank" rel="noopener noreferrer" className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={f.title} href={f.href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {status?.portalOrigin && (
          <p className="px-1 text-center text-[10px] text-muted-foreground sm:text-xs">
            Panel kökü: <code className="rounded bg-muted px-1">{status.portalOrigin}</code>
          </p>
        )}
      </div>
    </div>
  );
}
