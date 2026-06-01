'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Scale, X } from 'lucide-react';
import { Dialog, DialogFooter } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { PlanningRuleInfoCard } from '@/components/ders-dagit/planning-rule-info-card';
import { PlanningRuleListItem } from '@/components/ders-dagit/planning-rule-list-item';
import { planningCatalogRuleLabel, type AdvancedRelationDef, type SimpleRelationDef } from '@/lib/planning-relations';
import { planningRuleListCopy as listCopy } from '@/lib/planning-rule-list-copy';

type Mode = 'simple' | 'advanced';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  simpleCatalog: SimpleRelationDef[];
  advancedCatalog: AdvancedRelationDef[];
  initialMode?: Mode;
  onPick: (kind: Mode, ruleId: string) => void;
};

function fallbackCopy(label: string): { lead: string; detail: string; tone: 'week'; emoji: string } {
  return { lead: label, detail: 'Koşulları tanımlamak için alttaki düğmeye basın.', tone: 'week', emoji: '📖' };
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
  const [onlySupported, setOnlySupported] = useState(false);
  const [ruleId, setRuleId] = useState('');

  const catalogReady = simpleCatalog.length > 0 || advancedCatalog.length > 0;

  const list = useMemo(() => {
    const src = mode === 'simple' ? simpleCatalog : advancedCatalog;
    return onlySupported ? src.filter((r) => r.solver_supported) : src;
  }, [mode, simpleCatalog, advancedCatalog, onlySupported]);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setOnlySupported(false);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const src = initialMode === 'simple' ? simpleCatalog : advancedCatalog;
    const preferred = src[0]?.id ?? '';
    setRuleId((prev) => {
      const inSimple = simpleCatalog.some((r) => r.id === prev);
      const inAdv = advancedCatalog.some((r) => r.id === prev);
      if (mode === 'simple' && inSimple && list.some((r) => r.id === prev)) return prev;
      if (mode === 'advanced' && inAdv && list.some((r) => r.id === prev)) return prev;
      return list[0]?.id ?? preferred;
    });
  }, [open, initialMode, mode, list, simpleCatalog, advancedCatalog]);

  const picked =
    mode === 'simple'
      ? simpleCatalog.find((r) => r.id === ruleId)
      : advancedCatalog.find((r) => r.id === ruleId);

  const pickedCopy = picked
    ? (listCopy(picked.id, mode) ?? fallbackCopy(picked.label_tr))
    : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent
        scrollBody={false}
        className="max-h-[min(90vh,680px)] max-w-md flex-col gap-0 p-0 [--dd-accent:45_139_158]"
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border/80 px-4 py-3">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-base font-semibold tracking-tight">
              Kural seç
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Maddeye tıklayın; özet altta görünür.{' '}
              <Link href="/ders-dagit/studyo/kurallar" className="text-primary hover:underline">
                Okul kuralları
              </Link>
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
            aria-label="Kapat"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="shrink-0 space-y-2 border-b border-border/60 px-4 py-2.5">
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
        </div>

        <div
          className="min-h-[140px] flex-1 overflow-y-auto overscroll-contain"
          role="radiogroup"
          aria-label="Planlama kuralı"
        >
          {!catalogReady ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Kural listesi yüklenemedi. Sayfayı yenileyin veya stüdyo seçili olduğundan emin olun.
            </p>
          ) : list.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Bu filtrede madde yok. Filtreyi kapatın.
            </p>
          ) : (
            <ol className="m-0 list-none p-0">
              {list.map((r) => {
                const school = planningCatalogRuleLabel(r.catalog_key);
                const copy = listCopy(r.id, mode) ?? fallbackCopy(r.label_tr);
                return (
                  <PlanningRuleListItem
                    key={r.id}
                    selected={ruleId === r.id}
                    onSelect={() => setRuleId(r.id)}
                    title={r.label_tr}
                    copy={copy}
                    schoolRule={school}
                    supported={r.solver_supported}
                  />
                );
              })}
            </ol>
          )}
        </div>

        <div className="min-w-0 shrink-0 space-y-2 border-t border-border/80 bg-muted/20 px-4 py-3">
          {picked && pickedCopy ? (
            <PlanningRuleInfoCard
              title={picked.label_tr}
              copy={pickedCopy}
              schoolRule={planningCatalogRuleLabel(picked.catalog_key)}
              supported={picked.solver_supported}
            />
          ) : (
            <p className="text-center text-xs text-muted-foreground">Listeden bir kural seçin.</p>
          )}

          <DialogFooter className="flex-col items-stretch gap-2 pt-0 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/ders-dagit/studyo/kurallar"
              className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
            >
              <Scale className="h-3.5 w-3.5" />
              Okul kuralları
            </Link>
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <DdAccentButton
                type="button"
                size="sm"
                disabled={!ruleId || !catalogReady}
                onClick={() => {
                  onPick(mode, ruleId);
                  onOpenChange(false);
                }}
              >
                Koşulları tanımla
              </DdAccentButton>
            </div>
          </DialogFooter>
        </div>
      </DdDialogContent>
    </Dialog>
  );
}
