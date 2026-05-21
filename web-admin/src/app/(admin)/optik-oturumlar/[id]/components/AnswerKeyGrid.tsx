'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const CHOICES = ['A', 'B', 'C', 'D', 'E', 'F'];

export function AnswerKeyGrid({
  questionCount,
  choiceCount,
  answerKey,
  onSet,
  onSave,
  saving,
}: {
  questionCount: number;
  choiceCount: number;
  answerKey: Record<string, string>;
  onSet: (q: number, label: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const labels = CHOICES.slice(0, Math.min(6, Math.max(4, choiceCount)));

  return (
    <div className="space-y-3">
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold">Soru</th>
              {labels.map((l) => (
                <th key={l} className="w-8 px-0.5 py-1.5 text-center font-semibold">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: questionCount }, (_, i) => i + 1).map((q) => {
              const cur = answerKey[String(q)] ?? '';
              return (
                <tr key={q} className="border-t border-border/50">
                  <td className="px-2 py-1 font-medium text-muted-foreground">{q}</td>
                  {labels.map((l) => (
                    <td key={l} className="p-0.5 text-center">
                      <button
                        type="button"
                        className={cn(
                          'size-7 rounded-lg text-[10px] font-bold transition-colors',
                          cur === l
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-muted/60 hover:bg-violet-500/20',
                        )}
                        onClick={() => onSet(q, cur === l ? '' : l)}
                      >
                        {l}
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button className="h-11 w-full rounded-xl" disabled={saving} onClick={onSave}>
        {saving ? 'Kaydediliyor…' : 'Anahtarı kaydet'}
      </Button>
    </div>
  );
}
