'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  OPTIK_EXAM_CARD_STYLES,
  OPTIK_EXAM_LABELS,
  OPTIK_EXAM_ROW_STYLES,
  optikExamPaletteKey,
  optikScopeLabel,
  type OptikFormTemplate,
} from '@/lib/optik-form-templates';
import { cn } from '@/lib/utils';
import { Download, FileText, Pencil, Trash2 } from 'lucide-react';

type Props = {
  items: OptikFormTemplate[];
  totalCount: number;
  downloadingId: string | null;
  canModify: (item: OptikFormTemplate) => boolean;
  onDownload: (item: OptikFormTemplate, prependBlank?: number) => void;
  onEdit: (item: OptikFormTemplate) => void;
  onDelete: (item: OptikFormTemplate) => void;
};

export function OptikFormTemplateList({
  items,
  totalCount,
  downloadingId,
  canModify,
  onDownload,
  onEdit,
  onDelete,
}: Props) {
  const emptyTitle = totalCount === 0 ? 'Henüz form şablonu yok' : 'Eşleşen form yok';
  const emptyDesc =
    totalCount === 0
      ? 'Sistem şablonları süper admin tarafından eklenir. Okul veya öğretmen özel şablon da oluşturabilir.'
      : 'Arama veya filtreyi değiştirin.';

  const metaBits = (item: OptikFormTemplate) => {
    const bits = [
      OPTIK_EXAM_LABELS[item.examType ?? 'genel'] ?? item.examType,
      `${item.questionCount} soru · ${item.choiceCount} şık`,
      optikScopeLabel(item.scope),
    ];
    if (item.gradeLevel) bits.push(item.gradeLevel);
    if (item.subjectHint) bits.push(item.subjectHint);
    return bits;
  };

  const actionButtons = (item: OptikFormTemplate, compact?: boolean) => {
    const busy = downloadingId === item.id;
    const mod = canModify(item);
    return (
      <div className={cn('flex flex-wrap gap-1', compact ? 'mt-2' : 'items-center justify-end')}>
        {mod && (
          <>
            <Button variant="ghost" size="sm" className={compact ? 'h-8 px-2' : ''} onClick={() => onEdit(item)} title="Düzenle">
              <Pencil className="size-3.5 sm:size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('text-destructive hover:text-destructive', compact && 'h-8 px-2')}
              onClick={() => onDelete(item)}
              title="Sil"
            >
              <Trash2 className="size-3.5 sm:size-4" />
            </Button>
          </>
        )}
        <Button
          variant={compact ? 'secondary' : 'ghost'}
          size="sm"
          className={compact ? 'h-8 min-w-0 flex-1 px-2 text-[11px]' : ''}
          disabled={!!downloadingId}
          onClick={() => onDownload(item)}
          title="Sadece optik form"
        >
          {busy ? <LoadingSpinner className="size-3.5 sm:size-4" /> : <Download className="size-3 sm:size-4" />}
          <span className="ml-1">PDF</span>
        </Button>
        {(item.examType ?? 'genel') === 'yazili' && (
          <Button
            variant="outline"
            size="sm"
            className={compact ? 'h-8 min-w-0 flex-1 px-2 text-[11px]' : ''}
            disabled={!!downloadingId}
            onClick={() => onDownload(item, 1)}
            title="Yazılı sorular için önce boş sayfa"
          >
            +Boş sayfa
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-1.5 sm:hidden">
        {items.map((item) => {
          const pk = optikExamPaletteKey(item.examType);
          return (
            <div
              key={item.id}
              className={cn(
                'rounded-lg border border-y border-r border-border/60 border-l-[3px] p-2 shadow-sm ring-1 ring-black/2 dark:ring-white/4',
                OPTIK_EXAM_CARD_STYLES[pk],
              )}
            >
              <p className="text-xs font-semibold leading-snug text-foreground">{item.name}</p>
              {item.description ? (
                <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{item.description}</p>
              ) : null}
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                {metaBits(item).map((b, i) => (
                  <span key={i}>{b}</span>
                ))}
              </div>
              {actionButtons(item, true)}
            </div>
          );
        })}
        {items.length === 0 && (
          <EmptyState icon={<FileText className="size-10 text-muted-foreground" />} title={emptyTitle} description={emptyDesc} />
        )}
      </div>

      <div className="table-x-scroll hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="p-2.5 text-left font-semibold">Ad</th>
              <th className="p-2.5 text-left font-semibold">Tür</th>
              <th className="p-2.5 text-right font-semibold">Soru</th>
              <th className="p-2.5 text-right font-semibold">Şık</th>
              <th className="p-2.5 text-left font-semibold">Sınıf / Ders</th>
              <th className="p-2.5 text-left font-semibold">Kaynak</th>
              <th className="p-2.5" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const pk = optikExamPaletteKey(item.examType);
              const gradeSubject = [item.gradeLevel, item.subjectHint].filter(Boolean).join(' · ') || '—';
              return (
                <tr key={item.id} className={cn('border-b border-border/50 transition-colors', OPTIK_EXAM_ROW_STYLES[pk])}>
                  <td className="p-2.5">
                    <span className="font-medium">{item.name}</span>
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </td>
                  <td className="p-2.5">{OPTIK_EXAM_LABELS[item.examType ?? 'genel'] ?? item.examType}</td>
                  <td className="p-2.5 text-right tabular-nums">{item.questionCount}</td>
                  <td className="p-2.5 text-right tabular-nums">{item.choiceCount}</td>
                  <td className="p-2.5 text-muted-foreground">{gradeSubject}</td>
                  <td className="p-2.5 text-muted-foreground">{optikScopeLabel(item.scope)}</td>
                  <td className="p-2.5">{actionButtons(item)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <EmptyState icon={<FileText className="size-10 text-muted-foreground" />} title={emptyTitle} description={emptyDesc} />
        )}
      </div>
    </>
  );
}
