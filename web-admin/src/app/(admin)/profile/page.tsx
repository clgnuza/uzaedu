'use client';

import { Suspense } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataExportButton, DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { BackupExportPanel } from '@/components/account/backup-export-panel';
import { EditProfileForm, ChangePasswordForm } from '@/components/account/profile-account-forms';
import { LoginOtpPreference } from '@/components/account/login-otp-preference';
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
    <div
      className={cn(
        'mx-auto max-w-6xl pb-5 sm:px-4 sm:pb-8 lg:px-2',
        isSchoolAdmin ? 'max-sm:px-1.5 px-2 sm:px-4' : 'px-2.5',
      )}
    >
      <div
        className={cn(
          'lg:grid lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-5 xl:grid-cols-[280px_1fr] xl:gap-6 lg:items-start lg:space-y-0 pt-2 sm:pt-6',
          isSchoolAdmin ? 'max-sm:-mt-1 space-y-2 sm:space-y-6' : 'max-sm:-mt-2 space-y-3 sm:space-y-6',
        )}
      >
        <ProfileSidebar me={me} compactMobile={isTeacher || isSchoolAdmin} />

        <div className="min-w-0 space-y-3 sm:space-y-6">
          {isTeacher && (
            <Suspense fallback={<Loading />}>
              <TeacherAccountTabs />
            </Suspense>
          )}

          {isSchoolAdmin && (
            <Suspense fallback={<Loading />}>
              <div className="rounded-md border border-sky-500/12 bg-linear-to-br from-sky-500/5 via-background to-violet-500/4 p-0.5 shadow-sm ring-1 ring-sky-500/8 dark:from-sky-950/30 dark:via-background dark:to-violet-950/20 dark:ring-sky-500/12 sm:rounded-3xl sm:border-sky-500/15 sm:p-3 sm:ring-sky-500/10 md:p-4">
                <SchoolAdminAccountTabs />
              </div>
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
                      avatarUrl={me.avatar_url ?? null}
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

              {me.role === 'moderator' && (
                <LoginOtpPreference
                  token={token}
                  initialRequired={me.login_otp_required !== false}
                  onSaved={() => void refetchMe()}
                  className="border-sky-500/20 bg-linear-to-br from-sky-500/5 to-transparent"
                />
              )}

              <Card className="overflow-hidden rounded-xl border-2 border-border/70 bg-card shadow-md ring-1 ring-black/4 dark:border-border/80 dark:ring-white/6 sm:rounded-2xl">
                <CardHeader className="sm:px-8 sm:py-5">
                  <CardTitle className="text-lg sm:text-xl">Veri yedeği</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Modül seçerek tam JSON yedek; hesap, ajanda ve mesaj tercihleri sunucuya geri yüklenebilir.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6 px-3 pb-6 sm:px-8 sm:pb-8">
                  <BackupExportPanel
                    token={token}
                    enabledModules={me.school?.enabled_modules ?? null}
                    role={me.role}
                    layout="full"
                  />
                  <div className="flex flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
                    <DataExportButton token={token} />
                    <DeleteAccountButton token={token} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
