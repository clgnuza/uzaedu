'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StudioSettingsPanel } from '@/components/ders-dagit/StudioSettingsPanel';

export default function StudioAyarlarPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stüdyo ayarları</CardTitle>
      </CardHeader>
      <CardContent>
        <StudioSettingsPanel />
      </CardContent>
    </Card>
  );
}
