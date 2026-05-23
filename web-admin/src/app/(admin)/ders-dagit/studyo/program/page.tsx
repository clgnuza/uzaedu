'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TimetableShell } from '@/components/timetable/TimetableShell';
import { TimetablePublishPanel } from '@/components/timetable/TimetablePublishPanel';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function ProgramEditorInner() {
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
        onProgramIdChange={setActiveProgramId}
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
