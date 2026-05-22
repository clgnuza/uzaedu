'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { TimetableReadonly } from '@/components/timetable/TimetableReadonly';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';

export default function PublicPaylasimPage() {
  const { token: shareToken } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section') ?? '';
  const [section, setSection] = useState(sectionParam);
  const [data, setData] = useState<{
    program: { name: string | null; academic_year?: string; studio_name?: string | null };
    class_sections: string[];
    entries: Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const base = resolveDefaultApiBase().replace(/\/$/, '');
    const q = section.trim() ? `?section=${encodeURIComponent(section.trim())}` : '';
    fetch(`${base}/ders-dagit/public/share/${shareToken}${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Program bulunamadı');
        return r.json();
      })
      .then((d) => {
        setData(d);
        if (!section && d.class_sections?.[0]) setSection(d.class_sections[0]);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, [shareToken, section]);

  if (err) return <p className="p-6 text-sm text-destructive">{err}</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Yükleniyor…</p>;

  const pdfUrl = section.trim()
    ? `${resolveDefaultApiBase().replace(/\/$/, '')}/ders-dagit/public/share/${shareToken}/parent.pdf?section=${encodeURIComponent(section.trim())}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">{data.program.name ?? 'Ders programı'}</h1>
      <p className="text-sm text-muted-foreground">
        {data.program.studio_name} · {data.program.academic_year}
      </p>
      {data.class_sections.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {data.class_sections.map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded-md px-3 py-1 text-sm ${section === s ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {pdfUrl && (
        <a href={pdfUrl} className="text-sm text-primary underline" download>
          PDF indir ({section})
        </a>
      )}
      <TimetableReadonly entries={data.entries} classSection={section || undefined} />
    </div>
  );
}
