'use client';

import { usePathname, useRouter } from 'next/navigation';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { allStudioModuleHrefs, resolveStudioNavHref } from '@/lib/ders-dagit-studio-nav';

const MOBILE_OPTIONS = [
  { value: '/ders-dagit/studyo', label: 'Özet' },
  ...allStudioModuleHrefs().map((p) => ({ value: p.href, label: p.label })),
  { value: '/ders-dagit/studyo/ayarlar', label: 'Ayarlar' },
];

export function StudioMobileNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const value =
    resolveStudioNavHref(
      pathname,
      MOBILE_OPTIONS.map((o) => o.value),
    ) || MOBILE_OPTIONS[0]!.value;

  return (
    <DdSelectField
      label="Sayfa"
      className="max-w-md"
      value={value}
      onValueChange={(v) => router.push(v)}
      options={MOBILE_OPTIONS}
    />
  );
}
