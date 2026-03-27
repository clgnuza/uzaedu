'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { CheckCircle2, Mail, Clock, Shield } from 'lucide-react';

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
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  },
  school_pending: {
    label: 'Okul onayı bekliyor',
    className: 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
  },
  none: { label: '—', className: 'bg-muted text-muted-foreground' },
  approved: { label: 'Onaylı', className: 'bg-emerald-100 text-emerald-900' },
  rejected: { label: 'Reddedildi', className: 'bg-rose-100 text-rose-900' },
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
      <div className="p-6">
        <Alert message="Bu sayfa yalnızca okul yöneticisi veya süper yönetici içindir." />
      </div>
    );
  }

  const isSuper = me?.role === 'superadmin';
  const emailPending = items.filter((i) => i.school_join_stage === 'email_pending');
  const schoolPending = items.filter((i) => i.school_join_stage === 'school_pending');

  const profileHref = (id: string) => (isSuper ? `/users/${id}` : `/teachers?edit=${id}`);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {isSuper ? 'Okul kayıt kuyruğu (tüm okullar)' : 'Öğretmen onay kuyruğu'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuper
            ? 'Okul yöneticisi onayı bekleyen başvuruların genel görünümü. Öğretmen onayı ilgili okul yöneticisi tarafından yapılır.'
            : 'E-postasını doğrulayan öğretmenleri onaylayın veya reddedin. Onay sonrası öğretmen e-posta ile giriş yapabilir.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-amber-200/60 dark:border-amber-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
              <Mail className="size-4" />
              E-posta bekleyen
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{emailPending.length}</CardContent>
        </Card>
        <Card className="border-sky-200/60 dark:border-sky-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-sky-900 dark:text-sky-100">
              <Shield className="size-4" />
              Onayınızı bekleyen
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{schoolPending.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="size-4" />
              Toplam bekleyen
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{items.length}</CardContent>
        </Card>
      </div>

      {error && <Alert message={error} />}
      {loading ? (
        <LoadingSpinner label="Yükleniyor…" />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">Bekleyen başvuru yok.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Başvurular</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 font-medium">Öğretmen</th>
                    {isSuper && <th className="px-4 py-3 font-medium">Okul</th>}
                    <th className="px-4 py-3 font-medium">Aşama</th>
                    <th className="px-4 py-3 font-medium">Kayıt</th>
                    <th className="px-4 py-3 font-medium w-[200px]">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const st = STAGE_BADGE[row.school_join_stage] ?? STAGE_BADGE.none;
                    const canAct = !isSuper && row.school_join_stage === 'school_pending';
                    return (
                      <tr key={row.id} className="border-b border-border/80 last:border-0">
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{row.display_name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                          <Link href={profileHref(row.id)} className="text-xs text-primary hover:underline">
                            Profil
                          </Link>
                        </td>
                        {isSuper && (
                          <td className="px-4 py-3 text-muted-foreground">{row.school?.name ?? '—'}</td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString('tr-TR')}
                        </td>
                        <td className="px-4 py-3">
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
