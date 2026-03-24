'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users as UsersIcon, UserPlus, UserCheck, LayoutGrid, List, Search, Pencil, Mail, Calendar, Phone, Briefcase, BookOpen, ClipboardList, Tv, ChevronLeft, ChevronRight, Megaphone, BarChart3, MailPlus, Download, ArrowRight, ShieldCheck, Clock, AlertTriangle } from 'lucide-react';
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
import { useAdminMessagesUnread } from '@/hooks/use-admin-messages-unread';
import { cn } from '@/lib/utils';
import { UserAvatarBubble } from '@/components/user-avatar';

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
  avatar_key?: string | null;
  teacher_subject_ids?: string[] | null;
  teacher_school_membership?: 'none' | 'pending' | 'approved' | 'rejected';
  school_verified?: boolean;
  created_at: string;
};

type SchoolSubject = { id: string; name: string; code: string | null };

type ListResponse = { total: number; page: number; limit: number; items: UserItem[] };

type StatsResponse = {
  schools: number;
  users: number;
  announcements: number;
  chart: { month: string; count: number }[];
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

/** Pastel renk geçişleri – her kart ayrı ton ile ayırt edilir */
const PASTEL_GRADIENTS = [
  'from-teal-50 via-cyan-50 to-sky-100 dark:from-teal-950/60 dark:via-cyan-950/40 dark:to-sky-900/50',
  'from-violet-50 via-purple-50 to-fuchsia-100 dark:from-violet-950/60 dark:via-purple-950/40 dark:to-fuchsia-900/50',
  'from-amber-50 via-orange-50 to-rose-100 dark:from-amber-950/50 dark:via-orange-950/40 dark:to-rose-900/50',
  'from-emerald-50 via-lime-50 to-green-100 dark:from-emerald-950/50 dark:via-lime-950/40 dark:to-green-900/50',
  'from-sky-50 via-blue-50 to-indigo-100 dark:from-sky-950/50 dark:via-blue-950/40 dark:to-indigo-900/50',
  'from-rose-50 via-pink-50 to-fuchsia-100 dark:from-rose-950/50 dark:via-pink-950/40 dark:to-fuchsia-900/50',
  'from-lime-50 via-emerald-50 to-teal-100 dark:from-lime-950/40 dark:via-emerald-950/40 dark:to-teal-900/50',
  'from-indigo-50 via-violet-50 to-purple-100 dark:from-indigo-950/50 dark:via-violet-950/40 dark:to-purple-900/50',
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function teacherNeedsSchoolAttention(user: UserItem): boolean {
  return !user.school_verified;
}

function MembershipBadge({ user }: { user: UserItem }) {
  if (user.school_verified) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
        <ShieldCheck className="size-3 shrink-0" />
        Onaylı
      </span>
    );
  }
  if (user.teacher_school_membership === 'pending') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 rounded-full border-2 border-amber-500 bg-gradient-to-r from-amber-100 to-orange-50 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-950 shadow-md ring-2 ring-amber-400/50 dark:from-amber-950/70 dark:to-orange-950/50 dark:text-amber-50 dark:ring-amber-500/40 animate-pulse"
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          Onaysız
        </span>
        <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-600/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-950 dark:text-amber-50">
          <Clock className="size-3 shrink-0" />
          Onay bekliyor
        </span>
      </span>
    );
  }
  if (user.school_id) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border-2 border-rose-400 bg-gradient-to-r from-rose-50 to-orange-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-950 shadow-md dark:from-rose-950/50 dark:to-orange-950/40 dark:text-rose-50 dark:border-rose-500">
        <AlertTriangle className="size-3.5 shrink-0" />
        Onaysız
      </span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">—</span>;
}

export default function TeachersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams?.get('edit');
  const { token, me } = useAuth();
  const adminMessagesUnread = useAdminMessagesUnread(token, me?.role ?? null);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState<UserItem | null>(null);
  const [totalTeacherCount, setTotalTeacherCount] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'branch' | 'name'>('branch');
  const [membershipFilter, setMembershipFilter] = useState<string>('');
  const limit = 50;

  const fetchSubjects = useCallback(async () => {
    if (!token || me?.role !== 'school_admin') return;
    try {
      const list = await apiFetch<SchoolSubject[]>('/classes-subjects/subjects', { token });
      setSubjects(Array.isArray(list) ? list : []);
    } catch {
      setSubjects([]);
    }
  }, [token, me?.role]);

  const fetchTotalCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<ListResponse>('/users?role=teacher&page=1&limit=1', { token });
      setTotalTeacherCount(res.total);
    } catch {
      setTotalTeacherCount(null);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await apiFetch<StatsResponse>('/stats', { token });
      setStats(res);
    } catch {
      setStats(null);
    }
  }, [token]);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('role', 'teacher');
    if (statusFilter) params.set('status', statusFilter);
    if (membershipFilter) params.set('teacher_school_membership', membershipFilter);
    if (sortBy === 'branch') params.set('sort', 'teacher_branch');
    try {
      const res = await apiFetch<ListResponse>(`/users?${params.toString()}`, { token });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Liste yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, sortBy, membershipFilter]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchTotalCount();
  }, [fetchTotalCount]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!editId || !token) return;
    const existing = data?.items?.find((u) => u.id === editId);
    if (existing) {
      setEditModalOpen(existing);
    } else {
      apiFetch<UserItem>(`/users/${editId}`, { token })
        .then(setEditModalOpen)
        .catch(() => toast.error('Öğretmen yüklenemedi'));
    }
  }, [editId, token, data?.items]);

  const refreshAll = useCallback(() => {
    fetchList();
    fetchTotalCount();
    fetchStats();
  }, [fetchList, fetchTotalCount, fetchStats]);

  const handleMembership = useCallback(
    async (userId: string, action: 'approve' | 'reject' | 'revoke') => {
      if (!token) return;
      try {
        await apiFetch(`/users/${userId}/teacher-school-membership`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ action }),
        });
        toast.success(
          action === 'approve'
            ? 'Okul üyeliği onaylandı'
            : action === 'revoke'
              ? 'Onay geri alındı; öğretmen yeniden onay bekliyor'
              : 'Başvuru reddedildi',
        );
        refreshAll();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı');
      }
    },
    [token, refreshAll],
  );

  const teacherCount = totalTeacherCount ?? data?.total ?? 0;
  const teacherLimit = me?.school?.teacher_limit ?? 100;
  const canAddMore = teacherCount < teacherLimit;

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (u) =>
          (u.display_name ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.teacher_branch ?? '').toLowerCase().includes(q)
      );
    }
    const branch = (u: UserItem) => (u.teacher_branch ?? '').toLowerCase().trim() || '\uFFFF';
    const name = (u: UserItem) => (u.display_name ?? u.email ?? '').toLowerCase();
    const unverifiedFirst = (u: UserItem) => (u.school_verified ? 1 : 0);
    return [...items].sort((a, b) => {
      const pa = unverifiedFirst(a);
      const pb = unverifiedFirst(b);
      if (pa !== pb) return pa - pb;
      if (sortBy === 'branch') {
        const c = branch(a).localeCompare(branch(b));
        return c !== 0 ? c : name(a).localeCompare(name(b), 'tr');
      }
      return name(a).localeCompare(name(b), 'tr');
    });
  }, [data?.items, searchQuery, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((u) => u.id)));
    }
  };
  const selectedTeachers = filteredItems.filter((u) => selectedIds.has(u.id));
  const selectedEmails = selectedTeachers.map((u) => u.email).filter(Boolean).join(',');

  const handleExportCsv = () => {
    const headers = ['Ad', 'E-posta', 'Branş', 'Ünvan', 'Telefon', 'Durum', 'Kayıt Tarihi'];
    const rows = filteredItems.map((u) => [
      u.display_name ?? '',
      u.email,
      u.teacher_branch ?? '',
      u.teacher_title ?? '',
      u.teacher_phone ?? '',
      STATUS_LABELS[u.status] ?? u.status,
      formatDate(u.created_at),
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ogretmenler-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('CSV indirildi');
  };

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Öğretmenler</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Öğretmen listesi', icon: UsersIcon },
              { label: 'Görünüm / arama', icon: LayoutGrid },
              ...(me?.role === 'school_admin'
                ? [
                    { label: 'Okul onayı', icon: ShieldCheck },
                    { label: 'Kişisel bilgi', icon: UserCheck },
                  ]
                : []),
            ]}
            summary={
              me?.role === 'school_admin'
                ? 'Okulunuzdaki öğretmen listesi ve yönetimi. Okul doğrulaması: «Onay bekleyen» filtresi veya satırdaki Onayla. Ad/kişisel bilgiler yalnızca öğretmenin kendi ayarlarından değişir.'
                : 'Okulunuzdaki öğretmen listesi ve yönetimi'
            }
          />
        </ToolbarHeading>
        <ToolbarActions>
          <Link
            href="/duty"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:border-muted-foreground/20"
          >
            <ClipboardList className="size-4 text-muted-foreground" />
            Nöbet planı
          </Link>
          <Link
            href="/tv"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted hover:border-muted-foreground/20"
          >
            <Tv className="size-4 text-muted-foreground" />
            Duyuru TV
          </Link>
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            disabled={!canAddMore}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="size-4" />
            Öğretmen ekle
          </button>
        </ToolbarActions>
      </Toolbar>

      {/* Hızlı aksiyon kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/tv"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Duyuru gönder</p>
            <p className="text-xs text-muted-foreground">Duyuru oluştur, TV&apos;de yayınla</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
        <Link
          href="/classes-subjects"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <BookOpen className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Sınıflar & Dersler</p>
            <p className="text-xs text-muted-foreground">Ders atamalarını yönet</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
        <Link
          href="/school-reviews-report"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <BarChart3 className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Okul Değerlendirme Raporu</p>
            <p className="text-xs text-muted-foreground">Öğretmen değerlendirmeleri özeti</p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
        <Link
          href="/system-messages"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Mail className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">Sistem Mesajları</p>
            <p className="text-xs text-muted-foreground">
              {adminMessagesUnread > 0 ? (
                <span className="font-medium text-amber-600 dark:text-amber-400">{adminMessagesUnread} okunmamış</span>
              ) : (
                'Merkezden gelen mesajlar'
              )}
            </p>
          </div>
          {adminMessagesUnread > 0 && (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
              {adminMessagesUnread}
            </span>
          )}
          <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>

      {/* Özet istatistikler */}
      {stats && (
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Toplam öğretmen:</span>
            <span className="font-semibold text-foreground">{teacherCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <Megaphone className="size-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Toplam duyuru:</span>
            <span className="font-semibold text-foreground">{stats.announcements}</span>
          </div>
          <Link
            href="/duty"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ClipboardList className="size-5" />
            Nöbet planı yönetimi
            <ArrowRight className="size-4" />
          </Link>
        </div>
      )}

      {!canAddMore && (
        <Alert
          message={`Öğretmen limiti (${teacherLimit}) doldu. Yeni öğretmen eklemek için superadmin ile iletişime geçin.`}
          className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
        />
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-slate-50/60 dark:bg-slate-900/20 pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Öğretmen listesi</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{filteredItems.length}</span> öğretmen gösteriliyor
                <span className="mx-1.5">·</span>
                <span className="font-medium text-foreground">{teacherCount}</span> / {teacherLimit} toplam
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
              {selectedIds.size > 0 && (
                <a
                  href={`mailto:?bcc=${encodeURIComponent(selectedEmails)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/50 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <MailPlus className="size-4" />
                  {selectedIds.size} kişiye e-posta
                </a>
              )}
              <div className="relative min-w-[180px] sm:min-w-[220px]">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="İsim veya e-posta ara…"
                  className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'branch' | 'name');
                  setPage(1);
                }}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="branch">Branşa göre sırala</option>
                <option value="name">Ada göre sırala</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Tüm durumlar</option>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="suspended">Askıda</option>
              </select>
              <select
                value={membershipFilter}
                onChange={(e) => {
                  setMembershipFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Tüm üyelikler</option>
                <option value="pending">Onay bekleyen</option>
                <option value="approved">Doğrulanmış okul</option>
                <option value="none">Okul seçmemiş</option>
              </select>
              <div className="flex rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Görünüm">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-md p-2 transition-colors ${
                    viewMode === 'cards' ? 'bg-primary/15 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                  aria-label="Kart görünümü"
                  title="Kart görünümü"
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
                  title="Tablo görünümü"
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
            <LoadingSpinner label="Öğretmen listesi yükleniyor…" />
          ) : data && data.items.length > 0 ? (
            <>
              {viewMode === 'cards' ? (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredItems.map((u, idx) => (
                    <TeacherCard
                      key={u.id}
                      user={u}
                      index={idx}
                      token={token}
                      subjects={subjects}
                      selected={selectedIds.has(u.id)}
                      onToggleSelect={() => toggleSelect(u.id)}
                      onEdit={() => setEditModalOpen(u)}
                      onStatusChange={refreshAll}
                      isSchoolAdmin={me?.role === 'school_admin'}
                      onMembership={handleMembership}
                    />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700/60">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/30">
                        <th className="w-9 px-2 py-2.5">
                          <input
                            type="checkbox"
                            checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                            onChange={toggleSelectAll}
                            className="rounded border-input"
                            aria-label="Tümünü seç"
                          />
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Öğretmen
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Okul rozeti
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Branş
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          E-posta
                        </th>
                        <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Durum
                        </th>
                        <th className="w-24 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          İşlem
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredItems.map((u) => (
                        <tr
                          key={u.id}
                          className={cn(
                            'transition-colors',
                            teacherNeedsSchoolAttention(u)
                              ? 'border-l-[5px] border-l-amber-500 bg-amber-50/95 hover:bg-amber-100/95 dark:border-l-amber-400 dark:bg-amber-950/35 dark:hover:bg-amber-950/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30',
                          )}
                        >
                          <td className="w-9 px-2 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(u.id)}
                              onChange={() => toggleSelect(u.id)}
                              className="rounded border-slate-300"
                              aria-label={`${u.display_name ?? u.email} seç`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <UserAvatarBubble
                                avatarKey={u.avatar_key}
                                avatarUrl={u.avatar_url}
                                displayName={u.display_name || u.email}
                                email={u.email}
                                size="xs"
                                verified={!!u.school_verified}
                              />
                              <Link href={`/teachers/${u.id}`} className="font-medium text-foreground hover:text-primary text-sm">
                                {u.display_name ?? '—'}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            <MembershipBadge user={u} />
                            {me?.role === 'school_admin' && u.teacher_school_membership === 'pending' && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMembership(u.id, 'approve')}
                                  className="rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-600"
                                >
                                  Onayla
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMembership(u.id, 'reject')}
                                  className="rounded border border-border px-2 py-0.5 text-[10px] font-medium hover:bg-muted"
                                >
                                  Reddet
                                </button>
                              </div>
                            )}
                            {me?.role === 'school_admin' && u.school_verified && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleMembership(u.id, 'revoke')}
                                  className="rounded border border-amber-600/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
                                >
                                  Onayı geri al
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {u.teacher_branch ? (
                              <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                                {u.teacher_branch}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <a href={`mailto:${u.email}`} className="text-muted-foreground hover:text-primary text-xs truncate max-w-[180px] block">
                              {u.email}
                            </a>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[u.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                              {STATUS_LABELS[u.status] ?? u.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => setEditModalOpen(u)} className="rounded p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800" title="Düzenle">
                                <Pencil className="size-3.5" />
                              </button>
                              <StatusSelect userId={u.id} currentStatus={u.status} token={token} onSuccess={refreshAll} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {searchQuery && filteredItems.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Arama sonucu bulunamadı. Farklı bir terim deneyin.
                </p>
              )}
              {!searchQuery && data.total > limit && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                  <p className="text-sm text-muted-foreground">
                    Toplam <span className="font-medium text-foreground">{data.total}</span> öğretmen
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      aria-label="Önceki sayfa"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                    >
                      <ChevronLeft className="size-4" />
                      Önceki
                    </button>
                    <button
                      type="button"
                      disabled={page * limit >= data.total}
                      onClick={() => setPage((p) => p + 1)}
                      aria-label="Sonraki sayfa"
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
              title="Henüz öğretmen eklenmemiş"
              description="Öğretmen ekle butonundan okulunuza öğretmen davet edebilirsiniz."
            />
          )}
        </CardContent>
      </Card>

      <AddTeacherModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        token={token}
        subjects={subjects}
        onSuccess={() => {
          setAddModalOpen(false);
          refreshAll();
        }}
      />

      {editModalOpen && (
        <EditTeacherModal
          user={editModalOpen}
          open={!!editModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditModalOpen(null);
              if (editId) router.replace('/teachers');
            }
          }}
          token={token}
          subjects={subjects}
          readOnlyProfile={me?.role === 'school_admin'}
          onSuccess={() => {
            setEditModalOpen(null);
            refreshAll();
            if (editId) router.replace('/teachers');
          }}
        />
      )}
    </div>
  );
}

function TeacherCard({
  user,
  index = 0,
  token,
  subjects,
  selected,
  onToggleSelect,
  onEdit,
  onStatusChange,
  isSchoolAdmin,
  onMembership,
}: {
  user: UserItem;
  index?: number;
  token: string | null;
  subjects: SchoolSubject[];
  selected?: boolean;
  onToggleSelect?: () => void;
  onEdit: () => void;
  onStatusChange: () => void;
  isSchoolAdmin?: boolean;
  onMembership?: (userId: string, action: 'approve' | 'reject' | 'revoke') => void;
}) {
  const subjectNames = (user.teacher_subject_ids ?? [])
    .map((id) => subjects.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const gradient = PASTEL_GRADIENTS[index % PASTEL_GRADIENTS.length];
  const baseBg = `bg-gradient-to-br ${gradient}`;
  const unverified = teacherNeedsSchoolAttention(user);

  return (
    <div
      className={cn(
        'group flex flex-col gap-2.5 rounded-lg border p-3 transition-all duration-150 hover:shadow-md',
        unverified
          ? 'border-amber-500 bg-gradient-to-br from-amber-100/90 via-orange-50/95 to-amber-50 shadow-lg ring-2 ring-amber-400/60 dark:from-amber-950/80 dark:via-orange-950/50 dark:to-amber-950/40 dark:border-amber-500 dark:ring-amber-500/40 hover:border-amber-600'
          : `${baseBg} hover:border-slate-300 dark:hover:border-slate-600`,
        selected ? 'border-primary/60 ring-1 ring-primary/25 ring-offset-1 dark:ring-offset-slate-900' : !unverified && 'border-slate-200/80 dark:border-slate-600/50',
      )}
    >
      <div className="flex items-start gap-2.5">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={onToggleSelect}
            className="mt-1.5 rounded border-slate-300 shrink-0"
            aria-label={`${user.display_name ?? user.email} seç`}
          />
        )}
        <UserAvatarBubble
          avatarKey={user.avatar_key}
          avatarUrl={user.avatar_url}
          displayName={user.display_name || user.email}
          email={user.email}
          size="xs"
          verified={!!user.school_verified}
        />
        <div className="min-w-0 flex-1">
          <Link href={`/teachers/${user.id}`} className="font-medium text-foreground truncate block hover:text-primary text-sm">
            {user.display_name ?? 'İsim belirtilmemiş'}
          </Link>
          {user.teacher_branch && (
            <span className="inline-flex mt-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {user.teacher_branch}
            </span>
          )}
          <a href={`mailto:${user.email}`} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground truncate hover:text-primary">
            <Mail className="size-3 shrink-0" />
            <span className="truncate">{user.email}</span>
          </a>
          <div className="mt-1.5">
            <MembershipBadge user={user} />
          </div>
          {isSchoolAdmin && user.teacher_school_membership === 'pending' && onMembership && (
            <div className="mt-1.5 flex gap-1">
              <button
                type="button"
                onClick={() => onMembership(user.id, 'approve')}
                className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-700"
              >
                Onayla
              </button>
              <button
                type="button"
                onClick={() => onMembership(user.id, 'reject')}
                className="rounded-md border border-border px-2 py-1 text-[10px] font-medium hover:bg-muted"
              >
                Reddet
              </button>
            </div>
          )}
          {isSchoolAdmin && user.school_verified && onMembership && (
            <button
              type="button"
              onClick={() => onMembership(user.id, 'revoke')}
              className="mt-1.5 w-full rounded-md border border-amber-600/50 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
            >
              Onayı geri al
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/50 dark:border-slate-700/50">
        <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[user.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
          {STATUS_LABELS[user.status] ?? user.status}
        </span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800" title="Düzenle">
            <Pencil className="size-3.5" />
          </button>
          <StatusSelect userId={user.id} currentStatus={user.status} token={token} onSuccess={onStatusChange} />
        </div>
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

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={updating}
      className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground transition-colors disabled:opacity-50 min-w-[90px] focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
    >
      <option value="active">Aktif</option>
      <option value="passive">Pasif</option>
      <option value="suspended">Askıda</option>
    </select>
  );
}

const TITLE_OPTIONS = [
  { value: '', label: 'Seçiniz' },
  { value: 'Kadrolu', label: 'Kadrolu' },
  { value: 'Sözleşmeli', label: 'Sözleşmeli' },
  { value: 'Ücretli', label: 'Ücretli' },
  { value: 'Maaş karşılığı', label: 'Maaş karşılığı' },
];

function AddTeacherModal({
  open,
  onOpenChange,
  token,
  subjects,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  subjects: SchoolSubject[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [teacherBranch, setTeacherBranch] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherTitle, setTeacherTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
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
          role: 'teacher',
          teacher_branch: teacherBranch.trim() || null,
          teacher_phone: teacherPhone.trim() || null,
          teacher_title: teacherTitle || null,
          avatar_url: avatarUrl.trim() || null,
          teacher_subject_ids: subjectIds.length ? subjectIds : null,
        }),
      });
      toast.success('Öğretmen eklendi');
      setEmail('');
      setDisplayName('');
      setTeacherBranch('');
      setTeacherPhone('');
      setTeacherTitle('');
      setAvatarUrl('');
      setSubjectIds([]);
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
      <DialogContent title="Öğretmen ekle">
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto">
          {error && <Alert message={error} />}
          <div>
            <label htmlFor="teacher-email" className="block text-sm font-medium text-foreground">
              E-posta (zorunlu)
            </label>
            <input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="ornek@okul.gov.tr"
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label htmlFor="teacher-name" className="block text-sm font-medium text-foreground">
              Görünen ad (opsiyonel)
            </label>
            <input
              id="teacher-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={255}
              placeholder="Ad Soyad"
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label htmlFor="teacher-branch" className="block text-sm font-medium text-foreground">
              Branş / Ne öğretmeni (opsiyonel)
            </label>
            <input
              id="teacher-branch"
              type="text"
              value={teacherBranch}
              onChange={(e) => setTeacherBranch(e.target.value)}
              maxLength={100}
              placeholder="Coğrafya Öğretmeni, Matematik Öğretmeni vb."
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label htmlFor="teacher-title" className="block text-sm font-medium text-foreground">
              Ünvan (opsiyonel)
            </label>
            <select
              id="teacher-title"
              value={teacherTitle}
              onChange={(e) => setTeacherTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            >
              {TITLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="teacher-phone" className="block text-sm font-medium text-foreground">
              Telefon (opsiyonel)
            </label>
            <input
              id="teacher-phone"
              type="tel"
              value={teacherPhone}
              onChange={(e) => setTeacherPhone(e.target.value)}
              maxLength={32}
              placeholder="05XX XXX XX XX"
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label htmlFor="teacher-avatar" className="block text-sm font-medium text-foreground">
              Fotoğraf URL (opsiyonel)
            </label>
            <input
              id="teacher-avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={512}
              placeholder="https://..."
              className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          {subjects.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground">
                Okuttuğu dersler (opsiyonel)
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {subjects.map((s) => (
                  <label key={s.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(s.id)}
                      onChange={(e) =>
                        setSubjectIds((prev) =>
                          e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Ekleniyor…' : 'Ekle'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Inline SVG icons - hafif, hızlı yükleme
const SvgUser = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted-foreground">
    <path d="M10 10a3 3 0 100-6 3 3 0 000 6zM15 15a5 5 0 00-10 0" />
  </svg>
);
const SvgBook = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted-foreground">
    <path d="M4 4h4v12H4V4zm8 0h4v12h-4V4zM4 4l6 3 6-3M4 16l6-3 6 3" />
  </svg>
);
const SvgBriefcase = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted-foreground">
    <path d="M3 6h14v10H3V6zM3 6V5a2 2 0 012-2h10a2 2 0 012 2v1M7 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const SvgPhone = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted-foreground">
    <path d="M15 12v2a2 2 0 01-2 2 10 10 0 01-10-10 2 2 0 012-2h2M17 8V6a2 2 0 00-2-2 4 4 0 00-4 4v2" />
  </svg>
);
const SvgImage = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted-foreground">
    <rect x="2" y="3" width="16" height="14" rx="2" />
    <circle cx="6" cy="7" r="2" />
    <path d="M2 14l4-4 3 3 4-6 3 7" />
  </svg>
);
const SvgMail = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted-foreground">
    <path d="M3 5h14a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2z" />
    <path d="M3 5l7 5 7-5" />
  </svg>
);

const inputBase =
  'w-full rounded-lg border border-input bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 transition-colors';

function EditTeacherModal({
  user,
  open,
  onOpenChange,
  token,
  subjects,
  readOnlyProfile,
  onSuccess,
}: {
  user: UserItem;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  subjects: SchoolSubject[];
  /** true: okul yöneticisi — kişisel alanlar salt okunur, kayıt yok */
  readOnlyProfile?: boolean;
  onSuccess: () => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name ?? '');
  const [teacherBranch, setTeacherBranch] = useState(user.teacher_branch ?? '');
  const [teacherPhone, setTeacherPhone] = useState(user.teacher_phone ?? '');
  const [teacherTitle, setTeacherTitle] = useState(user.teacher_title ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '');
  const [subjectIds, setSubjectIds] = useState<string[]>(user.teacher_subject_ids ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user.display_name ?? '');
    setTeacherBranch(user.teacher_branch ?? '');
    setTeacherPhone(user.teacher_phone ?? '');
    setTeacherTitle(user.teacher_title ?? '');
    setAvatarUrl(user.avatar_url ?? '');
    setSubjectIds(user.teacher_subject_ids ?? []);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnlyProfile) return;
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          teacher_branch: teacherBranch.trim() || null,
          teacher_phone: teacherPhone.trim() || null,
          teacher_title: teacherTitle || null,
          avatar_url: avatarUrl.trim() || null,
          teacher_subject_ids: subjectIds.length ? subjectIds : null,
        }),
      });
      toast.success('Öğretmen güncellendi');
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Güncellenemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const previewName = displayName.trim() || user.email.split('@')[0];
  const previewInitial = (previewName || user.email).charAt(0).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={readOnlyProfile ? 'Öğretmen bilgisi' : 'Öğretmen düzenle'} className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          {/* Header: avatar + email */}
          <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-border bg-muted/30">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-semibold text-primary z-[0]">{previewInitial}</span>
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt=""
                  className="absolute inset-0 size-full object-cover z-[1]"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground truncate">{previewName || '—'}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <SvgMail />
                <span className="truncate">{user.email}</span>
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {readOnlyProfile && (
              <p className="mb-4 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Ad, branş, telefon ve fotoğraf yalnızca öğretmenin kendi hesabından (Ayarlar) güncellenir. Siz yalnızca okul üyeliğini onaylayabilir ve hesap durumunu tabloda değiştirebilirsiniz.
              </p>
            )}
            {error && <Alert message={error} className="mb-4" />}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 sm:flex sm:gap-4">
                <div className="flex-1 min-w-0">
                  <label htmlFor="edit-display-name" className="block text-sm font-medium text-foreground mb-1.5">Görünen ad</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgUser /></span>
                    <input
                      id="edit-display-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={255}
                      placeholder="Ad Soyad"
                      disabled={readOnlyProfile}
                      readOnly={readOnlyProfile}
                      className={inputBase + (readOnlyProfile ? ' opacity-80 cursor-not-allowed' : '')}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="edit-branch" className="block text-sm font-medium text-foreground mb-1.5">Branş / Ne öğretmeni</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgBook /></span>
                  <input
                    id="edit-branch"
                    type="text"
                    value={teacherBranch}
                    onChange={(e) => setTeacherBranch(e.target.value)}
                    maxLength={100}
                    placeholder="Coğrafya Öğretmeni, Matematik Öğretmeni vb."
                    disabled={readOnlyProfile}
                    readOnly={readOnlyProfile}
                    className={inputBase + (readOnlyProfile ? ' opacity-80 cursor-not-allowed' : '')}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="edit-title" className="block text-sm font-medium text-foreground mb-1.5">Ünvan</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"><SvgBriefcase /></span>
                  <select
                    id="edit-title"
                    value={teacherTitle}
                    onChange={(e) => setTeacherTitle(e.target.value)}
                    disabled={readOnlyProfile}
                    className={inputBase + ' appearance-none' + (readOnlyProfile ? ' opacity-80 cursor-not-allowed' : '')}
                  >
                    {TITLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="edit-phone" className="block text-sm font-medium text-foreground mb-1.5">Telefon</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgPhone /></span>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={teacherPhone}
                    onChange={(e) => setTeacherPhone(e.target.value)}
                    maxLength={32}
                    placeholder="05XX XXX XX XX"
                    disabled={readOnlyProfile}
                    readOnly={readOnlyProfile}
                    className={inputBase + (readOnlyProfile ? ' opacity-80 cursor-not-allowed' : '')}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-avatar" className="block text-sm font-medium text-foreground mb-1.5">Fotoğraf URL</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgImage /></span>
                  <input
                    id="edit-avatar"
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    maxLength={512}
                    placeholder="https://..."
                    disabled={readOnlyProfile}
                    readOnly={readOnlyProfile}
                    className={inputBase + (readOnlyProfile ? ' opacity-80 cursor-not-allowed' : '')}
                  />
                </div>
              </div>
            </div>
            {subjects.length > 0 && (
              <div className="mt-5 pt-5 border-t border-border">
                <label className="block text-sm font-medium text-foreground mb-2">Okuttuğu dersler</label>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <label
                      key={s.id}
                      className={
                        'inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary ' +
                        (readOnlyProfile ? 'cursor-default opacity-90' : 'cursor-pointer hover:bg-muted/50')
                      }
                    >
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(s.id)}
                        onChange={(e) =>
                          setSubjectIds((prev) =>
                            e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                          )
                        }
                        disabled={readOnlyProfile}
                        className="rounded border-input"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              {readOnlyProfile ? 'Kapat' : 'İptal'}
            </button>
            {!readOnlyProfile && (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitting ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
