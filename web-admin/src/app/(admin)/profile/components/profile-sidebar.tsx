'use client';

import {
  Mail,
  Building2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Clock,
  Calendar,
  GraduationCap,
  Sparkles,
  MapPin,
  Users,
} from 'lucide-react';
import { UserAvatarBubble } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import type { Me } from '@/providers/auth-provider';
import { formatSchoolTypeLabel } from '@/lib/school-labels';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Süper Admin',
  moderator: 'Moderatör',
  school_admin: 'Okul Yöneticisi',
  teacher: 'Öğretmen',
};

function ApprovalBadge({ me, className }: { me: Me; className?: string }) {
  if (me.role !== 'teacher' || !me.school_id) return null;

  if (me.school_verified) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
          className,
        )}
      >
        <ShieldCheck className="size-3.5" />
        Onaylı
      </span>
    );
  }
  if (me.teacher_school_membership === 'pending') {
    return (
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/12 px-2.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200">
          <ShieldOff className="size-3" />
          Onaysız
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/45 bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-950 dark:text-amber-100">
          <Clock className="size-3" />
          Beklemede
        </span>
      </div>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/12 px-2.5 py-1 text-[11px] font-semibold text-slate-800 dark:text-slate-200',
        className,
      )}
    >
      <ShieldOff className="size-3" />
      Onaysız
    </span>
  );
}

interface ProfileSidebarProps {
  me: Me;
  className?: string;
  /** Öğretmen profilinde mobilde daha kompakt boyutlar */
  compactMobile?: boolean;
}

function DefaultProfileSidebar({
  me,
  className,
  compactMobile,
}: ProfileSidebarProps) {
  const name = me.display_name?.trim() || me.email;
  const roleLabel = ROLE_LABELS[me.role] ?? me.role;

  return (
    <aside
      className={cn(
        'rounded-xl border-2 border-border/70 bg-card shadow-md ring-1 ring-black/4 backdrop-blur-sm dark:border-border/80 dark:ring-white/6 sm:rounded-2xl',
        'lg:sticky lg:top-4 lg:self-start',
        compactMobile && 'max-sm:border max-sm:shadow-sm max-sm:ring-0',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center text-center',
          compactMobile ? 'gap-2 p-3 pb-2.5 sm:gap-3 sm:p-5 sm:pb-4' : 'gap-2.5 p-4 pb-3 sm:gap-3 sm:p-5 sm:pb-4',
        )}
      >
        <UserAvatarBubble
          avatarKey={me.avatar_key}
          avatarUrl={me.avatar_url}
          displayName={name}
          email={me.email}
          size="lg"
          verified={me.school_verified}
          className={
            compactMobile
              ? 'size-16! text-lg! ring-1! sm:size-24! sm:text-3xl! sm:ring-2!'
              : undefined
          }
        />
        <div className="min-w-0 space-y-0.5 sm:space-y-1">
          <h1
            className={cn(
              'font-bold tracking-tight text-foreground wrap-break-word',
              compactMobile ? 'text-[15px] leading-tight sm:text-lg' : 'text-base sm:text-lg',
            )}
          >
            {name}
          </h1>
          <a
            href={`mailto:${me.email}`}
            className={cn(
              'inline-flex items-center gap-1 tabular-nums text-muted-foreground transition-colors hover:text-primary break-all',
              compactMobile ? 'text-[10px] leading-snug sm:text-xs' : 'text-[11px] sm:text-xs',
            )}
          >
            <Mail className="size-3 shrink-0" />
            {me.email}
          </a>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full border border-primary/20 bg-primary/5 font-medium text-primary',
            compactMobile ? 'gap-1 px-2 py-0.5 text-[10px] sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs' : 'gap-1.5 px-3 py-1 text-xs',
          )}
        >
          <Shield className={compactMobile ? 'size-2.5 sm:size-3' : 'size-3'} />
          {roleLabel}
        </span>
      </div>

      <div
        className={cn(
          'border-t border-border/50',
          compactMobile ? 'space-y-2 px-3 py-3 sm:space-y-3 sm:px-5 sm:py-4' : 'space-y-2.5 px-4 py-3.5 sm:space-y-3 sm:px-5 sm:py-4',
        )}
      >
        {me.school && (
          <div className={cn('flex items-start text-sm', compactMobile ? 'gap-2 sm:gap-2.5' : 'gap-2.5')}>
            <Building2 className={cn('mt-0.5 shrink-0 text-muted-foreground', compactMobile ? 'size-3.5 sm:size-4' : 'size-4')} />
            <div className="min-w-0">
              <p
                className={cn(
                  'font-medium leading-snug text-foreground',
                  compactMobile ? 'text-[13px] sm:text-sm' : 'text-sm',
                )}
              >
                {me.school.name}
              </p>
              {(me.school.city || me.school.district) && (
                <p className="text-xs text-muted-foreground">
                  {[me.school.district, me.school.city].filter(Boolean).join(', ')}
                </p>
              )}
              {me.school.type && (
                <p className="text-xs text-muted-foreground">{formatSchoolTypeLabel(me.school.type)}</p>
              )}
            </div>
          </div>
        )}

        {me.role === 'teacher' && me.teacher_branch && (
          <div className={cn('flex items-center text-sm', compactMobile ? 'gap-2' : 'gap-2.5')}>
            <GraduationCap className={cn('shrink-0 text-muted-foreground', compactMobile ? 'size-3.5 sm:size-4' : 'size-4')} />
            <span className={cn('font-medium text-foreground', compactMobile && 'text-[13px] sm:text-sm')}>
              {me.teacher_branch}
            </span>
          </div>
        )}

        {me.role === 'teacher' && me.school_id && (
          <div className="flex items-start gap-2.5">
            <ApprovalBadge me={me} />
          </div>
        )}

        {me.role === 'school_admin' && me.school?.teacher_limit != null && (
          <div className="flex items-center gap-2.5 text-sm">
            <Shield className="size-4 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              Öğretmen kotası: <span className="font-medium text-foreground">{me.school.teacher_limit}</span>
            </span>
          </div>
        )}

        {me.created_at && (
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5 shrink-0" />
            <span>Kayıt: {new Date(me.created_at).toLocaleDateString('tr-TR')}</span>
          </div>
        )}

        {me.status && (
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                me.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
              )}
            >
              {me.status === 'active' ? 'Aktif' : me.status === 'passive' ? 'Pasif' : me.status}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}

function TeacherProfileCard({ me, className, compactMobile }: ProfileSidebarProps) {
  const name = me.display_name?.trim() || me.email;
  const school = me.school;
  const memberSince = me.created_at
    ? new Date(me.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <aside
      className={cn(
        'overflow-hidden rounded-xl border border-teal-200/40 bg-card shadow-lg ring-1 ring-teal-500/15 dark:border-teal-900/40 dark:ring-teal-500/10 sm:rounded-2xl sm:shadow-xl',
        'lg:sticky lg:top-4 lg:self-start',
        className,
      )}
    >
      <div className="relative">
        <div
          className={cn(
            'relative overflow-hidden bg-linear-to-br from-teal-400/35 via-violet-500/25 to-amber-300/25 px-4 pb-14 pt-5 text-center dark:from-teal-950/80 dark:via-violet-950/50 dark:to-amber-950/35',
            compactMobile && 'px-3 pb-9 pt-3 sm:px-4 sm:pb-14 sm:pt-5',
          )}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-teal-400/25 blur-3xl dark:bg-teal-500/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-10 h-28 w-28 rounded-full bg-violet-400/20 blur-2xl dark:bg-violet-600/15"
            aria-hidden
          />

          <div
            className={cn(
              'relative mb-0 inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-teal-950 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-teal-100 sm:mb-1 sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:tracking-[0.2em]',
            )}
          >
            <Sparkles className="size-2.5 text-amber-600 sm:size-3 dark:text-amber-400" aria-hidden />
            Öğretmen
          </div>

          <div
            className={cn(
              'relative mx-auto mt-2 flex w-full justify-center sm:mt-3 sm:max-w-[220px]',
              compactMobile ? 'max-w-[160px]' : 'max-w-[220px]',
            )}
          >
            <UserAvatarBubble
              avatarKey={me.avatar_key}
              avatarUrl={me.avatar_url}
              displayName={name}
              email={me.email}
              size="lg"
              verified={me.school_verified}
              className={cn(
                'shadow-2xl ring-4 ring-white/95 dark:ring-zinc-950',
                compactMobile
                  ? 'size-14! text-lg! ring-3! sm:size-24! sm:text-3xl! sm:ring-4!'
                  : 'size-20! text-2xl! sm:size-28! sm:text-3xl!',
              )}
            />
          </div>
        </div>

        <div
          className={cn(
            'relative -mt-10 rounded-t-3xl border-x border-t border-border/60 bg-card px-4 pb-4 pt-9 shadow-[0_-12px_40px_-18px_rgba(15,118,110,0.35)] dark:border-border/50 dark:shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.5)]',
            compactMobile && '-mt-7 rounded-t-2xl px-3 pb-3 pt-7 sm:-mt-10 sm:rounded-t-3xl sm:px-4 sm:pb-4 sm:pt-9',
          )}
        >
          <div className="text-center">
            <h1
              className={cn(
                'text-balance font-bold leading-tight tracking-tight text-foreground',
                compactMobile ? 'text-[15px] sm:text-xl' : 'text-lg sm:text-xl',
              )}
            >
              {name}
            </h1>
            <a
              href={`mailto:${me.email}`}
              className={cn(
                'mt-0.5 inline-flex max-w-full items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-primary sm:mt-1',
                compactMobile ? 'text-[10px] sm:text-xs' : 'text-[11px] sm:text-xs',
              )}
            >
              <Mail className="size-3 shrink-0 opacity-70" />
              <span className="break-all">{me.email}</span>
            </a>
          </div>

          <div
            className={cn(
              'flex flex-wrap items-center justify-center gap-1.5 sm:mt-3 sm:gap-2',
              compactMobile ? 'mt-2' : 'mt-3',
            )}
          >
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full bg-primary font-bold text-primary-foreground shadow-md',
                compactMobile ? 'px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px]' : 'px-2.5 py-1 text-[11px]',
              )}
            >
              <Shield className={cn('shrink-0', compactMobile ? 'size-2.5 sm:size-3' : 'size-3')} />
              {ROLE_LABELS.teacher}
            </span>
            {me.status === 'active' && (
              <span
                className={cn(
                  'rounded-full bg-emerald-500/15 font-semibold text-emerald-800 dark:text-emerald-300',
                  compactMobile ? 'px-1.5 py-0.5 text-[9px] sm:px-2 sm:text-[10px]' : 'px-2 py-0.5 text-[10px]',
                )}
              >
                Aktif hesap
              </span>
            )}
          </div>

          {me.teacher_branch && (
            <div
              className={cn(
                'rounded-xl border border-violet-200/50 bg-linear-to-r from-violet-500/10 to-transparent dark:border-violet-800/40 dark:from-violet-950/40',
                compactMobile ? 'mt-2.5 px-2 py-2 sm:mt-4 sm:px-3 sm:py-2.5' : 'mt-4 px-3 py-2.5',
              )}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300',
                    compactMobile ? 'size-7 sm:size-9' : 'size-9',
                  )}
                >
                  <GraduationCap className={cn(compactMobile ? 'size-3.5 sm:size-4' : 'size-4')} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    Branş
                  </p>
                  <p
                    className={cn(
                      'truncate font-bold text-foreground',
                      compactMobile ? 'text-xs sm:text-sm' : 'text-sm',
                    )}
                  >
                    {me.teacher_branch}
                  </p>
                </div>
              </div>
            </div>
          )}

          {school && (
            <div
              className={cn(
                'rounded-xl border border-border/50 bg-muted/30 dark:bg-muted/20',
                compactMobile ? 'mt-1.5 px-2 py-2 sm:mt-2 sm:px-3 sm:py-2.5' : 'mt-2 px-3 py-2.5',
              )}
            >
              <div className="flex items-start gap-1.5 sm:gap-2">
                <Building2
                  className={cn(
                    'mt-0.5 shrink-0 text-teal-600 dark:text-teal-400',
                    compactMobile ? 'size-3.5 sm:size-4' : 'size-4',
                  )}
                />
                <div className="min-w-0 text-left">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    Okul
                  </p>
                  <p
                    className={cn(
                      'font-semibold leading-snug text-foreground',
                      compactMobile ? 'text-xs sm:text-sm' : 'text-sm',
                    )}
                  >
                    {school.name}
                  </p>
                  {(school.city || school.district) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
                      <MapPin className="size-2.5 shrink-0 opacity-70 sm:size-3" />
                      {[school.district, school.city].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {school.type && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-[11px]">
                      {formatSchoolTypeLabel(school.type)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {me.school_id && (
            <div className={cn('flex flex-wrap items-center gap-1.5 sm:gap-2', compactMobile ? 'mt-2' : 'mt-3')}>
              <p className="w-full text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                Durum
              </p>
              <ApprovalBadge me={me} />
            </div>
          )}

          {memberSince && (
            <div
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-muted/20 text-muted-foreground sm:gap-2 sm:px-3 sm:py-2 sm:text-[11px]',
                compactMobile ? 'mt-2 px-2 py-1.5 text-[10px]' : 'mt-4 px-3 py-2 text-[11px]',
              )}
            >
              <Calendar className="size-3 shrink-0 opacity-80 sm:size-3.5" />
              <span>
                Kayıt: <span className="font-medium text-foreground">{memberSince}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function SchoolAdminProfileCard({ me, className, compactMobile }: ProfileSidebarProps) {
  const name = me.display_name?.trim() || me.email;
  const school = me.school;
  const memberSince = me.created_at
    ? new Date(me.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const limit = me.school?.teacher_limit;

  return (
    <aside
      className={cn(
        'overflow-hidden rounded-xl border border-sky-200/40 bg-card shadow-lg ring-1 ring-sky-500/15 dark:border-sky-900/40 dark:ring-sky-500/10 sm:rounded-2xl sm:shadow-xl',
        'lg:sticky lg:top-4 lg:self-start',
        className,
      )}
    >
      <div className="relative">
        <div
          className={cn(
            'relative overflow-hidden bg-linear-to-br from-sky-400/35 via-violet-500/25 to-indigo-300/25 px-4 pb-14 pt-5 text-center dark:from-sky-950/80 dark:via-violet-950/50 dark:to-indigo-950/35',
            compactMobile && 'px-3 pb-9 pt-3 sm:px-4 sm:pb-14 sm:pt-5',
          )}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-12 h-36 w-36 rounded-full bg-sky-400/25 blur-3xl dark:bg-sky-500/15"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-6 -left-10 h-28 w-28 rounded-full bg-indigo-400/20 blur-2xl dark:bg-indigo-600/15"
            aria-hidden
          />

          <div
            className={cn(
              'relative mb-0 inline-flex items-center gap-1 rounded-full border border-white/40 bg-white/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-sky-950 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-sky-100 sm:mb-1 sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:tracking-[0.2em]',
            )}
          >
            <Building2 className="size-2.5 text-violet-700 sm:size-3 dark:text-violet-300" aria-hidden />
            Okul yöneticisi
          </div>

          <div
            className={cn(
              'relative mx-auto mt-2 flex w-full justify-center sm:mt-3 sm:max-w-[220px]',
              compactMobile ? 'max-w-[160px]' : 'max-w-[220px]',
            )}
          >
            <UserAvatarBubble
              avatarKey={me.avatar_key}
              avatarUrl={me.avatar_url}
              displayName={name}
              email={me.email}
              size="lg"
              verified={me.school_verified}
              className={cn(
                'shadow-2xl ring-4 ring-white/95 dark:ring-zinc-950',
                compactMobile
                  ? 'size-14! text-lg! ring-3! sm:size-24! sm:text-3xl! sm:ring-4!'
                  : 'size-20! text-2xl! sm:size-28! sm:text-3xl!',
              )}
            />
          </div>
        </div>

        <div
          className={cn(
            'relative -mt-10 rounded-t-3xl border-x border-t border-border/60 bg-card px-4 pb-4 pt-9 shadow-[0_-12px_40px_-18px_rgba(14,165,233,0.32)] dark:border-border/50 dark:shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.5)]',
            compactMobile && '-mt-7 rounded-t-2xl px-3 pb-3 pt-7 sm:-mt-10 sm:rounded-t-3xl sm:px-4 sm:pb-4 sm:pt-9',
          )}
        >
          <div className="text-center">
            <h1
              className={cn(
                'text-balance font-bold leading-tight tracking-tight text-foreground',
                compactMobile ? 'text-[15px] sm:text-xl' : 'text-lg sm:text-xl',
              )}
            >
              {name}
            </h1>
            <a
              href={`mailto:${me.email}`}
              className={cn(
                'mt-0.5 inline-flex max-w-full items-center justify-center gap-1 text-muted-foreground transition-colors hover:text-sky-600 dark:hover:text-sky-400 sm:mt-1',
                compactMobile ? 'text-[10px] sm:text-xs' : 'text-[11px] sm:text-xs',
              )}
            >
              <Mail className="size-3 shrink-0 opacity-70" />
              <span className="break-all">{me.email}</span>
            </a>
          </div>

          <div
            className={cn(
              'flex flex-wrap items-center justify-center gap-1.5 sm:mt-3 sm:gap-2',
              compactMobile ? 'mt-2' : 'mt-3',
            )}
          >
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full bg-sky-600 font-bold text-white shadow-md dark:bg-sky-500',
                compactMobile ? 'px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px]' : 'px-2.5 py-1 text-[11px]',
              )}
            >
              <Shield className={cn('shrink-0', compactMobile ? 'size-2.5 sm:size-3' : 'size-3')} />
              {ROLE_LABELS.school_admin}
            </span>
            {me.status === 'active' && (
              <span
                className={cn(
                  'rounded-full bg-emerald-500/15 font-semibold text-emerald-800 dark:text-emerald-300',
                  compactMobile ? 'px-1.5 py-0.5 text-[9px] sm:px-2 sm:text-[10px]' : 'px-2 py-0.5 text-[10px]',
                )}
              >
                Aktif hesap
              </span>
            )}
            {me.school_verified && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 font-semibold text-emerald-800 dark:text-emerald-200',
                  compactMobile ? 'px-1.5 py-0.5 text-[9px] sm:px-2 sm:text-[10px]' : 'px-2 py-0.5 text-[10px]',
                )}
              >
                <ShieldCheck className="size-3 shrink-0" />
                Kurum doğrulandı
              </span>
            )}
          </div>

          {limit != null && (
            <div
              className={cn(
                'rounded-xl border border-sky-200/50 bg-linear-to-r from-sky-500/10 to-transparent dark:border-sky-800/40 dark:from-sky-950/40',
                compactMobile ? 'mt-2.5 px-2 py-2 sm:mt-4 sm:px-3 sm:py-2.5' : 'mt-4 px-3 py-2.5',
              )}
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300',
                    compactMobile ? 'size-7 sm:size-9' : 'size-9',
                  )}
                >
                  <Users className={cn(compactMobile ? 'size-3.5 sm:size-4' : 'size-4')} />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    Öğretmen kotası
                  </p>
                  <p
                    className={cn(
                      'font-bold text-foreground',
                      compactMobile ? 'text-xs sm:text-sm' : 'text-sm',
                    )}
                  >
                    {limit} öğretmen
                  </p>
                </div>
              </div>
            </div>
          )}

          {school && (
            <div
              className={cn(
                'rounded-xl border border-border/50 bg-muted/30 dark:bg-muted/20',
                compactMobile ? 'mt-1.5 px-2 py-2 sm:mt-2 sm:px-3 sm:py-2.5' : 'mt-2 px-3 py-2.5',
              )}
            >
              <div className="flex items-start gap-1.5 sm:gap-2">
                <Building2
                  className={cn(
                    'mt-0.5 shrink-0 text-sky-600 dark:text-sky-400',
                    compactMobile ? 'size-3.5 sm:size-4' : 'size-4',
                  )}
                />
                <div className="min-w-0 text-left">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                    Okul
                  </p>
                  <p
                    className={cn(
                      'font-semibold leading-snug text-foreground',
                      compactMobile ? 'text-xs sm:text-sm' : 'text-sm',
                    )}
                  >
                    {school.name}
                  </p>
                  {(school.city || school.district) && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
                      <MapPin className="size-2.5 shrink-0 opacity-70 sm:size-3" />
                      {[school.district, school.city].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {school.type && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-[11px]">
                      {formatSchoolTypeLabel(school.type)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {memberSince && (
            <div
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-muted/20 text-muted-foreground sm:gap-2 sm:px-3 sm:py-2 sm:text-[11px]',
                compactMobile ? 'mt-2 px-2 py-1.5 text-[10px]' : 'mt-4 px-3 py-2 text-[11px]',
              )}
            >
              <Calendar className="size-3 shrink-0 opacity-80 sm:size-3.5" />
              <span>
                Kayıt: <span className="font-medium text-foreground">{memberSince}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function ProfileSidebar(props: ProfileSidebarProps) {
  if (props.me.role === 'teacher') {
    return <TeacherProfileCard {...props} />;
  }
  if (props.me.role === 'school_admin') {
    return <SchoolAdminProfileCard {...props} />;
  }
  return <DefaultProfileSidebar {...props} />;
}
