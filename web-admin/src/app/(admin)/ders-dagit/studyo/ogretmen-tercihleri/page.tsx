'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { TeacherAvailabilityAdminSettings } from '@/components/ders-dagit/teacher-availability-admin-settings';
import { TeacherAvailabilityAdminQueue } from '@/components/ders-dagit/teacher-availability-admin-queue';
import { DersDagitStudioNav } from '@/components/ders-dagit/studio-nav';
import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';

const WORK_DAYS = [1, 2, 3, 4, 5];

export default function OgretmenTercihleriPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const { maxLessons } = useSchoolTimetableSettings();
  const [settingsTick, setSettingsTick] = useState(0);

  if (!token || !studio) {
    return (
      <div className={DD_PAGE}>
        <DdPageHeader title="Öğretmen müsaitlik onayı" />
      </div>
    );
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        title="Öğretmen müsaitlik onayı"
        description="Öğretmen talebini ızgarada görün; tam veya kısmi onaylayın."
      />
      <DersDagitStudioNav />
      <TeacherAvailabilityAdminSettings
        token={token}
        studioId={studio.id}
        onUpdated={() => setSettingsTick((n) => n + 1)}
      />
      <TeacherAvailabilityAdminQueue
        token={token}
        studioId={studio.id}
        workDays={WORK_DAYS}
        maxLessons={maxLessons}
        refreshKey={settingsTick}
      />
    </div>
  );
}
