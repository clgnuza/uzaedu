'use client';

import { Suspense } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataExportButton, DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { EditProfileForm, ChangePasswordForm } from '@/components/account/profile-account-forms';
import { ProfileSidebar } from './components/profile-sidebar';
import { TeacherAccountTabs } from '../settings/teacher-account-tabs';
import { SchoolAdminAccountTabs } from '../settings/school-admin-account-tabs';
import { SuperadminAccountTabs } from '../settings/superadmin-account-tabs';

const Loading = () => <p className="text-sm text-muted-foreground">Yükleniyor…</p>;

export default function ProfilePage() {
  const { me, token, refetchMe } = useAuth();

  if (!me) return null;

  const isTeacher = me.role === 'teacher';
  const isSchoolAdmin = me.role === 'school_admin';
  const isSuperadmin = me.role === 'superadmin';

  return (
    <div className="mx-auto max-w-6xl px-2.5 pb-5 sm:px-4 sm:pb-8 lg:px-2">
      <div className="max-sm:-mt-2 lg:grid lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-5 xl:grid-cols-[280px_1fr] xl:gap-6 lg:items-start space-y-3 sm:space-y-6 lg:space-y-0 pt-2 sm:pt-6">
        <ProfileSidebar me={me} compactMobile={isTeacher} />

        <div className="min-w-0 space-y-4 sm:space-y-6">
          {isTeacher && (
            <Suspense fallback={<Loading />}>
              <TeacherAccountTabs />
            </Suspense>
          )}

          {isSchoolAdmin && (
            <Suspense fallback={<Loading />}>
              <SchoolAdminAccountTabs />
            </Suspense>
          )}

          {isSuperadmin && (
            <Suspense fallback={<Loading />}>
              <SuperadminAccountTabs />
            </Suspense>
          )}

          {!isTeacher && !isSchoolAdmin && !isSuperadmin && (
            <>
              <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
                <Card className="overflow-hidden rounded-xl border-2 border-border/70 bg-card shadow-md ring-1 ring-black/4 dark:border-border/80 dark:ring-white/6 sm:rounded-2xl">
                  <CardHeader>
                    <CardTitle>Profil düzenle</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EditProfileForm
                      token={token}
                      displayName={me.display_name ?? ''}
                      avatarKey={me.avatar_key ?? null}
                      onSuccess={refetchMe}
                    />
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-xl border-2 border-border/70 bg-card shadow-md ring-1 ring-black/4 dark:border-border/80 dark:ring-white/6 sm:rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <KeyRound className="size-4 text-muted-foreground" />
                      Şifre değiştir
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChangePasswordForm token={token} />
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden rounded-xl border-2 border-border/70 bg-card shadow-md ring-1 ring-black/4 dark:border-border/80 dark:ring-white/6 sm:rounded-2xl">
                <CardHeader>
                  <CardTitle>Veri ve hesap</CardTitle>
                  <p className="text-sm text-muted-foreground">Dışa aktarma ve hesap silme (KVKK).</p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  <DataExportButton token={token} />
                  <DeleteAccountButton token={token} />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
