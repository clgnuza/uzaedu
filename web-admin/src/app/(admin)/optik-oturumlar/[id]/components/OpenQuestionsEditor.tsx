'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OpenQuestionDef } from '@/lib/optik-sessions-api';
import { Plus, Trash2 } from 'lucide-react';

const MODES = [
  { value: 'CONTENT', label: 'İçerik' },
  { value: 'LANGUAGE', label: 'Dil' },
  { value: 'CONTENT_LANGUAGE', label: 'İçerik+Dil' },
  { value: 'MATH_FINAL', label: 'Mat. sonuç' },
  { value: 'MATH_STEPS', label: 'Mat. adım' },
];

export function OpenQuestionsEditor({
  questions,
  onChange,
  onSave,
  saving,
}: {
  questions: OpenQuestionDef[];
  onChange: (q: OpenQuestionDef[]) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const add = () => {
    const n = questions.length + 1;
    onChange([
      ...questions,
      { id: `oq${n}`, title: `Soru ${n}`, max_score: 10, mode: 'CONTENT' },
    ]);
  };

  return (
    <div className="space-y-2">
      {questions.map((q, i) => (
        <div key={q.id} className="flex gap-1.5 rounded-xl border bg-muted/30 p-2">
          <Input
            className="h-8 flex-1 rounded-lg text-xs"
            value={q.title}
            onChange={(e) => {
              const next = [...questions];
              next[i] = { ...q, title: e.target.value };
              onChange(next);
            }}
          />
          <Input
            type="number"
            className="h-8 w-14 rounded-lg text-xs"
            min={1}
            max={100}
            value={q.max_score}
            onChange={(e) => {
              const next = [...questions];
              next[i] = { ...q, max_score: Number(e.target.value) || 10 };
              onChange(next);
            }}
          />
          <Select
            value={q.mode ?? 'CONTENT'}
            onValueChange={(v) => {
              const next = [...questions];
              next[i] = { ...q, mode: v };
              onChange(next);
            }}
          >
            <SelectTrigger className="h-8 w-[88px] rounded-lg text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={() => onChange(questions.filter((_, j) => j !== i))}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={add}>
          <Plus className="mr-1 size-3.5" />
          Soru ekle
        </Button>
        <Button type="button" size="sm" className="flex-1 rounded-xl" disabled={saving} onClick={onSave}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
      </div>
    </div>
  );
}
