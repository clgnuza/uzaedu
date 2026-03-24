'use client';

import Link from 'next/link';
import { LayoutDashboard, Mail, Building2, Shield, ShieldCheck, ShieldOff, Settings, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatarBubble } from '@/components/user-avatar';

interface ProfileHeroProps {
  displayName: string;
  email: string;
  /** Hazır SVG veya yönetimden URL */
  avatarKey?: string | null;
  avatarUrl?: string | null;
  role: string;
  schoolName?: string | null;
  /** Öğretmen panosu ile uyumlu tam genişlik hero */
  variant?: 'default' | 'immersive';
  /** immersive: branş rozeti */
  teacherBranch?: string | null;
  /** Öğretmen: okul onayı (Onaylı / Onaysız) */
  teacherSchoolApproval?: 'verified' | 'pending' | 'unverified' | 'no_school';
  /** immersive: sol üst etiket (varsayılan: Profil) */
  immersiveEyebrow?: string;
  /** immersive: pano kısayolu metni (varsayılan: Ana sayfa) */
  primaryShortcutLabel?: string;
  /** Öğretmen profili için sıcak/teal gradient */
  profileAccent?: 'default' | 'teacher';
  className?: string;
}

export function ProfileHero({
  displayName,
  email,
  avatarKey,
  avatarUrl,
  role,
  schoolName,
  variant = 'default',
  teacherBranch,
  teacherSchoolApproval,
  immersiveEyebrow = 'Profil',
  primaryShortcutLabel = 'Ana sayfa',
  profileAccent = 'default',
  className,
}: ProfileHeroProps) {
  const name = displayName?.trim() || email;
  const teacherAccent = profileAccent === 'teacher';

  if (variant === 'immersive') {
    return (
      <div
        className={cn(
          'relative mx-3 overflow-hidden rounded-2xl border border-border/60 shadow-sm sm:mx-4 sm:rounded-3xl lg:mx-auto lg:max-w-6xl',
          teacherAccent
            ? 'bg-gradient-to-br from-teal-500/[0.14] via-background to-emerald-500/[0.09] dark:from-teal-950/50 dark:via-background dark:to-emerald-950/30'
            : 'bg-gradient-to-br from-sky-500/[0.12] via-background to-violet-500/[0.08] dark:from-sky-950/45 dark:via-background dark:to-violet-950/35',
          className,
        )}
      >
        <div
          className={cn(
            'pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl',
            teacherAccent
              ? 'bg-gradient-to-br from-teal-400/30 to-emerald-400/18 dark:from-teal-500/18 dark:to-emerald-500/12'
              : 'bg-gradient-to-br from-sky-400/25 to-violet-400/15 dark:from-sky-500/15 dark:to-violet-500/10',
          )}
          aria-hidden
        />
        <div
          className={cn(
            'pointer-events-none absolute -bottom-12 -left-12 h-40 w-40 rounded-full blur-2xl',
            teacherAccent
              ? 'bg-gradient-to-tr from-cyan-400/20 to-transparent'
              : 'bg-gradient-to-tr from-teal-400/15 to-transparent',
          )}
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 p-4 sm:gap-6 sm:p-6 md:flex-row md:items-center md:justify-between md:gap-8 md:p-8">
          <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
            <UserAvatarBubble
              avatarKey={avatarKey}
              avatarUrl={avatarUrl}
              displayName={name}
              email={email}
              size="lg"
              className="!ring-2 !ring-primary/15"
              verified={teacherSchoolApproval === 'verified'}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{immersiveEyebrow}</p>
              <h1 className="text-balance break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{name}</h1>
              <a
                href={`mailto:${email}`}
                className="inline-flex max-w-full items-start gap-1.5 break-all text-sm font-medium text-primary hover:underline"
              >
                <Mail className="size-3.5 shrink-0 opacity-80" />
                {email}
              </a>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
              {schoolName && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                  <Building2 className="size-3.5 text-muted-foreground" />
                  {schoolName}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/70 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <Shield className="size-3.5 text-muted-foreground" />
                {role}
              </span>
              {teacherBranch && (
                <span className="inline-flex items-center rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
                  {teacherBranch}
                </span>
              )}
              {teacherSchoolApproval === 'verified' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <ShieldCheck className="size-3.5" />
                  Onaylı
                </span>
              )}
              {teacherSchoolApproval === 'pending' && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/10 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <ShieldOff className="size-3.5" />
                    Onaysız
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100">
                    <Clock className="size-3.5" />
                    Onay bekliyor
                  </span>
                </>
              )}
              {teacherSchoolApproval === 'unverified' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/10 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <ShieldOff className="size-3.5" />
                  Onaysız
                </span>
              )}
              {teacherSchoolApproval === 'no_school' && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Okul seçilmedi
                </span>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
              <Link
                href="/dashboard"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/80 active:bg-muted sm:min-h-0 sm:justify-start"
              >
                <LayoutDashboard className="size-3.5" />
                {primaryShortcutLabel}
              </Link>
              <Link
                href="/settings"
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs font-medium transition-colors hover:bg-muted/80 active:bg-muted sm:min-h-0 sm:justify-start"
              >
                <Settings className="size-3.5" />
                Ayarlar
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mb-6 overflow-hidden rounded-xl bg-muted/50 bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage:
          'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted)) 50%, hsl(var(--accent)) 100%)',
      }}
    >
      <div className="flex flex-col items-center gap-2 px-4 py-8 lg:gap-3.5 lg:py-10">
        <UserAvatarBubble
          avatarKey={avatarKey}
          avatarUrl={avatarUrl}
          displayName={name}
          email={email}
          size="xl"
          className="!border-[3px] !border-green-500 !ring-0"
          verified={teacherSchoolApproval === 'verified'}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold text-foreground">{name}</span>
          <svg
            className="shrink-0 text-primary"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 15 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M14.5425 6.89749L13.5 5.83999C13.4273 5.76877 13.3699 5.6835 13.3312 5.58937C13.2925 5.49525 13.2734 5.39424 13.275 5.29249V3.79249C13.274 3.58699 13.2324 3.38371 13.1527 3.19432C13.0729 3.00494 12.9565 2.83318 12.8101 2.68892C12.6638 2.54466 12.4904 2.43073 12.2998 2.35369C12.1093 2.27665 11.9055 2.23801 11.7 2.23999H10.2C10.0982 2.24159 9.99722 2.22247 9.9031 2.18378C9.80898 2.1451 9.72371 2.08767 9.65249 2.01499L8.60249 0.957487C8.30998 0.665289 7.91344 0.50116 7.49999 0.50116C7.08654 0.50116 6.68999 0.665289 6.39749 0.957487L5.33999 1.99999C5.26876 2.07267 5.1835 2.1301 5.08937 2.16879C4.99525 2.20747 4.89424 2.22659 4.79249 2.22499H3.29249C3.08699 2.22597 2.88371 2.26754 2.69432 2.34731C2.50494 2.42709 2.33318 2.54349 2.18892 2.68985C2.04466 2.8362 1.93073 3.00961 1.85369 3.20013C1.77665 3.39064 1.73801 3.5945 1.73999 3.79999V5.29999C1.74159 5.40174 1.72247 5.50275 1.68378 5.59687C1.6451 5.691 1.58767 5.77627 1.51499 5.84749L0.457487 6.89749C0.165289 7.19 0.00115967 7.58654 0.00115967 7.99999C0.00115967 8.41344 0.165289 8.80998 0.457487 9.10249L1.49999 10.16C1.57267 10.2312 1.6301 10.3165 1.66878 10.4106C1.70747 10.5047 1.72659 10.6057 1.72499 10.7075V12.2075C1.72597 12.413 1.76754 12.6163 1.84731 12.8056C1.92709 12.995 2.04349 13.1668 2.18985 13.3111C2.3362 13.4553 2.50961 13.5692 2.70013 13.6463C2.89064 13.7233 3.0945 13.762 3.29999 13.76H4.79999C4.90174 13.7584 5.00275 13.7775 5.09687 13.8162C5.191 13.8549 5.27627 13.9123 5.34749 13.985L6.40499 15.0425C6.69749 15.3347 7.09404 15.4988 7.50749 15.4988C7.92094 15.4988 8.31748 15.3347 8.60999 15.0425L9.65999 14C9.73121 13.9273 9.81647 13.8699 9.9106 13.8312C10.0047 13.7925 10.1057 13.7734 10.2075 13.775H11.7075C12.1212 13.775 12.518 13.6106 12.8106 13.3181C13.1031 13.0255 13.2675 12.6287 13.2675 12.215V10.715C13.2659 10.6132 13.285 10.5122 13.3237 10.4181C13.3624 10.324 13.4198 10.2387 13.4925 10.1675L14.55 9.10999C14.6953 8.96452 14.8104 8.79176 14.8887 8.60164C14.9671 8.41152 15.007 8.20779 15.0063 8.00218C15.0056 7.79656 14.9643 7.59311 14.8847 7.40353C14.8051 7.21394 14.6888 7.04197 14.5425 6.89749ZM10.635 6.64999L6.95249 10.25C6.90055 10.3026 6.83864 10.3443 6.77038 10.3726C6.70212 10.4009 6.62889 10.4153 6.55499 10.415C6.48062 10.4139 6.40719 10.3982 6.33896 10.3685C6.27073 10.3389 6.20905 10.2961 6.15749 10.2425L4.37999 8.44249C4.32532 8.39044 4.28169 8.32793 4.25169 8.25867C4.22169 8.18941 4.20593 8.11482 4.20536 8.03934C4.20479 7.96387 4.21941 7.88905 4.24836 7.81934C4.27731 7.74964 4.31999 7.68647 4.37387 7.63361C4.42774 7.58074 4.4917 7.53926 4.56194 7.51163C4.63218 7.484 4.70726 7.47079 4.78271 7.47278C4.85816 7.47478 4.93244 7.49194 5.00112 7.52324C5.0698 7.55454 5.13148 7.59935 5.18249 7.65499L6.56249 9.05749L9.84749 5.84749C9.95296 5.74215 10.0959 5.68298 10.245 5.68298C10.394 5.68298 10.537 5.74215 10.6425 5.84749C10.6953 5.90034 10.737 5.96318 10.7653 6.03234C10.7935 6.1015 10.8077 6.1756 10.807 6.25031C10.8063 6.32502 10.7908 6.39884 10.7612 6.46746C10.7317 6.53608 10.6888 6.59813 10.635 6.64999Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="flex flex-wrap justify-center gap-3 text-sm lg:gap-5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="size-4" />
            <a href={`mailto:${email}`} className="font-medium text-secondary-foreground hover:text-primary">
              {email}
            </a>
          </span>
          {schoolName && (
            <span className="flex items-center gap-1.5 text-secondary-foreground">
              <Building2 className="size-4 text-muted-foreground" />
              {schoolName}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-secondary-foreground">
            <Shield className="size-4 text-muted-foreground" />
            {role}
          </span>
        </div>
      </div>
    </div>
  );
}
