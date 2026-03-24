'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Calendar, Briefcase, BookOpen, Pencil, ShieldCheck, ShieldOff, Clock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import {
  Toolbar,
  ToolbarHeading,
  ToolbarPageTitle,
  ToolbarDescription,
  ToolbarActions,
} from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  passive: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
      <div className="space-y-6">
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle>Öğretmen</ToolbarPageTitle>
            <ToolbarDescription>Öğretmen detayı yükleniyor…</ToolbarDescription>
          </ToolbarHeading>
        </Toolbar>
        <LoadingSpinner label="Öğretmen bilgileri yükleniyor…" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle>Öğretmen</ToolbarPageTitle>
            <ToolbarDescription>Hata</ToolbarDescription>
          </ToolbarHeading>
        </Toolbar>
        <Alert message={error ?? 'Öğretmen bulunamadı'} />
        <Link
          href="/teachers"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Listeye dön
        </Link>
      </div>
    );
  }

  const initial = (user.display_name || user.email).charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Öğretmen Detayı</ToolbarPageTitle>
          <ToolbarDescription>
            {user.display_name ?? 'İsim belirtilmemiş'}
          </ToolbarDescription>
        </ToolbarHeading>
        <ToolbarActions>
          <Link
            href="/teachers"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Listeye dön
          </Link>
          <Link
            href={`/teachers?edit=${user.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Pencil className="size-4" />
            Düzenle
          </Link>
        </ToolbarActions>
      </Toolbar>

      <Card>
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex items-start gap-4">
            <div className="flex size-20 shrink-0 overflow-hidden rounded-full bg-primary/10">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-2xl font-semibold text-primary">
                  {initial}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-xl">
                {user.display_name ?? 'İsim belirtilmemiş'}
              </CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_STYLES[user.status] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {STATUS_LABELS[user.status] ?? user.status}
                </span>
                {user.school_verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    <ShieldCheck className="size-3.5" />
                    Onaylı
                  </span>
                ) : user.teacher_school_membership === 'pending' ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      <ShieldOff className="size-3.5" />
                      Onaysız
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
                      <Clock className="size-3.5" />
                      Onay bekliyor
                    </span>
                  </>
                ) : user.school_id ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-400/35 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <ShieldOff className="size-3.5" />
                    Onaysız
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Mail className="size-5 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-posta</dt>
                <dd>
                  <a href={`mailto:${user.email}`} className="text-foreground hover:text-primary">
                    {user.email}
                  </a>
                </dd>
              </div>
            </div>
            {user.teacher_phone && (
              <div className="flex items-start gap-3">
                <Phone className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Telefon</dt>
                  <dd>
                    <a href={`tel:${user.teacher_phone}`} className="text-foreground hover:text-primary">
                      {user.teacher_phone}
                    </a>
                  </dd>
                </div>
              </div>
            )}
            {user.teacher_branch && (
              <div className="flex items-start gap-3">
                <BookOpen className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Branş</dt>
                  <dd>{user.teacher_branch}</dd>
                </div>
              </div>
            )}
            {user.teacher_title && (
              <div className="flex items-start gap-3">
                <Briefcase className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ünvan</dt>
                  <dd>{user.teacher_title}</dd>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Calendar className="size-5 shrink-0 text-muted-foreground mt-0.5" />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Kayıt tarihi</dt>
                <dd>{formatDate(user.created_at)}</dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
