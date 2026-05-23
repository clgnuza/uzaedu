'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Scale, CheckCircle2, Clock } from 'lucide-react';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { kartKoduPrefix } from '@/lib/plan-karti';
import {
  planningCatalogRuleHint,
  planningCatalogRuleLabel,
  type AdvancedRelationDef,
  type SimpleRelationDef,
} from '@/lib/planning-relations';

type Mode = 'simple' | 'advanced';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  simpleCatalog: SimpleRelationDef[];
  advancedCatalog: AdvancedRelationDef[];
  initialMode?: Mode;
  onPick: (kind: Mode, ruleId: string) => void;
};

function RulePickCard({
  selected,
  onSelect,
  title,
  hint,
  schoolRule,
  supported,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint?: string;
  schoolRule?: string | null;
  supported: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-3 text-left text-sm transition-colors',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/40' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium leading-snug">{title}</span>
        {supported ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Dağıtım
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            Yakında
          </span>
        )}
      </div>
      {schoolRule && (
        <p className="mt-1.5 text-xs">
          <span className="text-muted-foreground">Okul kuralı: </span>
          <span className="font-medium text-foreground">{schoolRule}</span>
        </p>
      )}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </button>
  );
}

export function PlanningRelationRulePickerDialog({
  open,
  onOpenChange,
  simpleCatalog,
  advancedCatalog,
  initialMode = 'simple',
  onPick,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [onlySupported, setOnlySupported] = useState(true);
  const [ruleId, setRuleId] = useState('');

  const supportedSimple = useMemo(
    () => simpleCatalog.filter((r) => r.solver_supported),
    [simpleCatalog],
  );
  const supportedAdvanced = useMemo(
    () => advancedCatalog.filter((r) => r.solver_supported),
    [advancedCatalog],
  );

  const list = useMemo(() => {
    const src = mode === 'simple' ? simpleCatalog : advancedCatalog;
    return onlySupported ? src.filter((r) => r.solver_supported) : src;
  }, [mode, simpleCatalog, advancedCatalog, onlySupported]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setOnlySupported(true);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const preferred =
      mode === 'simple'
        ? (supportedSimple[0]?.id ?? simpleCatalog[0]?.id ?? '')
        : (supportedAdvanced[0]?.id ?? advancedCatalog[0]?.id ?? '');
    const inList = list.some((r) => r.id === ruleId);
    if (!inList) setRuleId(preferred);
  }, [open, mode, list, ruleId, supportedSimple, supportedAdvanced, simpleCatalog, advancedCatalog]);

  const picked =
    mode === 'simple'
      ? simpleCatalog.find((r) => r.id === ruleId)
      : advancedCatalog.find((r) => r.id === ruleId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kurallara uygun kural ekleme</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Seçtiğiniz ilişki, program üretiminde{' '}
            <Link href="/ders-dagit/studyo/kurallar" className="text-primary hover:underline">
              okul kuralları
            </Link>{' '}
            ile birleştirilir. Dağıtım etiketi olanlar üretimde uygulanır.
          </p>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'simple' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setMode('simple')}
          >
            Basit ilişki
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'advanced' ? 'default' : 'ghost'}
            className="flex-1"
            onClick={() => setMode('advanced')}
          >
            Plan Kartı
          </Button>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={onlySupported}
            onChange={(e) => setOnlySupported(e.target.checked)}
            className="size-3.5 rounded border-border accent-[rgb(var(--dd-accent))]"
          />
          Yalnızca dağıtımda uygulananlar
        </label>

        <div className="max-h-[min(50vh,360px)] space-y-2 overflow-y-auto pr-1">
          {list.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Bu filtrede kural yok. Filtreyi kapatın veya okul kurallarından genel kural açın.
            </p>
          ) : (
            list.map((r) => {
              const school = planningCatalogRuleLabel(r.catalog_key);
              const hint =
                r.hint ??
                planningCatalogRuleHint(r.catalog_key) ??
                undefined;
              const title =
                mode === 'advanced'
                  ? `${kartKoduPrefix(r as AdvancedRelationDef)}${r.label_tr}`
                  : r.label_tr;
              return (
                <RulePickCard
                  key={r.id}
                  selected={ruleId === r.id}
                  onSelect={() => setRuleId(r.id)}
                  title={title}
                  hint={hint}
                  schoolRule={school}
                  supported={r.solver_supported}
                />
              );
            })
          )}
        </div>

        {picked && !picked.solver_supported && (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-900 dark:text-amber-100">
            Bu kural kayıt altına alınır; dağıtımda henüz uygulanmaz. Zorunlu önem seçerseniz üretim başlamayabilir.
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <Link
            href="/ders-dagit/studyo/kurallar"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Scale className="h-3.5 w-3.5" />
            Okul kuralları listesi
          </Link>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <DdAccentButton
              type="button"
              disabled={!ruleId}
              onClick={() => {
                onPick(mode, ruleId);
                onOpenChange(false);
              }}
            >
              Koşulları tanımla
            </DdAccentButton>
          </div>
        </DialogFooter>
      </DdDialogContent>
    </Dialog>
  );
}
