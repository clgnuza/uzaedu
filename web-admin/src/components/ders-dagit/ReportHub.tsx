'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { downloadDersDagitExport, openInstitutionDocumentPdf } from '@/lib/ders-dagit-api';
import { listStudioPrograms } from '@/lib/ders-dagit-program-api';
import { downloadParentAllZip } from '@/lib/ders-dagit-timetable-api';
import { REPORT_GROUPS, type ReportItemDef } from '@/lib/ders-dagit-reports-catalog';
import { buildProgramPrintUrl } from '@/lib/timetable-print-nav';
import {
  fetchReportSettings,
  loadReportPrintMode,
  type StudioReportSettings,
} from '@/lib/ders-dagit-report-settings';
import { ReportGroupCard } from '@/components/ders-dagit/ReportGroupCard';
import { ReportPrintSettings } from '@/components/ders-dagit/ReportPrintSettings';
import { SchoolReportTextsForm } from '@/components/ders-dagit/SchoolReportTextsForm';
import { DdSelectField, DD_PAGE, DdPageHeader } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileText } from 'lucide-react';

export function ReportHub() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [programs, setPrograms] = useState<Array<{ id: string; name: string | null }>>([]);
  const [programId, setProgramId] = useState('');
  const [parentSection, setParentSection] = useState('5A');
  const [reportSettings, setReportSettings] = useState<StudioReportSettings | null>(null);

  const loadPrograms = useCallback(async () => {
    if (!token || !studio) return;
    const list = await listStudioPrograms(token, studio.id);
    const active = list.filter((p) => !p.archived_at);
    setPrograms(active);
    setProgramId((prev) => prev || active[0]?.id || '');
  }, [token, studio]);

  useEffect(() => {
    void loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    if (!token || !studio) return;
    void fetchReportSettings(token, studio.id).then(setReportSettings);
  }, [token, studio?.id]);

  useEffect(() => {
    const q = searchParams.get('program');
    if (q) setProgramId(q);
  }, [searchParams]);

  const programOptions = useMemo(
    () =>
      programs.map((p) => ({
        value: p.id,
        label: p.name?.trim() || `Program ${p.id.slice(0, 8)}`,
      })),
    [programs],
  );

  const hasProgram = Boolean(programId);
  const settings = reportSettings;

  async function handleAction(item: ReportItemDef) {
    if (!token || !studio || !programId) {
      toast.error('Önce bir program seçin');
      return;
    }
    const mode = loadReportPrintMode();

    try {
      if (item.kind === 'download' && item.exportKind) {
        await downloadDersDagitExport(token, studio.id, programId, item.exportKind, undefined, mode);
        toast.success('İndirme başlatıldı');
        return;
      }
      if (item.kind === 'parent-pdf') {
        await downloadDersDagitExport(
          token,
          studio.id,
          programId,
          'parent_pdf',
          parentSection.trim() || '5A',
          mode,
        );
        toast.success('Veli PDF indirildi');
        return;
      }
      if (item.kind === 'parent-zip') {
        await downloadParentAllZip(token, studio.id, programId);
        toast.success('Veli ZIP indirildi');
        return;
      }
      if (item.kind === 'print-cover') {
        await openInstitutionDocumentPdf(token, studio.id, programId, 'cover', mode);
        toast.message('Kapak PDF açıldı', { description: 'Tarayıcıdan yazdırabilirsiniz (Ctrl+P).' });
        return;
      }
      if (item.kind === 'print-approval') {
        await openInstitutionDocumentPdf(token, studio.id, programId, 'approval', mode);
        toast.message('Onay bloğu PDF açıldı', { description: 'Tarayıcıdan yazdırabilirsiniz (Ctrl+P).' });
        return;
      }
      if (item.kind === 'program-print') {
        const view = item.view ?? 'class';
        if (view !== 'class' && view !== 'teacher' && view !== 'room') {
          toast.error('Geçersiz yazdırma görünümü');
          return;
        }
        router.push(buildProgramPrintUrl(programId, view));
        toast.message('Program editörü açıldı', {
          description: 'Haftalık ızgara yüklendikten sonra yazdırma penceresi açılır.',
        });
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  }

  if (!studio) {
    return <p className="text-sm text-muted-foreground">Stüdyo yükleniyor…</p>;
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={FileText}
        title="Yazdır / Raporlar"
        description="MEB okul uygulamasına uygun program çıktıları, kurul belgeleri ve e-Okul aktarımı."
      />

      {!programs.length ? (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">Henüz program yok. Önce program oluşturun.</p>
          <Button className="mt-3" asChild>
            <Link href="/ders-dagit/studyo/uret">Program üret</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-end">
            <DdSelectField
              label="Aktif program"
              className="min-w-[12rem] flex-1"
              value={programId}
              onValueChange={setProgramId}
              options={programOptions}
            />
            <div className="space-y-1">
              <Label className="text-xs">Veli PDF şubesi</Label>
              <Input
                className="h-9 w-24"
                value={parentSection}
                onChange={(e) => setParentSection(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/ders-dagit/studyo/program?id=${programId}`}>Program editörü</Link>
            </Button>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              {REPORT_GROUPS.map((group) => (
                <ReportGroupCard
                  key={group.id}
                  group={group}
                  disabled={!hasProgram}
                  onAction={(item) => void handleAction(item)}
                />
              ))}
            </div>
            <div className="space-y-3">
              <ReportPrintSettings />
              <SchoolReportTextsForm onSaved={setReportSettings} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
