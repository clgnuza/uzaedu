'use client';

import { cn } from '@/lib/utils';
import type { OptikFormTemplate } from '@/lib/optik-form-templates';
import { OPTIK_EXAM_LABELS, optikExamPaletteKey } from '@/lib/optik-form-templates';
import { isOptikMcTemplate } from '@/lib/optik-api';
import { CheckCircle2, ClipboardList, Download, FilePlus2, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export function OptikTemplateStrip({
  templates,
  selectedId,
  onSelect,
  onDownload,
  onDownloadYazili,
  downloading,
}: {
  templates: OptikFormTemplate[];
  selectedId: string;
  onSelect: (id: string) => void;
  onDownload: () => void;
  onDownloadYazili: () => void;
  downloading: boolean;
}) {
  const selected = templates.find((t) => t.id === selectedId);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ClipboardList className="size-4 text-fuchsia-600 dark:text-fuchsia-400" />
          Form şablonu
        </h2>
        {selected ? (
          <span className="text-[10px] text-muted-foreground">
            {selected.questionCount} soru · {selected.choiceCount} şık
          </span>
        ) : null}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
        {templates.map((t) => {
          const active = t.id === selectedId;
          const exam = optikExamPaletteKey(t.examType);
          const mc = isOptikMcTemplate(t);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={cn(
                'min-w-[148px] max-w-[180px] shrink-0 rounded-xl border p-2.5 text-left transition-all active:scale-[0.98]',
                active
                  ? 'border-fuchsia-500/60 bg-fuchsia-500/12 shadow-md shadow-fuchsia-500/15 ring-2 ring-fuchsia-500/30'
                  : 'border-border/80 bg-card hover:border-fuchsia-400/40',
              )}
            >
              <div className="mb-1 flex items-start justify-between gap-1">
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                    exam === 'yazili' && 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
                    exam === 'deneme' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
                    exam === 'quiz' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                    exam !== 'yazili' && exam !== 'deneme' && exam !== 'quiz' && 'bg-violet-500/15 text-violet-800 dark:text-violet-200',
                  )}
                >
                  {OPTIK_EXAM_LABELS[t.examType ?? 'genel'] ?? 'Genel'}
                </span>
                {active ? <CheckCircle2 className="size-4 shrink-0 text-fuchsia-600" /> : null}
              </div>
              <p className="line-clamp-2 text-xs font-semibold leading-tight">{t.name}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                {mc ? <ListChecks className="size-3" /> : <FilePlus2 className="size-3" />}
                {mc ? 'Çoktan seçmeli' : 'Açık uçlu'}
              </p>
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 rounded-xl text-xs"
            disabled={downloading}
            onClick={onDownload}
          >
            {downloading ? <LoadingSpinner className="size-3.5" /> : <Download className="size-3.5" />}
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 gap-1.5 rounded-xl text-xs"
            disabled={downloading}
            onClick={onDownloadYazili}
          >
            {downloading ? <LoadingSpinner className="size-3.5" /> : <FilePlus2 className="size-3.5" />}
            Yazılı+Form
          </Button>
        </div>
      ) : null}
    </section>
  );
}
