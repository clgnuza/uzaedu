'use client';

import { useEffect, useState, useCallback } from 'react';
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
  School,
  Shield,
  UserCog,
  GraduationCap,
  Wallet,
  Coins,
} from 'lucide-react';
import { toast } from 'sonner';
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
  school?: { id: string; name: string } | null;
  status: string;
  teacher_branch?: string | null;
  teacher_phone?: string | null;
  teacher_title?: string | null;
  avatar_url?: string | null;
  teacher_subject_ids?: string[] | null;
  created_at: string;
  updated_at?: string;
  market_jeton_balance?: string | number | null;
  market_ekders_balance?: string | number | null;
  teacher_school_membership?: 'none' | 'pending' | 'approved' | 'rejected';
  school_verified?: boolean;
};

type UserCreditRow = {
  id: string;
  jeton_credit: number;
  ekders_credit: number;
  note: string | null;
  created_at: string;
  created_by_user_id: string;
  creator_email: string | null;
  creator_display_name: string | null;
};

function fmtNum(n: unknown): string {
  const x = typeof n === 'number' ? n : parseFloat(String(n ?? '0'));
  if (!Number.isFinite(x)) return '0';
  return Number.isInteger(x) ? String(x) : x.toFixed(4).replace(/\.?0+$/, '');
}

function parsePositiveAmount(s: string): number {
  const x = parseFloat(String(s).replace(',', '.').trim());
  if (!Number.isFinite(x) || x < 0) return 0;
  return x;
}

function parseBalanceNum(n: unknown): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n ?? '0').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Süper Admin',
  moderator: 'Moderatör',
  school_admin: 'Okul Admin',
  teacher: 'Öğretmen',
};

const ROLE_STYLES: Record<string, string> = {
  superadmin: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  moderator: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  school_admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  teacher: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  superadmin: <Shield className="size-5" />,
  moderator: <Shield className="size-5" />,
  school_admin: <UserCog className="size-5" />,
  teacher: <GraduationCap className="size-5" />,
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  passive: 'Pasif',
  suspended: 'Askıda',
  deleted: 'Silindi',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  passive: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  deleted: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { token, me } = useAuth();
  const [user, setUser] = useState<UserItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creditRows, setCreditRows] = useState<UserCreditRow[]>([]);
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditPage, setCreditPage] = useState(1);
  const [creditFrom, setCreditFrom] = useState('');
  const [creditTo, setCreditTo] = useState('');
  const [creditLoading, setCreditLoading] = useState(false);
  const [addJeton, setAddJeton] = useState('');
  const [addEkders, setAddEkders] = useState('');
  const [addNote, setAddNote] = useState('');
  const [addingCredit, setAddingCredit] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    apiFetch<UserItem>(`/users/${id}`, { token })
      .then(setUser)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Yüklenemedi');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token, id, me?.role, me?.school?.id]);

  const fetchUserCredits = useCallback(async () => {
    if (!token || !id || me?.role !== 'superadmin') return;
    setCreditLoading(true);
    try {
      const q = new URLSearchParams({ page: String(creditPage), limit: '20' });
      if (creditFrom.trim()) q.set('from', creditFrom.trim());
      if (creditTo.trim()) q.set('to', creditTo.trim());
      const res = await apiFetch<{ total: number; items: UserCreditRow[] }>(
        `/market/admin/users/${id}/credits?${q}`,
        { token },
      );
      setCreditRows(res.items);
      setCreditTotal(res.total);
    } catch {
      setCreditRows([]);
      setCreditTotal(0);
    } finally {
      setCreditLoading(false);
    }
  }, [token, id, me?.role, creditPage, creditFrom, creditTo]);

  useEffect(() => {
    if (token && id && me?.role === 'superadmin' && user?.role === 'teacher') void fetchUserCredits();
  }, [token, id, me?.role, user?.role, fetchUserCredits]);

  const canViewUser =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('users'));
  if (!me || !canViewUser) {
    router.replace('/dashboard');
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle>Kullanıcı</ToolbarPageTitle>
            <ToolbarDescription>Yükleniyor…</ToolbarDescription>
          </ToolbarHeading>
        </Toolbar>
        <LoadingSpinner label="Kullanıcı bilgileri yükleniyor…" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <Toolbar>
          <ToolbarHeading>
            <ToolbarPageTitle>Kullanıcı</ToolbarPageTitle>
            <ToolbarDescription>Hata</ToolbarDescription>
          </ToolbarHeading>
        </Toolbar>
        <Alert message={error ?? 'Kullanıcı bulunamadı'} />
        <Link
          href="/users"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Listeye dön
        </Link>
      </div>
    );
  }

  const initial = (user.display_name || user.email || '?').charAt(0).toUpperCase();
  const showTeacherWallet = me.role === 'superadmin' && user.role === 'teacher';

  const handleTeacherMembershipChange = async (v: string) => {
    if (!token || !id || user.role !== 'teacher') return;
    if (!user.school_id && (v === 'pending' || v === 'approved')) {
      toast.error('Önce kullanıcıya bir okul atanmalı (Düzenle).');
      return;
    }
    setSavingMembership(true);
    try {
      const u = await apiFetch<UserItem>(`/users/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ teacher_school_membership: v }),
      });
      setUser(u);
      toast.success('Okul üyeliği güncellendi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Güncellenemedi');
    } finally {
      setSavingMembership(false);
    }
  };

  const handleAddUserCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !id) return;
    const j = parsePositiveAmount(addJeton);
    const ek = parsePositiveAmount(addEkders);
    if (j <= 0 && ek <= 0) {
      toast.error('Jeton veya ek ders için 0’dan büyük bir değer girin');
      return;
    }
    setAddingCredit(true);
    try {
      await apiFetch(`/market/admin/users/${id}/credits`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          jeton: j,
          ekders: ek,
          note: addNote.trim() || undefined,
        }),
      });
      toast.success('Bakiye eklendi');
      setAddJeton('');
      setAddEkders('');
      setAddNote('');
      const u = await apiFetch<UserItem>(`/users/${id}`, { token });
      setUser(u);
      await fetchUserCredits();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Eklenemedi');
    } finally {
      setAddingCredit(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Kullanıcı Detayı</ToolbarPageTitle>
          <ToolbarDescription>{user.display_name ?? user.email}</ToolbarDescription>
        </ToolbarHeading>
        <ToolbarActions>
          <Link
            href="/users"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Listeye dön
          </Link>
          {me.role === 'superadmin' && (
            <Link
              href={`/users?edit=${user.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Pencil className="size-4" />
              Düzenle
            </Link>
          )}
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
              <CardTitle className="text-xl">{user.display_name ?? 'İsim belirtilmemiş'}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    ROLE_STYLES[user.role] ?? 'bg-muted'
                  }`}
                >
                  {ROLE_ICONS[user.role]}
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_STYLES[user.status] ?? 'bg-muted text-muted-foreground'
                  }`}
                >
                  {STATUS_LABELS[user.status] ?? user.status}
                </span>
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
            {user.school && (
              <div className="flex items-start gap-3">
                <School className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Okul</dt>
                  <dd>
                    <Link href={`/schools/${user.school.id}`} className="text-foreground hover:text-primary">
                      {user.school.name}
                    </Link>
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

      {me.role === 'superadmin' && user.role === 'teacher' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Okul üyeliği (test / yönetim)</CardTitle>
            <p className="text-sm text-muted-foreground">
              «Onaysız» senaryosu için «Onay bekliyor» seçin. Öğretmenin bir okulu olmalı.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full min-w-0 sm:min-w-[200px]">
              <label htmlFor="u-tsm" className="mb-1 block text-sm font-medium text-foreground">
                Kayıt durumu
              </label>
              <select
                id="u-tsm"
                value={user.teacher_school_membership ?? 'none'}
                disabled={savingMembership}
                onChange={(e) => void handleTeacherMembershipChange(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
              >
                <option value="none">Okul yok / üyelik yok</option>
                <option value="pending">Onay bekliyor (onaysız)</option>
                <option value="approved">Onaylı</option>
                <option value="rejected">Reddedildi</option>
              </select>
            </div>
            <p className="text-xs text-muted-foreground max-w-md pb-0.5">
              Rozet: onaylı = <span className="font-medium text-emerald-700 dark:text-emerald-300">Onaylı</span>, aksi halde{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">Onaysız</span> (beklemede ise ek rozet).
            </p>
          </CardContent>
        </Card>
      )}

      {showTeacherWallet && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5" />
              Market cüzdanı (öğretmen)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Bireysel jeton / ek ders bakiyesi, manuel yükleme ve geçmiş.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Şu anki bakiye</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                  <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100/90">
                    <Coins className="size-4 shrink-0" />
                    <span className="font-medium">Jeton</span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-amber-950 dark:text-amber-50">
                    {fmtNum(user.market_jeton_balance)}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-200/80 bg-sky-50/80 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
                  <div className="flex items-center gap-2 text-sm text-sky-900 dark:text-sky-100/90">
                    <Coins className="size-4 shrink-0" />
                    <span className="font-medium">Ek ders</span>
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-sky-950 dark:text-sky-50">
                    {fmtNum(user.market_ekders_balance)}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddUserCredit} className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-foreground">Öğretmene tutar yükle</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="u-add-jeton" className="block text-sm font-medium text-foreground">
                    Eklenecek jeton
                  </label>
                  <input
                    id="u-add-jeton"
                    type="text"
                    inputMode="decimal"
                    value={addJeton}
                    onChange={(e) => setAddJeton(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm tabular-nums"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="u-add-ekders" className="block text-sm font-medium text-foreground">
                    Eklenecek ek ders
                  </label>
                  <input
                    id="u-add-ekders"
                    type="text"
                    inputMode="decimal"
                    value={addEkders}
                    onChange={(e) => setAddEkders(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm tabular-nums"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="u-add-note" className="block text-sm font-medium text-foreground">
                  Not <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
                </label>
                <input
                  id="u-add-note"
                  type="text"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  maxLength={500}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm"
                />
              </div>
              {(() => {
                const jAdd = parsePositiveAmount(addJeton);
                const eAdd = parsePositiveAmount(addEkders);
                const curJ = parseBalanceNum(user.market_jeton_balance);
                const curE = parseBalanceNum(user.market_ekders_balance);
                const hasInput = jAdd > 0 || eAdd > 0;
                if (!hasInput) return null;
                return (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Kayıt sonrası bakiye (önizleme)</p>
                    <p className="mt-2 tabular-nums">
                      Jeton: {fmtNum(curJ)} + <strong>{fmtNum(jAdd)}</strong> = <strong>{fmtNum(curJ + jAdd)}</strong>
                    </p>
                    <p className="mt-1 tabular-nums">
                      Ek ders: {fmtNum(curE)} + <strong>{fmtNum(eAdd)}</strong> = <strong>{fmtNum(curE + eAdd)}</strong>
                    </p>
                  </div>
                );
              })()}
              <button
                type="submit"
                disabled={addingCredit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 sm:w-auto"
              >
                <Wallet className="size-4" />
                {addingCredit ? 'Yükleniyor…' : 'Tutarı öğretmen cüzdanına ekle'}
              </button>
            </form>

            <div>
              <p className="mb-3 text-sm font-semibold text-foreground">Yükleme geçmişi</p>
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Başlangıç</label>
                  <input
                    type="date"
                    value={creditFrom}
                    onChange={(e) => {
                      setCreditFrom(e.target.value);
                      setCreditPage(1);
                    }}
                    className="mt-0.5 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">Bitiş</label>
                  <input
                    type="date"
                    value={creditTo}
                    onChange={(e) => {
                      setCreditTo(e.target.value);
                      setCreditPage(1);
                    }}
                    className="mt-0.5 rounded-lg border border-input bg-background px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchUserCredits()}
                  className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium hover:bg-muted"
                >
                  Filtrele
                </button>
              </div>
              {creditLoading ? (
                <LoadingSpinner label="Geçmiş yükleniyor…" className="py-6" />
              ) : creditRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Henüz yükleme kaydı yok.</p>
              ) : (
                <>
                  <div className="table-x-scroll rounded-lg border border-border">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Tarih / saat</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Jeton</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Ek ders</th>
                          <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">İşlemi yapan</th>
                          <th className="px-3 py-2 text-xs font-semibold text-muted-foreground">Not</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {creditRows.map((r) => (
                          <tr key={r.id} className="hover:bg-muted/30">
                            <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                              {new Date(r.created_at).toLocaleString('tr-TR')}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">+{fmtNum(r.jeton_credit)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">+{fmtNum(r.ekders_credit)}</td>
                            <td className="px-3 py-2 text-foreground">
                              {r.creator_display_name || r.creator_email || r.created_by_user_id.slice(0, 8) + '…'}
                            </td>
                            <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground" title={r.note ?? ''}>
                              {r.note || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {creditTotal > 20 && (
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Toplam {creditTotal} kayıt</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={creditPage <= 1}
                          onClick={() => setCreditPage((p) => p - 1)}
                          className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                        >
                          Önceki
                        </button>
                        <button
                          type="button"
                          disabled={creditPage * 20 >= creditTotal}
                          onClick={() => setCreditPage((p) => p + 1)}
                          className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted"
                        >
                          Sonraki
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
