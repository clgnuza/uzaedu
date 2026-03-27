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
    <div className="mx-auto max-w-6xl px-3 pb-8 sm:px-4 lg:px-2">
      <div className="lg:grid lg:grid-cols-[320px_1fr] lg:gap-6 lg:items-start space-y-6 lg:space-y-0 pt-4 sm:pt-6">
        <ProfileSidebar me={me} />

        <div className="min-w-0 space-y-6">
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
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
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

                <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
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

              <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl">
                <CardHeader>
                  <CardTitle>Veri talepleri</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    KVKK Madde 11 kapsamında kişisel verilerinize erişebilir ve hesabınızı silebilirsiniz.
                  </p>
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
