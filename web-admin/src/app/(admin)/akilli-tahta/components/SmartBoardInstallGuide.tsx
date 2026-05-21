'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { CheckCircle2, Chrome, Copy, Monitor, QrCode, ShieldCheck, Terminal } from 'lucide-react';
import { buildClassroomTvUrl } from '@/lib/smart-board-classroom-url';
import { buildPardusKurulumPageUrl } from '@/lib/smart-board-setup-link-parse';
import { SMART_BOARD_QR_FLOW_SUMMARY } from '@/lib/smart-board-teacher-qr-flow';
import { AndroidKioskGuide } from './AndroidKioskGuide';

export function SmartBoardInstallGuide({
  schoolId,
  hasDevice,
  setupCode,
}: {
  schoolId: string | null;
  hasDevice: boolean;
  setupCode?: string | null;
}) {
  const sample =
    schoolId && hasDevice
      ? `/tv/classroom?school_id=${schoolId}&device_id=<device_id>&kiosk=1&kilit=1`
      : setupCode
        ? `/tv/classroom?setup=1&school_code=${setupCode}`
        : '/tv/classroom?setup=1&school_code=<KOD>';

  const androidSampleUrl =
    schoolId && hasDevice
      ? buildClassroomTvUrl({ schoolId, deviceId: '<device_id>' })
      : typeof window !== 'undefined' && sample.startsWith('/')
        ? `${window.location.origin}${sample}`
        : sample;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Alert variant="info">
        <strong>Önerilen:</strong> Kurulum sihirbazı → etiket + eşleştirme kodu → tahta ilk kurulum linki → Duyuru TV. Canlıda önce
        TV izinli IP tanımlayın. {SMART_BOARD_QR_FLOW_SUMMARY}
      </Alert>

      <Card className="overflow-hidden border-emerald-200/50 dark:border-emerald-900/40">
        <CardHeader className="border-b border-emerald-200/40 bg-emerald-500/8 px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Chrome className="size-4 text-emerald-700 dark:text-emerald-300" />
            Tarayıcı-only (çoğu okul)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 py-3 sm:px-6 sm:py-4 text-sm">
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Kurulum sihirbazından sınıfları ekleyin; QR etiketlerinde eşleştirme kodu vardır.</li>
            <li>Tahtada Chromium / Edge → kiosk veya tam ekran.</li>
            <li>Kayıtlı tahta: ilk kurulum linkinde tahtayı seçin, etiketteki eşleştirme kodunu girin.</li>
            <li>
              Başlangıç adresi: sınıf etiketindeki URL veya{' '}
              {setupCode ? (
                <button
                  type="button"
                  className="font-mono text-primary underline"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      void navigator.clipboard?.writeText(
                        `${window.location.origin}/tv/classroom?setup=1&school_code=${encodeURIComponent(setupCode)}`,
                      );
                    }
                  }}
                >
                  ilk kurulum linki
                </button>
              ) : (
                'ilk kurulum linki'
              )}
              .
            </li>
            <li>Öğretmen telefonda girişli → QR okutur; tahta otomatik kullanım moduna geçer (tahtada şifre yok).</li>
          </ol>
          <code className="block break-all rounded bg-muted px-2 py-1 text-[10px]">{sample}</code>
          <p className="text-xs text-muted-foreground">
            Ayarlar → USB HTML indir: çift tıklayınca aynı adresi açar (USB anahtar).
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-cyan-200/50">
        <CardHeader className="border-b border-cyan-200/40 bg-cyan-500/8 px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="size-4" />
            QR-first güvenlik
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-3 py-3 sm:grid-cols-2 sm:px-6 sm:py-4">
          <MiniStep icon={<QrCode className="size-4" />} title="Tahta QR gösterir" />
          <MiniStep icon={<CheckCircle2 className="size-4" />} title="Öğretmen onaylar" />
          <MiniStep icon={<Monitor className="size-4" />} title="Duyuru + ders bandı açılır" />
          <MiniStep icon={<Copy className="size-4" />} title="PIN/OTP yedek" />
        </CardContent>
      </Card>

      {schoolId && hasDevice ? <AndroidKioskGuide sampleUrl={androidSampleUrl} /> : null}

      <Card className="border-amber-200/50">
        <CardHeader className="border-b border-amber-200/40 bg-amber-500/8 px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Terminal className="size-4 text-amber-700" />
            Pardus / gelişmiş (isteğe bağlı)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 py-3 sm:px-6 sm:py-4 text-sm text-muted-foreground">
          <p>
            <strong>Pardus:</strong>{' '}
            {setupCode && typeof window !== 'undefined' ? (
              <a
                href={buildPardusKurulumPageUrl(window.location.origin, setupCode)}
                className="font-medium text-primary underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Kurulum sihirbazı
              </a>
            ) : (
              'Kurulum sekmesindeki Pardus linki'
            )}{' '}
            — tahta seç, ZIP, tek komut. Alternatif: Ayarlar → USB / .deb.
          </p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/akilli-tahta?tab=ayarlar">Ayarlar ve Pardus indir</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStep({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-2 text-xs">
      {icon}
      {title}
    </div>
  );
}
