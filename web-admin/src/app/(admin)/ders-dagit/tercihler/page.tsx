'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useSchoolTimetableSettings } from '@/hooks/use-school-timetable-settings';
import { TeacherAvailabilityTeacherView } from '@/components/ders-dagit/teacher-availability-teacher-view';
import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import Link from 'next/link';
const WORK_DAYS = [1, 2, 3, 4, 5];

export default function TercihlerPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const { studio } = useDersDagitStudio();
  const { maxLessons } = useSchoolTimetableSettings();

  useEffect(() => {
    if (me?.role === 'school_admin') router.replace('/ders-dagit/studyo/ayarlar#ogretmen-musaitlik');
  }, [me?.role, router]);

  if (me?.role === 'school_admin') return null;

  if (!token || !studio) {
    return (
      <div className={DD_PAGE}>
        <DdPageHeader title="Müsaitlik tercihleri" description="DersDağıt stüdyosu yükleniyor…" />
      </div>
    );
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        title="Müsaitlik tercihleri"
        description="Uygun olmadığınız saatleri işaretleyin; durumunuzu aşağıdaki akıştan takip edin."
      />
      <p className="text-xs text-muted-foreground">
        İpuçları: önce taslak kaydedin, sonra idare onayı gerekiyorsa gönderin. Kararlar{' '}
        <Link href="/bildirimler?filter=timetable" className="font-medium text-primary underline-offset-2 hover:underline">
          Ders programı bildirimleri
        </Link>{' '}
        kanalında da görünür. Yayınlanmış programa{' '}
        <Link href="/ders-programi/programlarim" className="font-medium text-primary underline-offset-2 hover:underline">
          Programlarım
        </Link>{' '}
        üzerinden bakabilirsiniz.
      </p>
      <TeacherAvailabilityTeacherView
        token={token}
        studioId={studio.id}
        workDays={WORK_DAYS}
        maxLessons={maxLessons}
      />
    </div>
  );
}
