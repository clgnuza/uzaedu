'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const SKILLS = [
  'Eğitim Yönetimi',
  'Ders Planlama',
  'Ölçme Değerlendirme',
  'Dijital Araçlar',
  'İletişim',
  'Takım Çalışması',
  'Raporlama',
  'Müfredat',
];

export function SkillsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Beceriler</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2.5">
          {SKILLS.map((label, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
