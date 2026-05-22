'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarRange, Scale, Building2, Wand2, Send, Palette } from 'lucide-react';

const GROUPS = [
  {
    title: 'Zaman ve dönem',
    desc: 'Gün sayısı, öğle arası, hafta sonu saatleri.',
    href: '/ders-dagit/studyo/donem',
    icon: CalendarRange,
  },
  {
    title: 'Kısıtlar ve kurallar',
    desc: 'Öğretmen limitleri, derslik zorunluluğu, ardışık boşluk.',
    href: '/ders-dagit/studyo/kurallar',
    icon: Scale,
  },
  {
    title: 'Derslikler',
    desc: 'Oda listesi ve kapasite.',
    href: '/ders-dagit/studyo/derslikler',
    icon: Building2,
  },
  {
    title: 'Üretim',
    desc: 'CSP motoru, versiyon sayısı, süre.',
    href: '/ders-dagit/studyo/uret',
    icon: Wand2,
  },
  {
    title: 'Yayın ve paylaşım',
    desc: 'Okula aktarım, veli PDF, paylaşım linki.',
    href: '/ders-dagit/studyo/program?panel=publish',
    icon: Send,
  },
  {
    title: 'Görünüm (editör)',
    desc: 'Yazdır, renkler, varsayılan filtre.',
    href: '/ders-dagit/studyo/program',
    icon: Palette,
  },
] as const;

export function StudioSettingsPanel() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {GROUPS.map((g) => (
        <Link key={g.href} href={g.href} className="block rounded-xl border border-border transition-shadow hover:shadow-md">
          <Card className="h-full border-0 shadow-none">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <g.icon className="size-5 text-primary" />
              <CardTitle className="text-sm">{g.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{g.desc}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
