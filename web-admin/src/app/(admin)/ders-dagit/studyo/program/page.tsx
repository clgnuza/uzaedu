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
  const view = sp.get('view') === 'teacher' ? 'teacher' : sp.get('view') === 'room' ? 'room' : undefined;
  const [activeProgramId, setActiveProgramId] = useState(programId ?? '');
  const showPublish = sp.get('panel') === 'publish';

  useEffect(() => {
    if (showPublish) {
      requestAnimationFrame(() =>
        document.getElementById('publish-panel')?.scrollIntoView({ behavior: 'smooth' }),
      );
    }
  }, [showPublish]);

  return (
    <div className="space-y-4">
      <TimetableShell
        initialProgramId={programId}
        compareProgramId={compareId}
        initialView={view}
        onProgramIdChange={setActiveProgramId}
      />
      <TimetablePublishPanel programId={activeProgramId} />
    </div>
  );
}

export default function ProgramEditorPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Editör…" />}>
      <ProgramEditorInner />
    </Suspense>
  );
}
