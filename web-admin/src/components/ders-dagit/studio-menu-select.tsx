'use client';

import { usePathname, useRouter } from 'next/navigation';
import { DdSelectField } from '@/components/ders-dagit/dd-select';

const FLOW = [
  { value: '/ders-dagit/studyo', label: 'Özet' },
  { value: '/ders-dagit/studyo/kurulum', label: 'Kurulum' },
  { value: '/ders-dagit/studyo/dogrulama', label: 'Doğrula' },
  { value: '/ders-dagit/studyo/uret', label: 'Otomatik oluştur' },
  { value: '/ders-dagit/studyo/program', label: 'Program' },
  { value: '/ders-dagit/studyo/ayarlar', label: 'Ayarlar' },
];

const STEPS = [
  { value: '/ders-dagit/studyo/kurulum', label: '1 Kurulum' },
  { value: '/ders-dagit/studyo/donem', label: '2 Dönem' },
  { value: '/ders-dagit/studyo/sinif-saatleri', label: '2b Sınıf saatleri' },
  { value: '/ders-dagit/studyo/atamalar', label: '3 Atama' },
  { value: '/ders-dagit/studyo/kurallar', label: '4 Kurallar' },
  { value: '/ders-dagit/studyo/dogrulama', label: '5 Doğrula' },
  { value: '/ders-dagit/studyo/uret', label: '6 Oluştur' },
  { value: '/ders-dagit/studyo/program', label: '7 Program' },
];

const FULL_NAV = [
  { value: '/ders-dagit/studyo/kurulum', label: 'Kurulum' },
  { value: '/ders-dagit/studyo/donem', label: 'Dönem' },
  { value: '/ders-dagit/studyo/sinif-saatleri', label: 'Sınıf saatleri' },
  { value: '/ders-dagit/studyo/ogretmenler', label: 'Öğretmenler' },
  { value: '/ders-dagit/studyo/dersler', label: 'Dersler' },
  { value: '/ders-dagit/studyo/gruplar', label: 'Gruplar' },
  { value: '/ders-dagit/studyo/secmeli', label: 'Seçmeli' },
  { value: '/ders-dagit/studyo/derslikler', label: 'Derslikler' },
  { value: '/ders-dagit/studyo/atamalar', label: 'Atamalar' },
  { value: '/ders-dagit/studyo/kurallar', label: 'Kurallar' },
  { value: '/ders-dagit/studyo/dogrulama', label: 'Doğrulama' },
  { value: '/ders-dagit/studyo/uret', label: 'Otomatik oluştur' },
  { value: '/ders-dagit/studyo/program', label: 'Program' },
  { value: '/ders-dagit/studyo/yayin', label: 'Yayın' },
  { value: '/ders-dagit/studyo/ogretmen-program', label: 'Öğretmen programı' },
  { value: '/ders-dagit/studyo/arsiv', label: 'Arşiv' },
  { value: '/ders-dagit/studyo/adalet', label: 'Adalet' },
  { value: '/ders-dagit/studyo/ayarlar', label: 'Ayarlar' },
];

function matchHref(pathname: string, href: string) {
  if (href === '/ders-dagit/studyo') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeFromList(pathname: string, items: { value: string; label: string }[]) {
  const hit = items.find((i) => matchHref(pathname, i.value));
  return hit?.value ?? items[0]?.value ?? '';
}

function NavSelect({
  label,
  items,
  className,
}: {
  label: string;
  items: { value: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const value = activeFromList(pathname ?? '', items);

  return (
    <DdSelectField
      label={label}
      className={className}
      value={value}
      onValueChange={(v) => router.push(v)}
      options={items}
    />
  );
}

export function StudioFlowSelect({ className }: { className?: string }) {
  return <NavSelect label="Ana akış" items={FLOW} className={className} />;
}

export function StudioStepSelect({ className }: { className?: string }) {
  return <NavSelect label="Kurulum adımları" items={STEPS} className={className} />;
}

export function StudioFullNavSelect({ className }: { className?: string }) {
  return <NavSelect label="Tüm sayfalar" items={FULL_NAV} className={className} />;
}
