'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgramGridPreview } from '@/components/ders-dagit/program-grid-preview';

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
      const sections = [...new Set(detail.entries.map((e) => e.class_section))].sort();
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
  const sections = [...new Set(entries.map((e) => e.class_section))].sort();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Sınıf programı (salt okunur)</h1>
      <p className="text-sm text-muted-foreground">Yayınlanmış okul programı — veli/öğrenci görünümü önizlemesi.</p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şube</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded-md px-3 py-1 text-sm ${classSection === s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => setClassSection(s)}
            >
              {s}
            </button>
          ))}
        </CardContent>
      </Card>
      {filtered.length > 0 ? (
        <ProgramGridPreview entries={filtered} />
      ) : (
        <p className="text-sm text-muted-foreground">Yayınlanmış program yok.</p>
      )}
      {programs[0] && (
        <p className="text-xs text-muted-foreground">Kaynak: {programs[0].name ?? programs[0].id.slice(0, 8)}</p>
      )}
    </div>
  );
}
