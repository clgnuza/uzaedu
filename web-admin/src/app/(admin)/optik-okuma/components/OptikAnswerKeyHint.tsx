'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, FileKey2 } from 'lucide-react';

export function OptikAnswerKeyHint({
  hasMcAnswers,
  answerCount,
}: {
  hasMcAnswers: boolean;
  answerCount: number;
}) {
  const sp = useSearchParams();
  const sessionId = sp.get('session_id');

  if (!hasMcAnswers || answerCount === 0) return null;

  const href = sessionId
    ? `/optik-oturumlar/${sessionId}?tab=key`
    : '/optik-oturumlar';

  return (
    <Link
      href={href}
      title={`${answerCount} şık → oturum anahtarına aktar`}
      className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/8 px-2.5 py-2 text-[11px] font-medium text-violet-800 hover:bg-violet-500/12 dark:text-violet-200"
    >
      <FileKey2 className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {answerCount} şık → anahtar
      </span>
      <ArrowRight className="size-3.5 shrink-0 opacity-70" />
    </Link>
  );
}
