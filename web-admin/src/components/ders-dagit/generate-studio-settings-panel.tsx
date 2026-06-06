'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ChevronDown,
  Gauge,
  GitBranch,
  Scale,
  Settings2,
  Sparkles,
  Target,
  Wand2,
  Zap,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { StudioValidationGate } from '@/components/ders-dagit/StudioValidationGate';
import { DdAccentButton, DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import type { StudioReadiness } from '@/lib/ders-dagit-readiness';
import { distributionPolicySummary, type DistributionPolicyDto } from '@/lib/distribution-policy';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';
import { placementSearchSummary, type PlacementSearchPolicyDto } from '@/lib/placement-search-policy';
import { TimetablePlacementSettingsMenu } from '@/components/timetable/TimetablePlacementSettingsMenu';
import { cn } from '@/lib/utils';

export type GeneratePriority = 'coverage' | 'balanced' | 'fast';

const PRIORITY_OPTIONS: Array<{
  id: GeneratePriority;
  title: string;
  desc: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  recommended?: boolean;
}> = [
  {
    id: 'coverage',
    title: 'Tüm dersleri yerleştir',
    desc: 'Boş ders kalmasın',
    hint: 'Gelişmiş çözücü + uzun süre. Yerleşmeyen kaldığında en iyi sonuç.',
    icon: Target,
    recommended: true,
  },
  {
    id: 'balanced',
    title: 'Dengeli',
    desc: 'Hız ve yerleşim dengesi',
    hint: 'Standart süre. Çoğu okul için yeterli.',
    icon: Gauge,
  },
  {
    id: 'fast',
    title: 'Hızlı taslak',
    desc: 'Önizleme için',
    hint: 'En hızlı; eksik kalırsa editörden tamamlayın.',
    icon: Zap,
  },
];

export function generatePriorityHint(priority: GeneratePriority): string {
  return PRIORITY_OPTIONS.find((o) => o.id === priority)?.hint ?? '';
}

function ReadinessRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="relative size-12 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-[rgb(var(--dd-accent))] transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

function SettingsSection({
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-t border-border/60 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
      >
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-foreground">{title}</span>
          {!open && summary ? (
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{summary}</span>
          ) : null}
        </span>
      </button>
      {open ? <div className="space-y-3 px-3 pb-3">{children}</div> : null}
    </div>
  );
}

export function GenerateStudioSettingsPanel({
  readiness,
  overview,
  priority,
  onPriorityChange,
  relaxConstraints,
  onRelaxConstraintsChange,
  showAdvanced,
  onShowAdvancedChange,
  versions,
  onVersionsChange,
  durationSec,
  onDurationSecChange,
  useCsp,
  onUseCspChange,
  distributionPolicy,
  placementSearch,
  onPlacementSearchChange,
  token,
  studioId,
  generateBlockers,
  busy,
  studioReady,
  onGenerate,
  priorityHint,
  lastSearchIterations,
  lastSearchCapEstimate,
}: {
  readiness: StudioReadiness;
  overview: StudioOverview | null;
  priority: GeneratePriority;
  onPriorityChange: (p: GeneratePriority) => void;
  relaxConstraints: boolean;
  onRelaxConstraintsChange: (v: boolean) => void;
  showAdvanced: boolean;
  onShowAdvancedChange: (v: boolean) => void;
  versions: string;
  onVersionsChange: (v: string) => void;
  durationSec: string;
  onDurationSecChange: (v: string) => void;
  useCsp: boolean;
  onUseCspChange: (v: boolean) => void;
  distributionPolicy: DistributionPolicyDto | null;
  placementSearch: PlacementSearchPolicyDto | null;
  onPlacementSearchChange: (p: PlacementSearchPolicyDto) => void;
  token?: string | null;
  studioId?: string | null;
  generateBlockers: ValidationIssue[];
  busy: boolean;
  studioReady: boolean;
  onGenerate: () => void;
  priorityHint?: string;
  lastSearchIterations?: number;
  lastSearchCapEstimate?: number;
}) {
  const [openMotor, setOpenMotor] = useState(true);
  const [openPolicies, setOpenPolicies] = useState(false);

  const policySummary = [
    distributionPolicy ? distributionPolicySummary(distributionPolicy) : null,
    placementSearch ? placementSearchSummary(placementSearch) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const priorityLabel = PRIORITY_OPTIONS.find((o) => o.id === priority)?.title ?? 'Dengeli';
  const motorSummary = `${priorityLabel} · ${versions} taslak`;

  return (
    <DdCard variant="indigo" className="relative z-0 overflow-hidden">
      <CardHeader className="space-y-3 border-b border-border/50 bg-gradient-to-br from-[rgb(var(--dd-accent))]/8 to-transparent pb-3">
        <div className="flex items-center gap-2">
          <span className="dd-icon-badge !size-8 !rounded-lg">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <CardTitle className="text-base">Üretim ayarları</CardTitle>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-2.5 py-2">
          <ReadinessRing percent={readiness.percent} />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium">Hazırlık</p>
            <p className="text-muted-foreground">
              {readiness.percent >= 80 ? 'Üretime hazır' : 'Eksik adımlar var'}
            </p>
            {readiness.percent < 80 && (
              <Link href="/ders-dagit/studyo/kurulum" className="text-primary underline-offset-2 hover:underline">
                Kuruluma git
              </Link>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <SettingsSection
          title="Yerleştirme motoru"
          summary={motorSummary}
          open={openMotor}
          onToggle={() => setOpenMotor((v) => !v)}
        >
          <div className="space-y-1.5">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPriorityChange(opt.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors',
                  priority === opt.id
                    ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/10'
                    : 'border-border/60 hover:bg-muted/40',
                )}
              >
                <opt.icon
                  className={cn(
                    'size-3.5 shrink-0',
                    priority === opt.id ? 'text-[rgb(var(--dd-accent))]' : 'text-muted-foreground',
                  )}
                />
                <span className="min-w-0">
                  <span className="font-medium">{opt.title}</span>
                  {opt.recommended && (
                    <span className="ml-1 rounded bg-emerald-500/15 px-1 py-px text-[9px] font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                      önerilen
                    </span>
                  )}
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{opt.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={relaxConstraints}
              onChange={(e) => onRelaxConstraintsChange(e.target.checked)}
            />
            <span>
              <span className="font-medium">Desen ve kuralları gevşet</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Stüdyo kuralları ve desen cezası kalkar (tek seferlik).
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={() => onShowAdvancedChange(!showAdvanced)}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="size-3.5" />
            Gelişmiş {showAdvanced ? '▴' : '▾'}
          </button>
          {showAdvanced && (
            <div className="grid gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 p-2.5">
              <DdSelectField
                label="Taslak sayısı"
                value={versions}
                onValueChange={onVersionsChange}
                options={[
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                  { value: '3', label: '3' },
                ]}
              />
              <DdSelectField
                label="Süre (sn)"
                value={durationSec}
                onValueChange={onDurationSecChange}
                options={[
                  { value: '60', label: '60' },
                  { value: '90', label: '90' },
                  { value: '120', label: '120' },
                  { value: '180', label: '180' },
                  { value: '240', label: '240' },
                ]}
              />
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={useCsp} onChange={(e) => onUseCspChange(e.target.checked)} />
                Gelişmiş yerleştirme (yavaş)
              </label>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title="Stüdyo politikaları"
          summary={policySummary || 'Varsayılan'}
          open={openPolicies}
          onToggle={() => setOpenPolicies((v) => !v)}
        >
          {distributionPolicy && (
            <div className="rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2 text-xs">
              <p className="font-medium text-foreground">Haftalık dağıtım</p>
              <p className="mt-0.5 text-muted-foreground">{distributionPolicySummary(distributionPolicy)}</p>
            </div>
          )}
          {placementSearch && (
            <div className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-muted/15 px-2.5 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-foreground">Arama karmaşıklığı</p>
                <p className="mt-0.5 text-muted-foreground">{placementSearchSummary(placementSearch)}</p>
                {lastSearchIterations != null && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Son üretim: {lastSearchIterations.toLocaleString('tr-TR')} hamle
                    {lastSearchCapEstimate != null
                      ? ` · ~${lastSearchCapEstimate.toLocaleString('tr-TR')} hedef`
                      : ''}
                  </p>
                )}
              </div>
              <TimetablePlacementSettingsMenu
                token={token}
                studioId={studioId}
                onChange={onPlacementSearchChange}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/ders-dagit/studyo/kurallar"
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/80 px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
            >
              <Scale className="size-3 text-violet-600" />
              Kurallar
            </Link>
            <Link
              href="/ders-dagit/studyo/planlama-iliskileri"
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/80 px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
            >
              <GitBranch className="size-3 text-sky-600" />
              Planlama
            </Link>
            <Link
              href="/ders-dagit/studyo/ayarlar"
              className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-card/80 px-2 py-1 text-[11px] font-medium hover:bg-muted/40"
            >
              <Settings2 className="size-3" />
              Tüm ayarlar
            </Link>
          </div>
        </SettingsSection>

        <div className="space-y-2 border-t border-border/60 p-3">
          <StudioValidationGate overview={overview} action="generate">
            {generateBlockers.length > 0 && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/5 px-2.5 py-2 text-xs text-rose-900 dark:text-rose-100">
                <p className="font-medium">Engelleyen hatalar</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {generateBlockers.slice(0, 4).map((b, i) => (
                    <li key={`${b.code}-${i}`}>{b.message}</li>
                  ))}
                </ul>
                <Link href="/ders-dagit/studyo/dogrulama" className="mt-1 inline-block text-primary underline">
                  Doğrulama
                </Link>
              </div>
            )}
            <DdAccentButton
              type="button"
              className="w-full"
              disabled={busy || !studioReady || generateBlockers.length > 0}
              onClick={onGenerate}
            >
              <Wand2 className="mr-2 size-4" />
              {busy ? 'Oluşturuluyor…' : 'Program oluştur'}
            </DdAccentButton>
            {priorityHint ? (
              <p className="text-[10px] leading-relaxed text-muted-foreground">{priorityHint}</p>
            ) : null}
          </StudioValidationGate>
        </div>
      </CardContent>
    </DdCard>
  );
}
