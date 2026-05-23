'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DdInfoHint } from '@/components/ders-dagit/dd-info-hint';
import { SETTING_HINTS, settingHintKeyFromHref } from '@/lib/ders-dagit-hints';
import type { LucideIcon } from 'lucide-react';
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
  Layers,
  Archive,
  BarChart3,
  LayoutGrid,
  FileText,
  ArrowRightLeft,
} from 'lucide-react';

/** Sıra önemli — ilgili sayfalar yan yana */
export type StudioSettingsSection = 'zaman' | 'veri' | 'kisit' | 'program';

export type StudioSettingsGroup = {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  section: StudioSettingsSection;
};

export const STUDIO_SETTINGS_GROUPS: StudioSettingsGroup[] = [
  // Zaman ve okul
  { section: 'zaman', title: 'Kurulum', desc: 'Okul türü, sınıf profilleri.', href: '/ders-dagit/studyo/kurulum', icon: Settings2 },
  { section: 'zaman', title: 'Dönem ve saatler', desc: 'Çalışma günleri, öğle arası.', href: '/ders-dagit/studyo/donem', icon: CalendarRange },
  { section: 'zaman', title: 'Sınıf saatleri', desc: 'Şube kapasitesi ve slotlar.', href: '/ders-dagit/studyo/sinif-saatleri', icon: Grid3x3 },
  // Ders verisi
  {
    section: 'veri',
    title: 'İçe / dışa aktar',
    desc: 'aSc XML, Bilsa/e-Okul, JSON yedek.',
    href: '/ders-dagit/studyo/ayarlar/aktarim',
    icon: ArrowRightLeft,
  },
  { section: 'veri', title: 'Dersler', desc: 'Katalog ve TTKB planı.', href: '/ders-dagit/studyo/dersler', icon: BookOpen },
  { section: 'veri', title: 'Öğretmenler', desc: 'Müsaitlik ve limitler.', href: '/ders-dagit/studyo/ogretmenler', icon: Users },
  { section: 'veri', title: 'Atamalar', desc: 'Ders–öğretmen–şube.', href: '/ders-dagit/studyo/atamalar', icon: ListChecks },
  { section: 'veri', title: 'Gruplar', desc: 'Bölünmüş sınıflar.', href: '/ders-dagit/studyo/gruplar', icon: GitBranch },
  { section: 'veri', title: 'Seçmeli', desc: 'Seçmeli havuzlar.', href: '/ders-dagit/studyo/secmeli', icon: Layers },
  { section: 'veri', title: 'Derslikler', desc: 'Oda ve bina listesi.', href: '/ders-dagit/studyo/derslikler', icon: Building2 },
  // Kurallar
  { section: 'kisit', title: 'Planlama ilişkileri', desc: 'Plan Kartı kuralları.', href: '/ders-dagit/studyo/planlama-iliskileri', icon: GitBranch },
  { section: 'kisit', title: 'Kurallar', desc: 'Zorunlu ve tercih.', href: '/ders-dagit/studyo/kurallar', icon: Scale },
  { section: 'kisit', title: 'Doğrulama', desc: 'Üretim öncesi kontrol.', href: '/ders-dagit/studyo/dogrulama', icon: ClipboardCheck },
  // Program akışı
  { section: 'program', title: 'Program oluştur', desc: 'Otomatik dağıtım.', href: '/ders-dagit/studyo/uret', icon: Wand2 },
  { section: 'program', title: 'Program tablosu', desc: 'Düzenleme ve yazdırma.', href: '/ders-dagit/studyo/program', icon: TableProperties },
  { section: 'program', title: 'Yazdır / Raporlar', desc: 'PDF, Excel, kurul, e-Okul.', href: '/ders-dagit/studyo/raporlar', icon: FileText },
  { section: 'program', title: 'Öğretmen programı', desc: 'Tüm öğretmenler matris.', href: '/ders-dagit/studyo/ogretmen-program', icon: LayoutGrid },
  { section: 'program', title: 'Adalet', desc: 'Yük ve denge özeti.', href: '/ders-dagit/studyo/adalet', icon: BarChart3 },
  { section: 'program', title: 'Yayın', desc: 'Veli ve paylaşım.', href: '/ders-dagit/studyo/program?panel=publish', icon: Send },
  { section: 'program', title: 'Arşiv', desc: 'Eski sürümler.', href: '/ders-dagit/studyo/arsiv', icon: Archive },
];

const SECTION_META: Record<
  StudioSettingsSection,
  { title: string; hint: string }
> = {
  zaman: {
    title: 'Zaman ve okul yapısı',
    hint: 'Önce okul profili ve haftalık zaman ızgarası; üretim yalnızca bu çerçeveyi kullanır.',
  },
  veri: {
    title: 'Dersler, öğretmenler ve atamalar',
    hint: 'Katalog → öğretmen limitleri → atama → grup/derslik; veri burada tamamlanır.',
  },
  kisit: {
    title: 'Kurallar ve doğrulama',
    hint: 'Planlama ilişkileri ve motor kuralları; doğrulama üretimden hemen önce.',
  },
  program: {
    title: 'Program, yayın ve arşiv',
    hint: 'Üret → düzenle → denge kontrolü → yayınla → eski sürümler.',
  },
};

const SECTION_ORDER: StudioSettingsSection[] = ['zaman', 'veri', 'kisit', 'program'];

function SettingCard({ item }: { item: StudioSettingsGroup }) {
  const Icon = item.icon;
  const key = settingHintKeyFromHref(item.href);
  const hint = SETTING_HINTS[key];

  return (
    <div className="group relative rounded-xl border border-border/70 bg-card/80 shadow-sm transition-shadow hover:border-primary/30 hover:shadow-md">
      <Link href={item.href} className="flex items-center gap-2.5 p-2.5 pr-9">
        <span className="dd-icon-badge !size-8 shrink-0 !rounded-lg">
          <Icon className="size-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-semibold leading-tight">
            {item.title}
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{item.desc}</span>
        </span>
      </Link>
      {hint && (
        <div className="absolute right-1 top-1 z-10" onClick={(e) => e.stopPropagation()}>
          <DdInfoHint label={`${item.title} hakkında`} title={hint.title}>
            <p>{hint.detail}</p>
          </DdInfoHint>
        </div>
      )}
    </div>
  );
}

function SettingsSection({ sectionKey, items }: { sectionKey: StudioSettingsSection; items: StudioSettingsGroup[] }) {
  if (!items.length) return null;
  const meta = SECTION_META[sectionKey];
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{meta.title}</h2>
        <DdInfoHint label={meta.title} title={meta.title}>
          <p>{meta.hint}</p>
        </DdInfoHint>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <SettingCard key={item.href} item={item} />
        ))}
      </div>
    </section>
  );
}

export function StudioSettingsLinks() {
  const bySection = (s: StudioSettingsSection) => STUDIO_SETTINGS_GROUPS.filter((g) => g.section === s);

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Yukarıdan aşağı kurulum sırasına göre gruplandı. Karttaki <strong className="font-medium text-foreground">(i)</strong> ile açıklama.
      </p>
      {SECTION_ORDER.map((key) => (
        <SettingsSection key={key} sectionKey={key} items={bySection(key)} />
      ))}
    </div>
  );
}
