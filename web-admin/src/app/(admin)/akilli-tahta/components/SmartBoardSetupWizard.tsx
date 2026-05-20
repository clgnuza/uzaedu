'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Monitor,
  Package,
  Printer,
  QrCode,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { buildClassroomSetupUrl, buildClassroomTvUrl } from '@/lib/smart-board-classroom-url';
import { buildClassroomQrImageSrc } from '@/lib/smart-board-classroom-api';
import { openSmartBoardLabelsPrint } from '@/lib/smart-board-qr-labels';
import { downloadAllSmartBoardUsbLaunchers } from '@/lib/smart-board-usb-bulk-download';
import { downloadAllSmartBoardDebPackages } from '@/lib/smart-board-deb-bulk-download';
import { downloadSmartBoardUsbLauncher } from '@/lib/smart-board-usb-launcher';
import { downloadPardusTahtaDeb } from '@/lib/pardus-tahta-deb-pack';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import type { Device, SmartBoardSetupStatus } from '../types';
import { SmartBoardInstallGuide } from './SmartBoardInstallGuide';
import { KioskQuickStart } from './KioskQuickStart';
import { cn } from '@/lib/utils';

export function SmartBoardSetupWizard({
  schoolId,
  token,
  classSections,
  devices,
  schoolName,
  onDevicesChanged,
  onOpenSettings,
}: {
  schoolId: string;
  token: string | null;
  classSections: string[];
  devices: Device[];
  schoolName?: string;
  onDevicesChanged: () => void;
  onOpenSettings?: () => void;
}) {
  const [status, setStatus] = useState<SmartBoardSetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [debZipBusy, setDebZipBusy] = useState(false);
  const [autoAuthBusy, setAutoAuthBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    if (!token || !schoolId) return;
    setLoading(true);
    try {
      const res = await apiFetch<SmartBoardSetupStatus>(
        `/smart-board/schools/${schoolId}/setup-status`,
        { token },
      );
      setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token, schoolId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus, devices.length]);

  useEffect(() => {
    const missing = classSections.filter(
      (c) => !devices.some((d) => (d.classSection ?? '').trim().toUpperCase() === c.trim().toUpperCase()),
    );
    setSelected(new Set(missing));
  }, [classSections, devices]);

  const setupCode = status?.setup_code ?? '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const setupUrl = setupCode ? buildClassroomSetupUrl({ origin, setupCode }) : '';
  const doneCount = status?.checklist.filter((c) => c.done).length ?? 0;
  const totalCheck = status?.checklist.length ?? 0;

  const toggleClass = (c: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const handleBulkCreate = async () => {
    if (!token || selected.size === 0) return;
    setBulkBusy(true);
    try {
      const items = [...selected].map((class_section) => ({ class_section }));
      const res = await apiFetch<{ created?: Device[]; skipped?: string[] }>('/smart-board/devices/bulk', {
        method: 'POST',
        token,
        body: JSON.stringify({ items }),
      });
      const n = res.created?.length ?? 0;
      const sk = res.skipped?.length ?? 0;
      toast.success(`${n} tahta eklendi${sk ? `, ${sk} zaten vardı` : ''}.`);
      onDevicesChanged();
      void fetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu ekleme başarısız');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleRegenCode = async () => {
    if (!token || !confirm('Kurulum kodu değişir. Eski QR etiketlerini yenileyin. Devam?')) return;
    setRegenBusy(true);
    try {
      await apiFetch(`/smart-board/schools/${schoolId}/setup-code/regenerate`, {
        method: 'POST',
        token,
        body: JSON.stringify({}),
      });
      toast.success('Kurulum kodu yenilendi');
      void fetchStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kod yenilenemedi');
    } finally {
      setRegenBusy(false);
    }
  };

  const copy = (text: string, label: string) => {
    void navigator.clipboard?.writeText(text);
    toast.success(`${label} kopyalandı`);
  };

  const suggestedToAdd = useMemo(
    () => classSections.filter((c) => selected.has(c)),
    [classSections, selected],
  );

  if (loading && !status) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Sparkles className="size-5 text-primary" />
            Kurulum sihirbazı
            {totalCheck > 0 ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {doneCount}/{totalCheck} tamam
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="info">
            <strong>3 adım:</strong> Sınıfları seç → Etiketleri yazdır → Tahtada tarayıcıyı aç (Duyuru TV otomatik başlar).
            Öğretmen ders için hesabından QR onaylar. Pardus isteğe bağlıdır.
          </Alert>

          {status?.checklist?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {status.checklist.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                    item.done ? 'border-emerald-500/40 bg-emerald-500/8' : 'border-border bg-card',
                  )}
                >
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{item.label}</p>
                    {!item.done && item.hint ? (
                      <p className="text-xs text-muted-foreground">{item.hint}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">1 — Okul kurulum kodu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Yeni tahtada ilk açılış: bu kod ile sınıf seçilir; ardından ekran Duyuru TV modunda kalır.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-[0.25em] text-primary">{setupCode || '—'}</span>
              <Button type="button" variant="outline" size="sm" disabled={!setupCode} onClick={() => copy(setupCode, 'Kod')}>
                <Copy className="size-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={regenBusy} onClick={() => void handleRegenCode()}>
                <RefreshCw className={cn('size-3.5', regenBusy && 'animate-spin')} />
              </Button>
            </div>
            {setupUrl ? (
              <div className="space-y-2">
                <code className="block break-all rounded bg-muted px-2 py-1 text-[10px]">{setupUrl}</code>
                <Button type="button" variant="secondary" size="sm" onClick={() => copy(setupUrl, 'İlk kurulum URL')}>
                  İlk kurulum linkini kopyala
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">2 — Sınıflardan tahta oluştur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {classSections.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sınıf listesi boş. Ders programı veya sınıf tanımlarından ekleyin; veya Cihazlar sekmesinden tek tek ekleyin.
              </p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
                {classSections.map((c) => {
                  const exists = devices.some(
                    (d) => (d.classSection ?? '').trim().toUpperCase() === c.trim().toUpperCase(),
                  );
                  return (
                    <label key={c} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-border"
                        checked={selected.has(c)}
                        disabled={exists}
                        onChange={() => toggleClass(c)}
                      />
                      <span className={exists ? 'text-muted-foreground line-through' : ''}>{c}</span>
                      {exists ? <span className="text-[10px] text-emerald-600">kayıtlı</span> : null}
                    </label>
                  );
                })}
              </div>
            )}
            <Button
              type="button"
              disabled={bulkBusy || suggestedToAdd.length === 0}
              onClick={() => void handleBulkCreate()}
            >
              {bulkBusy ? <LoadingSpinner className="size-4" /> : <Monitor className="size-4" />}
              {suggestedToAdd.length} sınıf için tahta ekle
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">3 — Etiketler ve saha dosyaları</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            disabled={devices.length === 0 || !setupCode}
            onClick={() =>
              openSmartBoardLabelsPrint({
                schoolName: schoolName ?? 'Okul',
                setupCode,
                devices,
              })
            }
          >
            <Printer className="size-4" />
            QR etiketleri yazdır
          </Button>
          {devices.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              disabled={zipBusy}
              onClick={() => {
                setZipBusy(true);
                void downloadAllSmartBoardUsbLaunchers({
                  panelOrigin: origin,
                  devices,
                  schoolLabel: schoolName ?? 'okul',
                })
                  .then(() => toast.success('USB HTML ZIP indirildi'))
                  .catch(() => toast.error('ZIP oluşturulamadı'))
                  .finally(() => setZipBusy(false));
              }}
            >
              <Download className="size-4" />
              Tüm USB HTML (ZIP)
            </Button>
          ) : null}
          {devices.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              disabled={debZipBusy}
              onClick={() => {
                setDebZipBusy(true);
                void downloadAllSmartBoardDebPackages({
                  panelOrigin: origin,
                  devices,
                  schoolLabel: schoolName ?? 'okul',
                })
                  .then(() => toast.success('Tüm .deb ZIP indirildi'))
                  .catch(() => toast.error('.deb ZIP oluşturulamadı'))
                  .finally(() => setDebZipBusy(false));
              }}
            >
              <Package className="size-4" />
              Tüm .deb (ZIP)
            </Button>
          ) : null}
          {devices.length === 1 ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  downloadSmartBoardUsbLauncher(
                    {
                      panelOrigin: origin,
                      schoolId: devices[0]!.school_id,
                      deviceId: devices[0]!.id,
                      deviceLabel: devices[0]!.name,
                      kiosk: true,
                      tahtaKilit: true,
                    },
                    devices[0]!.name,
                  )
                }
              >
                <Download className="size-4" />
                USB HTML (tek tahta)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void downloadPardusTahtaDeb({
                    panelOrigin: origin,
                    apiBaseUrl: resolveDefaultApiBase(),
                    schoolId: devices[0]!.school_id,
                    deviceId: devices[0]!.id,
                    deviceLabel: devices[0]!.name,
                    kiosk: true,
                    tahtaKilit: true,
                  })
                    .then(() => toast.success('Hazır .deb indirildi'))
                    .catch(() => toast.error('.deb oluşturulamadı'))
                }
              >
                <Package className="size-4" />
                Hazır .deb
              </Button>
            </>
          ) : null}
          <Button type="button" variant="outline" asChild>
            <a href="/akilli-tahta?tab=ayarlar">
              <Wrench className="size-4" />
              Pardus / gelişmiş
            </a>
          </Button>
          {onOpenSettings ? (
            <Button type="button" variant="ghost" onClick={onOpenSettings}>
              Ayarlar
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {devices.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hızlı classroom URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {devices.slice(0, 8).map((d) => {
              const url = buildClassroomTvUrl({ origin, schoolId: d.school_id, deviceId: d.id });
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 py-2 last:border-0">
                  <span className="min-w-[6rem] text-sm font-medium">{d.classSection ?? d.name}</span>
                  <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => copy(url, d.name)}>
                    <Copy className="size-3" /> URL
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      window.open(buildClassroomQrImageSrc(url), '_blank', 'noopener,noreferrer,width=320,height=320');
                    }}
                  >
                    <QrCode className="size-3" /> QR
                  </Button>
                </div>
              );
            })}
            {devices.length > 8 ? (
              <p className="text-xs text-muted-foreground">+{devices.length - 8} tahta — tam liste Cihazlar sekmesinde.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{status?.device_count ?? 0} tahta</span>
        <span>{status?.online_count ?? 0} çevrimiçi</span>
        <span>{status?.never_seen_count ?? 0} hiç görülmedi</span>
      </div>

      {status && status.never_seen_count > 0 && devices.length > 0 ? (
        <Alert variant="warning">
          {status.never_seen_count} tahta henüz ağda görülmedi. Classroom URL veya USB HTML ile tahtayı açın.
        </Alert>
      ) : null}

      {!status?.auto_authorize && status && status.authorized_teacher_count === 0 ? (
        <Alert variant="info">
          Öğretmenler bağlanamıyor.{' '}
          <button
            type="button"
            className="font-semibold text-primary underline disabled:opacity-50"
            disabled={autoAuthBusy || !token}
            onClick={() => {
              if (!token) return;
              setAutoAuthBusy(true);
              apiFetch(`/schools/${schoolId}`, {
                method: 'PATCH',
                token,
                body: JSON.stringify({ smart_board_auto_authorize: true }),
              })
                .then(() => {
                  toast.success('Tüm öğretmenlere otomatik yetki açıldı');
                  void fetchStatus();
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : 'Kaydedilemedi'))
                .finally(() => setAutoAuthBusy(false));
            }}
          >
            Otomatik yetkiyi aç
          </button>
        </Alert>
      ) : null}

      {devices.length > 0 ? <KioskQuickStart devices={devices} origin={origin} /> : null}

      <SmartBoardInstallGuide schoolId={schoolId} hasDevice={devices.length > 0} setupCode={setupCode} />
    </div>
  );
}
