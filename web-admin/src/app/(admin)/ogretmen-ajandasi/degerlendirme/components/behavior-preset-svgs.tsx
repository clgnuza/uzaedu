'use client';

import { cn } from '@/lib/utils';

type SvgProps = { className?: string };

export function IconPuzzleHarmony({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M14 8h10v6a3 3 0 006 0V8h8v10h-6a3 3 0 000 6h6v10h-8v-6a3 3 0 00-6 0v6H8V28h6a3 3 0 000-6H8V8h6z" fill="#FCD34D" stroke="#D97706" strokeWidth="1.2" />
      <circle cx="36" cy="12" r="3" fill="#FDE68A" opacity="0.9" />
    </svg>
  );
}

export function IconHeartHelp({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 40C24 40 8 28 8 18a8 8 0 0116 0 8 8 0 0116 0c0 10-16 22-16 22z"
        fill="#FB7185"
        stroke="#BE123C"
        strokeWidth="1.2"
      />
      <path d="M20 18h8M24 14v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconTeamwork({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="16" cy="14" r="5" fill="#60A5FA" stroke="#1D4ED8" strokeWidth="1" />
      <path d="M10 34c0-4 2.5-7 6-7s6 3 6 7v2H10v-2z" fill="#3B82F6" />
      <circle cx="32" cy="14" r="5" fill="#FBBF24" stroke="#B45309" strokeWidth="1" />
      <path d="M26 34c0-4 2.5-7 6-7s6 3 6 7v2H26v-2z" fill="#F59E0B" />
      <circle cx="24" cy="11" r="4" fill="#34D399" stroke="#047857" strokeWidth="1" />
      <path d="M20 30c0-3 1.8-5.5 4-5.5s4 2.5 4 5.5v2h-8v-2z" fill="#10B981" />
    </svg>
  );
}

export function IconThumbsTask({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M12 22h6v16H12V22zm8-2l10-6 2 8-4 2v14H20V20z"
        fill="#86EFAC"
        stroke="#15803D"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M30 12l8 4-2 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMountainDetermination({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 38L20 14l8 12 6-8 6 20H8z" fill="#94A3B8" stroke="#475569" strokeWidth="1" />
      <path d="M14 38L24 22l6 8 8-12v20H14z" fill="#CBD5E1" />
      <path d="M28 10l-4 8h8l-4-8z" fill="#EF4444" stroke="#991B1B" strokeWidth="0.8" />
      <rect x="26" y="8" width="2" height="6" rx="0.5" fill="#7F1D1D" />
    </svg>
  );
}

export function IconLightbulbParticipation({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 8c-6 0-10 4.5-10 10 0 4 2 7 4 9v4h12v-4c2-2 4-5 4-9 0-5.5-4-10-10-10z"
        fill="#FDE047"
        stroke="#CA8A04"
        strokeWidth="1.2"
      />
      <path d="M18 34h12v2a4 4 0 01-4 4h-4a4 4 0 01-4-4v-2z" fill="#EAB308" />
      <path d="M22 14L24 18l4-6" stroke="#FEF08A" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconMedalHardWork({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M14 8l4 10h12l4-10" stroke="#A855F7" strokeWidth="2" fill="none" />
      <path d="M18 18h12v4l-6 14-6-14v-4z" fill="#C084FC" stroke="#7E22CE" strokeWidth="1" />
      <circle cx="24" cy="16" r="7" fill="#FACC15" stroke="#CA8A04" strokeWidth="1" />
      <path d="M24 12l.8 2.2h2.3l-1.8 1.4.7 2.3L24 17l-2 1.4.7-2.3-1.8-1.4h2.3L24 12z" fill="#B45309" />
    </svg>
  );
}

export function IconShieldRules({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 6L10 12v10c0 8 6 15 14 18 8-3 14-10 14-18V12L24 6z" fill="#67E8F9" stroke="#0E7490" strokeWidth="1.2" />
      <path d="M18 24l4 4 8-10" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function IconHeadphonesListen({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M12 22v10a4 4 0 004 4h2M36 22v10a4 4 0 01-4 4h-2"
        stroke="#818CF8"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path d="M12 22c0-6.6 5.4-12 12-12s12 5.4 12 12" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <rect x="8" y="22" width="8" height="14" rx="3" fill="#A5B4FC" stroke="#4338CA" strokeWidth="1" />
      <rect x="32" y="22" width="8" height="14" rx="3" fill="#A5B4FC" stroke="#4338CA" strokeWidth="1" />
    </svg>
  );
}

export function IconClipboardHomework({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="14" y="10" width="20" height="28" rx="2" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.2" />
      <path d="M18 16h12M18 22h12M18 28h8" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="20" y="6" width="8" height="6" rx="1" fill="#38BDF8" stroke="#0369A1" strokeWidth="0.8" />
    </svg>
  );
}

export function IconSmileRespect({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="14" fill="#FEF9C3" stroke="#EAB308" strokeWidth="1.2" />
      <circle cx="18" cy="22" r="2" fill="#422006" />
      <circle cx="30" cy="22" r="2" fill="#422006" />
      <path d="M18 30c2 3 10 3 12 0" stroke="#422006" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IconMessageShare({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 12h24v18H16l-6 6v-6H8V12z" fill="#E9D5FF" stroke="#9333EA" strokeWidth="1.2" />
      <circle cx="16" cy="21" r="2" fill="#7C3AED" />
      <circle cx="22" cy="21" r="2" fill="#7C3AED" />
      <circle cx="28" cy="21" r="2" fill="#7C3AED" />
    </svg>
  );
}

export function IconBookCare({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M10 10h12v28H10c-2 0-4-2-4-4V14c0-2 2-4 4-4z" fill="#FCA5A5" stroke="#B91C1C" strokeWidth="1" />
      <path d="M26 10h12c2 0 4 2 4 4v20c0 2-2 4-4 4H26V10z" fill="#FEE2E2" stroke="#B91C1C" strokeWidth="1" />
      <path d="M22 10v28" stroke="#991B1B" strokeWidth="1" />
    </svg>
  );
}

export function IconSparklePositive({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M24 6l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z" fill="#F472B6" stroke="#DB2777" strokeWidth="0.8" />
      <circle cx="36" cy="10" r="2" fill="#FBBF24" />
      <circle cx="10" cy="30" r="2" fill="#34D399" />
    </svg>
  );
}

/* —— Geliştirmesi gerek —— */

export function IconNoiseDisrupt({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M10 20h6l4-6 4 20 4-14h10" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="38" cy="14" r="4" fill="#FECACA" stroke="#DC2626" strokeWidth="1" />
      <path d="M36 12l4 4M40 12l-4 4" stroke="#991B1B" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconOffTask({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <ellipse cx="24" cy="28" rx="12" ry="6" fill="#E2E8F0" />
      <circle cx="24" cy="18" r="10" fill="#FDE68A" stroke="#CA8A04" strokeWidth="1" />
      <path d="M17 18h4M27 18h4M16 22h16" stroke="#A16207" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20 14c1.5 2 6.5 2 8 0" stroke="#A16207" strokeWidth="1" fill="none" />
    </svg>
  );
}

export function IconDisrespect({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="14" fill="#FECDD3" stroke="#E11D48" strokeWidth="1.2" />
      <path d="M18 20l4 4M22 20l-4 4M26 20l4 4M30 20l-4 4" stroke="#9F1239" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 32h12" stroke="#9F1239" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconNoHomework({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="12" y="10" width="20" height="26" rx="2" fill="#F1F5F9" stroke="#64748B" strokeWidth="1.2" />
      <path d="M16 18h12M16 24h8" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="32" cy="28" r="8" fill="#FCA5A5" stroke="#DC2626" strokeWidth="1" />
      <path d="M28 28l8 8M36 28l-8 8" stroke="#7F1D1D" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconLateUnprepared({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="26" r="12" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.5" />
      <path d="M24 18v9l6 3" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 10l6 6M40 10l-6 6" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconBotherPeer({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="16" cy="20" r="6" fill="#93C5FD" stroke="#1D4ED8" strokeWidth="1" />
      <circle cx="32" cy="20" r="6" fill="#FCA5A5" stroke="#B91C1C" strokeWidth="1" />
      <path d="M20 20h8M26 16l4 8" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconDefiantRules({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="10" y="14" width="28" height="20" rx="2" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1.2" />
      <path d="M14 22h20M14 28h14" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="10" r="5" fill="#FEF08A" stroke="#CA8A04" strokeWidth="1" />
      <path d="M32 10h4" stroke="#854D0E" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconPhoneDistraction({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="16" y="8" width="16" height="28" rx="3" fill="#1E293B" stroke="#0F172A" strokeWidth="1" />
      <rect x="19" y="12" width="10" height="16" rx="1" fill="#38BDF8" />
      <circle cx="24" cy="32" r="2" fill="#64748B" />
      <path d="M36 6l-8 8" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconMessySpace({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <rect x="8" y="28" width="32" height="8" rx="1" fill="#D6D3D1" />
      <rect x="10" y="22" width="8" height="6" rx="1" fill="#A8A29E" transform="rotate(-12 14 25)" />
      <rect x="22" y="20" width="10" height="5" rx="1" fill="#78716C" transform="rotate(8 27 22)" />
      <rect x="30" y="24" width="7" height="5" rx="1" fill="#57534E" transform="rotate(-20 33 26)" />
    </svg>
  );
}

export function IconRoughPlay({ className }: SvgProps) {
  return (
    <svg className={cn('size-9', className)} viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M12 34c4-8 8-12 12-12s8 4 12 12" stroke="#EA580C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="18" cy="14" r="5" fill="#FB923C" stroke="#C2410C" strokeWidth="1" />
      <circle cx="30" cy="12" r="5" fill="#FDBA74" stroke="#C2410C" strokeWidth="1" />
      <path d="M20 18l8 4" stroke="#9A3412" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
