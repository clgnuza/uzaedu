'use client';

import { useState } from 'react';
import type { ComponentType } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  IconBookCare,
  IconBotherPeer,
  IconClipboardHomework,
  IconDefiantRules,
  IconDisrespect,
  IconHeadphonesListen,
  IconHeartHelp,
  IconLateUnprepared,
  IconLightbulbParticipation,
  IconMedalHardWork,
  IconMessageShare,
  IconMessySpace,
  IconMountainDetermination,
  IconNoiseDisrupt,
  IconNoHomework,
  IconOffTask,
  IconPhoneDistraction,
  IconPuzzleHarmony,
  IconRoughPlay,
  IconShieldRules,
  IconSmileRespect,
  IconSparklePositive,
  IconTeamwork,
  IconThumbsTask,
} from './behavior-preset-svgs';
import { QuickBehaviorModal } from './quick-behavior-modal';

type SvgIcon = ComponentType<{ className?: string }>;

type Preset = {
  name: string;
  Icon: SvgIcon;
  scoreType: 'numeric' | 'sign';
  maxScore: number;
  polarity: 'positive' | 'negative';
};

const PRESETS: Preset[] = [
  { name: 'Arkadaşlarıyla uyumlu', Icon: IconPuzzleHarmony, scoreType: 'sign', maxScore: 3, polarity: 'positive' },
  { name: 'Başkalarına yardım etme', Icon: IconHeartHelp, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Ekip çalışması', Icon: IconTeamwork, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Göreve bağlılık', Icon: IconThumbsTask, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Kararlılık', Icon: IconMountainDetermination, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Katılımcılık', Icon: IconLightbulbParticipation, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Sıkı çalışma', Icon: IconMedalHardWork, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Sınıf kurallarına uyum', Icon: IconShieldRules, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Dinleme ve dikkat', Icon: IconHeadphonesListen, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Ödev ve görevleri zamanında getirme', Icon: IconClipboardHomework, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Saygılı iletişim', Icon: IconSmileRespect, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Düşüncelerini paylaşma', Icon: IconMessageShare, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Ders materyaline özen', Icon: IconBookCare, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Olumlu tutum', Icon: IconSparklePositive, scoreType: 'sign', maxScore: 1, polarity: 'positive' },
  { name: 'Dersi bölen davranış / gürültü', Icon: IconNoiseDisrupt, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Göreve ilgisizlik', Icon: IconOffTask, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Saygısız iletişim', Icon: IconDisrespect, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Ödevini getirmeme', Icon: IconNoHomework, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Geç kalma / hazırlıksız olma', Icon: IconLateUnprepared, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Arkadaşını rahatsız etme', Icon: IconBotherPeer, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Kural ve yönergelere uymama', Icon: IconDefiantRules, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Telefon veya dikkat dağıtıcı kullanım', Icon: IconPhoneDistraction, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Çalışma alanını düzensiz bırakma', Icon: IconMessySpace, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
  { name: 'Kaba / tehlikeli fiziksel davranış', Icon: IconRoughPlay, scoreType: 'sign', maxScore: 1, polarity: 'negative' },
];

export function BehaviorPresetsGrid({
  token,
  students,
  noteDate,
  existingNames,
  onAdded,
  onQuickApplied,
}: {
  token: string | null;
  students: { id: string; name: string }[];
  noteDate: string;
  existingNames: Set<string>;
  onAdded: () => void;
  onQuickApplied: () => void;
}) {
  const [tab, setTab] = useState<'positive' | 'negative'>('positive');
  const [quickPreset, setQuickPreset] = useState<Preset | null>(null);
  const list = PRESETS.filter((p) => p.polarity === tab);

  const add = async (p: Preset) => {
    if (existingNames.has(p.name)) {
      toast.message('Bu davranış zaten kriter listesinde.');
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
          criterionCategory: 'behavior',
        }),
      });
      toast.success('Davranış kriteri eklendi');
      onAdded();
    } catch {
      toast.error('Eklenemedi');
    }
  };

  return (
    <div className="space-y-3">
      <QuickBehaviorModal
        preset={quickPreset ? { name: quickPreset.name, Icon: quickPreset.Icon, polarity: quickPreset.polarity } : null}
        students={students}
        noteDate={noteDate}
        token={token}
        onClose={() => setQuickPreset(null)}
        onApplied={onQuickApplied}
      />
      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 dark:bg-muted/15">
        <button
          type="button"
          onClick={() => setTab('positive')}
          className={cn(
            'min-h-9 flex-1 rounded-lg text-xs font-semibold transition-colors sm:text-sm',
            tab === 'positive' ? 'bg-background text-primary shadow-sm ring-1 ring-primary/20' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Olumlu
        </button>
        <button
          type="button"
          onClick={() => setTab('negative')}
          className={cn(
            'min-h-9 flex-1 rounded-lg text-xs font-semibold transition-colors sm:text-sm',
            tab === 'negative' ? 'bg-background text-rose-600 shadow-sm ring-1 ring-rose-200 dark:text-rose-400 dark:ring-rose-900/50' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Geliştirmesi gerek
        </button>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Üst kısma dokunun: öğrenci seçip olumlu/olumsuz not verin (kriter eklemeden). Alttaki düğme ile aynı başlığı tabloda kalıcı kriter yapabilirsiniz.
      </p>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => {
          const taken = existingNames.has(p.name);
          const Icon = p.Icon;
          const isNeg = p.polarity === 'negative';
          return (
            <div
              key={p.name}
              className={cn(
                'flex flex-col overflow-hidden rounded-2xl border-2 text-center shadow-sm transition-all',
                taken
                  ? isNeg
                    ? 'border-rose-300/90 bg-rose-50/80 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
                    : 'border-emerald-300/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : isNeg
                    ? 'border-rose-100/90 bg-rose-50/40 dark:border-rose-950 dark:bg-zinc-900'
                    : 'border-zinc-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-900',
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setQuickPreset(p)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setQuickPreset(p);
                  }
                }}
                className="relative flex flex-1 cursor-pointer flex-col gap-1.5 px-2 py-2.5 outline-none transition-colors hover:bg-black/3 dark:hover:bg-white/4"
              >
                <span
                  className={cn(
                    'absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm',
                    isNeg ? 'bg-rose-500' : 'bg-emerald-500',
                  )}
                  aria-hidden
                >
                  {p.maxScore}
                </span>
                <span
                  className={cn(
                    'relative mx-auto mt-1 flex size-12 items-center justify-center rounded-2xl shadow-inner ring-1 ring-black/5 dark:ring-white/10',
                    isNeg ? 'bg-rose-100/80 dark:bg-rose-950/40' : 'bg-zinc-100/90 dark:bg-zinc-800/80',
                  )}
                >
                  <Icon className="size-9" />
                </span>
                <span className="line-clamp-2 px-1 text-[11px] font-semibold leading-snug">{p.name}</span>
              </div>
              <button
                type="button"
                disabled={taken || !token}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void add(p);
                }}
                className={cn(
                  'border-t py-1.5 text-[10px] font-semibold transition-colors',
                  isNeg ? 'border-rose-200/80 hover:bg-rose-500/10 dark:border-rose-800/60' : 'border-emerald-200/80 hover:bg-emerald-500/10 dark:border-emerald-800/50',
                  taken ? 'cursor-default text-muted-foreground' : 'text-primary hover:underline',
                )}
              >
                {taken ? 'Kriter listede' : 'Kriter olarak ekle'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
