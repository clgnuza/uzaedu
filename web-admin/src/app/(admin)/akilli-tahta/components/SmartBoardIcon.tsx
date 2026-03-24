'use client';

/** Akıllı tahta cihazını temsil eden SVG ikon */
export function SmartBoardIcon({
  className,
  isOnline,
  size = 48,
}: {
  className?: string;
  isOnline?: boolean;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Ekran / tahta gövdesi */}
      <rect
        x="4"
        y="6"
        width="40"
        height="26"
        rx="2"
        fill={isOnline ? 'currentColor' : 'currentColor'}
        opacity={isOnline ? 0.9 : 0.4}
      />
      {/* Ekran içi - parlama */}
      <rect
        x="8"
        y="10"
        width="32"
        height="18"
        rx="1"
        fill="white"
        opacity={isOnline ? 0.15 : 0.08}
      />
      {/* Dokunmatik / ekran parıltısı */}
      <rect
        x="18"
        y="14"
        width="12"
        height="8"
        rx="1"
        fill="currentColor"
        opacity={isOnline ? 0.12 : 0.06}
      />
      {/* Alt çerçeve / stand */}
      <rect x="18" y="32" width="12" height="3" rx="0.5" fill="currentColor" opacity={isOnline ? 0.8 : 0.5} />
      <rect x="20" y="35" width="8" height="4" fill="currentColor" opacity={isOnline ? 0.6 : 0.35} />
      {/* Çevrimiçi göstergesi - yeşil nokta */}
      {isOnline && (
        <circle cx="38" cy="10" r="3" fill="#22c55e" stroke="white" strokeWidth="1" />
      )}
    </svg>
  );
}
