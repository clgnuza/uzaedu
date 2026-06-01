'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { DdInfoHint } from '@/components/ders-dagit/dd-info-hint';
import { TeacherAvailabilityAdminSettings } from '@/components/ders-dagit/teacher-availability-admin-settings';
import { TeacherAvailabilityAdminQueue } from '@/components/ders-dagit/teacher-availability-admin-queue';
import { StudioSettingsLinks } from '@/components/ders-dagit/studio-settings-links';
import { Button } from '@/components/ui/button';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';

const WORK_DAYS = [1, 2, 3, 4, 5];

export default function StudioAyarlarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const { maxLessons } = useSchoolTimetableSettings();
  const [settingsTick, setSettingsTick] = useState(0);

  return (
    <div className={DD_PAGE}>
      <div className="flex items-start gap-2">
        <DdPageHeader
          icon={SlidersHorizontal}
          title="Ayarlar"
          description="Program öncesi okul tercihleri ve modül sayfalarına kısayollar."
          className="flex-1"
        />
        <DdInfoHint label="Ayarlar sayfası" title="Program merkezi ayarları">
          <p>
            Öğretmen müsaitlik toplama buradan açılır. Diğer kartlar kurulum, veri ve program adımlarına gider.
          </p>
        </DdInfoHint>
      </div>

      {token && studio && (
        <section id="ogretmen-musaitlik" className="scroll-mt-20 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Öğretmen müsaitlik tercihleri</h2>
              <p className="text-xs text-muted-foreground">
                Program üretilmeden önce öğretmenler uygun olmadıkları saatleri bildirir.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ders-dagit/studyo/ogretmen-tercihleri">
                Tam ekran onay sayfası
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </div>
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
        </section>
      )}

      <StudioSettingsLinks />
    </div>
  );
}
