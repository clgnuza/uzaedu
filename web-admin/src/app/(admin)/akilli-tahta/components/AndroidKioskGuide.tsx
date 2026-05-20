'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';
import { downloadTextFile } from '@/lib/smart-board-kiosk-oneliner';

const FULLY_KIOSK_INTENT = `intent://launch#Intent;scheme=fully;package=de.ozerov.fully;S.url=%s;end`;

export function AndroidKioskGuide({ sampleUrl }: { sampleUrl: string }) {
  return (
    <Card className="border-violet-200/50">
      <CardHeader className="border-b border-violet-200/40 bg-violet-500/8 px-3 py-3 sm:px-6 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Smartphone className="size-4" />
          Android tahta (isteğe bağlı)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 py-3 sm:px-6 sm:py-4 text-sm text-muted-foreground">
        <p>
          Pardus yoksa <strong>Fully Kiosk Browser</strong> veya kurumsal Chrome ile tam ekran açılır. QR onayı yine
          öğretmen telefonundan panel/PWA ile yapılır.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-xs">
          <li>Play Store → Fully Kiosk (veya kurumsal MDM ile Chrome kiosk).</li>
          <li>Başlangıç URL: sınıf etiketindeki classroom adresi.</li>
          <li>Kiosk modu, ekran uyanık, sistem çubuğu gizli.</li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              downloadTextFile(
                'android-tahta-kiosk-notlar.txt',
                [
                  'Uzaedu Android tahta notları',
                  '========================',
                  `Başlangıç URL: ${sampleUrl}`,
                  '',
                  'Fully Kiosk: Start URL alanına yapıştırın, Kiosk Mode açık.',
                  'Chrome (kurumsal): Policy ile URLAllowlist + fullscreen.',
                  '',
                  `Intent örneği: ${FULLY_KIOSK_INTENT.replace('%s', sampleUrl)}`,
                ].join('\n'),
              );
            }}
          >
            Kurulum notları (.txt)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
