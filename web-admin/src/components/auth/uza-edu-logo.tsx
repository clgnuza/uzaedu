/**
 * UzaEdu brand logo — inline SVG.
 * Matches the pixel-block "U" icon style with "Uza" + "Edu" wordmark.
 */
export function UzaEduLogo({ className }: { className?: string }) {
  // Each block: 7×7, pitch=9 (gap=2)
  // U shape: cols 0-1 full height (rows 0-4), col 2 bottom only (rows 3-4), cols 3-4 full height
  // Colors graduate dark-indigo (left) → blue (right)
  const blocks: Array<{ x: number; y: number; fill: string }> = [
    // ── Col 0 (x=0) – deepest indigo ──
    { x: 0, y: 0, fill: '#312E81' },
    { x: 0, y: 9, fill: '#3730A3' },
    { x: 0, y: 18, fill: '#3730A3' },
    { x: 0, y: 27, fill: '#4338CA' },
    { x: 0, y: 36, fill: '#4338CA' },

    // ── Col 1 (x=9) – medium indigo ──
    { x: 9, y: 0, fill: '#3730A3' },
    { x: 9, y: 9, fill: '#4338CA' },
    { x: 9, y: 18, fill: '#4338CA' },
    { x: 9, y: 27, fill: '#4F46E5' },
    { x: 9, y: 36, fill: '#4F46E5' },

    // ── Col 2 (x=18) – bottom 2 only, indigo→blue bridge ──
    { x: 18, y: 27, fill: '#5B4CF5' },
    { x: 18, y: 36, fill: '#6366F1' },

    // ── Col 3 (x=27) – blue ──
    { x: 27, y: 0, fill: '#1D4ED8' },
    { x: 27, y: 9, fill: '#2563EB' },
    { x: 27, y: 18, fill: '#2563EB' },
    { x: 27, y: 27, fill: '#3B82F6' },
    { x: 27, y: 36, fill: '#3B82F6' },

    // ── Col 4 (x=36) – lighter blue ──
    { x: 36, y: 0, fill: '#2563EB' },
    { x: 36, y: 9, fill: '#3B82F6' },
    { x: 36, y: 18, fill: '#3B82F6' },
    { x: 36, y: 27, fill: '#60A5FA' },
    { x: 36, y: 36, fill: '#60A5FA' },
  ];

  return (
    <svg
      viewBox="0 0 152 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="UzaEdu logo"
    >
      {/* ── Pixel-block U icon ── */}
      <g>
        {blocks.map(({ x, y, fill }, i) => (
          <g key={i}>
            {/* block body */}
            <rect x={x} y={y} width={7} height={7} rx={1.4} fill={fill} />
            {/* top-left shine for subtle 3-D depth */}
            <rect
              x={x + 1}
              y={y + 1}
              width={3.5}
              height={1.5}
              rx={0.4}
              fill="white"
              fillOpacity={0.28}
            />
          </g>
        ))}
      </g>

      {/* ── Wordmark ── */}
      {/* "Uza" – dark slate */}
      <text
        x={52}
        y={32}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize={26}
        fontWeight={700}
        fill="#0f172a"
        letterSpacing={-0.5}
      >
        Uza
      </text>
      {/* "Edu" – brand blue */}
      <text
        x={103}
        y={32}
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize={26}
        fontWeight={700}
        fill="#2563EB"
        letterSpacing={-0.5}
      >
        Edu
      </text>
    </svg>
  );
}
