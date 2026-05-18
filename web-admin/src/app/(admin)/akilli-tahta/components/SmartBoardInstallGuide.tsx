'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { CheckCircle2, Copy, Download, Laptop, Link2, Monitor, QrCode, ShieldCheck, Terminal, Usb } from 'lucide-react';

export function SmartBoardInstallGuide({
  schoolId,
  hasDevice,
}: {
  schoolId: string | null;
  hasDevice: boolean;
}) {
  const classroomSample = schoolId
    ? `/tv/classroom?school_id=${schoolId}&device_id=<device_id>&usb=1&kiosk=1&kilit=1`
    : '/tv/classroom?school_id=<school_id>&device_id=<device_id>&usb=1&kiosk=1&kilit=1';

  return (
    <div className="space-y-3 sm:space-y-5">
      <Card className="overflow-hidden border-cyan-200/50 dark:border-cyan-900/40">
        <CardHeader className="border-b border-cyan-200/40 bg-cyan-500/8 px-3 py-3 sm:px-6 sm:py-5">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <span className="flex size-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
              <ShieldCheck className="size-4" />
            </span>
            Akilli Tahta Kurulum Akisi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-6 sm:py-5">
          <Alert variant="info">
            Hedef akış: <strong>QR-first</strong>. PIN/OTP sadece yedek.
          </Alert>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StepCard
              idx={1}
              icon={<Monitor className="size-4" />}
              title="Cihaz ekle"
              desc="Cihazlar sekmesinde tahta kaydi olustur, pairing code olustur."
              visual={<span className="inline-flex rounded-full border bg-muted px-2 py-0.5 text-[10px]">Pairing Code</span>}
            />
            <StepCard
              idx={2}
              icon={<Link2 className="size-4" />}
              title="Classroom URL ac"
              desc="Tahtada sadece classroom URL kullan. school_id + device_id zorunlu."
              visual={<code className="block truncate rounded bg-muted px-2 py-1 text-[10px]">{classroomSample}</code>}
            />
            <StepCard
              idx={3}
              icon={<QrCode className="size-4" />}
              title="QR ile acilis"
              desc="Tahta ekrani QR uretir, ogretmen panelden onaylar, tahta otomatik acilir."
              visual={<span className="inline-flex rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">QR-first</span>}
            />
            <StepCard
              idx={4}
              icon={<Usb className="size-4" />}
              title="Yedek giris"
              desc="Internet sorunu halinde OTP/PIN fallback. OTP tek kullanimlik."
              visual={<span className="inline-flex rounded-full border px-2 py-0.5 text-[10px]">OTP / PIN fallback</span>}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-amber-200/50 dark:border-amber-900/40">
        <CardHeader className="border-b border-amber-200/40 bg-amber-500/8 px-3 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Laptop className="size-4 text-amber-700 dark:text-amber-300" />
            Pardus 23 Kurulum (Saha)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-3 py-3 sm:px-6 sm:py-4">
          <Alert variant="info">
            Modern akış: cihaz bazli paketi indir, tahtada <strong>.deb</strong> kur ve ilk acilista sihirbazi tamamla.
          </Alert>
          <div className="grid gap-2.5 sm:gap-3">
            <TerminalStep
              idx={1}
              title="On kosul paketleri"
              desc="Chromium ve ekran kapanmasini engelleyen araclari yukleyin."
              command="sudo apt update && sudo apt install -y chromium x11-xserver-utils"
            />
            <TerminalStep
              idx={2}
              title="Paket klasorune gec"
              desc="Indirdiginiz ZIP icindeki ogretmenpro-tahta-pardus klasorunde olun."
              command="cd ~/Downloads/ogretmenpro-tahta-pardus"
            />
            <TerminalStep
              idx={3}
              title=".deb olustur"
              desc="GUI kurulum icin tek dosya .deb paketini uretin."
              command="bash packages/deb/build-deb.sh 2.1.0"
            />
            <TerminalStep
              idx={4}
              title="GUI kurulum"
              desc="Pardus Paket Kurucu acilir; Yukle ile tamamlayin."
              command="xdg-open packages/deb/dist/ogretmenpro-tahta_2.1.0_all.deb"
            />
            <TerminalStep
              idx={5}
              title="Ilk acilis sihirbazi"
              desc="Lisans + sinif adi adimlarini tamamlayin (tek sefer calisir)."
              command="ogretmenpro-tahta-launch"
            />
            <TerminalStep
              idx={6}
              title="Saglik kontrolu"
              desc="Kurulum raporu ve policy/autostart kontrolunu alin."
              command="ogretmenpro-tahta-diagnostics && cat /var/log/ogretmenpro-tahta/install-report.json"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/akilli-tahta?tab=ayarlar">
              <Button size="sm" className="h-8 gap-1 text-xs">
                <Download className="size-3.5" /> ZIP / .deb paket
              </Button>
            </Link>
            <Link href="/akilli-tahta?tab=yetkiler">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <QrCode className="size-3.5" /> OTP/QR yetki
              </Button>
            </Link>
            <Link href="/akilli-tahta?tab=cihazlar">
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                <CheckCircle2 className="size-3.5" /> Cihaz durum
              </Button>
            </Link>
          </div>
          {!hasDevice ? (
            <Alert variant="warning">Kuruluma gecmeden once en az bir tahta cihazi ekleyin.</Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TerminalStep({
  idx,
  title,
  desc,
  command,
}: {
  idx: number;
  title: string;
  desc: string;
  command: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-800 dark:text-amber-200">
            {idx}
          </span>
          <p className="truncate text-xs font-semibold sm:text-sm">{title}</p>
        </div>
        <Terminal className="size-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground sm:text-xs">{desc}</p>
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-2">
        <code className="min-w-0 flex-1 wrap-break-word text-[11px] leading-relaxed">{command}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1 px-2 text-[10px]"
          onClick={() => void navigator.clipboard.writeText(command)}
        >
          <Copy className="size-3" />
          Kopyala
        </Button>
      </div>
    </div>
  );
}

function StepCard({
  idx,
  icon,
  title,
  desc,
  visual,
}: {
  idx: number;
  icon: ReactNode;
  title: string;
  desc: string;
  visual: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {idx}
        </span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
      <div className="mt-2">{visual}</div>
    </div>
  );
}
