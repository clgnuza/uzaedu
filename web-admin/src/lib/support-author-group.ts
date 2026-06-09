export type SupportAuthorGroup = 'requester' | 'school_staff' | 'platform' | 'internal' | 'system';

export type SupportMessageAuthor = {
  display_name?: string | null;
  role?: string | null;
};

export type SupportMessageForGroup = {
  message_type: 'PUBLIC' | 'INTERNAL_NOTE' | string;
  author_user_id?: string | null;
  author?: SupportMessageAuthor | null;
};

export type SupportTicketForGroup = {
  requester_user_id?: string | null;
  target_type?: string | null;
};

export function resolveSupportAuthorGroup(
  message: SupportMessageForGroup,
  ticket: SupportTicketForGroup,
): SupportAuthorGroup {
  if (message.message_type === 'INTERNAL_NOTE') return 'internal';

  const role = message.author?.role?.trim().toLowerCase();
  if (role === 'superadmin') return 'platform';
  if (role === 'school_admin' || role === 'moderator') return 'school_staff';

  if (
    message.author_user_id &&
    ticket.requester_user_id &&
    message.author_user_id === ticket.requester_user_id
  ) {
    return 'requester';
  }
  if (role === 'teacher') return 'requester';

  return 'system';
}

export type SupportAuthorGroupTheme = {
  label: string;
  shortLabel: string;
  cardClass: string;
  avatarClass: string;
  badgeClass: string;
  dotClass: string;
  align: 'start' | 'end' | 'center';
};

export const SUPPORT_AUTHOR_GROUP_THEMES: Record<SupportAuthorGroup, SupportAuthorGroupTheme> = {
  requester: {
    label: 'Talep sahibi',
    shortLabel: 'Öğretmen',
    cardClass:
      'border-violet-300/55 bg-linear-to-br from-violet-50/95 via-fuchsia-50/50 to-background/90 dark:border-violet-700/45 dark:from-violet-950/45 dark:via-fuchsia-950/25 dark:to-background/80',
    avatarClass: 'bg-linear-to-br from-violet-500 to-fuchsia-600 text-white',
    badgeClass:
      'border border-violet-300/50 bg-violet-200/90 text-violet-950 dark:border-violet-600/40 dark:bg-violet-900/55 dark:text-violet-100',
    dotClass: 'bg-violet-500',
    align: 'start',
  },
  school_staff: {
    label: 'Okul destek ekibi',
    shortLabel: 'Okul',
    cardClass:
      'border-sky-300/55 bg-linear-to-br from-sky-50/95 via-cyan-50/55 to-background/90 dark:border-sky-700/45 dark:from-sky-950/40 dark:via-cyan-950/25 dark:to-background/80',
    avatarClass: 'bg-linear-to-br from-sky-500 to-cyan-600 text-white',
    badgeClass:
      'border border-sky-300/50 bg-sky-200/90 text-sky-950 dark:border-sky-600/40 dark:bg-sky-900/55 dark:text-sky-100',
    dotClass: 'bg-sky-500',
    align: 'end',
  },
  platform: {
    label: 'Platform destek',
    shortLabel: 'Platform',
    cardClass:
      'border-emerald-300/55 bg-linear-to-br from-emerald-50/95 via-teal-50/50 to-background/90 dark:border-emerald-700/45 dark:from-emerald-950/40 dark:via-teal-950/25 dark:to-background/80',
    avatarClass: 'bg-linear-to-br from-emerald-500 to-teal-600 text-white',
    badgeClass:
      'border border-emerald-300/50 bg-emerald-200/90 text-emerald-950 dark:border-emerald-600/40 dark:bg-emerald-900/55 dark:text-emerald-100',
    dotClass: 'bg-emerald-500',
    align: 'end',
  },
  internal: {
    label: 'İç not',
    shortLabel: 'İç not',
    cardClass:
      'border-amber-400/55 bg-linear-to-br from-amber-50/95 via-orange-50/45 to-background/90 dark:border-amber-700/45 dark:from-amber-950/40 dark:via-orange-950/20 dark:to-background/80',
    avatarClass: 'bg-linear-to-br from-amber-500 to-orange-600 text-white',
    badgeClass:
      'border border-amber-400/50 bg-amber-200/90 text-amber-950 dark:border-amber-600/40 dark:bg-amber-900/55 dark:text-amber-100',
    dotClass: 'bg-amber-500',
    align: 'end',
  },
  system: {
    label: 'Sistem',
    shortLabel: 'Sistem',
    cardClass:
      'border-slate-300/50 bg-linear-to-br from-slate-50/95 to-background/90 dark:border-slate-600/40 dark:from-slate-900/40 dark:to-background/80',
    avatarClass: 'bg-linear-to-br from-slate-500 to-slate-600 text-white',
    badgeClass:
      'border border-slate-300/50 bg-slate-200/90 text-slate-800 dark:border-slate-600/40 dark:bg-slate-800/55 dark:text-slate-100',
    dotClass: 'bg-slate-400',
    align: 'center',
  },
};

export function supportAuthorGroupTheme(group: SupportAuthorGroup): SupportAuthorGroupTheme {
  return SUPPORT_AUTHOR_GROUP_THEMES[group];
}
