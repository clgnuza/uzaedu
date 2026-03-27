'use client';

import { School, GraduationCap, BookOpen, Building2, Wrench, Landmark, HeartHandshake, Library } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  anaokul: School,
  ilkokul: BookOpen,
  ortaokul: BookOpen,
  lise: GraduationCap,
  meslek_lisesi: Wrench,
  imam_hatip_ortaokul: Landmark,
  imam_hatip_lise: Landmark,
  ozel_egitim: HeartHandshake,
  halk_egitim: Library,
  bilsem: GraduationCap,
  default: Building2,
};

export function SchoolTypeIcon({ type, className }: { type?: string; className?: string }) {
  const name = (type || '').toLowerCase();
  const Icon = TYPE_ICONS[name] ?? TYPE_ICONS.default;
  return <Icon className={cn('size-4 text-slate-500 dark:text-slate-400', className)} aria-hidden />;
}
