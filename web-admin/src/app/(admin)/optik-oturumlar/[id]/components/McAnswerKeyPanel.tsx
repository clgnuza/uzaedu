'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  formatAnswerKeyForPaste,
  parseAnswerKeyText,
} from '@/lib/optik-answer-key-parse';
import { AnswerKeyGrid } from './AnswerKeyGrid';
import { Camera, ClipboardPaste, FileKey2, ScanLine, Sparkles } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type KeyMode = 'grid' | 'paste' | 'omr' | 'ocr';

export function McAnswerKeyPanel({
  questionCount,
  choiceCount,
  answerKey,
  onSet,
  onApplyKey,
  onSave,
  saving,
  busy,
  ready,
  onScanOmr,
  onScanOcr,
  hideCameraModes,
}: {
  questionCount: number;
  choiceCount: number;
  answerKey: Record<string, string>;
  onSet: (q: number, label: string) => void;
  onApplyKey: (patch: Record<string, string>, replace?: boolean) => void;
  onSave: () => void;
  saving: boolean;
  busy: boolean;
  ready: boolean;
  onScanOmr: () => void;
  onScanOcr: () => void;
  /** Mobil native tarama — omr/ocr sekmeleri gizlenir */
  hideCameraModes?: boolean;
}) {
  const [mode, setMode] = useState<KeyMode>('grid');
  const [paste, setPaste] = useState(() => formatAnswerKeyForPaste(answerKey, questionCount));

  const filled = Object.keys(answerKey).filter((k) => answerKey[k]).length;

  const applyPaste = () => {
    const parsed = parseAnswerKeyText(paste, questionCount);
    if (Object.keys(parsed).length === 0) {
      return false;
    }
    onApplyKey(parsed, false);
    return true;
  };

  const modes: { id: KeyMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'grid', label: 'Elle', icon: FileKey2 },
    ...(hideCameraModes
      ? []
      : [
          { id: 'omr' as const, label: 'Optik tara', icon: ScanLine },
          { id: 'ocr' as const, label: 'Anahtar OCR', icon: Sparkles },
        ]),
    { id: 'paste', label: 'Yapıştır', icon: ClipboardPaste },
  ];

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-2.5 py-2 text-[10px] leading-relaxed text-muted-foreground">
        <strong className="text-violet-800 dark:text-violet-200">Çoktan seçmeli anahtar</strong> (A–F şıkları).
        Öğretmen optik formunu veya cevap anahtarı kağıdını tarayın; sonra grid ile düzeltin.
        Kayıt sonrası öğrenci formları otomatik netlenir.
      </p>

      <p className="text-center text-[10px] tabular-nums text-muted-foreground">
        {filled}/{questionCount} soru dolu
      </p>

      <div className="flex flex-wrap gap-1">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              type="button"
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                mode === m.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setMode(m.id)}
            >
              <Icon className="size-3.5" />
              {m.label}
            </button>
          );
        })}
      </div>

      {mode === 'grid' ? (
        <AnswerKeyGrid
          questionCount={questionCount}
          choiceCount={choiceCount}
          answerKey={answerKey}
          onSet={onSet}
          onSave={onSave}
          saving={saving}
        />
      ) : null}

      {mode === 'omr' ? (
        <div className="space-y-2 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-3">
          <p className="text-[10px] text-muted-foreground">
            Aynı şablonla doldurulmuş <strong>öğretmen cevap anahtarı</strong> veya örnek optik formu tarayın (3 kare).
            Okunan şıklar anahtara yazılır; yanlışları grid sekmesinden düzeltin.
          </p>
          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-xl bg-linear-to-r from-fuchsia-600 to-violet-600"
            disabled={!ready || busy}
            onClick={onScanOmr}
          >
            {busy ? <LoadingSpinner className="size-5" /> : <Camera className="size-5" />}
            Optik formdan anahtar oku
          </Button>
          <Button type="button" variant="outline" className="h-10 w-full rounded-xl" disabled={saving} onClick={onSave}>
            Okunan anahtarı kaydet
          </Button>
        </div>
      ) : null}

      {mode === 'paste' ? (
        <div className="space-y-2">
          <textarea
            className="min-h-[120px] w-full rounded-xl border bg-background px-3 py-2 font-mono text-xs"
            placeholder={'1\tA\n2\tC\n3\tB\n… veya tek satır: ABCDE…'}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setPaste(formatAnswerKeyForPaste(answerKey, questionCount))}
            >
              Mevcut anahtarı göster
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl"
              onClick={() => {
                if (!applyPaste()) {
                  window.alert('Metin okunamadı. Örnek: 1\\tA veya her satırda "1 A"');
                  return;
                }
                void onSave();
              }}
            >
              Uygula ve kaydet
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'ocr' ? (
        <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
          <p className="text-[10px] text-muted-foreground">
            Yazılı cevap anahtarı / rubrik kağıdı fotoğrafı (metin). Satır satır okunur; şık formatına
            çevrilebiliyorsa anahtara eklenir.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-2 rounded-xl"
            disabled={!ready || busy}
            onClick={onScanOcr}
          >
            {busy ? <LoadingSpinner className="size-5" /> : <Camera className="size-5" />}
            Anahtar kağıdı OCR
          </Button>
        </div>
      ) : null}

      {mode !== 'grid' ? (
        <Button type="button" className="h-10 w-full rounded-xl" disabled={saving} onClick={onSave}>
          {saving ? 'Kaydediliyor…' : 'Anahtarı kaydet'}
        </Button>
      ) : null}
    </div>
  );
}
