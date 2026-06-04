import { useId } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  size?: number;
};

/** PWA marka ikonu — scripts/brand/uzaedu-app-icon.svg ile aynı */
export function UzaeduAppIcon({ className, size = 64 }: Props) {
  const uid = useId().replace(/:/g, '');
  const bg = `bg-${uid}`;
  const shine = `shine-${uid}`;
  const mark = `mark-${uid}`;
  const glow = `glow-${uid}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn('shrink-0 drop-shadow-[0_8px_24px_rgba(13,148,136,0.35)]', className)}
      role="img"
      aria-label="Uzaedu"
    >
      <defs>
        <linearGradient id={bg} x1="8%" y1="4%" x2="92%" y2="96%">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="38%" stopColor="#0d9488" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>
        <radialGradient id={shine} cx="28%" cy="18%" r="55%">
          <stop offset="0%" stopColor="#99f6e4" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#0d9488" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={mark} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#a5f3fc" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" rx="132" fill={`url(#${bg})`} />
      <rect width="512" height="512" rx="132" fill={`url(#${shine})`} />
      <path
        d="M72 118 C72 72 108 48 156 48 H356 C404 48 440 72 440 118 V148 C440 248 368 312 256 328 C144 312 72 248 72 148 Z"
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.1}
        strokeWidth={3}
      />
      <path
        fill={`url(#${mark})`}
        d="M178 156 C178 132 198 116 224 116 H288 C314 116 334 132 334 156 V188 C334 252 298 288 256 296 C214 288 178 252 178 188 Z M224 152 H288 V188 C288 228 264 252 256 252 C248 252 224 228 224 188 Z"
      />
      <circle cx="388" cy="124" r="40" fill="#fb7185" filter={`url(#${glow})`} />
      <circle cx="388" cy="124" r="24" fill="#fecdd3" opacity={0.75} />
    </svg>
  );
}
