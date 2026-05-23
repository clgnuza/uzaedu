/** Matris «Tümü» görünümü — öğretmen satırı / kart renkleri */
export const MATRIX_TEACHER_CELL = [
  'border-sky-300/90 bg-sky-50 text-sky-950 shadow-sm dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-50',
  'border-emerald-300/90 bg-emerald-50 text-emerald-950 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-50',
  'border-violet-300/90 bg-violet-50 text-violet-950 shadow-sm dark:border-violet-600 dark:bg-violet-950/50 dark:text-violet-50',
  'border-amber-300/90 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50',
  'border-rose-300/90 bg-rose-50 text-rose-950 shadow-sm dark:border-rose-600 dark:bg-rose-950/50 dark:text-rose-50',
  'border-cyan-300/90 bg-cyan-50 text-cyan-950 shadow-sm dark:border-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-50',
  'border-orange-300/90 bg-orange-50 text-orange-950 shadow-sm dark:border-orange-600 dark:bg-orange-950/50 dark:text-orange-50',
  'border-fuchsia-300/90 bg-fuchsia-50 text-fuchsia-950 shadow-sm dark:border-fuchsia-600 dark:bg-fuchsia-950/50 dark:text-fuchsia-50',
] as const;

export const MATRIX_TEACHER_ROW_BG = [
  'bg-sky-50/70 dark:bg-sky-950/25',
  'bg-emerald-50/70 dark:bg-emerald-950/25',
  'bg-violet-50/70 dark:bg-violet-950/25',
  'bg-amber-50/70 dark:bg-amber-950/25',
  'bg-rose-50/70 dark:bg-rose-950/25',
  'bg-cyan-50/70 dark:bg-cyan-950/25',
  'bg-orange-50/70 dark:bg-orange-950/25',
  'bg-fuchsia-50/70 dark:bg-fuchsia-950/25',
] as const;

export const MATRIX_TEACHER_ROW_ACCENT = [
  'border-l-sky-500',
  'border-l-emerald-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-orange-500',
  'border-l-fuchsia-500',
] as const;

export const MATRIX_TEACHER_AVATAR = [
  'bg-sky-500 text-white',
  'bg-emerald-500 text-white',
  'bg-violet-500 text-white',
  'bg-amber-600 text-white',
  'bg-rose-500 text-white',
  'bg-cyan-600 text-white',
  'bg-orange-500 text-white',
  'bg-fuchsia-500 text-white',
] as const;

export const MATRIX_CLASS_CELL = [
  'border-orange-300/90 bg-orange-50 text-orange-950 dark:border-orange-600 dark:bg-orange-950/45 dark:text-orange-50',
  'border-amber-300/90 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/45 dark:text-amber-50',
  'border-lime-300/90 bg-lime-50 text-lime-950 dark:border-lime-600 dark:bg-lime-950/45 dark:text-lime-50',
  'border-teal-300/90 bg-teal-50 text-teal-950 dark:border-teal-600 dark:bg-teal-950/45 dark:text-teal-50',
] as const;

export const MATRIX_CLASS_ROW_BG = [
  'bg-orange-50/60 dark:bg-orange-950/20',
  'bg-amber-50/60 dark:bg-amber-950/20',
  'bg-lime-50/60 dark:bg-lime-950/20',
  'bg-teal-50/60 dark:bg-teal-950/20',
] as const;

export const MATRIX_CLASS_ROW_ACCENT = [
  'border-l-orange-500',
  'border-l-amber-500',
  'border-l-lime-500',
  'border-l-teal-500',
] as const;

export function matrixToneIndex(rowIdx: number, paletteLength: number) {
  return rowIdx % paletteLength;
}
