'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { toast } from 'sonner';
import { CheckCircle2, Mail, Clock, Shield, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stage = 'email_pending' | 'school_pending' | 'none' | 'approved' | 'rejected';

type QueueItem = {
  id: string;
  email: string;
  display_name: string | null;
  school: { id: string; name: string } | null;
  school_join_stage: Stage;
  school_join_email_verified_at: string | null;
  created_at: string;
};

const STAGE_BADGE: Record<Stage, { label: string; className: string }> = {
  email_pending: {
    label: 'E-posta bekleniyor',
    className:
      'bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/25 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-500/20',
  },
  school_pending: {
    label: 'Okul onayı bekliyor',
    className:
      'bg-sky-500/15 text-sky-900 ring-1 ring-sky-500/25 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-500/20',
  },
  none: { label: '—', className: 'bg-muted text-muted-foreground' },
  approved: {
    label: 'Onaylı',
    className: 'bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-200',
  },
  rejected: {
    label: 'Reddedildi',
    className: 'bg-rose-500/15 text-rose-900 ring-1 ring-rose-500/20 dark:bg-rose-950/40 dark:text-rose-200',
  },
};

export default function SchoolJoinQueuePage() {
  const { token, me } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setLoading(true);
    try {
      const r = await apiFetch<{ items: QueueItem[] }>('/users/school-join-queue', { token });
      setItems(r.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    if (!token) return;
    try {
      await apiFetch(`/users/${id}/teacher-school-membership`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ action }),
      });
      const msgs = { approve: 'Onaylandı', reject: 'Reddedildi', revoke: 'Onay geri alındı' };
      toast.success(msgs[action]);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı');
    }
  };

  if (me && me.role !== 'superadmin' && me.role !== 'school_admin') {
    return (
      <div className="p-4 sm:p-6">
        <Alert message="Bu sayfa yalnızca okul yöneticisi veya süper yönetici içindir." />
      </div>
    );
  }

  const isSuper = me?.role === 'superadmin';
  const emailPending = items.filter((i) => i.school_join_stage === 'email_pending');
  const schoolPending = items.filter((i) => i.school_join_stage === 'school_pending');

  const profileHref = (id: string) => (isSuper ? `/users/${id}` : `/teachers?edit=${id}`);

  return (
    <div className="support-page mx-auto max-w-6xl space-y-2 px-1 pb-4 sm:space-y-4 sm:px-2 sm:pb-6 md:p-0">
      <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2.5 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-cyan-400/18 blur-3xl dark:bg-cyan-500/10 sm:size-32"
          aria-hidden
        />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-10">
              <ClipboardList className="size-[1.05rem] sm:size-[1.2rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
                {isSuper ? 'Okul kayıt kuyruğu (tüm okullar)' : 'Öğretmen onay kuyruğu'}
              </h1>
              <div className="mt-0.5">
                <ToolbarIconHints
                  compact
                  showOnMobile
                  className="text-[11px] sm:text-xs"
                  items={[
                    { label: 'E-posta', icon: Mail },
                    { label: 'Okul onayı', icon: Shield },
                  ]}
                  summary={
                    isSuper
                      ? 'Tüm okulların bekleyen başvuruları; onay ilgili okul yöneticisindedir.'
                      : 'E-postayı doğrulayan öğretmenleri onaylayın veya reddedin.'
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground sm:text-sm">
        {isSuper
          ? 'Okul yöneticisi onayı bekleyen başvuruların genel görünümü. Öğretmen onayı ilgili okul yöneticisi tarafından yapılır.'
          : 'E-postasını doğrulayan öğretmenleri onaylayın veya reddedin. Onay sonrası öğretmen e-posta ile giriş yapabilir.'}
      </p>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
        <div className="rounded-lg border border-amber-500/25 bg-linear-to-br from-amber-500/8 to-card p-2 shadow-sm ring-1 ring-amber-500/10 sm:rounded-xl sm:p-3">
          <div className="flex items-center justify-between gap-0.5">
            <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">E-posta bekleyen</span>
            <Mail className="size-3.5 shrink-0 text-amber-600 sm:size-4" />
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums sm:mt-1.5 sm:text-xl">{emailPending.length}</p>
        </div>
        <div className="rounded-lg border border-sky-500/25 bg-linear-to-br from-sky-500/8 to-card p-2 shadow-sm ring-1 ring-sky-500/10 sm:rounded-xl sm:p-3">
          <div className="flex items-center justify-between gap-0.5">
            <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">Onayınızı bekleyen</span>
            <Shield className="size-3.5 shrink-0 text-sky-600 sm:size-4" />
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums sm:mt-1.5 sm:text-xl">{schoolPending.length}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/85 p-2 shadow-sm backdrop-blur sm:rounded-xl sm:p-3">
          <div className="flex items-center justify-between gap-0.5">
            <span className="text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">Toplam kayıt</span>
            <Clock className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums sm:mt-1.5 sm:text-xl">{items.length}</p>
        </div>
      </div>

      {error && <Alert message={error} className="py-2 text-sm" />}
      {loading ? (
        <LoadingSpinner label="Yükleniyor…" className="py-8" />
      ) : items.length === 0 ? (
        <Card className="overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-sm sm:rounded-2xl">
          <CardContent className="py-8 text-center text-xs text-muted-foreground sm:py-10 sm:text-sm">
            Bekleyen başvuru yok.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-xl border border-emerald-500/15 bg-linear-to-br from-emerald-500/5 via-card to-sky-500/5 shadow-sm ring-1 ring-emerald-500/10 dark:from-emerald-950/20 dark:to-sky-950/15 sm:rounded-2xl">
          <CardHeader className="border-b border-border/50 bg-linear-to-r from-emerald-500/10 via-background/90 to-sky-500/8 px-3 py-2.5 sm:px-5 sm:py-3">
            <CardTitle className="text-sm font-bold sm:text-base">Başvurular</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Mobil kartlar */}
            <div className="space-y-2 p-2 sm:hidden">
              {items.map((row) => {
                const st = STAGE_BADGE[row.school_join_stage] ?? STAGE_BADGE.none;
                const canAct = !isSuper && row.school_join_stage === 'school_pending';
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-border/50 bg-card/90 p-2.5 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{row.display_name ?? '—'}</p>
                        <p className="text-[11px] text-muted-foreground">{row.email}</p>
                        {isSuper && <p className="mt-0.5 text-[11px] text-muted-foreground">{row.school?.name ?? '—'}</p>}
                      </div>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', st.className)}>{st.label}</span>
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString('tr-TR')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Link href={profileHref(row.id)} className="text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400">
                        Profil
                      </Link>
                      {canAct ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void act(row.id, 'approve')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white"
                          >
                            <CheckCircle2 className="size-3" />
                            Onayla
                          </button>
                          <button
                            type="button"
                            onClick={() => void act(row.id, 'reject')}
                            className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium"
                          >
                            Reddet
                          </button>
                        </>
                      ) : isSuper ? (
                        <span className="text-[10px] text-muted-foreground">Okul yöneticisi onaylar</span>
                      ) : row.school_join_stage === 'email_pending' ? (
                        <span className="text-[10px] text-muted-foreground">E-posta sonrası onay</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Masaüstü tablo */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/25">
                    <th className="px-3 py-2.5 text-xs font-semibold sm:px-4 sm:py-3">Öğretmen</th>
                    {isSuper && <th className="px-3 py-2.5 text-xs font-semibold sm:px-4 sm:py-3">Okul</th>}
                    <th className="px-3 py-2.5 text-xs font-semibold sm:px-4 sm:py-3">Aşama</th>
                    <th className="px-3 py-2.5 text-xs font-semibold sm:px-4 sm:py-3">Kayıt</th>
                    <th className="w-[200px] px-3 py-2.5 text-xs font-semibold sm:px-4 sm:py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const st = STAGE_BADGE[row.school_join_stage] ?? STAGE_BADGE.none;
                    const canAct = !isSuper && row.school_join_stage === 'school_pending';
                    return (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                          <div className="font-medium text-foreground">{row.display_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                          <Link href={profileHref(row.id)} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                            Profil
                          </Link>
                        </td>
                        {isSuper && <td className="px-3 py-2.5 text-muted-foreground sm:px-4 sm:py-3">{row.school?.name ?? '—'}</td>}
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', st.className)}>
                            {st.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground sm:px-4 sm:py-3">
                          {new Date(row.created_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                          {canAct ? (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => void act(row.id, 'approve')}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                              >
                                <CheckCircle2 className="size-3.5" />
                                Onayla
                              </button>
                              <button
                                type="button"
                                onClick={() => void act(row.id, 'reject')}
                                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                              >
                                Reddet
                              </button>
                            </div>
                          ) : isSuper ? (
                            <span className="text-xs text-muted-foreground">Okul yöneticisi onaylar</span>
                          ) : row.school_join_stage === 'email_pending' ? (
                            <span className="text-xs text-muted-foreground">E-posta doğrulanınca onaylayabilirsiniz</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
