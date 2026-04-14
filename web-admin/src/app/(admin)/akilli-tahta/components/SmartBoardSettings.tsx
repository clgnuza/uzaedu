'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Monitor,
  MapPin,
  Tv,
  Users,
  Settings,
  Shield,
  Usb,
  Download,
  ExternalLink,
  Server,
  Archive,
  ChevronDown,
  Terminal,
  Package,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { buildPardusTahtaKioskZip, downloadPardusTahtaKioskZip } from '@/lib/pardus-tahta-kiosk-pack';
import { downloadSmartBoardUsbLauncher } from '@/lib/smart-board-usb-launcher';
import { cn } from '@/lib/utils';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

const TIMEOUT_OPTIONS = [1, 2, 5, 10, 15, 30];

type DeviceForSettings = { id: string; name: string; roomOrLocation: string | null; classSection?: string | null };

export function SmartBoardSettings({
  schoolId,
  token,
  canManage,
  devices,
  authorizedCount,
  onSaved,
}: {
  schoolId: string;
  token: string | null;
  canManage: boolean;
  devices: DeviceForSettings[];
  authorizedCount: number;
  classSections?: string[];
  onSaved?: () => void;
  onEditDevice?: (d: DeviceForSettings) => void;
}) {
  const [autoAuthorize, setAutoAuthorize] = useState(false);
  const [restrictToOwnClasses, setRestrictToOwnClasses] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(2);
  const [notifyOnDisconnect, setNotifyOnDisconnect] = useState(true);
  const [autoDisconnectLessonEnd, setAutoDisconnectLessonEnd] = useState(false);
  const [tvAllowedIps, setTvAllowedIps] = useState<string | null>(null);
  const [usbKiosk, setUsbKiosk] = useState(true);
  const [tahtaKilit, setTahtaKilit] = useState(true);
  const [panelOrigin, setPanelOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPanelOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  useEffect(() => {
    if (!token || !schoolId) return;
    setLoading(true);
    apiFetch<{
      smartBoardAutoAuthorize?: boolean;
      smartBoardRestrictToOwnClasses?: boolean;
      smartBoardSessionTimeoutMinutes?: number;
      smartBoardNotifyOnDisconnect?: boolean;
      smartBoardAutoDisconnectLessonEnd?: boolean;
      tv_allowed_ips?: string | null;
    }>(`/schools/${schoolId}`, { token })
      .then((s) => {
        setAutoAuthorize(s?.smartBoardAutoAuthorize ?? false);
        setRestrictToOwnClasses(s?.smartBoardRestrictToOwnClasses ?? false);
        setSessionTimeout(s?.smartBoardSessionTimeoutMinutes ?? 2);
        setNotifyOnDisconnect(s?.smartBoardNotifyOnDisconnect ?? true);
        setAutoDisconnectLessonEnd(s?.smartBoardAutoDisconnectLessonEnd ?? false);
        setTvAllowedIps(s?.tv_allowed_ips ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, schoolId]);

  const handleSave = async () => {
    if (!token || !schoolId || !canManage) return;
    setSaving(true);
    try {
      await apiFetch(`/schools/${schoolId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          smart_board_auto_authorize: autoAuthorize,
          smart_board_restrict_to_own_classes: restrictToOwnClasses,
          smart_board_session_timeout_minutes: sessionTimeout,
          smart_board_notify_on_disconnect: notifyOnDisconnect,
          smart_board_auto_disconnect_lesson_end: autoDisconnectLessonEnd,
        }),
        token,
      });
      toast.success('Ayarlar kaydedildi.');
      onSaved?.();
    } catch {
      toast.error('Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const settingRows = [
    {
      label: 'Otomatik yetki',
      hint: 'Açık: Tüm öğretmenler bağlanabilir. Kapalı: Sadece Yetkiler listesindekiler.',
      value: autoAuthorize,
      set: setAutoAuthorize,
    },
    {
      label: 'Sadece dersi olan sınıflara',
      hint: 'Öğretmen yalnızca ders verdiği sınıfların tahtalarına bağlanır (Ders Programına göre).',
      value: restrictToOwnClasses,
      set: setRestrictToOwnClasses,
    },
    {
      label: 'Bağlantı kesildiğinde bildir',
      hint: 'İdare bağlantıyı sonlandırdığında öğretmene Inbox bildirimi gider.',
      value: notifyOnDisconnect,
      set: setNotifyOnDisconnect,
    },
    {
      label: 'Ders saati bitince otomatik kes',
      hint: 'Son ders saati geçtiğinde bağlantı otomatik sonlanır (Okul Ayarları → Ders saatleri gerekli).',
      value: autoDisconnectLessonEnd,
      set: setAutoDisconnectLessonEnd,
    },
  ];

  const ipListActive = !!(tvAllowedIps && tvAllowedIps.trim());

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-8 sm:space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-linear-to-br from-slate-500/8 via-background to-rose-500/5 p-4 dark:border-slate-800 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
              <span className="flex size-9 items-center justify-center rounded-xl bg-slate-500/15">
                <Settings className="size-4 text-slate-700 dark:text-slate-300" />
              </span>
              Akıllı tahta ayarları
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Oturum politikası, kapalı devre erişim (TV ile aynı IP kuralı), USB’den sınıf tahtası açılışı ve Pardus 23 Etap
              için öneriler tek sayfada toplandı.
            </p>
          </div>
          {panelOrigin && (
            <div className="shrink-0 rounded-lg border bg-card/80 px-3 py-2 text-[10px] text-muted-foreground backdrop-blur sm:text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Server className="size-3.5" />
                Panel adresi
              </div>
              <code className="mt-1 block break-all font-mono text-[10px] sm:text-xs">{panelOrigin}</code>
              <p className="mt-1 opacity-90">USB yönlendirici bu kökü kullanır.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-slate-300/45 shadow-sm dark:border-slate-700">
          <CardHeader className="border-b border-border/60 bg-slate-500/6 px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/12">
                <Monitor className="size-4 text-primary" />
              </span>
              Bağlantı ve oturum
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Öğretmen–tahta oturumu ve yetki davranışı.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-4 sm:px-6 sm:py-5">
            {loading ? (
              <p className="text-xs text-muted-foreground sm:text-sm">Yükleniyor…</p>
            ) : (
              <div className="space-y-4">
                {settingRows.map((r) => (
                  <div key={r.label} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium sm:text-sm">{r.label}</span>
                      <Toggle checked={r.value} onChange={r.set} disabled={!canManage} />
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-xs">{r.hint}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium sm:text-sm">Bağlantı süresi (heartbeat)</span>
                    <Select value={String(sessionTimeout)} onValueChange={(v) => setSessionTimeout(Number(v))} disabled={!canManage}>
                      <SelectTrigger className="h-8 w-24 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEOUT_OPTIONS.map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v} dk
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Sinyal gelmezse oturum bu sürede sonlanır; kapalı devrede ağ gecikmelerine göre 5–10 dk deneyin.</p>
                </div>
                {canManage && (
                  <Button onClick={handleSave} disabled={saving} size="sm" className="h-9 w-full sm:w-auto">
                    {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-amber-200/40 shadow-sm dark:border-amber-900/30">
          <CardHeader className="border-b border-border/60 bg-amber-500/8 px-4 py-3 sm:px-6 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15">
                <Shield className="size-4 text-amber-800 dark:text-amber-200" />
              </span>
              Kapalı devre ve erişim
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Sınıf tahtası ve duyuru TV aynı IP kuralını kullanır; yalnızca okul içi ağa izin verin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 py-4 text-xs sm:px-6 sm:py-5 sm:text-sm">
            <div
              className={cn(
                'rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3',
                ipListActive
                  ? 'border-emerald-500/35 bg-emerald-500/8'
                  : 'border-amber-500/35 bg-amber-500/8',
              )}
            >
              <p className="font-medium text-foreground">İzinli IP listesi</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
                {ipListActive ? (
                  <>
                    Kısıtlama <strong className="text-foreground">açık</strong>. Aşağıdaki kurallar TV ve{' '}
                    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">/tv/classroom</code> için geçerli.
                  </>
                ) : (
                  <>
                    Şu an <strong className="text-foreground">tüm IP’ler</strong> kabul ediliyor. Kapalı devrede mutlaka okul subnet’lerinizi girin.
                  </>
                )}
              </p>
              {ipListActive ? (
                <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background/80 p-2 font-mono text-[10px] sm:text-xs">
                  {tvAllowedIps}
                </pre>
              ) : null}
            </div>
            <ul className="list-disc space-y-1 pl-4 text-[10px] text-muted-foreground sm:text-xs">
              <li>Proxy / TLS sonlandırma kullanıyorsanız gerçek istemci IP’sinin backend’e iletildiğinden emin olun (X-Forwarded-For).</li>
              <li>Tahta tarayıcılarında yalnızca okul paneli ve gerekli adreslere izin verin; şüpheli eklentileri kapatın.</li>
              <li>HTTPS ve kurum içi sertifika: Pardus’ta CA’yı sistem ve tarayıcı (NSS) deposuna ekleyin.</li>
            </ul>
            <Button variant="outline" size="sm" className="h-9 w-full gap-1.5 sm:w-fit" asChild>
              <Link href="/tv">
                <Tv className="size-4 shrink-0" />
                Duyuru TV’de IP listesini düzenle
                <ExternalLink className="size-3.5 opacity-60" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden border-cyan-500/25 shadow-md shadow-cyan-500/5 dark:border-cyan-400/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_100%_0%,rgba(6,182,212,0.12),transparent_55%),radial-gradient(700px_circle_at_0%_100%,rgba(59,130,246,0.08),transparent_50%)] dark:bg-[radial-gradient(900px_circle_at_100%_0%,rgba(34,211,238,0.08),transparent_55%)]"
        />
        <CardHeader className="relative border-b border-cyan-500/15 bg-linear-to-r from-cyan-500/10 via-background/80 to-sky-500/8 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-700 shadow-inner ring-1 ring-cyan-500/20 dark:text-cyan-300">
                  <Usb className="size-5" />
                </span>
                <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-900 dark:text-cyan-100">
                  Pardus 23 · Chromium
                </span>
              </div>
              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Tahta kurulum paketleri</CardTitle>
              <CardDescription className="max-w-2xl text-xs leading-relaxed sm:text-sm">
                Her cihaz için ayrı indirme: USB’de tek HTML; Pardus’ta ZIP ile kiosk, yönetilen politika ve oturum açılışı — panel + API (+ slayt YouTube) dışı engelli.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm sm:max-w-xs sm:text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Terminal className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                Tahtada özet
              </div>
              <ol className="mt-1 w-full space-y-1.5">
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[9px] font-bold text-foreground">
                    1
                  </span>
                  <span>
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">apt install chromium</code> (+ isteğe bağlı{' '}
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">x11-xserver-utils</code>)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[9px] font-bold text-foreground">
                    2
                  </span>
                  <span>ZIP’i açın, çalıştırılabilir yapın, ardından</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-cyan-500/20 font-mono text-[9px] font-bold text-cyan-900 dark:text-cyan-100">
                    3
                  </span>
                  <span>
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">sudo make install</code> veya{' '}
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">sudo ./install.sh</code>
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground sm:text-sm">Tam ekran kiosk</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">URL’de kiosk=1</p>
              </div>
              <Toggle checked={usbKiosk} onChange={setUsbKiosk} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground sm:text-sm">Tahta kilidi</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">Yalnız duyuru slaytı · kilit=1</p>
              </div>
              <Toggle checked={tahtaKilit} onChange={setTahtaKilit} />
            </div>
          </div>
          <p className="rounded-xl border border-dashed border-cyan-500/25 bg-cyan-500/4 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground sm:px-4 sm:text-xs">
            Kilit açıkken yan panel, RSS, hava ve alt şeritler kapanır; PIN sonrası yalnız okul duyuruları döner. Tarayıcı dışına çıkış Chromium politikasıyla engellenir.
          </p>

          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-10 text-center">
              <Package className="size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Henüz tahta yok</p>
              <p className="max-w-sm text-xs text-muted-foreground">Cihazlar sekmesinden tahta ekleyin; ardından bu listeden indirin.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">Cihaz başına indir</p>
              <ul className="space-y-2">
                {devices.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/20 to-sky-500/15 text-cyan-800 dark:text-cyan-200">
                          <Monitor className="size-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{d.name}</p>
                          <p className="text-[10px] text-muted-foreground sm:text-xs">
                            Sınıf: <span className="text-foreground/90">{d.classSection || '—'}</span>
                            {d.roomOrLocation ? (
                              <>
                                {' '}
                                · <span className="text-foreground/80">{d.roomOrLocation}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 flex-1 gap-1.5 rounded-xl text-xs sm:flex-initial"
                        disabled={!panelOrigin}
                        onClick={() => {
                          if (!panelOrigin) {
                            toast.error('Panel adresi hazır değil; sayfayı yenileyin.');
                            return;
                          }
                          downloadSmartBoardUsbLauncher(
                            {
                              panelOrigin,
                              schoolId,
                              deviceId: d.id,
                              deviceLabel: d.name,
                              kiosk: usbKiosk,
                              tahtaKilit,
                            },
                            `tahta_${d.name}`,
                          );
                          toast.success('HTML indirildi; USB’ye kopyalayın.');
                        }}
                      >
                        <Download className="size-3.5" />
                        USB HTML
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 flex-1 gap-1.5 rounded-xl border-0 bg-linear-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-500/20 hover:from-cyan-500 hover:to-sky-500 sm:flex-initial"
                        disabled={!panelOrigin}
                        onClick={() => {
                          if (!panelOrigin) {
                            toast.error('Panel adresi hazır değil; sayfayı yenileyin.');
                            return;
                          }
                          void (async () => {
                            try {
                              const blob = await buildPardusTahtaKioskZip({
                                panelOrigin,
                                apiBaseUrl: resolveDefaultApiBase(),
                                schoolId,
                                deviceId: d.id,
                                deviceLabel: d.name,
                                kiosk: usbKiosk,
                                tahtaKilit,
                              });
                              downloadPardusTahtaKioskZip(blob, d.name);
                              toast.success('Pardus paketi indirildi; tahtada ZIP’i açıp kurun.');
                            } catch {
                              toast.error('Pardus paketi oluşturulamadı.');
                            }
                          })();
                        }}
                      >
                        <Archive className="size-3.5" />
                        Pardus ZIP
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-violet-500/20 shadow-md dark:border-violet-400/15">
        <CardHeader className="border-b border-violet-500/15 bg-linear-to-r from-violet-500/10 via-background to-fuchsia-500/8 px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300">
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Pardus rehberi</CardTitle>
              <CardDescription className="text-xs leading-relaxed sm:text-sm">
                Kurum politikasına göre değişebilir; tipik sabitleme ve tarayıcı seçenekleri.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-4 py-4 sm:px-6 sm:py-5">
          <details className="group rounded-xl border border-border/60 bg-card/50 transition-colors open:border-violet-500/25 open:bg-violet-500/3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span>Firefox / Firefox ESR</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 pb-4 pt-0 text-[10px] leading-relaxed text-muted-foreground sm:text-xs sm:leading-relaxed">
              <ul className="mt-3 list-disc space-y-1.5 pl-4">
                <li>
                  Ayrı profil; ana sayfa{' '}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">/tv/classroom?device_id=…</code>
                </li>
                <li>Güncellemeleri bakım penceresinde yapın; kiosk için oturum otomatik başlatma ile profili açın.</li>
                <li>Kurum CA&apos;sını Yetkililer deposuna ekleyin (about:certificate veya politika).</li>
              </ul>
            </div>
          </details>
          <details className="group rounded-xl border border-border/60 bg-card/50 transition-colors open:border-violet-500/25 open:bg-violet-500/3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                Chromium / Google Chrome
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                  Önerilen
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 pb-4 pt-0 text-[10px] leading-relaxed text-muted-foreground sm:text-xs sm:leading-relaxed">
              <ul className="mt-3 list-disc space-y-1.5 pl-4">
                <li>
                  <strong className="text-foreground">ZIP</strong> indirip tahtada{' '}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">sudo make install</code> veya{' '}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">sudo ./install.sh</code> — yalnız panel + API (+ YouTube slayt).
                </li>
                <li>
                  Elle:{' '}
                  <code className="break-all rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px]">
                    chromium --kiosk --app=&quot;https://…/tv/classroom?school_id=…&amp;device_id=…&amp;usb=1&amp;kiosk=1&amp;kilit=1&quot;
                  </code>
                </li>
                <li>USB’den file:// HTML önce HTTPS’e yönlenir; karma içerik uyarısında hedefi yer imlerine sabitleyin.</li>
              </ul>
            </div>
          </details>
          <details className="group rounded-xl border border-border/60 bg-card/50 transition-colors open:border-violet-500/25 open:bg-violet-500/3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span>Ağ ve güvenlik</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 pb-4 pt-0 text-[10px] leading-relaxed text-muted-foreground sm:text-xs sm:leading-relaxed">
              <ul className="mt-3 list-disc space-y-1.5 pl-4">
                <li>Tahtaları okul VLAN’ında tutun; TV izinli IP listesini subnet ile hizalayın.</li>
                <li>Öğretmen JWT ile panelden; tahta ekranı duyuru akışı — duyuru hedeflerini kontrol edin.</li>
              </ul>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200/70 dark:border-slate-800">
        <CardHeader className="border-b border-border/60 px-4 py-3 sm:px-6 sm:py-3">
          <CardTitle className="text-xs font-semibold sm:text-sm">Hızlı bağlantılar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/akilli-tahta?tab=cihazlar">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] sm:text-xs">
              <Monitor className="size-3.5" /> Cihazlar
            </Button>
          </Link>
          <Link href="/akilli-tahta?tab=yetkiler">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] sm:text-xs">
              <Users className="size-3.5" /> Yetki{!autoAuthorize && ` ${authorizedCount}`}
            </Button>
          </Link>
          <Link href="/akilli-tahta?tab=yerlesim">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] sm:text-xs">
              <MapPin className="size-3.5" /> Yerleşim
            </Button>
          </Link>
          <Link href="/ders-programi">
            <Button variant="outline" size="sm" className="h-8 px-2 text-[10px] sm:text-xs">
              Ders prog.
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
