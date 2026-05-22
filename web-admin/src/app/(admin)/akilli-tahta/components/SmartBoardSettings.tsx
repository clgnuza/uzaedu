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
import { apiFetch, getApiUrl } from '@/lib/api';
import { resolveSmartBoardPackApiBase } from '@/lib/smart-board-pack-url';
import { buildPardusTahtaKioskZip, downloadPardusTahtaKioskZip } from '@/lib/pardus-tahta-kiosk-pack';
import { downloadPardusTahtaDeb } from '@/lib/pardus-tahta-deb-pack';
import { downloadSmartBoardUsbLauncher } from '@/lib/smart-board-usb-launcher';
import { buildTvAllowedIpsSettingsHref } from '@/lib/tv-settings-nav';
import { cn } from '@/lib/utils';
import { SmartBoardLessonEndGraceFields } from '@/components/akilli-tahta/smart-board-lesson-end-grace-fields';

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
  floorPlanCount = 0,
  floorPlacedCount = 0,
  onSaved,
}: {
  schoolId: string;
  token: string | null;
  canManage: boolean;
  devices: DeviceForSettings[];
  authorizedCount: number;
  floorPlanCount?: number;
  floorPlacedCount?: number;
  classSections?: string[];
  onSaved?: () => void;
  onEditDevice?: (d: DeviceForSettings) => void;
}) {
  const [autoAuthorize, setAutoAuthorize] = useState(false);
  const [restrictToOwnClasses, setRestrictToOwnClasses] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(2);
  const [notifyOnDisconnect, setNotifyOnDisconnect] = useState(true);
  const [autoDisconnectLessonEnd, setAutoDisconnectLessonEnd] = useState(false);
  const [lunchDuyuruGraceMinutes, setLunchDuyuruGraceMinutes] = useState(10);
  const [endOfDayCloseGraceMinutes, setEndOfDayCloseGraceMinutes] = useState(10);
  const [releasePreviousOnQr, setReleasePreviousOnQr] = useState(true);
  const [notifyOnQrTakeover, setNotifyOnQrTakeover] = useState(true);
  const [softTakeoverSeconds, setSoftTakeoverSeconds] = useState(0);
  const [reconnectGraceMinutes, setReconnectGraceMinutes] = useState(45);
  const [notifyLessonTeachersOnly, setNotifyLessonTeachersOnly] = useState(true);
  const [notifyOnQrPending, setNotifyOnQrPending] = useState(true);
  const [tvAllowedIps, setTvAllowedIps] = useState<string | null>(null);
  const [usbKiosk, setUsbKiosk] = useState(true);
  const [tahtaKilit, setTahtaKilit] = useState(true);
  const [ipProbe, setIpProbe] = useState<{ client_ip: string; ip_allowed: boolean | null } | null>(null);
  const [ipProbeBusy, setIpProbeBusy] = useState(false);
  const [disconnectAllBusy, setDisconnectAllBusy] = useState(false);
  const [panelOrigin, setPanelOrigin] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastDownloadByDevice, setLastDownloadByDevice] = useState<
    Record<string, { kind: 'html' | 'zip' | 'deb'; at: number }>
  >({});
  const [packDownloadBusy, setPackDownloadBusy] = useState<string | null>(null);

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
      smartBoardLunchDuyuruGraceMinutes?: number;
      smartBoardEndOfDayCloseGraceMinutes?: number;
      smartBoardReleasePreviousOnQr?: boolean;
      smartBoardNotifyOnQrTakeover?: boolean;
      smartBoardSoftTakeoverSeconds?: number;
      smartBoardReconnectGraceMinutes?: number;
      smartBoardNotifyLessonTeachersOnly?: boolean;
      smartBoardNotifyOnQrPending?: boolean;
      smartBoardDefaultKiosk?: boolean;
      smartBoardDefaultKilit?: boolean;
      tv_allowed_ips?: string | null;
    }>(`/schools/${schoolId}`, { token })
      .then((s) => {
        setAutoAuthorize(s?.smartBoardAutoAuthorize ?? false);
        setRestrictToOwnClasses(s?.smartBoardRestrictToOwnClasses ?? false);
        setSessionTimeout(s?.smartBoardSessionTimeoutMinutes ?? 2);
        setNotifyOnDisconnect(s?.smartBoardNotifyOnDisconnect ?? true);
        setAutoDisconnectLessonEnd(s?.smartBoardAutoDisconnectLessonEnd ?? false);
        setLunchDuyuruGraceMinutes(s?.smartBoardLunchDuyuruGraceMinutes ?? 10);
        setEndOfDayCloseGraceMinutes(s?.smartBoardEndOfDayCloseGraceMinutes ?? 10);
        setReleasePreviousOnQr(s?.smartBoardReleasePreviousOnQr ?? true);
        setNotifyOnQrTakeover(s?.smartBoardNotifyOnQrTakeover ?? true);
        setSoftTakeoverSeconds(s?.smartBoardSoftTakeoverSeconds ?? 0);
        setReconnectGraceMinutes(s?.smartBoardReconnectGraceMinutes ?? 45);
        setNotifyLessonTeachersOnly(s?.smartBoardNotifyLessonTeachersOnly ?? true);
        setNotifyOnQrPending(s?.smartBoardNotifyOnQrPending ?? true);
        setUsbKiosk(s?.smartBoardDefaultKiosk ?? true);
        setTahtaKilit(s?.smartBoardDefaultKilit ?? true);
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
          smart_board_lunch_duyuru_grace_minutes: lunchDuyuruGraceMinutes,
          smart_board_end_of_day_close_grace_minutes: endOfDayCloseGraceMinutes,
          smart_board_release_previous_on_qr: releasePreviousOnQr,
          smart_board_notify_on_qr_takeover: notifyOnQrTakeover,
          smart_board_soft_takeover_seconds: softTakeoverSeconds,
          smart_board_reconnect_grace_minutes: reconnectGraceMinutes,
          smart_board_notify_lesson_teachers_only: notifyLessonTeachersOnly,
          smart_board_notify_on_qr_pending: notifyOnQrPending,
          smart_board_default_kiosk: usbKiosk,
          smart_board_default_kilit: tahtaKilit,
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
      hint: 'Panel bağlantısı, QR onayı ve PIN/OTP: okuldaki tüm öğretmenler. Kapalıyken yalnızca Yetkiler listesi.',
      applies: 'connect · claimQr · listDevices · PIN/OTP',
      value: autoAuthorize,
      set: setAutoAuthorize,
    },
    {
      label: 'Sadece dersi olan sınıflara',
      hint: 'Açıkken öğretmen yalnız ders programındaki sınıflara bağlanır. Sınıf dışı tahtalarda bu kısıt uygulanmaz.',
      applies: 'connect · claimQr · tahta listesi · PIN/OTP',
      value: restrictToOwnClasses,
      set: setRestrictToOwnClasses,
    },
    {
      label: 'Bağlantı kesildiğinde bildir',
      hint: 'Yalnız idare panelden oturumu sonlandırdığında öğretmene Inbox gider.',
      applies: 'disconnect (idare)',
      value: notifyOnDisconnect,
      set: setNotifyOnDisconnect,
    },
    {
      label: 'QR ile değişimde bildir',
      hint: 'Aynı tahtada yeni öğretmen bağlandığında önceki öğretmene Inbox (idare kesmedi uyarısı).',
      applies: 'connect (releaseOther)',
      value: notifyOnQrTakeover,
      set: setNotifyOnQrTakeover,
    },
    {
      label: 'QR’da önceki öğretmeni sonlandır',
      hint: 'Yeni QR onayında aynı tahtadaki aktif oturum kapatılır; kapalıyken “tahta meşgul” hatası alınır.',
      applies: 'claimQr → connect',
      value: releasePreviousOnQr,
      set: setReleasePreviousOnQr,
    },
    {
      label: 'QR beklerken öğretmene bildir',
      hint: 'Tahta yeni QR ürettiğinde Inbox (aynı tahta için tek okunmamış bildirim güncellenir).',
      applies: 'notifyTeachersQrSessionPending',
      value: notifyOnQrPending,
      set: setNotifyOnQrPending,
    },
    {
      label: 'QR bildirimi: ders saati öğretmenleri',
      hint: 'Açıkken program varsa yalnız o saatte derse giren öğretmenlere gider.',
      applies: 'notifyTeachersQrSessionPending',
      value: notifyLessonTeachersOnly,
      set: setNotifyLessonTeachersOnly,
      disabled: !notifyOnQrPending,
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
              Günlük kurulum: <strong className="text-foreground">Kurulum</strong> sekmesi (okul kodu, toplu sınıf, QR etiket, USB/.deb ZIP).
              Bu sayfa oturum, IP ve cihaz başına <strong className="text-foreground">Hazır .deb</strong> / Pardus ZIP’idir.
            </p>
            <Link href="/akilli-tahta?tab=kurulum" className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">
              Kurulum sihirbazına git →
            </Link>
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
            <CardDescription className="text-xs sm:text-sm">
              Kayıt sonrası backend’de anında uygulanır. Öğretmen paneli ~45 sn heartbeat gönderir.
            </CardDescription>
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
                      <Toggle
                        checked={r.value}
                        onChange={r.set}
                        disabled={!canManage || ('disabled' in r && !!r.disabled)}
                      />
                    </div>
                    <p className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-xs">{r.hint}</p>
                    {'applies' in r && r.applies ? (
                      <p className="mt-1 font-mono text-[9px] text-muted-foreground/80">Uygulama: {r.applies}</p>
                    ) : null}
                  </div>
                ))}
                <div className="rounded-lg border border-amber-200/40 bg-amber-500/5 px-3 py-2.5 sm:px-4 sm:py-3 dark:border-amber-900/35">
                  <SmartBoardLessonEndGraceFields
                    enabled={autoDisconnectLessonEnd}
                    onEnabledChange={setAutoDisconnectLessonEnd}
                    lunchGraceMinutes={lunchDuyuruGraceMinutes}
                    onLunchGraceChange={setLunchDuyuruGraceMinutes}
                    endOfDayGraceMinutes={endOfDayCloseGraceMinutes}
                    onEndOfDayGraceChange={setEndOfDayCloseGraceMinutes}
                    disabled={!canManage}
                  />
                  <p className="mt-2 font-mono text-[9px] text-muted-foreground/80">
                    Uygulama: heartbeat · classroom-session-status · cron
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium sm:text-sm">Heartbeat zaman aşımı</span>
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
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                    Son sinyalden bu süre geçince oturum kapanır (heartbeat + tahta oturum poll). Öneri: sürenin en az 2× heartbeat aralığı (≈90 sn) olması.
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] text-muted-foreground/80">Uygulama: heartbeat · classroom-session-status</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium sm:text-sm">Yumuşak devralma (sn)</span>
                    <Select
                      value={String(softTakeoverSeconds)}
                      onValueChange={(v) => setSoftTakeoverSeconds(Number(v))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45, 60].map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v === 0 ? 'Kapalı' : `${v} sn`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                    0 = anında devralma. &gt;0 iken tahtada geri sayım; slayt durur, sonra yeni öğretmen bağlanır.
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 sm:px-4 sm:py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium sm:text-sm">QR’sız yeniden bağlanma</span>
                    <Select
                      value={String(reconnectGraceMinutes)}
                      onValueChange={(v) => setReconnectGraceMinutes(Number(v))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="h-8 w-28 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 15, 30, 45, 60, 90].map((v) => (
                          <SelectItem key={v} value={String(v)}>
                            {v === 0 ? 'Kapalı' : `${v} dk`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">
                    Aynı öğretmen+tahta için kesintiden sonra panelden QR olmadan devam (ders süresi içi).
                  </p>
                </div>
                <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2.5 text-[10px] text-muted-foreground sm:text-xs">
                  <p className="font-medium text-foreground">Kurallar özeti</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4">
                    <li>Tahta varsayılan <strong className="text-foreground">duyuru TV</strong>; öğretmen QR onayı → kullanım modu → oturum bitince tekrar duyuru.</li>
                    <li>QR token tahtada tek seferlik <code className="rounded bg-muted px-1 font-mono text-[9px]">exchange</code> ile alınır; poll yanıtında token yok.</li>
                    <li>
                      <strong className="text-foreground">İzinli IP</strong> (Duyuru TV, isteğe bağlı): liste doluysa sınıf tahtası ve duyuru yalnız okul ağından; boşsa kısıt yok.
                    </li>
                    <li>Kiosk / kilit URL parametreleri ({' '}
                      <code className="rounded bg-muted px-1 font-mono text-[9px]">kiosk=1</code>,{' '}
                      <code className="rounded bg-muted px-1 font-mono text-[9px]">kilit=1</code>) paket indirmede seçilir; bu sayfada kaydedilmez.</li>
                  </ul>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSave} disabled={saving} size="sm" className="h-9">
                      {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={disconnectAllBusy}
                      onClick={() => {
                        if (!token || !schoolId) return;
                        if (!window.confirm('Tüm aktif tahta oturumları sonlandırılsın mı? Tahtalar duyuru moduna döner.')) return;
                        setDisconnectAllBusy(true);
                        apiFetch<{ disconnected?: number }>('/smart-board/sessions/disconnect-all', {
                          method: 'POST',
                          token,
                        })
                          .then((r) => toast.success(`${r?.disconnected ?? 0} oturum sonlandırıldı.`))
                          .catch(() => toast.error('Toplu sonlandırma başarısız.'))
                          .finally(() => setDisconnectAllBusy(false));
                      }}
                    >
                      {disconnectAllBusy ? 'Sonlandırılıyor…' : 'Tüm tahtaları duyuruya al'}
                    </Button>
                  </div>
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
              Liste doluysa sınıf tahtası ve duyuru TV yalnız izinli IP’lerden açılır; boş bırakırsanız kısıt yok.
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
                    <strong className="text-amber-800 dark:text-amber-200">Sınıf tahtası (QR / duyuru)</strong>: IP listesi
                    isteğe bağlıdır; boş bırakırsanız kurulum ve tahta çalışır. Kısıtlamak için Duyuru TV’den subnet girin.
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-1.5" asChild>
                <Link href={buildTvAllowedIpsSettingsHref({ schoolId })}>
                  <Tv className="size-4 shrink-0" />
                  IP listesini düzenle
                  <ExternalLink className="size-3.5 opacity-60" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={ipProbeBusy || !schoolId}
                onClick={() => {
                  setIpProbeBusy(true);
                  fetch(getApiUrl(`/tv/classroom-client-ip?school_id=${encodeURIComponent(schoolId)}`))
                    .then(async (res) => {
                      const body = (await res.json()) as {
                        client_ip?: string;
                        ip_allowed?: boolean | null;
                      };
                      setIpProbe({
                        client_ip: body.client_ip ?? '—',
                        ip_allowed: body.ip_allowed ?? null,
                      });
                    })
                    .catch(() => toast.error('IP testi yapılamadı.'))
                    .finally(() => setIpProbeBusy(false));
                }}
              >
                {ipProbeBusy ? 'Test…' : 'Bu istekten görünen IP'}
              </Button>
            </div>
            {ipProbe ? (
              <p className="rounded-md border bg-muted/30 px-2 py-1.5 font-mono text-[10px] sm:text-xs">
                IP: {ipProbe.client_ip}
                {ipProbe.ip_allowed === null
                  ? ' · Liste boş'
                  : ipProbe.ip_allowed
                    ? ' · Listede ✓'
                    : ' · Listede değil ✗'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-emerald-300/45 shadow-sm dark:border-emerald-900/40">
        <CardHeader className="border-b border-emerald-200/40 bg-emerald-500/8 px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15">
              <Shield className="size-4 text-emerald-700 dark:text-emerald-300" />
            </span>
            Duyuru TV varsayılan · QR ile kullanım modu
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Tahta duyuru modundayken QR görünür; öğretmen telefonda Uzaedu ile girişli iken okutur — tahta şifresiz kullanım moduna geçer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 py-4 sm:px-6 sm:py-4">
          <ul className="list-disc space-y-1.5 pl-4 text-[11px] text-muted-foreground sm:text-xs">
            <li>QR onayından sonra tahta birkaç saniye içinde kullanım moduna geçer (exchange); tahtada öğretmen şifresi yoktur.</li>
            <li>QR oturum süresi <code className="rounded bg-muted px-1 py-0.5 font-mono">120s</code>; exchange penceresi <code className="rounded bg-muted px-1 py-0.5 font-mono">90s</code>.</li>
            <li>PIN/OTP yedek giriş; yetki kuralları (otomatik yetki / sınıf kısıtı) burada da geçerli.</li>
            <li>OTP üretme <strong className="text-foreground">Yetkiler</strong> sekmesinden.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link href="/akilli-tahta?tab=kurulum">
              <Button size="sm" className="h-8 gap-1 text-[10px] sm:text-xs">
                <Terminal className="size-3.5" /> Kurulum rehberi
              </Button>
            </Link>
            <Link href="/akilli-tahta?tab=yetkiler">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] sm:text-xs">
                <Users className="size-3.5" /> OTP / QR Yetki
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <details className="group rounded-2xl border border-cyan-500/25 bg-card shadow-sm open:shadow-md">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold sm:px-6 sm:py-4">
          <span className="inline-flex items-center gap-2">
            <ChevronDown className="size-4 transition group-open:rotate-180" />
            Gelişmiş: Pardus paketleri (isteğe bağlı)
          </span>
        </summary>
      <Card className="relative overflow-hidden border-0 shadow-none">
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
                Cihaz başına: USB HTML, panelden <strong className="text-foreground">Hazır .deb</strong> veya Pardus ZIP (içinde hazır .deb). Kurulum sihirbazı önce önerilir.
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm sm:max-w-xs sm:text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Terminal className="size-3.5 text-cyan-600 dark:text-cyan-400" />
                Tahtada özet
              </div>
              <ol className="mt-1 w-full space-y-1.5">
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-cyan-500/20 font-mono text-[9px] font-bold text-cyan-900 dark:text-cyan-100">
                    1
                  </span>
                  <span>
                    Panelden <strong className="text-foreground">Hazır .deb</strong> indir → Pardus Paket Kurucu ile kur (önerilen).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[9px] font-bold text-foreground">
                    2
                  </span>
                  <span>
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">apt install chromium</code> (+ isteğe bağlı{' '}
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">x11-xserver-utils</code>)
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[9px] font-bold text-foreground">
                    3
                  </span>
                  <span>
                    Alternatif: Pardus ZIP → <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">packages/deb/dist/*.deb</code> veya{' '}
                    <code className="rounded bg-muted/80 px-1 font-mono text-[9px] sm:text-[10px]">build-deb.sh</code>
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
                <p className="text-xs font-semibold text-foreground sm:text-sm">Tam ekran kiosk (varsayılan)</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">Kayıtlı · yeni paket/URL’de kiosk=1</p>
              </div>
              <Toggle checked={usbKiosk} onChange={setUsbKiosk} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/60 px-4 py-3 shadow-sm backdrop-blur-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground sm:text-sm">Duyuru kilidi (varsayılan)</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">Kayıtlı · yeni paket/URL’de kilit=1</p>
              </div>
              <Toggle checked={tahtaKilit} onChange={setTahtaKilit} />
            </div>
          </div>
          <p className="rounded-xl border border-dashed border-cyan-500/25 bg-cyan-500/4 px-3 py-2.5 text-[10px] leading-relaxed text-muted-foreground sm:px-4 sm:text-xs">
            <strong className="text-foreground">kilit=1</strong> (varsayılan): duyuru slaytı; öğretmen oturumu açılınca tam TV düzeni. Üstteki anahtarlar kaydedilir; paket indirirken uygulanır.
          </p>

          {devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-10 text-center">
              <Package className="size-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Henüz tahta yok</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Önce <Link href="/akilli-tahta?tab=kurulum" className="text-primary underline">Kurulum</Link> sihirbazı ile sınıf ekleyin; ardından buradan indirin.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">Cihaz başına indir</p>
              <ul className="space-y-2">
                {[...devices]
                  .sort((a, b) =>
                    (a.classSection ?? '').localeCompare(b.classSection ?? '', 'tr', { numeric: true }) ||
                    (a.name ?? '').localeCompare(b.name ?? '', 'tr', { numeric: true }),
                  )
                  .map((d) => (
                  (() => {
                    const downloadLabel = `${d.name}_${d.id.slice(0, 8)}`;
                    const lastDownload = lastDownloadByDevice[d.id];
                    return (
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
                          {lastDownload ? (
                            <p className="mt-1 inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-800 dark:text-emerald-200">
                              Son indirilen:{' '}
                              {lastDownload.kind === 'html'
                                ? 'USB HTML'
                                : lastDownload.kind === 'deb'
                                  ? 'Hazır .deb'
                                  : 'Pardus ZIP'}{' '}
                              ·{' '}
                              {new Date(lastDownload.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          ) : null}
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
                            `tahta_${downloadLabel}`,
                          );
                          setLastDownloadByDevice((prev) => ({
                            ...prev,
                            [d.id]: { kind: 'html', at: Date.now() },
                          }));
                          toast.success('HTML indirildi; USB’ye kopyalayın.');
                        }}
                      >
                        <Download className="size-3.5" />
                        USB HTML
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1 gap-1.5 rounded-xl text-xs sm:flex-initial"
                        disabled={!panelOrigin || packDownloadBusy === d.id}
                        onClick={() => {
                          if (!panelOrigin) {
                            toast.error('Panel adresi hazır değil; sayfayı yenileyin.');
                            return;
                          }
                          setPackDownloadBusy(d.id);
                          void downloadPardusTahtaDeb({
                            panelOrigin,
                            apiBaseUrl: resolveSmartBoardPackApiBase(panelOrigin),
                            schoolId,
                            deviceId: d.id,
                            deviceLabel: d.name,
                            kiosk: usbKiosk,
                            tahtaKilit,
                          })
                            .then(() => {
                              setLastDownloadByDevice((prev) => ({
                                ...prev,
                                [d.id]: { kind: 'deb', at: Date.now() },
                              }));
                              toast.success('Hazır .deb indirildi; Pardus Paket Kurucu ile kurun.');
                            })
                            .catch((e: unknown) => {
                              const msg =
                                e instanceof Error
                                  ? e.message
                                  : 'Paket oluşturulamadı. Tarayıcı güncel mi? (Chrome/Edge önerilir)';
                              toast.error(msg);
                            })
                            .finally(() => setPackDownloadBusy(null));
                        }}
                      >
                        <Package className="size-3.5" />
                        {packDownloadBusy === d.id ? 'Hazırlanıyor…' : 'Hazır .deb'}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 flex-1 gap-1.5 rounded-xl border-0 bg-linear-to-r from-cyan-600 to-sky-600 text-white shadow-md shadow-cyan-500/20 hover:from-cyan-500 hover:to-sky-500 sm:flex-initial"
                        disabled={!panelOrigin || packDownloadBusy === d.id}
                        onClick={() => {
                          if (!panelOrigin) {
                            toast.error('Panel adresi hazır değil; sayfayı yenileyin.');
                            return;
                          }
                          setPackDownloadBusy(d.id);
                          void (async () => {
                            try {
                              const blob = await buildPardusTahtaKioskZip({
                                panelOrigin,
                                apiBaseUrl: resolveSmartBoardPackApiBase(panelOrigin),
                                schoolId,
                                deviceId: d.id,
                                deviceLabel: d.name,
                                kiosk: usbKiosk,
                                tahtaKilit,
                              });
                              downloadPardusTahtaKioskZip(blob, downloadLabel);
                              setLastDownloadByDevice((prev) => ({
                                ...prev,
                                [d.id]: { kind: 'zip', at: Date.now() },
                              }));
                              toast.success('Pardus paketi indirildi; tahtada ZIP’i açıp kurun.');
                            } catch (e: unknown) {
                              const msg =
                                e instanceof Error
                                  ? e.message
                                  : 'ZIP oluşturulamadı. Tarayıcı güncel mi? (Chrome/Edge önerilir)';
                              toast.error(msg);
                            } finally {
                              setPackDownloadBusy(null);
                            }
                          })();
                        }}
                      >
                        <Archive className="size-3.5" />
                        {packDownloadBusy === d.id ? 'Hazırlanıyor…' : 'Pardus ZIP'}
                      </Button>
                    </div>
                  </li>
                    );
                  })()
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
          <details className="group rounded-xl border border-border/60 bg-card/50 transition-colors open:border-emerald-500/25 open:bg-emerald-500/5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                TV slaytları (PIN / OTP / QR / klavye)
                <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                  dokunmatik
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 pb-4 pt-0 text-[10px] leading-relaxed text-muted-foreground sm:text-xs sm:leading-relaxed">
              <ul className="mt-3 list-disc space-y-1.5 pl-4">
                <li>
                  Tarayıcıda açık olan <strong className="text-foreground">panel TV (sınıf) sayfası</strong> odaktayken çoğu USB
                  kumanda <code className="rounded bg-muted px-1 font-mono text-[10px]">PageDown</code> /{' '}
                  <code className="rounded bg-muted px-1 font-mono text-[10px]">PageUp</code> veya ok tuşları ile slayt ilerletir;{' '}
                  <code className="rounded bg-muted px-1 font-mono text-[10px]">Space</code> sonraki slayta geçer.{' '}
                  <code className="rounded bg-muted px-1 font-mono text-[10px]">Home</code> /{' '}
                  <code className="rounded bg-muted px-1 font-mono text-[10px]">End</code> ilk / son slayta gider.
                </li>
                <li>
                  <code className="break-all rounded bg-muted px-1 font-mono text-[9px] sm:text-[10px]">kilit=1</code> veya sınıf
                  TV&apos;de, dokunmatik tahta için ekranın altında yarı saydam <strong className="text-foreground">İleri / Geri</strong>{' '}
                  ok düğmeleri gösterilir.
                </li>
                <li>
                  <strong className="text-foreground">Açılış yöntemleri:</strong> TV unlock ekranında{' '}
                  <strong className="text-foreground">Otomatik / PIN / OTP</strong> seçimi vardır. Otomatik modda önce PIN, gerekirse OTP
                  doğrulaması denenir.
                </li>
                <li>
                  <strong className="text-foreground">QR girişi:</strong> Sınıf TV&apos;de <strong className="text-foreground">QR ile öğretmen girişi</strong>{' '}
                  ile 2 dakikalık kod üretilir; öğretmen panelden onay verince tahta duyuru modundan çıkar (tam TV düzeni).
                  Varsayılan ekran Duyuru TV; PIN/OTP yedektir.
                </li>
                <li>
                  <strong className="text-foreground">OTP yönetimi:</strong> Yetkiler sekmesinde öğretmen satırından OTP kodları üretilir /
                  yenilenir. Kodlar tek kullanımlıktır; kullanılınca sistemden düşer.
                </li>
                <li>
                  Impress veya başka bir uygulama önde ise kısayollar o pencereye gider — sınıf içi sunumda TV sekmesine tıklayıp
                  odağı tarayıcıya alın.
                </li>
              </ul>
            </div>
          </details>
          <details className="group rounded-xl border border-border/60 bg-card/50 transition-colors open:border-violet-500/25 open:bg-violet-500/3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <span>Firefox / Firefox ESR</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 px-4 pb-4 pt-0 text-[10px] leading-relaxed text-muted-foreground sm:text-xs sm:leading-relaxed">
              <ul className="mt-3 list-disc space-y-1.5 pl-4">
                <li>
                  Ayrı profil; sınıf TV adresi (PIN/OTP/QR ile USB) örn.{' '}
                  <code className="wrap-break-word rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px]">
                    /tv/classroom?school_id=…&amp;device_id=…&amp;kiosk=1&amp;kilit=1
                  </code>{' '}
                  — Chromium örneğiyle aynı parametreler; yalnızca <code className="rounded bg-muted px-1 font-mono text-[10px]">device_id</code>{' '}
                  yetersizdir.
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
                  <strong className="text-foreground">Pardus:</strong> panelden <strong className="text-foreground">Hazır .deb</strong> veya ZIP içindeki{' '}
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">packages/deb/dist/*.deb</code> — Paket Kurucu ile kurun.
                </li>
                <li>İlk açılışta sihirbaz gelir: lisans onayı + sınıf adı + başlat.</li>
                <li>
                  Elle:{' '}
                  <code className="break-all rounded-md bg-muted px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px]">
                    chromium --kiosk --app=&quot;https://…/tv/classroom?school_id=…&amp;device_id=…&amp;kiosk=1&amp;kilit=1&quot;
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
      </details>

      <Card className="overflow-hidden border-amber-200/45 dark:border-amber-900/35">
        <CardHeader className="border-b border-amber-200/35 bg-amber-500/5 px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <MapPin className="size-4 text-amber-700 dark:text-amber-300" />
            Kroki ve yerleşim
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Kat planı görselleri ve tahta konumları ayrı sekmede yönetilir; okul genelinde tek kayıt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 py-4 sm:px-6">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border bg-muted/25 px-2 py-2">
              <p className="text-lg font-bold tabular-nums">{floorPlanCount}</p>
              <p className="text-[10px] text-muted-foreground">Kat planı</p>
            </div>
            <div className="rounded-lg border bg-muted/25 px-2 py-2">
              <p className="text-lg font-bold tabular-nums">{devices.length}</p>
              <p className="text-[10px] text-muted-foreground">Tahta</p>
            </div>
            <div className="rounded-lg border bg-muted/25 px-2 py-2">
              <p className="text-lg font-bold tabular-nums">{floorPlacedCount}</p>
              <p className="text-[10px] text-muted-foreground">Konumlu</p>
            </div>
          </div>
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground sm:text-xs">
            <li>Plan görseli: PNG/JPG veya HTTPS URL (okul sitesi, drive paylaşımı).</li>
            <li>Her tahta için kat seçin; rozeti planda sürükleyerek yüzde konum kaydedilir.</li>
            <li>Renkler: yeşil çevrimiçi, turuncu ders oturumu, gri kapalı.</li>
          </ul>
          <Button variant="default" size="sm" className="h-9 w-full gap-1.5 sm:w-auto" asChild>
            <Link href="/akilli-tahta?tab=yerlesim">
              <MapPin className="size-4" />
              Yerleşim sekmesini aç
            </Link>
          </Button>
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
          <Link href="/akilli-tahta?tab=kurulum">
            <Button variant="outline" size="sm" className="h-8 gap-1 text-[10px] sm:text-xs">
              <Terminal className="size-3.5" /> Kurulum
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
