'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  PublicShareView,
  type PublicSharePayload,
} from '@/components/ders-dagit/public-share/PublicShareView';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function PublicPaylasimInner() {
  const { token: shareToken } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section') ?? '';
  const [section, setSection] = useState(sectionParam);
  const [data, setData] = useState<PublicSharePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const base = resolveDefaultApiBase().replace(/\/$/, '');
    const q = section.trim() ? `?section=${encodeURIComponent(section.trim())}` : '';
    fetch(`${base}/ders-dagit/public/share/${shareToken}${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Program bulunamadı veya paylaşım kapalı');
        return r.json() as Promise<PublicSharePayload>;
      })
      .then((d) => {
        setData(d);
        const next =
          sectionParam && d.class_sections.includes(sectionParam)
            ? sectionParam
            : d.class_section ?? d.class_sections[0] ?? '';
        setSection(next);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, [shareToken, section, sectionParam]);

  const pdfUrl = useMemo(() => {
    if (!shareToken || !section.trim()) return null;
    const base = resolveDefaultApiBase().replace(/\/$/, '');
    return `${base}/ders-dagit/public/share/${shareToken}/parent.pdf?section=${encodeURIComponent(section.trim())}`;
  }, [shareToken, section]);

  if (err) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <p className="max-w-md rounded-xl border border-destructive/30 bg-white px-6 py-4 text-center text-sm text-destructive shadow-sm">
          {err}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <LoadingSpinner label="Program yükleniyor…" />
      </div>
    );
  }

  return (
    <PublicShareView
      data={data}
      section={section}
      onSectionChange={setSection}
      pdfUrl={pdfUrl}
    />
  );
}

export default function PublicPaylasimPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      }
    >
      <PublicPaylasimInner />
    </Suspense>
  );
}
