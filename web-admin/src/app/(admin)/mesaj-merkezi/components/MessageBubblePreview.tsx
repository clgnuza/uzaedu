'use client';

import { cn } from '@/lib/utils';
import { FileText, MessageSquare } from 'lucide-react';

export type BubbleChannel = 'whatsapp' | 'sms';

interface Props {
  text: string;
  channel?: BubbleChannel;
  attachmentLabel?: string | null;
  className?: string;
  compact?: boolean;
}

export default function MessageBubblePreview({
  text,
  channel = 'whatsapp',
  attachmentLabel,
  className,
  compact,
}: Props) {
  const isSms = channel === 'sms';
  const time = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[320px] rounded-2xl p-3 sm:max-w-[340px]',
        isSms
          ? 'bg-gradient-to-b from-sky-50 to-slate-100 dark:from-sky-950/40 dark:to-zinc-900'
          : 'bg-[#efeae2] dark:bg-[#0b141a]',
        className,
      )}
    >
      <div
        className={cn(
          'mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide',
          isSms ? 'text-sky-700 dark:text-sky-300' : 'text-emerald-800/80 dark:text-emerald-400/90',
        )}
      >
        {isSms ? <MessageSquare className="size-3" /> : null}
        {isSms ? 'SMS önizleme' : 'WhatsApp önizleme'}
      </div>
      <div className="relative">
        <div
          className={cn(
            'relative rounded-2xl rounded-tl-sm shadow-sm whitespace-pre-line border',
            compact ? 'px-3 py-2 text-[11px] leading-[1.55]' : 'px-3.5 py-2.5 text-[12px] leading-[1.65]',
            isSms
              ? 'bg-white text-slate-800 border-sky-100 dark:bg-zinc-800 dark:text-slate-100 dark:border-sky-900/40'
              : 'bg-[#d9fdd3] text-slate-800 border-green-100/80 dark:bg-[#005c4b] dark:text-[#e9edef] dark:border-emerald-900/30',
          )}
        >
          {text || <span className="text-muted-foreground italic">Mesaj metni…</span>}
        </div>
        {!isSms ? (
          <div
            className="absolute -left-1 top-0 size-0 border-t-[9px] border-t-[#d9fdd3] dark:border-t-[#005c4b] border-r-[7px] border-r-transparent"
            aria-hidden
          />
        ) : null}
      </div>
      {attachmentLabel ? (
        <div
          className={cn(
            'mt-2 flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-medium',
            isSms
              ? 'border-sky-200 bg-white/90 text-sky-900 dark:border-sky-800 dark:bg-zinc-800/80 dark:text-sky-100'
              : 'border-emerald-200/60 bg-white/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-zinc-800/60 dark:text-emerald-100',
          )}
        >
          <FileText className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{attachmentLabel}</span>
        </div>
      ) : null}
      <p className="mt-1.5 text-right text-[9px] text-muted-foreground tabular-nums">
        {time}
        {!isSms ? ' ✓✓' : ''}
      </p>
    </div>
  );
}
