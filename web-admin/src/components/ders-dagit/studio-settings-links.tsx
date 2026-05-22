'use client';

import Link from 'next/link';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DD_CARD_HEADER,
  DD_CARD_CONTENT,
  ddVariantAt,
} from '@/components/ders-dagit/dd-ui';
import {
  Settings2,
  CalendarRange,
  Scale,
  GitBranch,
  Building2,
  Wand2,
  Send,
  TableProperties,
  Users,
  BookOpen,
  ListChecks,
  Grid3x3,
  ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StudioSettingsGroup = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
};

export const STUDIO_SETTINGS_GROUPS: StudioSettingsGroup[] = [
  {
    title: 'Kurulum',
    desc: 'Okul türü, sınıf profilleri ve veri özeti.',
    href: '/ders-dagit/studyo/kurulum',
    icon: Settings2,
  },
  {
    title: 'Dönem ve saatler',
    desc: 'Çalışma günleri, öğle arası, ikili eğitim.',
    href: '/ders-dagit/studyo/donem',
    icon: CalendarRange,
  },
  {
    title: 'Sınıf saatleri',
    desc: 'Şube bazlı zaman tablosu ve kapasite.',
    href: '/ders-dagit/studyo/sinif-saatleri',
    icon: Grid3x3,
  },
  {
    title: 'Öğretmenler',
    desc: 'Müsaitlik ve limitler.',
    href: '/ders-dagit/studyo/ogretmenler',
    icon: Users,
  },
  {
    title: 'Dersler',
    desc: 'Katalog ve TTKB planı.',
    href: '/ders-dagit/studyo/dersler',
    icon: BookOpen,
  },
  {
    title: 'Atamalar',
    desc: 'Ders–öğretmen–şube eşlemesi.',
    href: '/ders-dagit/studyo/atamalar',
    icon: ListChecks,
  },
  {
    title: 'Planlama ilişkileri',
    desc: 'aSc kart kuralları ve kısıtlar.',
    href: '/ders-dagit/studyo/planlama-iliskileri',
    icon: GitBranch,
  },
  {
    title: 'Kurallar',
    desc: 'Zorunlu ve tercih kuralları.',
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
    title: 'Doğrulama',
    desc: 'Ön kontrol ve eksikler.',
    href: '/ders-dagit/studyo/dogrulama',
    icon: ClipboardCheck,
  },
  {
    title: 'Program oluştur',
    desc: 'Otomatik dağıtım.',
    href: '/ders-dagit/studyo/uret',
    icon: Wand2,
  },
  {
    title: 'Program tablosu',
    desc: 'Düzenleme, yazdırma, renkler.',
    href: '/ders-dagit/studyo/program',
    icon: TableProperties,
  },
  {
    title: 'Yayın',
    desc: 'Veli görünümü ve paylaşım.',
    href: '/ders-dagit/studyo/program?panel=publish',
    icon: Send,
  },
];

export function StudioSettingsLinks() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STUDIO_SETTINGS_GROUPS.map((g, i) => (
        <Link key={g.href} href={g.href} className="block transition-transform hover:scale-[1.01]">
          <DdCard variant={ddVariantAt(i)} className="h-full">
            <CardHeader className={`${DD_CARD_HEADER} flex flex-row items-center gap-2`}>
              <span className="dd-icon-badge !size-8 !rounded-lg">
                <g.icon className="size-4" strokeWidth={2} />
              </span>
              <CardTitle className="text-sm">{g.title}</CardTitle>
            </CardHeader>
            <CardContent className={DD_CARD_CONTENT}>
              <p className="text-xs text-muted-foreground">{g.desc}</p>
            </CardContent>
          </DdCard>
        </Link>
      ))}
    </div>
  );
}
