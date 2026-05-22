'use client';

import { useState } from 'react';
import { applyWaTemplateSamples } from '@/lib/messaging-template-samples';
import MessageBubblePreview, { type BubbleChannel } from './MessageBubblePreview';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Smartphone } from 'lucide-react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  help?: string;
  attachmentLabel?: string | null;
  defaultChannel?: BubbleChannel;
  className?: string;
}

export default function TemplateEditorWithPreview({
  value,
  onChange,
  rows = 8,
  help,
  attachmentLabel,
  defaultChannel = 'whatsapp',
  className,
}: Props) {
  const [showMobile, setShowMobile] = useState(true);
  const [channel, setChannel] = useState<BubbleChannel>(defaultChannel);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-semibold text-muted-foreground">Mesaj şablonu</label>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-white/80 p-0.5 dark:bg-zinc-900/60">
            {(['whatsapp', 'sms'] as const).map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => setChannel(ch)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors',
                  channel === ch ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-zinc-800',
                )}
              >
                {ch === 'whatsapp' ? 'WA' : 'SMS'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowMobile((v) => !v)}
            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
          >
            {showMobile ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            {showMobile ? 'Önizlemeyi gizle' : 'Önizle'}
          </button>
        </div>
      </div>
      <div className={cn('grid gap-3', showMobile && 'lg:grid-cols-2')}>
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[140px] w-full resize-y rounded-xl border border-input bg-white px-3 py-2 font-mono text-xs leading-relaxed dark:bg-zinc-900 sm:text-sm"
        />
        {showMobile ? (
          <div className="flex flex-col items-center justify-start rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/30">
            <div className="mb-2 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Smartphone className="size-3" />
              Örnek alıcı görünümü
            </div>
            <MessageBubblePreview
              text={applyWaTemplateSamples(value)}
              channel={channel}
              attachmentLabel={attachmentLabel}
            />
          </div>
        ) : null}
      </div>
      {help ? <p className="text-[10px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}
