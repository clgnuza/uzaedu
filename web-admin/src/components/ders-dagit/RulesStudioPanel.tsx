'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { GitBranch } from 'lucide-react';
import { formatClassSectionsList } from '@/lib/class-section-sort';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { DdInfoHint, DdLabelWithHint } from '@/components/ders-dagit/dd-info-hint';
import { Switch } from '@/components/ui/switch';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { DdWeekdayPicker } from '@/components/ders-dagit/dd-weekday-picker';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RULE_KIND_UI, ruleLabel } from '@/lib/ders-dagit-labels';
import {
  RULE_ENGINE_SUMMARY,
  RULE_EXTRA_HINTS,
  RULE_HINTS,
  RULE_KIND_HINTS,
  ruleHint,
} from '@/lib/ders-dagit-hints';
import { filterRulesPageCatalog } from '@/lib/ders-dagit-rules-page';

export type RuleState = { active: boolean; weight?: number; params?: { days?: number[] } };
export type RuleDef = { key: string; label_tr: string; kind: string };
export type ClassProfileRules = {
  id: string;
  name: string;
  class_sections: string[];
  rules: Record<string, RuleState> | null;
};

export type RulesRes = {
  rules: Record<string, RuleState>;
  catalog: RuleDef[];
  building_travel?: Array<{ from: string; to: string; minutes: number }>;
  class_profiles?: ClassProfileRules[];
};

type Props = {
  scope: string;
  studioScope: string;
  scopeOptions: { value: string; label: string }[];
  onScopeChange: (v: string) => void;
  profile: ClassProfileRules | undefined;
  scopeSectionLabel: string | null;
  catalog: RuleDef[];
  displayRules: Record<string, RuleState> | null | undefined;
  onToggle: (key: string, active: boolean) => void;
  onWeight: (key: string, weight: number) => void;
  peDays: number[];
  onPeDaysChange: (days: number[]) => void;
  onSavePeDays: () => void;
  peSaveDisabled: boolean;
  travelMin: number;
  onTravelMinChange: (n: number) => void;
  onSaveTravelDefault: () => void;
  buildings: Array<{ id: string; name: string }>;
  travelFrom: string;
  travelTo: string;
  travelPairMin: number;
  onTravelFrom: (v: string) => void;
  onTravelTo: (v: string) => void;
  onTravelPairMin: (n: number) => void;
  onSaveTravelPair: () => void;
  buildingTravel: Array<{ from: string; to: string; minutes: number }> | undefined;
};

function RuleRow({
  ruleKey,
  label,
  kind,
  active,
  weight,
  onToggle,
  onWeight,
}: {
  ruleKey: string;
  label: string;
  kind: string;
  active: boolean;
  weight?: number;
  onToggle: (v: boolean) => void;
  onWeight: (n: number) => void;
}) {
  const text = ruleHint(ruleKey, label);
  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <DdLabelWithHint htmlFor={ruleKey} label={label} hint={text} className="flex-1 font-medium" />
        <Switch id={ruleKey} checked={active} onCheckedChange={onToggle} />
      </div>
      {kind !== 'hard' && active && (
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 text-[10px] text-muted-foreground">Öncelik</span>
          <Input
            type="number"
            min={1}
            max={20}
            className="h-7 w-16 text-xs"
            value={weight ?? 5}
            onChange={(e) => onWeight(Number(e.target.value))}
          />
          <DdInfoHint label="Öncelik puanı" title="Öncelik puanı">
            <p>{RULE_EXTRA_HINTS.weight}</p>
          </DdInfoHint>
        </div>
      )}
    </div>
  );
}

export function RulesStudioPanel({
  scope,
  studioScope,
  scopeOptions,
  onScopeChange,
  profile,
  scopeSectionLabel,
  catalog,
  displayRules,
  onToggle,
  onWeight,
  peDays,
  onPeDaysChange,
  onSavePeDays,
  peSaveDisabled,
  travelMin,
  onTravelMinChange,
  onSaveTravelDefault,
  buildings,
  travelFrom,
  travelTo,
  travelPairMin,
  onTravelFrom,
  onTravelTo,
  onTravelPairMin,
  onSaveTravelPair,
  buildingTravel,
}: Props) {
  const pageCatalog = useMemo(() => filterRulesPageCatalog(catalog), [catalog]);
  const byKind = (kind: string) => pageCatalog.filter((c) => c.kind === kind);
  const isStudio = scope === studioScope;

  const ruleKindCard = (kind: 'hard' | 'soft' | 'pedagogy') => (
    <DdCard key={kind} className="overflow-hidden">
      <CardHeader className="space-y-1 p-3 pb-2">
        <div className="flex items-center gap-1">
          <CardTitle className="text-sm">{RULE_KIND_UI[kind].title}</CardTitle>
          <DdInfoHint label={RULE_KIND_UI[kind].title} title={RULE_KIND_UI[kind].title}>
            <p>{RULE_KIND_HINTS[kind]}</p>
          </DdInfoHint>
        </div>
        <p className="text-[11px] text-muted-foreground">{RULE_KIND_UI[kind].hint}</p>
      </CardHeader>
      <CardContent className="space-y-1.5 p-3 pt-0">
        {byKind(kind).map((r) => (
          <RuleRow
            key={r.key}
            ruleKey={r.key}
            label={ruleLabel(r.key, r.label_tr)}
            kind={kind}
            active={displayRules?.[r.key]?.active ?? false}
            weight={displayRules?.[r.key]?.weight}
            onToggle={(v) => onToggle(r.key, v)}
            onWeight={(n) => onWeight(r.key, n)}
          />
        ))}
      </CardContent>
    </DdCard>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs">
        <p className="flex-1 leading-relaxed text-foreground">
          Ders ve şube bazlı dağıtım kuralları (2+2, haftaya yay, aynı gün yasak vb.){' '}
          <Link href="/ders-dagit/studyo/planlama-iliskileri" className="font-medium text-primary underline">
            Planlama ilişkileri
          </Link>
          üzerinden tanımlanır. Bu sayfada yalnızca okul geneli zorunluluklar, tercihler ve MEB pedagojisi yer alır.
        </p>
      </div>
      <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2.5 text-xs text-sky-950 dark:text-sky-100">
        <p className="flex-1 leading-relaxed">{RULE_ENGINE_SUMMARY}</p>
        <DdInfoHint label="Kurallar ve üretim" title="Kurallar üretimde nasıl uygulanır?">
          <p>{RULE_ENGINE_SUMMARY}</p>
          <ul className="mt-3 list-disc space-y-1 pl-4">
            <li>
              <strong>Zorunlu:</strong> Çakışma yok, sabit slot, grup paralelliği — çoğu her zaman; derslik/bina kuralları anahtara bağlı.
            </li>
            <li>
              <strong>Tercih:</strong> Öncelik puanı; mümkün olduğunca uygulanır, skorda ceza.
            </li>
            <li>
              <strong>MEB:</strong> Okul türü + sizin gün seçiminiz.
            </li>
          </ul>
        </DdInfoHint>
      </div>
      <div className="dd-glass dd-glass-subtle flex flex-wrap items-end gap-3 rounded-xl p-3">
        <div className="min-w-[200px] flex-1">
          <div className="mb-1 flex items-center gap-1">
            <span className="text-xs font-medium">Kural kapsamı</span>
            <DdInfoHint label="Kural kapsamı" title="Kural kapsamı">
              <p>{RULE_EXTRA_HINTS.scope}</p>
            </DdInfoHint>
          </div>
          <DdSelectField
            label=""
            className="[&_label]:sr-only"
            value={scope}
            onValueChange={onScopeChange}
            options={scopeOptions}
          />
        </div>
        <div className="flex items-center gap-0.5">
          <Link
            href="/ders-dagit/studyo/planlama-iliskileri"
            className="inline-flex items-center gap-1 rounded-lg border border-border/80 px-2.5 py-2 text-xs font-medium text-primary hover:bg-muted/50"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Planlama ilişkileri
          </Link>
          <DdInfoHint label="Planlama ilişkileri" title="Planlama ilişkileri">
            <p>{RULE_EXTRA_HINTS.planningLink}</p>
          </DdInfoHint>
        </div>
      </div>

      {(scopeSectionLabel || (!isStudio && profile)) && (
        <p className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs">
          <strong>Kapsam:</strong>{' '}
          {scopeSectionLabel
            ? `şube ${scopeSectionLabel}`
            : `${profile?.name} (${formatClassSectionsList(profile?.class_sections ?? [])})`}
        </p>
      )}
      {!isStudio && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Yalnızca <strong>{profile?.name}</strong> şubeleri için kayıt; diğerleri okul varsayılanını kullanır.
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-3 lg:items-start">
        {ruleKindCard('hard')}
        {ruleKindCard('soft')}
        <div className="flex flex-col gap-3">
          {ruleKindCard('pedagogy')}
          {isStudio && (
            <>
          <DdCard>
            <CardHeader className="flex flex-row items-center gap-1 p-3 pb-1">
              <CardTitle className="text-sm">Beden ve müzik günleri</CardTitle>
              <DdInfoHint label="Beden ve müzik günleri" title="Beden ve müzik günleri">
                <p>{RULE_HINTS.meb_pe_music_days}</p>
                <p className="mt-2">{RULE_EXTRA_HINTS.peDays}</p>
              </DdInfoHint>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              <DdWeekdayPicker value={peDays} onChange={onPeDaysChange} minSelected={1} />
              <Button type="button" size="sm" variant="secondary" disabled={peSaveDisabled} onClick={onSavePeDays}>
                Günleri kaydet
              </Button>
            </CardContent>
          </DdCard>

          <DdCard>
            <CardHeader className="flex flex-row items-center gap-1 p-3 pb-1">
              <CardTitle className="text-sm">Bina geçiş süresi</CardTitle>
              <DdInfoHint label="Bina geçiş" title="Bina geçiş süresi">
                <p>{RULE_HINTS.building_travel_time}</p>
                <p className="mt-2">{RULE_EXTRA_HINTS.travelDefault}</p>
              </DdInfoHint>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2 p-3 pt-0">
              <Input
                type="number"
                className="h-8 w-20"
                value={travelMin}
                onChange={(e) => onTravelMinChange(Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">dk (varsayılan)</span>
              <Button type="button" size="sm" variant="secondary" onClick={onSaveTravelDefault}>
                Kaydet
              </Button>
            </CardContent>
          </DdCard>

          <DdCard>
            <CardHeader className="flex flex-row items-center gap-1 p-3 pb-1">
              <CardTitle className="text-sm">Bina geçiş matrisi</CardTitle>
              <DdInfoHint label="Bina matrisi" title="Bina geçiş matrisi">
                <p>{RULE_EXTRA_HINTS.travelMatrix}</p>
              </DdInfoHint>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              <div className="flex flex-wrap items-end gap-2">
                <DdSelectField
                  label="Kaynak"
                  className="min-w-[120px] flex-1 sm:max-w-[180px]"
                  value={travelFrom}
                  onValueChange={onTravelFrom}
                  options={[
                    { value: 'default', label: 'Varsayılan' },
                    ...buildings.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
                <span className="pb-2 text-muted-foreground">→</span>
                <DdSelectField
                  label="Hedef"
                  className="min-w-[120px] flex-1 sm:max-w-[180px]"
                  value={travelTo}
                  onValueChange={onTravelTo}
                  options={[
                    { value: 'default', label: 'Varsayılan' },
                    ...buildings.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                />
                <Input
                  type="number"
                  className="h-9 w-16"
                  value={travelPairMin}
                  onChange={(e) => onTravelPairMin(Number(e.target.value))}
                />
                <Button type="button" size="sm" onClick={onSaveTravelPair}>
                  Ekle / güncelle
                </Button>
              </div>
              {buildingTravel && buildingTravel.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {buildingTravel.map((t, i) => (
                    <li key={i} className="rounded-md bg-muted/50 px-2 py-0.5">
                      {t.from} → {t.to}: {t.minutes} dk
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </DdCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
