'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users as UsersIcon,
  UserPlus,
  LayoutGrid,
  List,
  Search,
  Pencil,
  Mail,
  Calendar,
  School,
  Download,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCog,
  GraduationCap,
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

const MODERATOR_MODULE_OPTIONS: { key: string; label: string }[] = [
  { key: 'school_reviews', label: 'Okul Değerlendirmeleri' },
  { key: 'school_profiles', label: 'Okul Profilleri (Moderasyon)' },
  { key: 'announcements', label: 'Duyurular' },
  { key: 'schools', label: 'Okullar' },
  { key: 'users', label: 'Kullanıcılar' },
  { key: 'market_policy', label: 'Market Politikası' },
  { key: 'modules', label: 'Modüller' },
  { key: 'document_templates', label: 'Evrak Şablonları' },
  { key: 'extra_lesson_params', label: 'Hesaplama Parametreleri' },
  { key: 'outcome_sets', label: 'Kazanım Setleri' },
  { key: 'system_announcements', label: 'Sistem Duyuruları' },
];

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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || !data?.items?.length}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="size-4" />
                CSV İndir
              </button>
              <div className="relative min-w-[180px] sm:min-w-[220px]">
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
                    className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors min-w-[120px]"
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
                    className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors min-w-[120px] disabled:opacity-50"
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
                    className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors min-w-[180px]"
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
                className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
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
                  className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors min-w-[160px]"
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
                className="rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
              >
                <option value="">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="suspended">Askıda</option>
              </select>
              <div className="flex rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Görünüm">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-md p-2 transition-colors ${
                    viewMode === 'cards' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  aria-label="Kart görünümü"
                >
                  <LayoutGrid className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-md p-2 transition-colors ${
                    viewMode === 'table' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  aria-label="Tablo görünümü"
                >
                  <List className="size-4" />
                </button>
              </div>
            </div>
          </div>
          {error && <Alert message={error} className="mt-4" />}
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <LoadingSpinner label="Kullanıcı listesi yükleniyor…" />
          ) : data && data.items.length > 0 ? (
            <>
              {viewMode === 'cards' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredItems.map((u) => (
                    <UserCard
                      key={u.id}
                      user={u}
                      token={token}
                      onEdit={() => setEditModalOpen(u)}
                      onStatusChange={refreshAll}
                      isSuperadmin={isSuperadmin}
                      showSchool={isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'))}
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kullanıcı</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rol</th>
                        {(isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'))) && (
                          <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Okul</th>
                        )}
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Durum</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kayıt</th>
                        <th className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {filteredItems.map((u) => (
                        <tr key={u.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <UserAvatarBubble
                                avatarKey={u.avatar_key}
                                avatarUrl={u.avatar_url}
                                displayName={u.display_name || u.email}
                                email={u.email}
                                size="md"
                                verified={u.role === 'teacher' && !!u.school_verified}
                              />
                              <div>
                                <Link href={`/users/${u.id}`} className="font-medium text-foreground hover:text-primary">
                                  {u.display_name ?? '—'}
                                </Link>
                                <a href={`mailto:${u.email}`} className="block text-xs text-muted-foreground hover:text-primary">
                                  {u.email}
                                </a>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[u.role] ?? 'bg-muted'}`}>
                              {ROLE_ICONS[u.role]}
                              {ROLE_LABELS[u.role] ?? u.role}
                            </span>
                          </td>
                          {(isSuperadmin || (me?.role === 'moderator' && (me?.moderator_modules ?? []).includes('schools'))) && (
                            <td className="px-5 py-4">
                              {u.school ? (
                                <Link href={`/schools/${u.school.id}`} className="text-muted-foreground hover:text-primary">
                                  {u.school.name}
                                </Link>
                              ) : (
                                '—'
                              )}
                            </td>
                          )}
                          <td className="px-5 py-4">
                            <StatusSelect userId={u.id} currentStatus={u.status} token={token} onSuccess={refreshAll} />
                          </td>
                          <td className="px-5 py-4 text-muted-foreground text-xs">{formatDate(u.created_at)}</td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() => setEditModalOpen(u)}
                              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
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
              )}
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

function UserCard({
  user,
  token,
  onEdit,
  onStatusChange,
  isSuperadmin,
  showSchool,
}: {
  user: UserItem;
  token: string | null;
  onEdit: () => void;
  onStatusChange: () => void;
  isSuperadmin: boolean;
  showSchool?: boolean;
}) {
  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-muted-foreground/20">
      <div className="flex items-start gap-3">
        <UserAvatarBubble
          avatarKey={user.avatar_key}
          avatarUrl={user.avatar_url}
          displayName={user.display_name || user.email}
          email={user.email}
          size="md"
          verified={user.role === 'teacher' && !!user.school_verified}
        />
        <div className="min-w-0 flex-1">
          <Link href={`/users/${user.id}`} className="font-semibold text-foreground hover:text-primary block truncate">
            {user.display_name ?? 'İsim belirtilmemiş'}
          </Link>
          <a href={`mailto:${user.email}`} className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 truncate">
            <Mail className="size-3.5" />
            <span className="truncate">{user.email}</span>
          </a>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[user.role] ?? 'bg-muted'}`}>
              {ROLE_ICONS[user.role]}
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <StatusSelect userId={user.id} currentStatus={user.status} token={token} onSuccess={onStatusChange} />
          </div>
          {showSchool && user.school && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <School className="size-3.5" />
              <Link href={`/schools/${user.school.id}`} className="hover:text-primary">{user.school.name}</Link>
            </p>
          )}
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="size-3.5" />
            {formatDate(user.created_at)}
          </p>
        </div>
      </div>
      <div className="flex justify-end border-t border-border pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          title="Düzenle"
        >
          <Pencil className="size-4" />
        </button>
      </div>
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
    return <span className="text-xs text-muted-foreground">Silindi</span>;
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={updating}
      className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs transition-colors disabled:opacity-50 min-w-[85px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
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
      <DialogContent title="Kullanıcı ekle" className="max-w-lg">
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
            <div>
              <label className="block text-sm font-medium mb-2">Moderatör modülleri</label>
              <div className="flex flex-wrap gap-2">
                {MODERATOR_MODULE_OPTIONS.map((opt) => (
                  <label key={opt.key} className="inline-flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={moderatorModules.includes(opt.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setModeratorModules((prev) => [...prev, opt.key]);
                        } else {
                          setModeratorModules((prev) => prev.filter((m) => m !== opt.key));
                        }
                      }}
                      className="rounded border-input"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
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
      <DialogContent title="Kullanıcı düzenle" className="max-w-lg">
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
                <div>
                  <label className="block text-sm font-medium mb-2">Moderatör modülleri</label>
                  <div className="flex flex-wrap gap-2">
                    {MODERATOR_MODULE_OPTIONS.map((opt) => (
                      <label key={opt.key} className="inline-flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={moderatorModules.includes(opt.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModeratorModules((prev) => [...prev, opt.key]);
                            } else {
                              setModeratorModules((prev) => prev.filter((m) => m !== opt.key));
                            }
                          }}
                          className="rounded border-input"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
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
