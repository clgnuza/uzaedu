'use client';

import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  GraduationCap,
  School,
  PenLine,
  Library,
  Microscope,
  Award,
  Globe,
  Laptop,
  Lightbulb,
  Music2,
  Brain,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const AVATAR_PRESET_IDS = [
  'rose',
  'ocean',
  'sunset',
  'forest',
  'slate',
  'violet',
  'amber',
  'mint',
  'laptop',
  'bulb',
  'note',
  'mind',
  'palette',
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export function isAvatarPresetId(s: string | null | undefined): s is AvatarPresetId {
  return !!s && (AVATAR_PRESET_IDS as readonly string[]).includes(s);
}

/** DB anahtarı aynı; etiket + ikon öğretmen bağlamına göre (backend avatar-keys ile uyumlu). */
const PRESET: Record<
  AvatarPresetId,
  { label: string; Icon: LucideIcon; gradient: string }
> = {
  rose: { label: 'Kitap', Icon: BookOpen, gradient: 'from-rose-600 to-rose-900' },
  ocean: { label: 'Mezuniyet', Icon: GraduationCap, gradient: 'from-sky-600 to-sky-900' },
  sunset: { label: 'Okul', Icon: School, gradient: 'from-amber-600 to-orange-900' },
  forest: { label: 'Kalem', Icon: PenLine, gradient: 'from-emerald-600 to-emerald-950' },
  slate: { label: 'Kütüphane', Icon: Library, gradient: 'from-slate-500 to-slate-800' },
  violet: { label: 'Deney', Icon: Microscope, gradient: 'from-violet-600 to-violet-900' },
  amber: { label: 'Başarı', Icon: Award, gradient: 'from-amber-500 to-amber-900' },
  mint: { label: 'Dünya', Icon: Globe, gradient: 'from-teal-600 to-teal-900' },
  laptop: { label: 'Bilişim', Icon: Laptop, gradient: 'from-indigo-600 to-indigo-950' },
  bulb: { label: 'Fikir', Icon: Lightbulb, gradient: 'from-yellow-500 to-amber-900' },
  note: { label: 'Nota', Icon: Music2, gradient: 'from-fuchsia-600 to-fuchsia-950' },
  mind: { label: 'Zeka', Icon: Brain, gradient: 'from-sky-600 to-indigo-950' },
  palette: { label: 'Palet', Icon: Palette, gradient: 'from-orange-600 to-rose-900' },
};

export const AVATAR_PRESETS: { id: AvatarPresetId; label: string }[] = AVATAR_PRESET_IDS.map((id) => ({
  id,
  label: PRESET[id].label,
}));

/** Hazır profil rozeti: gradient zemin + öğretmen temalı vektör ikon (Lucide, ek ağ isteği yok). */
export function AvatarPresetSvg({ id, className }: { id: AvatarPresetId; className?: string }) {
  const { Icon, gradient } = PRESET[id];
  return (
    <span
      className={cn(
        'relative inline-flex size-full items-center justify-center overflow-hidden rounded-full bg-linear-to-br shadow-inner',
        gradient,
        className,
      )}
      aria-hidden
    >
      <Icon className="relative z-1 size-[58%] text-white opacity-[0.97] drop-shadow-sm" strokeWidth={2} />
    </span>
  );
}
