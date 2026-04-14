import { cn } from '@/lib/utils';

/** Haftalık program için küçük dekoratif SVG (metin yerine tek görsel ipucu). */
export function DersProgramiWeekIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 88 88"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="dpw-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <rect x="6" y="10" width="76" height="68" rx="12" fill="url(#dpw-bg)" />
      <rect x="14" y="20" width="60" height="8" rx="3" className="fill-foreground/15" />
      {['P', 'S', 'Ç', 'P', 'C'].map((_, i) => (
        <g key={i} transform={`translate(${16 + i * 14}, 34)`}>
          <rect width="12" height="6" rx="2" className="fill-foreground/10" />
          <rect y="9" width="12" height="6" rx="2" className="fill-sky-500/35 dark:fill-sky-400/40" />
          <rect y="18" width="12" height="6" rx="2" className="fill-violet-500/30 dark:fill-violet-400/35" />
        </g>
      ))}
      <circle cx="70" cy="24" r="5" className="fill-emerald-500/80 dark:fill-emerald-400/90" />
    </svg>
  );
}
