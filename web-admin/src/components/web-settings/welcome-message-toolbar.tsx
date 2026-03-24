'use client';

import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { Bold, Italic, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EMOJIS = [
  '✨',
  '🌟',
  '💪',
  '📚',
  '☀️',
  '🌷',
  '🎯',
  '❤️',
  '👏',
  '🙌',
  '✅',
  '☕',
  '🎉',
  '📅',
  '💡',
  '🌈',
  '🍀',
  '✍️',
  '📖',
  '🎓',
  '💜',
  '🔥',
  '😊',
  '🙂',
  '🇹🇷',
];

type Props = {
  value: string;
  onChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  disabled?: boolean;
};

export function WelcomeMessageToolbar({ value, onChange, textareaRef, disabled }: Props) {
  const [emojiOpen, setEmojiOpen] = useState(false);

  const applyWrap = useCallback(
    (before: string, after: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const sel = value.slice(start, end);
      const next = value.slice(0, start) + before + sel + after + value.slice(end);
      onChange(next);
      const pos = start + before.length + sel.length + after.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [value, onChange, textareaRef],
  );

  const insertEmoji = useCallback(
    (ch: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const next = value.slice(0, start) + ch + value.slice(end);
      onChange(next);
      const pos = start + ch.length;
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      });
      setEmojiOpen(false);
    },
    [value, onChange, textareaRef],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-muted/30 px-2 py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Biçim</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        disabled={disabled}
        onClick={() => applyWrap('**', '**')}
        title="Kalın **metin**"
      >
        <Bold className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        disabled={disabled}
        onClick={() => applyWrap('_', '_')}
        title="İtalik _metin_"
      >
        <Italic className="size-3.5" />
      </Button>
      <div className="relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          disabled={disabled}
          onClick={() => setEmojiOpen((o) => !o)}
          title="Emoji"
        >
          <Smile className="size-3.5" />
        </Button>
        {emojiOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default"
              aria-label="Kapat"
              onClick={() => setEmojiOpen(false)}
            />
            <div className="absolute left-0 top-full z-50 mt-1 grid max-h-48 w-[220px] grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-lg">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex size-8 items-center justify-center rounded-lg text-lg hover:bg-muted"
                  onClick={() => insertEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
