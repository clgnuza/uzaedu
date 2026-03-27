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

function ApprovalBadge({ me }: { me: Me }) {
  if (me.role !== 'teacher' || !me.school_id) return null;

  if (me.school_verified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
        <ShieldCheck className="size-3" />
        Onaylı
      </span>
    );
  }
  if (me.teacher_school_membership === 'pending') {
    return (
      <div className="flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <ShieldOff className="size-3" />
          Onaysız
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
          <Clock className="size-3" />
          Onay bekliyor
        </span>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/30 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
      <ShieldOff className="size-3" />
      Onaysız
    </span>
  );
}

interface ProfileSidebarProps {
  me: Me;
  className?: string;
}

export function ProfileSidebar({ me, className }: ProfileSidebarProps) {
  const name = me.display_name?.trim() || me.email;
  const roleLabel = ROLE_LABELS[me.role] ?? me.role;

  return (
    <aside
      className={cn(
        'rounded-2xl border border-border/60 bg-card/90 shadow-sm backdrop-blur-sm sm:rounded-3xl',
        'lg:sticky lg:top-4 lg:self-start',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-3 p-5 pb-4 text-center">
        <UserAvatarBubble
          avatarKey={me.avatar_key}
          avatarUrl={me.avatar_url}
          displayName={name}
          email={me.email}
          size="lg"
          verified={me.school_verified}
        />
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg font-bold tracking-tight text-foreground break-words">{name}</h1>
          <a
            href={`mailto:${me.email}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors break-all"
          >
            <Mail className="size-3 shrink-0" />
            {me.email}
          </a>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <Shield className="size-3" />
          {roleLabel}
        </span>
      </div>

      <div className="border-t border-border/50 px-5 py-4 space-y-3">
        {me.school && (
          <div className="flex items-start gap-2.5 text-sm">
            <Building2 className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-foreground leading-snug">{me.school.name}</p>
              {(me.school.city || me.school.district) && (
                <p className="text-xs text-muted-foreground">
                  {[me.school.district, me.school.city].filter(Boolean).join(', ')}
                </p>
              )}
              {me.school.type && (
                <p className="text-xs text-muted-foreground">
                  {formatSchoolTypeLabel(me.school.type)}
                </p>
              )}
            </div>
          </div>
        )}

        {me.role === 'teacher' && me.teacher_branch && (
          <div className="flex items-center gap-2.5 text-sm">
            <GraduationCap className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">{me.teacher_branch}</span>
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
