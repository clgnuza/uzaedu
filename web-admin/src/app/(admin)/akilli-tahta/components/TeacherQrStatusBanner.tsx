'use client';

import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function TeacherQrStatusBanner({
  status,
  message,
}: {
  status: 'pending' | 'error' | 'success';
  message: string;
}) {
  if (status === 'success') return null;

  return (
    <div
      className={cn(
        'mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
        status === 'error'
          ? 'border border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200'
          : 'border border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100',
      )}
    >
      {status === 'pending' ? <LoadingSpinner className="size-3.5 shrink-0" /> : null}
      <p className="min-w-0 flex-1 leading-snug">{message}</p>
    </div>
  );
}
