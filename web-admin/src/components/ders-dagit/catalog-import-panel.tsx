'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import {
  downloadTtkbCsv,
  schoolTypeLabel,
  type SchoolCatalogPreview,
  type TtkbPreview,
} from '@/lib/dersler-studio';
import { Button } from '@/components/ui/button';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DD_CARD_CONTENT,
  DD_CARD_HEADER,
} from '@/components/ders-dagit/dd-ui';
import { cn } from '@/lib/utils';
import { Building2, Download, Library } from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'ttkb' | 'school';

type Props = {
  schoolType: string;
  onImported: () => void | Promise<void>;
};

function GradeChips({
  grades,
  selected,
  onChange,
}: {
  grades: number[];
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  if (!grades.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {grades.map((g) => {
        const on = selected.has(g);
        return (
          <button
            key={g}
            type="button"
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            )}
            onClick={() => {
              const next = new Set(selected);
              if (next.has(g)) next.delete(g);
              else next.add(g);
              onChange(next);
            }}
          >
            {g}. sınıf
          </button>
        );
      })}
      <button
        type="button"
        className="text-xs text-primary underline"
        onClick={() => onChange(new Set(grades))}
      >
        Tümü
      </button>
    </div>
  );
}

function SummaryTable({ preview }: { preview: TtkbPreview | SchoolCatalogPreview | null }) {
  if (!preview?.subject_summary?.length) return null;
  const grades = Object.keys(preview.by_grade ?? {})
    .map(Number)
    .sort((a, b) => a - b);
  return (
    <div className="overflow-x-auto rounded-md border text-xs">
      <table className="w-full min-w-[480px]">
        <thead className="bg-muted/50 text-left text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Ders</th>
            {grades.map((g) => (
              <th key={g} className="px-2 py-1.5 tabular-nums">
                {g}. sn
              </th>
            ))}
            <th className="px-2 py-1.5">Şube</th>
          </tr>
        </thead>
        <tbody>
          {preview.subject_summary.slice(0, 40).map((row) => (
            <tr key={row.subject_code} className="border-t">
              <td className="px-2 py-1 font-medium">{row.subject_name}</td>
              {grades.map((g) => (
                <td key={g} className="px-2 py-1 tabular-nums text-muted-foreground">
                  {row.hours_by_grade[g] ?? '—'}
                </td>
              ))}
              <td className="px-2 py-1 tabular-nums">{row.section_count || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CatalogImportPanel({ schoolType, onImported }: Props) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [tab, setTab] = useState<Tab>('ttkb');
  const [busy, setBusy] = useState(false);

  const [ttkbPreview, setTtkbPreview] = useState<TtkbPreview | null>(null);
  const [gradeSel, setGradeSel] = useState<Set<number>>(new Set());
  const [ttkbReplace, setTtkbReplace] = useState(false);
  const [ttkbSync, setTtkbSync] = useState(false);

  const [schoolPreview, setSchoolPreview] = useState<SchoolCatalogPreview | null>(null);
  const [schoolMode, setSchoolMode] = useState<'subjects_with_ttkb_hours' | 'subjects_only'>(
    'subjects_with_ttkb_hours',
  );
  const [schoolReplace, setSchoolReplace] = useState(false);
  const [schoolSync, setSchoolSync] = useState(false);

  const grades = useMemo(
    () => ttkbPreview?.grades ?? [],
    [ttkbPreview?.grades],
  );

  useEffect(() => {
    if (grades.length) setGradeSel(new Set(grades));
  }, [grades.join(',')]);

  const previewTtkb = useCallback(
    async (download = false) => {
      if (!token || !studio) return;
      setBusy(true);
      try {
        const gq =
          gradeSel.size && gradeSel.size < grades.length
            ? `?grades=${[...gradeSel].sort((a, b) => a - b).join(',')}`
            : '';
        const data = await apiFetch<TtkbPreview>(
          `/ders-dagit/studios/${studio.id}/seed/ttkb/preview${gq}`,
          { token },
        );
        setTtkbPreview(data);
        if (!data.cell_count) {
          toast.error(data.empty_message ?? 'Liste boş');
          return;
        }
        if (!download) {
          toast.success(
            `${data.subject_count} ders · ${data.cell_count} şube satırı (${schoolTypeLabel(data.school_type)})`,
          );
        } else {
          downloadTtkbCsv(data, schoolTypeLabel(data.school_type));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'TTKB önizleme başarısız');
      } finally {
        setBusy(false);
      }
    },
    [token, studio, gradeSel, grades.length],
  );

  const saveTtkb = useCallback(async () => {
    if (!token || !studio || !ttkbPreview?.cell_count) return;
    setBusy(true);
    try {
      const grades =
        gradeSel.size && gradeSel.size < (ttkbPreview.grades?.length ?? 0)
          ? [...gradeSel]
          : undefined;
      const r = await apiFetch<{ created: number; updated: number; assignments_created?: number }>(
        `/ders-dagit/studios/${studio.id}/seed/ttkb`,
        {
          token,
          method: 'POST',
          body: { replace: ttkbReplace, sync_assignments: ttkbSync, grades },
        },
      );
      toast.success(
        `Katalog: +${r.created} / ~${r.updated}${ttkbSync ? ` · ${r.assignments_created ?? 0} atama` : ''}`,
      );
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setBusy(false);
    }
  }, [token, studio, ttkbPreview, ttkbReplace, ttkbSync, gradeSel, onImported]);

  const previewSchool = useCallback(async () => {
    if (!token || !studio) return;
    setBusy(true);
    try {
      const data = await apiFetch<SchoolCatalogPreview>(
        `/ders-dagit/studios/${studio.id}/seed/school-catalog/preview`,
        { token },
      );
      setSchoolPreview(data);
      if (!data.class_count && !data.school_subject_count) {
        toast.error('Sınıf–Ders modülünde kayıt yok');
        return;
      }
      toast.success(`${data.class_count} sınıf · ${data.school_subject_count} ders`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Önizleme başarısız');
    } finally {
      setBusy(false);
    }
  }, [token, studio]);

  const saveSchool = useCallback(async () => {
    if (!token || !studio) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ created: number; updated: number; assignments_created?: number }>(
        `/ders-dagit/studios/${studio.id}/seed/school-catalog`,
        {
          token,
          method: 'POST',
          body: {
            mode: schoolMode,
            replace: schoolReplace,
            sync_assignments: schoolSync,
          },
        },
      );
      toast.success(
        `Aktarıldı: +${r.created}${schoolSync ? ` · ${r.assignments_created ?? 0} atama` : ''}`,
      );
      await onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktarım başarısız');
    } finally {
      setBusy(false);
    }
  }, [token, studio, schoolMode, schoolReplace, schoolSync, onImported]);

  return (
    <DdCard variant="sky" className="overflow-hidden">
      <CardHeader className={cn(DD_CARD_HEADER, 'pb-2')}>
        <CardTitle className="text-base">Ders kataloğu içe aktar</CardTitle>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={tab === 'ttkb' ? 'default' : 'outline'}
            onClick={() => setTab('ttkb')}
          >
            <Download className="mr-1 size-3.5" />
            TTKB / Maarif
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tab === 'school' ? 'default' : 'outline'}
            onClick={() => setTab('school')}
          >
            <Building2 className="mr-1 size-3.5" />
            Okul sınıf & ders
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
        {tab === 'ttkb' ? (
          <>
            <p className="text-xs text-muted-foreground">
              Kurum türü: <strong>{schoolTypeLabel(schoolType)}</strong>. Şubelerinize göre sınıf
              seviyesinde TTKB saatleri; kayıtta şube planı dolar.
            </p>
            <GradeChips grades={grades} selected={gradeSel} onChange={setGradeSel} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void previewTtkb(false)}>
                Önizle
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void previewTtkb(true)}>
                CSV
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || !ttkbPreview?.cell_count}
                onClick={() => void saveTtkb()}
              >
                Kataloğa kaydet
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={ttkbReplace} onChange={(e) => setTtkbReplace(e.target.checked)} />
              Mevcut dersleri değiştir
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={ttkbSync} onChange={(e) => setTtkbSync(e.target.checked)} />
              Atamaları da oluştur
            </label>
            {ttkbPreview?.sections_without_grade?.length ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300">
                Sınıf numarası okunamayan şubeler: {ttkbPreview.sections_without_grade.slice(0, 5).join(', ')}
                {ttkbPreview.sections_without_grade.length > 5 ? '…' : ''}
              </p>
            ) : null}
            {ttkbPreview?.cell_count ? (
              <p className="text-xs text-muted-foreground">
                {ttkbPreview.subject_count} ders · {ttkbPreview.cell_count} satır
                {ttkbPreview.mode === 'sections' ? ' (şubeli)' : ''}
              </p>
            ) : null}
            <SummaryTable preview={ttkbPreview} />
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              <Library className="mr-1 inline size-3.5" />
              Sınıf–Ders modülündeki gruplar ve ders listesi. TTKB saatleri okul şubelerine göre
              eşlenir.
            </p>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="school-mode"
                checked={schoolMode === 'subjects_with_ttkb_hours'}
                onChange={() => setSchoolMode('subjects_with_ttkb_hours')}
              />
              Ders adları + TTKB şube saatleri (önerilen)
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="radio"
                name="school-mode"
                checked={schoolMode === 'subjects_only'}
                onChange={() => setSchoolMode('subjects_only')}
              />
              Yalnızca okul ders adları (saatleri sonra girersiniz)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void previewSchool()}>
                Önizle
              </Button>
              <Button type="button" size="sm" disabled={busy} onClick={() => void saveSchool()}>
                Kataloğa aktar
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={schoolReplace} onChange={(e) => setSchoolReplace(e.target.checked)} />
              Mevcut dersleri değiştir
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={schoolSync} onChange={(e) => setSchoolSync(e.target.checked)} />
              Atamaları da oluştur
            </label>
            {schoolPreview ? (
              <p className="text-xs text-muted-foreground">
                {schoolPreview.class_count} sınıf/grup · {schoolPreview.school_subject_count} okul dersi
                {schoolPreview.ttkb_cell_count
                  ? ` · ${schoolPreview.ttkb_subject_count} ders TTKB ile eşlendi`
                  : ''}
              </p>
            ) : null}
            <SummaryTable preview={schoolPreview} />
          </>
        )}
      </CardContent>
    </DdCard>
  );
}
