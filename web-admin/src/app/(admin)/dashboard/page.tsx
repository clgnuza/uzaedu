'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { useStatsQuery } from '@/hooks/use-stats-query';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, School, Users, ArrowRight, Calculator, Puzzle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TeacherHome } from '@/components/dashboard/teacher-home';
import { SchoolAdminHome } from '@/components/dashboard/school-admin-home';
import { isSchoolModuleEnabled } from '@/components/dashboard/teacher-home';
import { WelcomeMotivationBanner } from '@/components/dashboard/welcome-motivation-banner';
import { useAdminMessagesUnread } from '@/hooks/use-admin-messages-unread';
import { useAllNotificationsUnread } from '@/hooks/use-duty-notifications-unread';
import { SuperadminDashboardShell } from '@/components/dashboard/superadmin-overview';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Süper Admin',
  moderator: 'Moderatör',
  school_admin: 'Okul Yöneticisi',
  teacher: 'Öğretmen',
};

export default function DashboardPage() {
  const { me, token } = useAuth();
  const adminMessagesUnread = useAdminMessagesUnread(token, me?.role ?? null);
  const allNotificationsUnread = useAllNotificationsUnread(token, me?.role ?? null);
  const {
    data: stats,
    isPending: statsPending,
    error: statsQueryError,
  } = useStatsQuery(token);
  const statsError = statsQueryError
    ? statsQueryError instanceof Error
      ? statsQueryError.message
      : 'Yüklenemedi'
    : null;
  const [todayDuty, setTodayDuty] = useState<{ date: string; slots: { user_id: string; area_name: string | null; slot_name: string | null; shift?: string }[] } | null>(null);
  const [teacherPrefs, setTeacherPrefs] = useState<{ id?: string; date: string; status: string }[]>([]);
  const [teacherSwaps, setTeacherSwaps] = useState<{ id: string; status: string; duty_slot?: { date: string; area_name: string | null }; proposedUser?: { display_name: string | null; email: string } }[]>([]);
  const [belirliGunAssignments, setBelirliGunAssignments] = useState<{ id: string; itemTitle: string; weekDateStart: string | null; weekDateEnd: string | null; weekLabel: string | null; gorevTipi: string }[]>([]);
  const dutyEnabledForTeacher =
    me?.role === 'teacher' &&
    !!me.school_id &&
    isSchoolModuleEnabled(me.school?.enabled_modules ?? null, 'duty');

  useEffect(() => {
    if (!token || me?.role !== 'teacher' || !dutyEnabledForTeacher) {
      setTodayDuty(null);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    apiFetch<{ date: string; slots: { user_id: string; area_name: string | null; slot_name: string | null; shift?: string }[] }>(`/duty/daily?date=${today}`, { token })
      .then(setTodayDuty)
      .catch(() => setTodayDuty(null));
  }, [token, me?.role, dutyEnabledForTeacher]);

  useEffect(() => {
    if (!token || me?.role !== 'teacher') return;
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const academicYear = month < 8 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
    Promise.all([
      dutyEnabledForTeacher
        ? apiFetch<{ id?: string; date: string; status: string }[]>(`/duty/preferences?from=${from}&to=${to}`, { token }).catch(() => [])
        : Promise.resolve([]),
      dutyEnabledForTeacher
        ? apiFetch<{ id: string; status: string; duty_slot?: { date: string; area_name: string | null }; proposedUser?: { display_name: string | null; email: string } }[]>(`/duty/swap-requests`, { token }).catch(() => [])
        : Promise.resolve([]),
      apiFetch<{ id: string; itemTitle: string; weekDateStart: string | null; weekDateEnd: string | null; weekLabel: string | null; gorevTipi: string }[]>(`/academic-calendar/my-assignments?academic_year=${encodeURIComponent(academicYear)}`, { token }).catch(() => []),
    ]).then(([prefs, swaps, assignments]) => {
      setTeacherPrefs(Array.isArray(prefs) ? prefs.slice(-5) : []);
      setTeacherSwaps(Array.isArray(swaps) ? swaps.slice(0, 5) : []);
      setBelirliGunAssignments(Array.isArray(assignments) ? assignments.slice(0, 6) : []);
    });
  }, [token, me?.role, dutyEnabledForTeacher]);

  if (!me) {
    if (token) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner label="Profil yükleniyor…" />
        </div>
      );
    }
    return null;
  }

  const isLoading = statsPending;
  const displayName = me.display_name || me.email?.split('@')[0] || 'Kullanıcı';

  if (me.role === 'superadmin') {
    return (
      <SuperadminDashboardShell
        me={me}
        displayName={displayName}
        stats={stats ?? null}
        statsError={statsError}
        isLoadingStats={isLoading}
      />
    );
  }

  if (me.role === 'school_admin') {
    return (
      <SchoolAdminHome
        me={me}
        displayName={displayName}
        stats={stats ?? null}
        statsError={statsError}
        isLoadingStats={isLoading}
        adminMessagesUnread={adminMessagesUnread}
        allNotificationsUnread={allNotificationsUnread}
      />
    );
  }

  if (me.role === 'teacher') {
    return (
      <div className="max-sm:-mt-2">
        <TeacherHome
          me={me}
          displayName={displayName}
          allNotificationsUnread={allNotificationsUnread}
          todayDuty={todayDuty}
          belirliGunAssignments={belirliGunAssignments}
          teacherPrefs={teacherPrefs}
          teacherSwaps={teacherSwaps}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-2xl">Hoş geldiniz, {displayName}</ToolbarPageTitle>
          <ToolbarIconHints
            compact
            items={[
              { label: 'Rol', icon: Users },
              { label: 'Özet', icon: LayoutDashboard },
            ]}
            summary={`${ROLE_LABELS[me.role] ?? me.role} · Özet ve genel bilgiler`}
          />
        </ToolbarHeading>
      </Toolbar>

      <WelcomeMotivationBanner />

      {/* Hızlı aksiyonlar – rol bazlı kısayollar, pastel kutucuklar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {me.role === 'moderator' && (
        <>
          <Link
            href="/hesaplamalar"
            className="group flex items-center justify-between rounded-xl border border-border p-4 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 card-pastel-soft-sky"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-400/20 text-blue-700 dark:text-blue-400">
                <Calculator className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Hesaplamalar</p>
                <p className="text-xs text-muted-foreground">Ek ders ve sınav ücreti hesapları</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/schools"
            className="group flex items-center justify-between rounded-xl border border-border p-4 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 card-pastel-soft-teal"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-400/20 text-teal-700 dark:text-teal-400">
                <School className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Okullar</p>
                <p className="text-xs text-muted-foreground">Kurum listesi</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/users"
            className="group flex items-center justify-between rounded-xl border border-border p-4 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 card-pastel-soft-indigo"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-400/20 text-indigo-700 dark:text-indigo-400">
                <Users className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Kullanıcılar</p>
                <p className="text-xs text-muted-foreground">Hesap yönetimi</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
          <Link
            href="/modules"
            className="group flex items-center justify-between rounded-xl border border-border p-4 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 card-pastel-soft-violet"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-400/20 text-violet-700 dark:text-violet-400">
                <Puzzle className="size-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">Modül politikaları</p>
                <p className="text-xs text-muted-foreground">Okul modülleri</p>
              </div>
            </div>
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        </>
      )}
      </div>

      {/* Hesap bilgileri */}
      <Card variant="teal" soft>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Hesap bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Profil</dt>
              <dd className="mt-1 font-medium text-foreground">
                {me.display_name || me.email}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Rol</dt>
              <dd className="mt-1 text-foreground">{ROLE_LABELS[me.role] ?? me.role}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">E-posta</dt>
              <dd className="mt-1 text-foreground">{me.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Okul</dt>
              <dd className="mt-1 text-foreground">{me.school?.name ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
