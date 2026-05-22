'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Monitor, Package } from 'lucide-react';
import { downloadPardusTahtaDeb } from '@/lib/pardus-tahta-deb-pack';
import { resolveSmartBoardPackApiBase } from '@/lib/smart-board-pack-url';
import { toast } from 'sonner';
import {
  buildLinuxDesktopEntry,
  buildWindowsTahtaBat,
  downloadTextFile,
} from '@/lib/smart-board-kiosk-oneliner';
import type { Device } from '../types';

export function KioskQuickStart({
  devices,
  origin,
}: {
  devices: Device[];
  origin: string;
}) {
  const sample = devices[0];
  if (!sample) return null;

  const copyChromiumCmd = () => {
    const url = `${origin}/tv/classroom?school_id=${sample.school_id}&device_id=${sample.id}&kiosk=1&kilit=1`;
    const cmd = `chromium --kiosk --app="${url}"`;
    void navigator.clipboard?.writeText(cmd);
    toast.success('Komut kopyalandı');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Monitor className="size-4" />
          Tahta açılış kısayolu (Pardus’sız)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copyChromiumCmd}>
          <Copy className="size-4" />
          Linux komutu
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            downloadTextFile(
              `tahta_${sample.classSection ?? 'sinif'}.bat`,
              buildWindowsTahtaBat({
                panelOrigin: origin,
                schoolId: sample.school_id,
                deviceId: sample.id,
                deviceLabel: sample.name,
              }),
            );
            toast.success('Windows .bat indirildi');
          }}
        >
          Windows .bat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            void downloadPardusTahtaDeb({
              panelOrigin: origin,
              apiBaseUrl: resolveSmartBoardPackApiBase(origin),
              schoolId: sample.school_id,
              deviceId: sample.id,
              deviceLabel: sample.name,
              kiosk: true,
              tahtaKilit: true,
            })
              .then(() => toast.success('Hazır .deb indirildi'))
              .catch(() => toast.error('.deb oluşturulamadı'))
          }
        >
          <Package className="size-4" />
          Pardus .deb
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            downloadTextFile(
              `ogretmenpro-tahta.desktop`,
              buildLinuxDesktopEntry({
                panelOrigin: origin,
                schoolId: sample.school_id,
                deviceId: sample.id,
                deviceLabel: sample.name,
              }),
            );
            toast.success('.desktop dosyası indirildi');
          }}
        >
          Linux .desktop
        </Button>
      </CardContent>
    </Card>
  );
}
