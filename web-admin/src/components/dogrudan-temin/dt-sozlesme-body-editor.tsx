'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Heading2, Italic, List, ListOrdered, Pilcrow, Redo2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DtSozlesmeBodyEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
};

export function DtSozlesmeBodyEditor({ value, onChange, disabled, className }: DtSozlesmeBodyEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder:
          'Paragraflar halinde yazın. Araç çubuğundan kalın, italik, başlık ve liste ekleyebilirsiniz.',
      }),
    ],
    content: value?.trim() ? value : '<p></p>',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          'max-w-none px-3 py-2 text-[13px] leading-relaxed text-foreground focus:outline-none',
          '[&_p]:my-2 [&_p:first-child]:mt-0',
          '[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-bold',
          '[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-[14px] [&_h3]:font-semibold',
          '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
          '[&_li]:my-0.5',
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const cur = editor.getHTML();
    if (cur === value) return;
    editor.commands.setContent(value?.trim() ? value : '<p></p>', { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className={cn('min-h-[200px] animate-pulse rounded-lg border border-border bg-muted/20', className)} />;
  }

  const tb = (pressed: boolean) => (pressed ? 'bg-muted' : '');

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/80 bg-muted/25 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', tb(editor.isActive('bold')))}
          disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Kalın"
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', tb(editor.isActive('italic')))}
          disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="İtalik"
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', tb(editor.isActive('heading', { level: 2 })))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          aria-label="Başlık 2"
        >
          <Heading2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', tb(editor.isActive('bulletList')))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Madde işaretli liste"
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8 w-8 p-0', tb(editor.isActive('orderedList')))}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numaralı liste"
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={disabled}
          onClick={() => editor.chain().focus().setParagraph().run()}
          aria-label="Paragraf"
        >
          <Pilcrow className="size-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
          aria-label="Geri al"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
          aria-label="Yinele"
        >
          <Redo2 className="size-4" />
        </Button>
      </div>
      <div className="min-h-[min(52vh,380px)] flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <details className="shrink-0 border-t border-border/80 bg-muted/10 text-xs">
        <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-muted-foreground hover:bg-muted/40">
          Ham HTML (isteğe bağlı)
        </summary>
        <div className="border-t border-border/60 p-2">
          <textarea
            className={cn(
              'min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] leading-snug',
            )}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            disabled={disabled}
            spellCheck={false}
            aria-label="Ham HTML"
          />
        </div>
      </details>
    </div>
  );
}
