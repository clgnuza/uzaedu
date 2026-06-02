'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { TimetableShell } from '@/components/timetable/TimetableShell';
import { TimetablePublishPanel } from '@/components/timetable/TimetablePublishPanel';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function ProgramEditorInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const programId = sp.get('id') ?? undefined;
  const compareId = sp.get('compare') ?? undefined;
  const viewParam = sp.get('view');
  const initialView =
    viewParam === 'teacher' || viewParam === 'room' || viewParam === 'class' || viewParam === 'all'
      ? viewParam
      : undefined;
  const initialFilter = sp.get('filter') ?? undefined;
  const [activeProgramId, setActiveProgramId] = useState(programId ?? '');
  const showPublish = sp.get('panel') === 'publish';
  const autoPrint = sp.get('print') === '1';

  const onProgramIdChange = useCallback(
    (id: string) => {
      setActiveProgramId(id);
      if (!id) return;
      const params = new URLSearchParams(sp.toString());
      if (params.get('id') === id) return;
      params.set('id', id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, sp],
  );

  useEffect(() => {
    if (programId) setActiveProgramId(programId);
  }, [programId]);

  useEffect(() => {
    if (showPublish) {
      requestAnimationFrame(() =>
        document.getElementById('publish-panel')?.scrollIntoView({ behavior: 'smooth' }),
      );
    }
  }, [showPublish]);

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <TimetableShell
        initialProgramId={programId}
        compareProgramId={compareId}
        initialView={initialView}
        initialFilterId={initialFilter}
        initialAutoPrint={autoPrint}
        onProgramIdChange={onProgramIdChange}
      />
      {!autoPrint && <TimetablePublishPanel programId={activeProgramId} />}
    </div>
  );
}

export default function ProgramEditorPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Program tablosu…" />}>
      <ProgramEditorInner />
    </Suspense>
  );
}
