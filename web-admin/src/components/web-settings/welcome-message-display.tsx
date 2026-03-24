'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Basit biçim: `**kalın**` ve `_italik_` (çift yıldız ve alt çizgi çifti).
 * Yeni satır korunur.
 */
export function WelcomeMessageDisplay({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div
      className={cn(
        'min-w-0 max-w-full whitespace-pre-wrap break-words text-foreground',
        // Kalın / italik, üstteki font-medium ile aynı görünmesin
        '[&_strong]:font-bold [&_strong]:text-inherit',
        '[&_em]:italic',
        // Emoji renkli fontlara düşsün (Inter tek ailede boğabiliyor)
        "font-[ui-sans-serif,system-ui,sans-serif,'Segoe_UI_Emoji','Segoe_UI_Symbol','Apple_Color_Emoji','Noto_Color_Emoji']",
        className,
      )}
    >
      {lines.map((line, li) => (
        <p key={li} className={li > 0 ? 'mt-1' : undefined}>
          {parseLine(line)}
        </p>
      ))}
    </div>
  );
}

function parseItalicsInText(s: string): ReactNode {
  const parts: React.ReactNode[] = [];
  let rest = s;
  let k = 0;
  while (rest.length) {
    const a = rest.indexOf('_');
    if (a === -1) {
      parts.push(rest);
      break;
    }
    if (a > 0) parts.push(rest.slice(0, a));
    const b = rest.indexOf('_', a + 1);
    if (b === -1) {
      parts.push(rest.slice(a));
      break;
    }
    parts.push(<em key={k++}>{rest.slice(a + 1, b)}</em>);
    rest = rest.slice(b + 1);
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function parseLine(line: string): ReactNode {
  const boldChunks = line.split(/\*\*/);
  return boldChunks.map((chunk, i) => {
    const inner = parseItalicsInText(chunk);
    return i % 2 === 1 ? (
      <strong key={`b-${i}`}>
        {inner}
      </strong>
    ) : (
      <span key={`b-${i}`}>{inner}</span>
    );
  });
}
