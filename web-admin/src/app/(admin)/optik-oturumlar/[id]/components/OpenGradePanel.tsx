'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { OpenQuestionDef } from '@/lib/optik-sessions-api';
import { Camera, Sparkles } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function OpenGradePanel({
  questions,
  answers,
  onAnswer,
  manualScores,
  onManualScore,
  busy,
  ready,
  onOcrQuestion,
  onGradeAi,
  onSaveManual,
  onGoDefineKeys,
}: {
  questions: OpenQuestionDef[];
  answers: Record<string, string>;
  onAnswer: (questionId: string, text: string) => void;
  manualScores: Record<string, { score: number; max: number }>;
  onManualScore: (questionId: string, score: number, max: number) => void;
  busy: boolean;
  ready: boolean;
  onOcrQuestion: (questionId: string) => void;
  onGradeAi: () => void;
  onSaveManual: () => void;
  onGoDefineKeys: () => void;
}) {
  const [offlineManual, setOfflineManual] = useState(false);

  if (!questions.length) {
    return (
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>Bu oturumda açık uçlu soru tanımlı değil.</p>
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onGoDefineKeys}>
          Anahtar sekmesinde açık soru ekle
        </Button>
      </div>
    );
  }

  const keysReady = questions.every((q) => (q.key_text?.trim().length ?? 0) > 0);

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">
        Öğrenci cevaplarını tarayın veya yazın. Rubrik metinleri{' '}
        <button type="button" className="font-semibold text-primary underline" onClick={onGoDefineKeys}>
          Anahtar
        </button>{' '}
        sekmesinde tanımlıdır.
      </p>

      {!keysReady ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-900 dark:text-amber-100">
          Eksik rubrik: {questions.filter((q) => !q.key_text?.trim()).map((q) => q.title).join(', ')}
        </p>
      ) : null}

      <label className="flex items-center gap-2 text-[10px]">
        <input type="checkbox" checked={offlineManual} onChange={(e) => setOfflineManual(e.target.checked)} />
        Elle puan (AI yok)
      </label>

      {questions.map((q) => (
        <div key={q.id} className="rounded-xl border bg-card/80 p-2.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">{q.title}</span>
            <span className="text-[10px] text-muted-foreground">/{q.max_score}</span>
          </div>
          {q.key_text?.trim() ? (
            <p className="mb-1.5 line-clamp-2 rounded bg-muted/40 px-1.5 py-1 text-[9px] text-muted-foreground">
              Anahtar: {q.key_text.slice(0, 120)}
              {q.key_text.length > 120 ? '…' : ''}
            </p>
          ) : (
            <p className="mb-1 text-[9px] text-amber-700">Rubrik tanımlı değil</p>
          )}
          {offlineManual ? (
            <div className="flex gap-2">
              <Input
                type="number"
                className="h-8 rounded-lg text-xs"
                min={0}
                max={manualScores[q.id]?.max ?? q.max_score}
                value={manualScores[q.id]?.score ?? 0}
                onChange={(e) =>
                  onManualScore(q.id, Number(e.target.value) || 0, manualScores[q.id]?.max ?? q.max_score)
                }
              />
              <Input
                type="number"
                className="h-8 w-16 rounded-lg text-xs"
                min={1}
                value={manualScores[q.id]?.max ?? q.max_score}
                onChange={(e) =>
                  onManualScore(q.id, manualScores[q.id]?.score ?? 0, Number(e.target.value) || q.max_score)
                }
              />
            </div>
          ) : (
            <>
              <textarea
                className="mb-1.5 min-h-[56px] w-full rounded-lg border bg-background px-2 py-1.5 text-xs"
                value={answers[q.id] ?? ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onAnswer(q.id, e.target.value)}
                placeholder="Öğrenci cevabı…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full rounded-lg text-[10px]"
                disabled={busy}
                onClick={() => onOcrQuestion(q.id)}
              >
                <Camera className="mr-1 size-3" />
                Öğrenci cevabı OCR
              </Button>
            </>
          )}
        </div>
      ))}

      {offlineManual ? (
        <Button className="h-11 w-full rounded-xl" disabled={busy} onClick={onSaveManual}>
          Elle puanları kaydet
        </Button>
      ) : (
        <Button
          className="h-11 w-full gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500"
          disabled={!ready || busy || !keysReady}
          onClick={onGradeAi}
        >
          {busy ? <LoadingSpinner className="size-5" /> : <Sparkles className="size-5" />}
          Toplu AI puanla ({questions.length} soru)
        </Button>
      )}
    </div>
  );
}
