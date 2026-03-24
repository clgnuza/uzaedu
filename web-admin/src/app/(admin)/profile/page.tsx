'use client';

import Link from 'next/link';
import {
  KeyRound,
  LayoutDashboard,
  Users,
  Bell,
  Megaphone,
  Settings,
  BookOpen,
  CalendarClock,
  Mail,
  BarChart3,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataExportButton, DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { EditProfileForm, ChangePasswordForm } from '@/components/account/profile-account-forms';
import {
  ProfileHero,
  EvrakDefaultsSummaryCard,
  CommunityBadges,
  AboutCard,
  WorkExperienceCard,
  SkillsCard,
  RecentUploadsCard,
  UnlockCard,
  MediaChartCard,
  ContributorsCard,
  ContributionsChartCard,
  ProjectsTableCard,
  SuperadminProfileHub,
} from './components';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Süper Admin',
  moderator: 'Moderatör',
  school_admin: 'Okul yöneticisi',
  teacher: 'Öğretmen',
};
const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  suspended: 'Askıda',
};

const SCHOOL_TYPE_LABELS: Record<string, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
  gsl: 'Güzel Sanatlar Lisesi',
  spor_l: 'Spor Lisesi',
  meslek: 'Meslek Lisesi',
  mesem: 'Mesleki Eğitim Merkezi',
};

export default function ProfilePage() {
  const { me, token, refetchMe } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';

  if (!me) return null;

  const aboutRows = [
    { label: 'E-posta', value: me.email },
    { label: 'Görünen ad', value: me.display_name ?? '—' },
    { label: 'Rol', value: ROLE_LABELS[me.role] ?? me.role },
    ...(me.school ? [{ label: 'Okul', value: me.school.name }] : []),
    ...(me.school?.city ? [{ label: 'İl', value: me.school.city }] : []),
    ...(me.school?.district ? [{ label: 'İlçe', value: me.school.district }] : []),
    ...(me.school?.type
      ? [{ label: 'Okul türü', value: SCHOOL_TYPE_LABELS[me.school.type] ?? me.school.type }]
      : []),
    ...(me.school?.segment ? [{ label: 'Segment', value: me.school.segment }] : []),
    ...(me.role === 'teacher' && me.teacher_branch
      ? [{ label: 'Branş', value: me.teacher_branch }]
      : []),
    ...(me.status ? [{ label: 'Durum', value: STATUS_LABELS[me.status] ?? me.status }] : []),
    ...(me.created_at
      ? [{ label: 'Kayıt tarihi', value: new Date(me.created_at).toLocaleDateString('tr-TR') }]
      : []),
    ...(me.updated_at
      ? [
          {
            label: 'Profil son güncelleme',
            value: new Date(me.updated_at).toLocaleString('tr-TR'),
          },
        ]
      : []),
    ...(me.role === 'school_admin' && me.school?.teacher_limit != null
      ? [{ label: 'Öğretmen kotası', value: String(me.school.teacher_limit) }]
      : []),
  ];

  return (
    <div className="space-y-6 pb-6 sm:pb-8">
      <ProfileHero
        displayName={me.display_name ?? me.email}
        email={me.email}
        avatarKey={me.avatar_key}
        avatarUrl={me.avatar_url}
        role={ROLE_LABELS[me.role] ?? me.role}
        schoolName={me.school?.name}
        variant={
          me.role === 'teacher' || me.role === 'school_admin' || isSuperadmin ? 'immersive' : 'default'
        }
        teacherBranch={me.role === 'teacher' ? me.teacher_branch : undefined}
        teacherSchoolApproval={
          me.role === 'teacher'
            ? !me.school_id
              ? 'no_school'
              : me.school_verified
                ? 'verified'
                : me.teacher_school_membership === 'pending'
                  ? 'pending'
                  : 'unverified'
            : undefined
        }
        immersiveEyebrow={
          me.role === 'teacher'
            ? 'Öğretmen profili'
            : me.role === 'school_admin'
              ? 'Yönetim profili'
              : isSuperadmin
                ? 'Süper yönetici'
                : 'Profil'
        }
        profileAccent={me.role === 'teacher' ? 'teacher' : 'default'}
        primaryShortcutLabel={me.role === 'school_admin' ? 'Pano' : isSuperadmin ? 'Genel pano' : 'Ana sayfa'}
      />

      {me.role === 'teacher' ? (
        <div className="mx-auto max-w-6xl space-y-6 px-3 sm:space-y-8 sm:px-4 lg:px-2">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-7">
              <AboutCard
                title="Hesap özeti"
                description="Okul ve iletişim bilgileriniz; düzenleme Ayarlar üzerinden."
                rows={aboutRows}
                className="h-full overflow-hidden rounded-2xl border-border/60 bg-card/90 shadow-sm backdrop-blur-sm sm:rounded-3xl"
              />
            </div>
            <Card
              variant="teal"
              soft
              className="flex flex-col overflow-hidden rounded-2xl border-border/60 shadow-sm sm:rounded-3xl lg:col-span-5"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Hızlı erişim</CardTitle>
                <p className="text-xs text-muted-foreground">Sık kullanılan sayfalar</p>
              </CardHeader>
              <CardContent className="grid flex-1 grid-cols-2 gap-2 pt-0 sm:gap-2.5">
                <Link
                  href="/dashboard"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <LayoutDashboard className="size-4 shrink-0 text-primary" />
                  Ana sayfa
                </Link>
                <Link
                  href="/settings"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <Settings className="size-4 shrink-0 text-muted-foreground" />
                  Ayarlar
                </Link>
                <Link
                  href="/bildirimler"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <Bell className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  Bildirimler
                </Link>
                <Link
                  href="/ders-programi/programlarim"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <BookOpen className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  Ders programı
                </Link>
                <Link
                  href="/duty/ozet"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <CalendarClock className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  Nöbet özeti
                </Link>
                <Link
                  href="/sinav-gorevlerim"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <ClipboardList className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                  Sınav görevleri
                </Link>
                <Link
                  href="/evrak"
                  className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-muted/80"
                >
                  <FileText className="size-4 shrink-0 text-teal-600 dark:text-teal-400" />
                  MEB yıllık plan / evrak
                </Link>
              </CardContent>
            </Card>
          </div>
          <EvrakDefaultsSummaryCard evrakDefaults={me.evrak_defaults ?? null} />
          <div className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3.5 text-pretty text-sm text-muted-foreground sm:px-5">
            Görünen ad, şifre ve veri talepleri için{' '}
            <Link href="/settings?tab=hesap" className="font-medium text-primary hover:underline">
              Ayarlar → Hesap
            </Link>
            .
          </div>
        </div>
      ) : me.role === 'school_admin' ? (
        <div className="mx-auto max-w-6xl space-y-6 px-3 sm:space-y-8 sm:px-4 lg:px-2">
          <AboutCard
            rows={aboutRows}
            className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm backdrop-blur-sm sm:rounded-3xl"
          />

          <Card className="overflow-hidden rounded-2xl border-border/60 bg-gradient-to-b from-card to-muted/15 shadow-sm sm:rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Yönetim kısayolları</CardTitle>
              <p className="text-xs text-muted-foreground">Pano, öğretmenler ve okul operasyonları</p>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 pt-0 sm:grid-cols-3">
              <Link
                href="/dashboard"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <LayoutDashboard className="size-4 shrink-0 text-primary" />
                Pano
              </Link>
              <Link
                href="/teachers"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <Users className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                Öğretmenler
              </Link>
              <Link
                href="/classes-subjects"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <BookOpen className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                Sınıflar
              </Link>
              <Link
                href="/ders-programi"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <CalendarClock className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                Ders programı
              </Link>
              <Link
                href="/announcements"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <Megaphone className="size-4 shrink-0 text-violet-600 dark:text-violet-400" />
                Duyurular
              </Link>
              <Link
                href="/bildirimler"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <Bell className="size-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                Bildirimler
              </Link>
              <Link
                href="/system-messages"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <Mail className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                Sistem mesajları
              </Link>
              <Link
                href="/school-reviews-report"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80"
              >
                <BarChart3 className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
                Değerlendirme
              </Link>
              <Link
                href="/settings"
                className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/80 sm:col-span-1"
              >
                <Settings className="size-4 shrink-0 text-muted-foreground" />
                Ayarlar
              </Link>
            </CardContent>
          </Card>

          <p className="text-pretty text-center text-sm text-muted-foreground sm:text-left">
            Görünen ad, şifre ve veri talepleri için{' '}
            <Link href="/settings?tab=hesap" className="font-medium text-primary hover:underline">
              Ayarlar
            </Link>
            .
          </p>
        </div>
      ) : isSuperadmin ? (
        <SuperadminProfileHub token={token} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-7">
          <div className="xl:col-span-1 space-y-5 lg:space-y-7">
            <CommunityBadges />
            <AboutCard rows={aboutRows} />
            <WorkExperienceCard />
            <SkillsCard />
            <RecentUploadsCard />
          </div>
          <div className="xl:col-span-2 space-y-5 lg:space-y-7">
            <UnlockCard />
            <MediaChartCard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7">
              <ContributorsCard />
              <ContributionsChartCard />
            </div>
            <ProjectsTableCard />
          </div>
        </div>
      )}

      {me.role !== 'teacher' && me.role !== 'school_admin' && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
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

            <Card>
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

          <Card>
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
  );
}
