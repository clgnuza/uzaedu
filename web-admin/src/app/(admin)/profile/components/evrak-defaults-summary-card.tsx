'use client';

import Link from 'next/link';
import { ChevronRight, FileText } from 'lucide-react';
import type { EvrakDefaults } from '@/components/evrak-defaults-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FIELD_LABELS: Record<string, string> = {
  okul_adi: 'Okul adı',
  mudur_adi: 'Müdür',
  ogretim_yili: 'Öğretim yılı',
  sinif: 'Sınıf / şube',
  zumreler: 'Zümreler',
  zumre_ogretmenleri: 'Zümre öğretmenleri',
  onay_tarihi: 'Onay tarihi',
  ogretmen_unvani: 'Ünvan',
};

function summarizeDefaults(d: EvrakDefaults): { key: string; label: string; value: string }[] {
  if (!d || typeof d !== 'object') return [];
  const out: { key: string; label: string; value: string }[] = [];
  for (const [key, raw] of Object.entries(d)) {
    const value = raw == null ? '' : String(raw).trim();
    if (!value) continue;
    const label = FIELD_LABELS[key] ?? key;
    const short = value.length > 80 ? `${value.slice(0, 77)}…` : value;
    out.push({ key, label, value: short });
  }
  return out;
}

export function EvrakDefaultsSummaryCard({ evrakDefaults, className }: { evrakDefaults: EvrakDefaults; className?: string }) {
  const rows = summarizeDefaults(evrakDefaults);
  const hasAny = rows.length > 0;

  return (
    <Card className={cn('overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl', className)}>
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <CardTitle className="flex flex-col gap-3 text-base sm:flex-row sm:items-center sm:gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="size-4 text-primary" />
          </span>
          <span className="min-w-0">
            MEB yıllık plan — varsayılanlar
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Evrak ve plan sayfalarında otomatik doldurulur
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {!hasAny ? (
          <p className="text-sm text-muted-foreground">
            Henüz kayıtlı varsayılan yok. Ayarlar → Zümre sekmesinden okul, müdür ve zümre bilgilerinizi kaydedebilirsiniz.
          </p>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {rows.slice(0, 6).map((r) => (
              <li key={r.key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:w-36">
                  {r.label}
                </span>
                <span className="min-w-0 break-words text-foreground">{r.value}</span>
              </li>
            ))}
            {rows.length > 6 && (
              <li className="text-xs text-muted-foreground">+{rows.length - 6} alan daha</li>
            )}
          </ul>
        )}
        <Link
          href="/settings?tab=zumre"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          Varsayılanları düzenle
          <ChevronRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
