'use client';

import { cn } from '@/lib/utils';
import type { ExamSession } from '@/lib/optik-sessions-api';
import { sessionBadgeClass, sessionBadgeKind, sessionBadgeLabel } from '@/lib/optik-session-summary';

export function OptikSessionBadge({ session }: { session: ExamSession }) {
  const kind = sessionBadgeKind(session);
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
        sessionBadgeClass(kind),
      )}
    >
      {sessionBadgeLabel(kind)}
    </span>
  );
}
