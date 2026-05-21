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
import { Camera, Plus, Trash2 } from 'lucide-react';

const MODES = [
  { value: 'CONTENT', label: 'İçerik' },
  { value: 'LANGUAGE', label: 'Dil' },
  { value: 'CONTENT_LANGUAGE', label: 'İçerik+Dil' },
  { value: 'MATH_FINAL', label: 'Mat. sonuç' },
  { value: 'MATH_STEPS', label: 'Mat. adım' },
];

export function OpenAnswerKeysEditor({
  questions,
  onChange,
  onSave,
  saving,
  onOcrKey,
  busy,
}: {
  questions: OpenQuestionDef[];
  onChange: (q: OpenQuestionDef[]) => void;
  onSave: () => void;
  saving: boolean;
  onOcrKey: (questionId: string) => void;
  busy: boolean;
}) {
  const add = () => {
    const n = questions.length + 1;
    onChange([
      ...questions,
      { id: `oq${n}`, title: `Açık soru ${n}`, max_score: 10, mode: 'CONTENT', key_text: '' },
    ]);
  };

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
        <strong className="text-cyan-800 dark:text-cyan-200">Açık uçlu</strong> için şık anahtarı yok; her soruya{' '}
        <strong>beklenen cevap / rubrik metni</strong> yazın. AI puanlama bu metne göre yapılır (Açık sekmesinde öğrenci
        cevabı taranır).
      </p>

      {questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Açık uçlu soru yok — ekleyin veya yalnızca MC kullanın.</p>
      ) : null}

      {questions.map((q, i) => (
        <div key={q.id} className="space-y-1.5 rounded-xl border bg-muted/20 p-2.5">
          <div className="flex gap-1.5">
            <Input
              className="h-8 flex-1 rounded-lg text-xs font-semibold"
              placeholder="Soru başlığı"
              value={q.title}
              onChange={(e) => {
                const next = [...questions];
                next[i] = { ...q, title: e.target.value };
                onChange(next);
              }}
            />
            <Input
              type="number"
              className="h-8 w-12 rounded-lg text-xs"
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
              <SelectTrigger className="h-8 w-[72px] rounded-lg text-[9px]">
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
          <textarea
            className="min-h-[64px] w-full rounded-lg border bg-background px-2 py-1.5 text-[11px]"
            placeholder="Beklenen cevap, puanlama kriteri, örnek çözüm…"
            value={q.key_text ?? ''}
            onChange={(e) => {
              const next = [...questions];
              next[i] = { ...q, key_text: e.target.value };
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-full rounded-lg text-[10px]"
            disabled={busy}
            onClick={() => onOcrKey(q.id)}
          >
            <Camera className="mr-1 size-3" />
            Rubrik metnini OCR ile doldur
          </Button>
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={add}>
          <Plus className="mr-1 size-3.5" />
          Açık soru
        </Button>
        <Button type="button" size="sm" className="flex-1 rounded-xl" disabled={saving} onClick={onSave}>
          {saving ? 'Kaydediliyor…' : 'Açık uçlu tanımları kaydet'}
        </Button>
      </div>
    </div>
  );
}
