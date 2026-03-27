'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users as UsersIcon,
  UserPlus,
  Search,
  Pencil,
  Download,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCog,
  GraduationCap,
  BadgeCheck,
  Clock,
  XCircle,
  Minus,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { UserAvatarBubble } from '@/components/user-avatar';
import { ModeratorModulesField, getModeratorModuleLabel } from '@/components/users/moderator-modules-field';
import { cn } from '@/lib/utils';

type UserItem = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  school_id: string | null;
  school?: { id: string; name: string; city?: string | null; district?: string | null } | null;
  status: string;
  teacher_branch?: string | null;
  teacher_phone?: string | null;
  teacher_title?: string | null;
  avatar_url?: string | null;
  avatar_key?: string | null;
  teacher_subject_ids?: string[] | null;
  moderator_modules?: string[] | null;
  teacher_school_membership?: string | null;
  school_verified?: boolean;
  created_at: string;
  updated_at?: string;
};

type SchoolItem = { id: string; name: string; city?: string | null; district?: string | null };

function schoolLabel(s: SchoolItem): string {
  const loc = [s.city, s.district].filter(Boolean).join(' / ');
  return loc ? `${s.name} (${loc})` : s.name;
}

type ListResponse = { total: number; page: number; limit: number; items: UserItem[] };

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
  superadmin: <Shield className="size-3.5" />,
  moderator: <Shield className="size-3.5" />,
  school_admin: <UserCog className="size-3.5" />,
  teacher: <GraduationCap className="size-3.5" />,
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

const MEMBERSHIP_LABELS: Record<string, string> = {
  none: 'Okul atanmamış',
  pending: 'Onay bekliyor',
  approved: 'Onaylı üye',
  rejected: 'Reddedildi',
};

const MEMBERSHIP_STYLES: Record<string, string> = {
  none: 'bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300',
  pending: 'bg-amber-100 text-amber-900 dark:bg-amber-900/35 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/35 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200',
};

const STATUS_SELECT_ACCENT: Record<string, string> = {
  active: 'border-l-emerald-500',
  passive: 'border-l-slate-400',
  suspended: 'border-l-amber-500',
  deleted: 'border-l-red-500',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function UsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams?.get('edit');
  const { token, me } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [membershipFilter, setMembershipFilter] = useState<string>('');
  const [schoolIdFilter, setSchoolIdFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState<UserItem | null>(null);
  const limit = 20;
  const isSuperadmin = me?.role === 'superadmin';

  const canFetchSchools =
    isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'));

  useEffect(() => {
    apiFetch<string[]>('school-reviews-public/cities')
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    if (!cityFilter?.trim()) {
      setDistricts([]);
      setDistrictFilter('');
      return;
    }
    apiFetch<string[]>(`school-reviews-public/districts?city=${encodeURIComponent(cityFilter)}`)
      .then(setDistricts)
      .catch(() => setDistricts([]));
    setDistrictFilter('');
    setSchoolIdFilter('');
  }, [cityFilter]);

  useEffect(() => {
    setSchoolIdFilter('');
  }, [districtFilter]);

  useEffect(() => {
    const r = searchParams?.get('role');
    const m = searchParams?.get('teacher_school_membership');
    if (r && ['superadmin', 'moderator', 'school_admin', 'teacher'].includes(r)) {
      setRoleFilter(r);
      setPage(1);
    }
    if (m && ['none', 'pending', 'approved', 'rejected'].includes(m)) {
      setMembershipFilter(m);
      setPage(1);
    }
  }, [searchParams]);

  const fetchSchools = useCallback(async () => {
    if (!token || !canFetchSchools) return;
    const params = new URLSearchParams();
    params.set('limit', '100');
    if (cityFilter?.trim()) params.set('city', cityFilter.trim());
    if (districtFilter?.trim()) params.set('district', districtFilter.trim());
    try {
      const res = await apiFetch<{ items: SchoolItem[] }>(`schools?${params.toString()}`, { token });
      setSchools(Array.isArray(res?.items) ? res.items : []);
    } catch {
      setSchools([]);
    }
  }, [token, canFetchSchools, cityFilter, districtFilter]);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (roleFilter) params.set('role', roleFilter);
    if (membershipFilter) params.set('teacher_school_membership', membershipFilter);
    if (schoolIdFilter) params.set('school_id', schoolIdFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (searchDebounced.trim()) params.set('search', searchDebounced.trim());
    try {
      const res = await apiFetch<ListResponse>(`/users?${params.toString()}`, { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, page, roleFilter, membershipFilter, schoolIdFilter, statusFilter, searchDebounced]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchDebounced(searchQuery);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!editId || !token) return;
    const existing = data?.items?.find((u) => u.id === editId);
    if (existing) {
      setEditModalOpen(existing);
    } else {
      apiFetch<UserItem>(`/users/${editId}`, { token })
        .then(setEditModalOpen)
        .catch(() => toast.error('Kullanıcı yüklenemedi'));
    }
  }, [editId, token, data?.items]);

  const refreshAll = useCallback(() => {
    fetchList();
  }, [fetchList]);

  const filteredItems = data?.items ?? [];

  const handleExportCsv = () => {
    const headers = ['E-posta', 'Ad', 'Rol', 'Okul', 'Durum', 'Kayıt Tarihi'];
    const rows = filteredItems.map((u) => [
      u.email,
      u.display_name ?? '',
      ROLE_LABELS[u.role] ?? u.role,
      u.school?.name ?? '',
      STATUS_LABELS[u.status] ?? u.status,
      formatDate(u.created_at),
    ]);
    const csv = [
      headers.join(';'),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')),
    ].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV indirildi');
  };

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Kullanıcılar</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Kullanıcılar', icon: UsersIcon },
              { label: 'Filtreleme', icon: Search },
              { label: 'Roller', icon: UserCog },
            ]}
            summary="Tüm platform kullanıcıları, filtreleme ve yönetim"
          />
        </ToolbarHeading>
        <ToolbarActions>
          {isSuperadmin && (
            <button
              type="button"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow"
            >
              <UserPlus className="size-4" />
              Kullanıcı ekle
            </button>
          )}
        </ToolbarActions>
      </Toolbar>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-muted/20 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Kullanıcı listesi</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{filteredItems.length}</span> kullanıcı gösteriliyor
                <span className="mx-1.5">·</span>
                Toplam <span className="font-medium text-foreground">{data?.total ?? 0}</span>
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || !data?.items?.length}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="size-4" />
                CSV İndir
              </button>
              <div className="relative w-full sm:min-w-[180px] sm:max-w-[280px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="E-posta veya ad ara…"
                  className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
                />
              </div>
              {(isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'))) && (
                <>
                  <select
                    value={cityFilter}
                    onChange={(e) => {
                      setCityFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-auto sm:min-w-[120px]"
                  >
                    <option value="">Tüm iller</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={districtFilter}
                    onChange={(e) => {
                      setDistrictFilter(e.target.value);
                      setPage(1);
                    }}
                    disabled={!cityFilter}
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 disabled:opacity-50 sm:w-auto sm:min-w-[120px]"
                  >
                    <option value="">Tüm ilçeler</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={schoolIdFilter}
                    onChange={(e) => {
                      setSchoolIdFilter(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-auto sm:min-w-[180px]"
                  >
                    <option value="">Tüm okullar</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id}>{schoolLabel(s)}</option>
                    ))}
                  </select>
                </>
              )}
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-auto"
              >
                <option value="">Tüm roller</option>
                <option value="superadmin">Süper Admin</option>
                <option value="moderator">Moderatör</option>
                <option value="school_admin">Okul Admin</option>
                <option value="teacher">Öğretmen</option>
              </select>
              {isSuperadmin && (
                <select
                  value={membershipFilter}
                  onChange={(e) => {
                    setMembershipFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-auto sm:min-w-[160px]"
                  title="Öğretmen okul üyeliği"
                >
                  <option value="">Tümü (üyelik)</option>
                  <option value="none">Okul seçilmemiş</option>
                  <option value="pending">Onay bekliyor</option>
                  <option value="approved">Onaylı</option>
                  <option value="rejected">Reddedildi</option>
                </select>
              )}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 sm:w-auto"
              >
                <option value="">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="suspended">Askıda</option>
              </select>
            </div>
          </div>
          {error && <Alert message={error} className="mt-4" />}
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <LoadingSpinner label="Kullanıcı listesi yükleniyor…" />
          ) : data && data.items.length > 0 ? (
            <>
              <div className="table-x-scroll rounded-xl border border-border/80 bg-card shadow-sm">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Kullanıcı
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Rol
                      </th>
                      {(isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'))) && (
                        <th className="min-w-32 px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Okul
                        </th>
                      )}
                      {isSuperadmin && (
                        <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Okul üyeliği
                        </th>
                      )}
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Durum
                      </th>
                      <th className="whitespace-nowrap px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Kayıt
                      </th>
                      <th className="w-px whitespace-nowrap px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        İşlem
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/80">
                    {filteredItems.map((u) => (
                      <tr
                        key={u.id}
                        className="transition-colors hover:bg-muted/40 dark:hover:bg-muted/20"
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="flex max-w-[280px] items-center gap-3">
                            <UserAvatarBubble
                              avatarKey={u.avatar_key}
                              avatarUrl={u.avatar_url}
                              displayName={u.display_name || u.email}
                              email={u.email}
                              size="sm"
                              verified={u.role === 'teacher' && !!u.school_verified}
                            />
                            <div className="min-w-0">
                              <Link
                                href={`/users/${u.id}`}
                                className="font-medium text-foreground hover:text-primary line-clamp-1"
                              >
                                {u.display_name ?? '—'}
                              </Link>
                              <a
                                href={`mailto:${u.email}`}
                                className="block truncate text-xs text-muted-foreground hover:text-primary"
                              >
                                {u.email}
                              </a>
                              {u.role === 'moderator' && (u.moderator_modules?.length ?? 0) > 0 && (
                                <p
                                  className="mt-1 line-clamp-2 text-[10px] text-muted-foreground"
                                  title={u.moderator_modules?.map((k) => getModeratorModuleLabel(k)).join(', ')}
                                >
                                  {u.moderator_modules?.slice(0, 2).map((k) => getModeratorModuleLabel(k)).join(' · ')}
                                  {(u.moderator_modules?.length ?? 0) > 2
                                    ? ` +${(u.moderator_modules?.length ?? 0) - 2}`
                                    : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_STYLES[u.role] ?? 'bg-muted text-foreground'}`}
                          >
                            {ROLE_ICONS[u.role]}
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </td>
                        {(isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'))) && (
                          <td className="max-w-[200px] px-3 py-3 align-middle text-muted-foreground">
                            {u.school ? (
                              <Link
                                href={`/schools/${u.school.id}`}
                                className="line-clamp-2 text-xs hover:text-primary"
                              >
                                {u.school.name}
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground/70">—</span>
                            )}
                          </td>
                        )}
                        {isSuperadmin && (
                          <td className="px-3 py-3 align-middle">
                            {u.role === 'teacher' ? (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${MEMBERSHIP_STYLES[u.teacher_school_membership ?? 'none'] ?? MEMBERSHIP_STYLES.none}`}
                                >
                                  {u.teacher_school_membership === 'approved' && (
                                    <BadgeCheck className="size-3 shrink-0 opacity-90" aria-hidden />
                                  )}
                                  {u.teacher_school_membership === 'pending' && (
                                    <Clock className="size-3 shrink-0 opacity-90" aria-hidden />
                                  )}
                                  {u.teacher_school_membership === 'rejected' && (
                                    <XCircle className="size-3 shrink-0 opacity-90" aria-hidden />
                                  )}
                                  {(!u.teacher_school_membership || u.teacher_school_membership === 'none') && (
                                    <Minus className="size-3 shrink-0 opacity-70" aria-hidden />
                                  )}
                                  {MEMBERSHIP_LABELS[u.teacher_school_membership ?? 'none'] ?? u.teacher_school_membership}
                                </span>
                                {u.school_verified && (
                                  <span className="inline-flex w-fit items-center gap-0.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                                    <BadgeCheck className="size-2.5" aria-hidden />
                                    E-posta doğrulandı
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/60">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3 align-middle">
                          <StatusSelect
                            userId={u.id}
                            currentStatus={u.status}
                            token={token}
                            onSuccess={refreshAll}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 align-middle text-xs tabular-nums text-muted-foreground">
                          {formatDate(u.created_at)}
                        </td>
                        <td className="px-3 py-3 align-middle text-right">
                          <button
                            type="button"
                            onClick={() => setEditModalOpen(u)}
                            className="inline-flex rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            title="Düzenle"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.total > limit && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                  <p className="text-sm text-muted-foreground">
                    Toplam <span className="font-medium text-foreground">{data.total}</span> kullanıcı
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                    >
                      <ChevronLeft className="size-4" />
                      Önceki
                    </button>
                    <button
                      type="button"
                      disabled={page * limit >= data.total}
                      onClick={() => setPage((p) => p + 1)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                    >
                      Sonraki
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon={<UsersIcon />}
              title="Kullanıcı bulunamadı"
              description="Filtreleri değiştirerek veya yeni kullanıcı ekleyerek deneyebilirsiniz."
            />
          )}
        </CardContent>
      </Card>

      {isSuperadmin && (
        <AddUserModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          token={token}
          onSuccess={() => {
            setAddModalOpen(false);
            refreshAll();
          }}
        />
      )}

      {editModalOpen && (
        <EditUserModal
          user={editModalOpen}
          open={!!editModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditModalOpen(null);
              if (editId) router.replace('/users');
            }
          }}
          token={token}
          isSuperadmin={isSuperadmin}
          onSuccess={() => {
            setEditModalOpen(null);
            refreshAll();
            if (editId) router.replace('/users');
          }}
        />
      )}
    </div>
  );
}

function StatusSelect({
  userId,
  currentStatus,
  token,
  onSuccess,
}: {
  userId: string;
  currentStatus: string;
  token: string | null;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (!token || newStatus === status) return;
    setUpdating(true);
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
      toast.success('Durum güncellendi');
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setUpdating(false);
    }
  };

  if (status === 'deleted') {
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLES.deleted}`}>
        Silindi
      </span>
    );
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={updating}
      className={cn(
        'rounded-lg border border-input bg-background px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 min-w-30 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20',
        'border-l-[3px]',
        STATUS_SELECT_ACCENT[status] ?? 'border-l-slate-400',
      )}
    >
      <option value="active">Aktif</option>
      <option value="passive">Pasif</option>
      <option value="suspended">Askıda</option>
    </select>
  );
}

function AddUserModal({
  open,
  onOpenChange,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<string>('teacher');
  const [schoolId, setSchoolId] = useState<string>('');
  const [moderatorModules, setModeratorModules] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('active');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/users', {
        method: 'POST',
        token,
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          display_name: displayName.trim() || null,
          role,
          school_id: schoolId || null,
          moderator_modules: role === 'moderator' ? moderatorModules : null,
          status,
        }),
      });
      toast.success('Kullanıcı eklendi');
      setEmail('');
      setDisplayName('');
      setSchoolId('');
      setModeratorModules([]);
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Eklenemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Kullanıcı ekle" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert message={error} />}
          <div>
            <label className="block text-sm font-medium mb-1.5">E-posta (zorunlu)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="kullanici@example.com"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Görünen ad</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ad Soyad"
              maxLength={255}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1.5">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="superadmin">Süper Admin</option>
                <option value="moderator">Moderatör</option>
                <option value="school_admin">Okul Admin</option>
                <option value="teacher">Öğretmen</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Durum</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="suspended">Askıda</option>
              </select>
            </div>
          </div>
          {role === 'moderator' && (
            <ModeratorModulesField value={moderatorModules} onChange={setModeratorModules} idPrefix="user-add-mod" />
          )}
          {(role === 'school_admin' || role === 'teacher') && (
            <SchoolSelectWithFilter
              value={schoolId}
              onChange={setSchoolId}
              token={token}
              placeholder="Okul seçin"
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
              İptal
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Ekleniyor…' : 'Ekle'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserModal({
  user,
  open,
  onOpenChange,
  token,
  isSuperadmin,
  onSuccess,
}: {
  user: UserItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  isSuperadmin: boolean;
  onSuccess: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name ?? '');
  const [role, setRole] = useState(user.role);
  const [schoolId, setSchoolId] = useState(user.school_id ?? '');
  const [moderatorModules, setModeratorModules] = useState<string[]>(user.moderator_modules ?? []);
  const [status, setStatus] = useState(user.status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user.display_name ?? '');
    setRole(user.role);
    setSchoolId(user.school_id ?? '');
    setModeratorModules(user.moderator_modules ?? []);
    setStatus(user.status);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          role,
          school_id: schoolId || null,
          moderator_modules: role === 'moderator' ? moderatorModules : null,
          status,
        }),
      });
      toast.success('Kullanıcı güncellendi');
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Güncellenemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Kullanıcı düzenle" className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert message={error} />}
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div>
            <label className="block text-sm font-medium mb-1.5">Görünen ad</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={255}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          {isSuperadmin && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Rol</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  <option value="superadmin">Süper Admin</option>
                  <option value="moderator">Moderatör</option>
                  <option value="school_admin">Okul Admin</option>
                  <option value="teacher">Öğretmen</option>
                </select>
              </div>
              {role === 'moderator' && (
                <ModeratorModulesField value={moderatorModules} onChange={setModeratorModules} idPrefix="user-edit-mod" />
              )}
              <SchoolSelectWithFilter
                value={schoolId}
                onChange={setSchoolId}
                token={token}
                placeholder="Okul ataması yok"
                initialCity={user.school?.city}
                initialDistrict={user.school?.district}
              />
            </>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Durum</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              <option value="active">Aktif</option>
              <option value="passive">Pasif</option>
              <option value="suspended">Askıda</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">
              İptal
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {submitting ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
