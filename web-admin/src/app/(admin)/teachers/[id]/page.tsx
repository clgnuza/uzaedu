'use client';

import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  BookOpen,
  Pencil,
  ShieldCheck,
  ShieldOff,
  Clock,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

type UserItem = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  school_id: string | null;
  status: string;
  teacher_branch?: string | null;
  teacher_phone?: string | null;
  teacher_title?: string | null;
  avatar_url?: string | null;
  teacher_school_membership?: 'none' | 'pending' | 'approved' | 'rejected';
  school_verified?: boolean;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  suspended: 'Askıda',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-900 ring-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-400/25',
  passive: 'bg-slate-500/15 text-slate-800 ring-slate-400/25 dark:bg-slate-500/20 dark:text-slate-100 dark:ring-slate-500/30',
  suspended: 'bg-amber-500/20 text-amber-950 ring-amber-500/35 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-400/25',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function InfoTile({
  icon: Icon,
  label,
  children,
  className,
  iconClass,
}: {
  icon: ElementType;
  label: string;
  children: React.ReactNode;
  className?: string;
  iconClass?: string;
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-3 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06] sm:p-3.5',
        className,
      )}
    >
      <div
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 sm:size-11',
          iconClass,
        )}
      >
        <Icon className="size-[1.05rem] sm:size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[11px]">{label}</p>
        <div className="mt-1 text-sm font-medium leading-snug text-foreground sm:text-[0.9375rem]">{children}</div>
      </div>
    </div>
  );
}

export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { token, me } = useAuth();
  const [user, setUser] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    apiFetch<UserItem>(`/users/${id}`, { token })
      .then((u) => {
        if (me?.role === 'school_admin' && u.school_id !== me?.school?.id) {
          setError('Bu öğretmene erişim yetkiniz yok.');
          setUser(null);
        } else {
          setUser(u);
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token, id, me?.role, me?.school?.id]);

  if (!me || me.role !== 'school_admin') {
    router.replace('/teachers');
    return null;
  }

  if (loading) {
    return (
      <div className="support-page space-y-3 pb-6 sm:space-y-4">
        <div className="relative overflow-hidden rounded-2xl border border-sky-400/20 bg-linear-to-br from-sky-500/12 via-violet-500/8 to-emerald-500/10 p-4 ring-1 ring-sky-500/15 dark:border-sky-500/20 sm:p-5">
          <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-cyan-400/15 blur-3xl" aria-hidden />
          <div className="relative h-8 w-40 animate-pulse rounded-lg bg-white/30 dark:bg-white/10" />
          <div className="relative mt-4 flex gap-4">
            <div className="size-20 shrink-0 animate-pulse rounded-2xl bg-white/25 dark:bg-white/10 sm:size-24" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-6 w-48 animate-pulse rounded-md bg-white/30 dark:bg-white/10" />
              <div className="h-4 w-64 animate-pulse rounded-md bg-white/20 dark:bg-white/5" />
            </div>
          </div>
        </div>
        <LoadingSpinner label="Öğretmen bilgileri yükleniyor…" className="py-8" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="support-page space-y-4 pb-6">
        <div className="rounded-2xl border border-rose-500/25 bg-linear-to-br from-rose-500/10 to-amber-500/8 p-4 ring-1 ring-rose-500/15 sm:p-5">
          <h1 className="text-base font-semibold text-foreground sm:text-lg">Öğretmen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Kayıt yüklenemedi veya erişim yok.</p>
        </div>
        <Alert message={error ?? 'Öğretmen bulunamadı'} className="border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/25" />
        <Link
          href="/teachers"
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 text-sm font-semibold text-sky-900 transition-colors hover:bg-sky-500/15 dark:text-sky-100"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Listeye dön
        </Link>
      </div>
    );
  }

  const initial = (user.display_name || user.email).charAt(0).toUpperCase();
  const displayName = user.display_name ?? 'İsim belirtilmemiş';

  return (
    <div className="support-page space-y-3 pb-6 sm:space-y-4 sm:pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-400/25 bg-linear-to-br from-sky-500/14 via-cyan-500/10 to-emerald-500/12 p-3 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/25 dark:from-sky-950/50 dark:via-cyan-950/25 dark:to-emerald-950/35 sm:p-4">
        <div
          className="pointer-events-none absolute -right-8 -top-12 size-32 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/15 sm:size-40"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-8 -left-6 size-28 rounded-full bg-violet-400/15 blur-2xl dark:bg-violet-600/10"
          aria-hidden
        />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <div className="absolute -inset-0.5 rounded-2xl bg-linear-to-br from-sky-500 via-cyan-400 to-emerald-500 opacity-80 blur-[2px]" aria-hidden />
              <div className="relative flex size-[4.5rem] overflow-hidden rounded-2xl bg-linear-to-br from-sky-600 to-emerald-600 shadow-lg ring-2 ring-white/40 dark:ring-white/10 sm:size-24">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-2xl font-bold text-white drop-shadow-sm sm:text-3xl">
                    {initial}
                  </span>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-950 ring-1 ring-sky-500/20 dark:bg-white/10 dark:text-sky-100 dark:ring-white/10 sm:text-[11px]">
                  <GraduationCap className="size-3" aria-hidden />
                  Öğretmen
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 sm:text-xs',
                    STATUS_STYLES[user.status] ?? 'bg-muted text-muted-foreground ring-border',
                  )}
                >
                  {STATUS_LABELS[user.status] ?? user.status}
                </span>
              </div>
              <h1 className="mt-1.5 text-lg font-bold leading-tight tracking-tight text-foreground sm:text-2xl">{displayName}</h1>
              <a
                href={`mailto:${user.email}`}
                className="mt-0.5 block truncate text-xs font-medium text-sky-700 hover:underline dark:text-sky-300 sm:text-sm"
              >
                {user.email}
              </a>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.school_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-900 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-100 sm:text-xs">
                    <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
                    Okul onaylı
                  </span>
                ) : user.teacher_school_membership === 'pending' ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/45 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-950 dark:bg-amber-500/20 dark:text-amber-100 sm:text-xs">
                      <Clock className="size-3.5 shrink-0" aria-hidden />
                      Onay bekliyor
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/12 px-2.5 py-1 text-[10px] font-semibold text-slate-800 dark:text-slate-200 sm:text-xs">
                      <ShieldOff className="size-3.5 shrink-0" aria-hidden />
                      Kurumsal e-posta sonrası
                    </span>
                  </>
                ) : user.school_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/35 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-900 dark:bg-rose-950/40 dark:text-rose-100 sm:text-xs">
                    <ShieldOff className="size-3.5 shrink-0" aria-hidden />
                    Üyelik onaysız
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[10rem] sm:items-end">
            <Link
              href="/teachers"
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/30 px-3 text-xs font-semibold text-foreground backdrop-blur-sm transition-colors hover:bg-white/45 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15 sm:w-auto sm:px-4 sm:text-sm"
            >
              <ArrowLeft className="size-4 shrink-0" aria-hidden />
              Listeye dön
            </Link>
            <Link
              href={`/teachers?edit=${user.id}`}
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-3 text-xs font-bold text-white shadow-md shadow-emerald-900/20 transition-[transform,opacity] hover:opacity-95 active:scale-[0.99] dark:shadow-emerald-950/40 sm:w-auto sm:px-4 sm:text-sm"
            >
              <Pencil className="size-4 shrink-0" aria-hidden />
              Düzenle
            </Link>
          </div>
        </div>
      </div>

      {/* Bilgi kutuları */}
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm ring-1 ring-sky-500/8 dark:ring-sky-500/10">
        <CardContent className="space-y-2 p-3 sm:space-y-2.5 sm:p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
            <Sparkles className="size-3.5 text-violet-500 dark:text-violet-400" aria-hidden />
            İletişim ve kayıt
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-2.5">
            <InfoTile
              icon={Mail}
              label="E-posta"
              className="border-sky-500/20 bg-linear-to-br from-sky-500/8 to-transparent dark:from-sky-950/35"
              iconClass="bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:bg-sky-500/20 dark:text-sky-200"
            >
              <a href={`mailto:${user.email}`} className="break-all text-sky-800 hover:underline dark:text-sky-200">
                {user.email}
              </a>
            </InfoTile>

            {user.teacher_phone ? (
              <InfoTile
                icon={Phone}
                label="Telefon"
                className="border-emerald-500/20 bg-linear-to-br from-emerald-500/8 to-transparent dark:from-emerald-950/35"
                iconClass="bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-200"
              >
                <a href={`tel:${user.teacher_phone}`} className="text-emerald-900 hover:underline dark:text-emerald-100">
                  {user.teacher_phone}
                </a>
              </InfoTile>
            ) : (
              <InfoTile
                icon={Phone}
                label="Telefon"
                className="border-dashed border-muted-foreground/25 bg-muted/20"
                iconClass="bg-muted text-muted-foreground ring-border"
              >
                <span className="font-normal text-muted-foreground">Belirtilmemiş</span>
              </InfoTile>
            )}

            {user.teacher_branch ? (
              <InfoTile
                icon={BookOpen}
                label="Branş"
                className="border-violet-500/20 bg-linear-to-br from-violet-500/8 to-transparent dark:from-violet-950/35"
                iconClass="bg-violet-500/15 text-violet-800 ring-violet-500/25 dark:bg-violet-500/20 dark:text-violet-200"
              >
                {user.teacher_branch}
              </InfoTile>
            ) : (
              <InfoTile
                icon={BookOpen}
                label="Branş"
                className="border-dashed border-muted-foreground/25 bg-muted/20"
                iconClass="bg-muted text-muted-foreground ring-border"
              >
                <span className="font-normal text-muted-foreground">Belirtilmemiş</span>
              </InfoTile>
            )}

            {user.teacher_title ? (
              <InfoTile
                icon={Briefcase}
                label="Ünvan"
                className="border-amber-500/25 bg-linear-to-br from-amber-500/10 to-transparent dark:from-amber-950/30"
                iconClass="bg-amber-500/15 text-amber-950 ring-amber-500/30 dark:bg-amber-500/20 dark:text-amber-100"
              >
                {user.teacher_title}
              </InfoTile>
            ) : (
              <InfoTile
                icon={Briefcase}
                label="Ünvan"
                className="border-dashed border-muted-foreground/25 bg-muted/20"
                iconClass="bg-muted text-muted-foreground ring-border"
              >
                <span className="font-normal text-muted-foreground">Belirtilmemiş</span>
              </InfoTile>
            )}

            <InfoTile
              icon={Calendar}
              label="Kayıt tarihi"
              className="border-cyan-500/20 bg-linear-to-br from-cyan-500/8 to-transparent dark:from-cyan-950/30 sm:col-span-2"
              iconClass="bg-cyan-500/15 text-cyan-800 ring-cyan-500/25 dark:bg-cyan-500/20 dark:text-cyan-200"
            >
              {formatDate(user.created_at)}
            </InfoTile>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
