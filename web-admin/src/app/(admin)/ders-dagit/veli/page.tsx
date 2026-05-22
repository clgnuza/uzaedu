'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { DdCard, CardContent, CardHeader, CardTitle, DdPageHeader, DD_PAGE, DD_CARD_HEADER, DD_CARD_CONTENT } from '@/components/ders-dagit/dd-ui';
import { DdSectionField } from '@/components/ders-dagit/dd-section-picker';
import { Button } from '@/components/ui/button';
import { TimetableReadonly } from '@/components/timetable/TimetableReadonly';
import { sortClassSections } from '@/lib/class-section-sort';
import { downloadDersDagitExport } from '@/lib/ders-dagit-api';
import { toast } from 'sonner';

type Program = { id: string; name: string | null; status: string };

export default function VeliProgramPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classSection, setClassSection] = useState('');
  const [entries, setEntries] = useState<
    Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>
  >([]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const list = await apiFetch<Program[]>(`/ders-dagit/studios/${studio.id}/programs`, { token });
    const pub = list.filter((p) => p.status === 'published');
    setPrograms(pub);
    const sec = classSection || '5A';
    const res = await apiFetch<{
      ready: boolean;
      entries: Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>;
      class_section?: string;
    }>(`/ders-dagit/studios/${studio.id}/published-class?section=${encodeURIComponent(sec)}`, { token });
    if (res.ready && res.entries.length) {
      setEntries(res.entries);
      if (res.class_section) setClassSection(res.class_section);
    } else if (pub[0]) {
      const detail = await apiFetch<{
        entries: Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>;
      }>(`/ders-dagit/studios/${studio.id}/programs/${pub[0].id}`, { token });
      setEntries(detail.entries);
      const sections = sortClassSections([...new Set(detail.entries.map((e) => e.class_section))]);
      if (sections[0]) setClassSection(sections[0]);
    }
  }, [token, studio]);

  useEffect(() => {
    if (!token || !studio || !classSection) return;
    void apiFetch<{
      ready: boolean;
      entries: Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>;
    }>(`/ders-dagit/studios/${studio.id}/published-class?section=${encodeURIComponent(classSection)}`, { token }).then(
      (res) => {
        if (res.ready) setEntries(res.entries);
      },
    );
  }, [token, studio, classSection]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = classSection ? entries.filter((e) => e.class_section === classSection) : entries;
  const sections = sortClassSections([...new Set(entries.map((e) => e.class_section))]);

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        title="Sınıf programı"
        description="Yayınlanmış okul programı — veli/öğrenci görünümü."
      />
      <DdSectionField
        label="Şube"
        value={classSection}
        onValueChange={setClassSection}
        extraSections={sections}
      />
      {programs[0] && classSection && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            if (!token || !studio) return;
            try {
              await downloadDersDagitExport(token, studio.id, programs[0]!.id, 'parent_pdf', classSection);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'PDF indirilemedi');
            }
          }}
        >
          Veli PDF indir
        </Button>
      )}
      {filtered.length > 0 ? (
        <TimetableReadonly entries={filtered} classSection={classSection} />
      ) : (
        <p className="text-sm text-muted-foreground">Yayınlanmış program yok.</p>
      )}
      {programs[0] && (
        <p className="text-xs text-muted-foreground">Kaynak: {programs[0].name ?? programs[0].id.slice(0, 8)}</p>
      )}
    </div>
  );
}
