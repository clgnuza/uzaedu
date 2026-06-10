'use client';

import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  ClipboardCheck,
  FlaskConical,
  Layers,
  MessageCircle,
  Mic,
  PenLine,
  Presentation,
  Puzzle,
  Users,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CRITERION_PRESET_GRID, CriterionPresetCard } from './criterion-preset-glass';

type LessonPreset = {
  name: string;
  Icon: LucideIcon;
  scoreType: 'numeric';
  maxScore: number;
  group: 'process' | 'assessment';
};

const PRESETS: LessonPreset[] = [
  { name: 'Derse katılım', Icon: Users, scoreType: 'numeric', maxScore: 5, group: 'process' },
  { name: 'Sözlü yanıt', Icon: MessageCircle, scoreType: 'numeric', maxScore: 5, group: 'process' },
  { name: 'Grup çalışması katkısı', Icon: UsersRound, scoreType: 'numeric', maxScore: 5, group: 'process' },
  { name: 'Sunum / anlatım', Icon: Mic, scoreType: 'numeric', maxScore: 5, group: 'process' },
  { name: 'Okuma-anlama', Icon: BookOpen, scoreType: 'numeric', maxScore: 5, group: 'process' },
  { name: 'Kavram pekiştirme', Icon: Layers, scoreType: 'numeric', maxScore: 5, group: 'process' },
  { name: 'Ödev tamamlama', Icon: ClipboardCheck, scoreType: 'numeric', maxScore: 5, group: 'assessment' },
  { name: 'Kısa yazılı', Icon: PenLine, scoreType: 'numeric', maxScore: 10, group: 'assessment' },
  { name: 'Yazılı sınav', Icon: PenLine, scoreType: 'numeric', maxScore: 100, group: 'assessment' },
  { name: 'Performans görevi', Icon: Presentation, scoreType: 'numeric', maxScore: 10, group: 'assessment' },
  { name: 'Problem çözme', Icon: Puzzle, scoreType: 'numeric', maxScore: 10, group: 'assessment' },
  { name: 'Deney / uygulama', Icon: FlaskConical, scoreType: 'numeric', maxScore: 10, group: 'assessment' },
];

export function LessonPresetsGrid({
  token,
  existingNames,
  onAdded,
}: {
  token: string | null;
  existingNames: Set<string>;
  onAdded: () => void;
}) {
  const [tab, setTab] = useState<'process' | 'assessment'>('process');
  const list = PRESETS.filter((p) => p.group === tab);
  const tabOffset = tab === 'process' ? 0 : PRESETS.filter((p) => p.group === 'process').length;

  const add = async (p: LessonPreset) => {
    if (existingNames.has(p.name)) {
      toast.message('Bu kriter zaten listede.');
      return;
    }
    if (!token) return;
    try {
      await apiFetch('/teacher-agenda/evaluation/criteria', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: p.name,
          scoreType: p.scoreType,
          maxScore: p.maxScore,
          criterionCategory: 'lesson',
        }),
      });
      toast.success('Ders kriteri eklendi');
      onAdded();
    } catch {
      toast.error('Eklenemedi');
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1 rounded-xl border border-white/20 bg-white/30 p-1 backdrop-blur-md dark:bg-white/5">
        <button
          type="button"
          onClick={() => setTab('process')}
          className={cn(
            'min-h-8 flex-1 rounded-lg text-[11px] font-semibold transition-colors',
            tab === 'process' ? 'bg-white/70 text-indigo-800 shadow-sm ring-1 ring-indigo-300/40 dark:bg-white/10 dark:text-indigo-200' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Süreç
        </button>
        <button
          type="button"
          onClick={() => setTab('assessment')}
          className={cn(
            'min-h-8 flex-1 rounded-lg text-[11px] font-semibold transition-colors',
            tab === 'assessment' ? 'bg-white/70 text-violet-800 shadow-sm ring-1 ring-violet-300/40 dark:bg-white/10 dark:text-violet-200' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Ölçme
        </button>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Cam efektli hazır kartlara dokunarak genel ders kriteri ekleyin.
      </p>
      <div className={CRITERION_PRESET_GRID}>
        {list.map((p, i) => {
          const taken = existingNames.has(p.name);
          const Icon = p.Icon;
          return (
            <CriterionPresetCard
              key={p.name}
              colorIndex={tabOffset + i}
              scoreLabel={String(p.maxScore)}
              name={p.name}
              icon={<Icon className="size-4" strokeWidth={2.2} aria-hidden />}
              taken={taken}
              addDisabled={taken || !token}
              onAddClick={() => void add(p)}
              primaryTitle={taken ? 'Zaten listede' : `0–${p.maxScore} olarak ekle`}
            />
          );
        })}
      </div>
    </div>
  );
}
