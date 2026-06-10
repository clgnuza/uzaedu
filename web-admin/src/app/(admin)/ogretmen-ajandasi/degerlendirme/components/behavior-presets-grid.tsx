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
import { CRITERION_PRESET_GRID, CriterionPresetCard } from './criterion-preset-glass';
import { QuickBehaviorModal } from './quick-behavior-modal';

type SvgIcon = ComponentType<{ className?: string }>;

type Preset = {
  name: string;
  Icon: SvgIcon;
  scoreType: 'numeric' | 'sign';
  maxScore: number;
  polarity: 'positive' | 'negative';
};

export const BEHAVIOR_PRESETS: Preset[] = [
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
  const list = BEHAVIOR_PRESETS.filter((p) => p.polarity === tab);
  const tabOffset = tab === 'positive' ? 0 : BEHAVIOR_PRESETS.filter((p) => p.polarity === 'positive').length;

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
      <div className="flex gap-1 rounded-xl border border-white/20 bg-white/30 p-1 backdrop-blur-md dark:bg-white/5">
        <button
          type="button"
          onClick={() => setTab('positive')}
          className={cn(
            'min-h-8 flex-1 rounded-lg text-[11px] font-semibold transition-colors sm:text-xs',
            tab === 'positive' ? 'bg-white/70 text-emerald-800 shadow-sm ring-1 ring-emerald-300/40 dark:bg-white/10 dark:text-emerald-200' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Olumlu
        </button>
        <button
          type="button"
          onClick={() => setTab('negative')}
          className={cn(
            'min-h-8 flex-1 rounded-lg text-[11px] font-semibold transition-colors sm:text-xs',
            tab === 'negative' ? 'bg-white/70 text-rose-800 shadow-sm ring-1 ring-rose-300/40 dark:bg-white/10 dark:text-rose-200' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Geliştirmesi gerek
        </button>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Üste dokunun: hızlı not. Alttan: kalıcı kriter. Kartlar aynı boyutta cam efektli renklerdedir.
      </p>
      <div className={CRITERION_PRESET_GRID}>
        {list.map((p, i) => {
          const taken = existingNames.has(p.name);
          const Icon = p.Icon;
          return (
            <CriterionPresetCard
              key={p.name}
              colorIndex={tabOffset + i}
              scoreLabel={p.scoreType === 'sign' ? '+/−' : String(p.maxScore)}
              name={p.name}
              icon={<Icon className="size-4" />}
              taken={taken}
              onPrimaryClick={() => setQuickPreset(p)}
              onAddClick={() => void add(p)}
              addDisabled={taken || !token}
              footerLabel={taken ? 'Kriter listede' : 'Kriter olarak ekle'}
              primaryTitle="Hızlı not ver"
            />
          );
        })}
      </div>
    </div>
  );
}
