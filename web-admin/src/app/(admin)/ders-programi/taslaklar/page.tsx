'use client';

import { DersProgramiSubpageIntro } from '@/components/ders-programi/ders-programi-subpage-intro';
import { SchoolTimetableDraftsPanel } from '@/components/ders-programi/school-timetable-drafts-panel';
import { useAuth } from '@/hooks/use-auth';

export default function TaslaklarPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'school_admin';

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center text-sm text-muted-foreground">
        Bu sayfa yalnızca okul yöneticilerine açıktır.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <DersProgramiSubpageIntro title="Program taslakları" subtitle="Okul programı sayfasındaki Taslaklar sekmesinden de erişebilirsiniz." accent="violet" />
      <SchoolTimetableDraftsPanel />
    </div>
  );
}
