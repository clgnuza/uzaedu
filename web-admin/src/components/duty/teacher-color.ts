/**
 * Deterministik öğretmen renk sistemi.
 * Her öğretmene ID sırasına göre 12 pastel renkten biri atanır.
 */

export type TeacherColor = {
  bg: string;
  text: string;
  border: string;
  dot: string;       // küçük renkli nokta / avatar
  hoverBg: string;
  darkBg: string;
  darkText: string;
};

export const TEACHER_PALETTE: TeacherColor[] = [
  { bg: 'bg-sky-100',      text: 'text-sky-800',      border: 'border-sky-300',      dot: 'bg-sky-400',      hoverBg: 'hover:bg-sky-200',      darkBg: 'dark:bg-sky-900/40',      darkText: 'dark:text-sky-300' },
  { bg: 'bg-violet-100',   text: 'text-violet-800',   border: 'border-violet-300',   dot: 'bg-violet-400',   hoverBg: 'hover:bg-violet-200',   darkBg: 'dark:bg-violet-900/40',   darkText: 'dark:text-violet-300' },
  { bg: 'bg-amber-100',    text: 'text-amber-800',    border: 'border-amber-300',    dot: 'bg-amber-400',    hoverBg: 'hover:bg-amber-200',    darkBg: 'dark:bg-amber-900/40',    darkText: 'dark:text-amber-300' },
  { bg: 'bg-rose-100',     text: 'text-rose-800',     border: 'border-rose-300',     dot: 'bg-rose-400',     hoverBg: 'hover:bg-rose-200',     darkBg: 'dark:bg-rose-900/40',     darkText: 'dark:text-rose-300' },
  { bg: 'bg-emerald-100',  text: 'text-emerald-800',  border: 'border-emerald-300',  dot: 'bg-emerald-400',  hoverBg: 'hover:bg-emerald-200',  darkBg: 'dark:bg-emerald-900/40',  darkText: 'dark:text-emerald-300' },
  { bg: 'bg-orange-100',   text: 'text-orange-800',   border: 'border-orange-300',   dot: 'bg-orange-400',   hoverBg: 'hover:bg-orange-200',   darkBg: 'dark:bg-orange-900/40',   darkText: 'dark:text-orange-300' },
  { bg: 'bg-teal-100',     text: 'text-teal-800',     border: 'border-teal-300',     dot: 'bg-teal-400',     hoverBg: 'hover:bg-teal-200',     darkBg: 'dark:bg-teal-900/40',     darkText: 'dark:text-teal-300' },
  { bg: 'bg-pink-100',     text: 'text-pink-800',     border: 'border-pink-300',     dot: 'bg-pink-400',     hoverBg: 'hover:bg-pink-200',     darkBg: 'dark:bg-pink-900/40',     darkText: 'dark:text-pink-300' },
  { bg: 'bg-indigo-100',   text: 'text-indigo-800',   border: 'border-indigo-300',   dot: 'bg-indigo-400',   hoverBg: 'hover:bg-indigo-200',   darkBg: 'dark:bg-indigo-900/40',   darkText: 'dark:text-indigo-300' },
  { bg: 'bg-lime-100',     text: 'text-lime-800',     border: 'border-lime-300',     dot: 'bg-lime-500',     hoverBg: 'hover:bg-lime-200',     darkBg: 'dark:bg-lime-900/40',     darkText: 'dark:text-lime-300' },
  { bg: 'bg-cyan-100',     text: 'text-cyan-800',     border: 'border-cyan-300',     dot: 'bg-cyan-400',     hoverBg: 'hover:bg-cyan-200',     darkBg: 'dark:bg-cyan-900/40',     darkText: 'dark:text-cyan-300' },
  { bg: 'bg-fuchsia-100',  text: 'text-fuchsia-800',  border: 'border-fuchsia-300',  dot: 'bg-fuchsia-400',  hoverBg: 'hover:bg-fuchsia-200',  darkBg: 'dark:bg-fuchsia-900/40',  darkText: 'dark:text-fuchsia-300' },
];

/** Verilen ID listesinden deterministik renk haritası oluşturur. */
export function buildColorMap(
  teacherIds: string[],
): Map<string, TeacherColor> {
  const sorted = [...teacherIds].sort(); // ID'ye göre sıralayarak aynı renk garantisi
  const map = new Map<string, TeacherColor>();
  sorted.forEach((id, i) => {
    map.set(id, TEACHER_PALETTE[i % TEACHER_PALETTE.length]);
  });
  return map;
}

/** Renk haritasından öğretmen rengi döndürür; bulunamazsa varsayılan renk. */
export function getTeacherColor(
  teacherId: string,
  colorMap: Map<string, TeacherColor>,
): TeacherColor {
  return colorMap.get(teacherId) ?? TEACHER_PALETTE[0];
}
