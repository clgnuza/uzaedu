import { cn } from '@/lib/utils';

type PageLoadingBrandProps = {
  className?: string;
  density?: 'shell' | 'page';
};

/**
 * Küçük SVG öğretmen: konteyner içinde soldan sağa yürür (gradient + CSS, video yok).
 */
export function PageLoadingBrand({ className, density = 'shell' }: PageLoadingBrandProps) {
  const isPage = density === 'page';
  const frame = cn(
    'relative mx-auto w-full max-w-full',
    isPage
      ? 'max-w-[min(92vw,15rem)] sm:max-w-[min(88vw,16.5rem)]'
      : 'max-w-[min(92vw,13rem)] sm:max-w-[min(88vw,14rem)]',
  );

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 sm:gap-4', className)}>
      <div className={cn(frame, 'select-none')}>
        <div
          className={cn(
            'relative mx-auto h-17 w-full overflow-hidden rounded-2xl sm:h-18',
            'bg-slate-100/40 dark:bg-slate-900/35',
          )}
          aria-hidden
        >
          <div
            className={cn(
              'absolute top-1/2 z-1 w-[2.85rem] sm:w-12',
              'motion-safe:animate-running-teacher-walk',
              'motion-reduce:animate-none motion-reduce:left-1/2 motion-reduce:-translate-x-1/2 motion-reduce:-translate-y-1/2',
            )}
          >
            <div
              className="pointer-events-none absolute inset-[-18%] rounded-[40%] bg-linear-to-br from-sky-400/28 via-teal-400/18 to-indigo-400/22 blur-2xl motion-safe:animate-running-teacher-halo motion-reduce:animate-none dark:from-sky-500/22 dark:via-teal-500/12 dark:to-indigo-500/18"
              aria-hidden
            />
            <svg
              className="relative z-1 h-auto w-full drop-shadow-[0_8px_18px_rgba(14,116,144,0.14)] dark:drop-shadow-[0_10px_22px_rgba(0,0,0,0.35)]"
              viewBox="0 0 240 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
          <defs>
            <linearGradient id="plb-skin" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fcd9c4" />
              <stop offset="100%" stopColor="#e8b196" />
            </linearGradient>
            <linearGradient id="plb-shirt" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="55%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="plb-pant" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>
            <linearGradient id="plb-shoe" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="plb-tie" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
            <linearGradient id="plb-book" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>
            <filter id="plb-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b" />
              <feOffset dx="1" dy="2" in="b" result="o" />
              <feMerge>
                <feMergeNode in="o" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g>
          {/* Hız çizgileri */}
          <g className="motion-safe:animate-running-teacher-streak motion-reduce:opacity-50" opacity={0.55}>
            <path d="M28 88h-18M22 108h-26M34 128h-20M26 148h-30" stroke="currentColor" strokeWidth={3} strokeLinecap="round" className="text-sky-400/70 dark:text-sky-300/50" />
          </g>

          <g className="motion-safe:animate-running-teacher-bob motion-reduce:animate-none">
            <ellipse cx={122} cy={258} rx={52} ry={11} fill="currentColor" className="text-slate-900/12 dark:text-black/40" />

            {/* Arka bacak */}
            <g transform="translate(128 172)">
              <g className="motion-safe:animate-running-teacher-thigh-r motion-reduce:animate-none">
                <path
                  d="M0 0c-4 22-10 44-6 68"
                  stroke="url(#plb-pant)"
                  strokeWidth={17}
                  strokeLinecap="round"
                  filter="url(#plb-soft)"
                />
                <ellipse cx={-8} cy={76} rx={14} ry={8} fill="url(#plb-shoe)" transform="rotate(-12 -8 76)" />
              </g>
            </g>

            {/* Ön bacak */}
            <g transform="translate(108 172)">
              <g className="motion-safe:animate-running-teacher-thigh-l motion-reduce:animate-none">
                <path
                  d="M0 0c2 24 12 46 28 66"
                  stroke="url(#plb-pant)"
                  strokeWidth={17}
                  strokeLinecap="round"
                  filter="url(#plb-soft)"
                />
                <ellipse cx={32} cy={72} rx={14} ry={8} fill="url(#plb-shoe)" transform="rotate(8 32 72)" />
              </g>
            </g>

            {/* Gövde */}
            <path
              d="M88 168c-4-38 8-72 32-88 18-10 40-8 56 4 20 16 28 48 24 84-28 8-56 10-84 4-10-2-22-2-28-4z"
              fill="url(#plb-shirt)"
              filter="url(#plb-soft)"
            />
            <path d="M118 92l-6 52 18 4 4-50z" fill="url(#plb-tie)" />

            {/* Arka kol */}
            <g transform="translate(94 118)">
              <g className="motion-safe:animate-running-teacher-arm-r motion-reduce:animate-none">
                <path
                  d="M0 0c-18 14-32 36-38 58"
                  stroke="url(#plb-shirt)"
                  strokeWidth={14}
                  strokeLinecap="round"
                />
                <circle cx={-36} cy={62} r={9} fill="url(#plb-skin)" />
              </g>
            </g>

            {/* Boyun + kafa */}
            <rect x={108} y={86} width={24} height={18} rx={6} fill="url(#plb-skin)" />
            <circle cx={120} cy={64} r={26} fill="url(#plb-skin)" filter="url(#plb-soft)" />
            <path d="M98 52c8-16 28-22 44-14" stroke="#c2410c" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.35} />
            <ellipse cx={108} cy={62} rx={4} ry={5} fill="#1e293b" opacity={0.65} />
            <ellipse cx={128} cy={60} rx={4} ry={5} fill="#1e293b" opacity={0.65} />
            <path d="M112 76q8 6 16 0" stroke="#b45309" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.5} />

            {/* Ön kol + kitap */}
            <g transform="translate(138 122)">
              <g className="motion-safe:animate-running-teacher-arm-l motion-reduce:animate-none">
                <path
                  d="M0 0c16 10 28 28 34 50"
                  stroke="url(#plb-shirt)"
                  strokeWidth={14}
                  strokeLinecap="round"
                />
                <g transform="translate(28 48) rotate(8)">
                  <rect x={0} y={-14} width={22} height={30} rx={3} fill="url(#plb-book)" stroke="#ca8a04" strokeWidth={1.5} />
                  <line x1={6} y1={-6} x2={18} y2={-6} stroke="#a16207" strokeWidth={1} opacity={0.6} />
                  <line x1={6} y1={2} x2={18} y2={2} stroke="#a16207" strokeWidth={1} opacity={0.6} />
                </g>
                <circle cx={32} cy={54} r={9} fill="url(#plb-skin)" />
              </g>
            </g>
          </g>
          </g>
            </svg>
          </div>
        </div>
      </div>

      <div className="w-full max-w-md px-1 sm:max-w-lg">
        <div
          className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80"
          aria-hidden
        >
          <div className="absolute inset-y-0 left-0 w-[34%] rounded-full bg-linear-to-r from-sky-500 via-teal-500 to-emerald-500 motion-safe:animate-page-load-bar motion-reduce:animate-none dark:from-sky-400 dark:via-teal-400 dark:to-emerald-400" />
        </div>
        <div className="mt-2 flex justify-center gap-2.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 rounded-full bg-sky-500/80 motion-safe:animate-running-load-dot motion-reduce:animate-none dark:bg-sky-400/90 sm:size-2.5"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
