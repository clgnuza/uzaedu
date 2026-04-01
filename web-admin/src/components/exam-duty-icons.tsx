import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';

type SvgProps = SVGProps<SVGSVGElement> & { className?: string };

const base = 'shrink-0';

/** Görünüm: Tüm duyurular */
export function SvgViewAll({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

/** Görünüm: Süresi devam eden / aktif */
export function SvgViewActive({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Görünüm: Süre yakın (7 gün) */
export function SvgViewSoon({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

/** Görünüm: Görev çıktı işaretli */
export function SvgViewAssigned({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="m9 10 2 2 4-4" />
    </svg>
  );
}

/** Görünüm: Geçmiş */
export function SvgViewPast({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 8h.01M12 8h.01M17 8h.01M7 12h10M7 16h6" />
    </svg>
  );
}

/** Kurum: MEB — bina */
export function SvgKurumMeb({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4v18" />
      <path d="M19 21V11l-7-4" />
      <path d="M9 9v.01" />
      <path d="M9 12v.01" />
      <path d="M9 15v.01" />
      <path d="M9 18v.01" />
    </svg>
  );
}

/** Kurum: ÖSYM — belge */
export function SvgKurumOsym({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h6M8 9h2" />
    </svg>
  );
}

/** Kurum: AÖF — açık kitap */
export function SvgKurumAof({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

/** Kurum: ATA-AÖF — rozet */
export function SvgKurumAtaaof({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="6" />
      <path d="M8 13.5 4 22l8-4 8 4-4-8.5" />
    </svg>
  );
}

/** Kurum: AUZEF — pin */
export function SvgKurumAuzef({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** Duyuru kartı başlığı */
export function SvgMegaphone({ className, ...p }: SvgProps) {
  return (
    <svg viewBox="0 0 24 24" className={cn(base, 'size-5', className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11.6 16.8a3 3 0 1 1-4.8-2.4" />
    </svg>
  );
}

export const KURUM_SVG: Record<string, ComponentType<SvgProps>> = {
  meb: SvgKurumMeb,
  osym: SvgKurumOsym,
  aof: SvgKurumAof,
  ataaof: SvgKurumAtaaof,
  auzef: SvgKurumAuzef,
};
