'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Users as UsersIcon, UserPlus, UserCheck, LayoutGrid, List, Search, Pencil, Mail, Calendar, Phone, Briefcase, BookOpen, ClipboardList, Tv, ChevronLeft, ChevronRight, Megaphone, BarChart3, MailPlus, Download, ArrowRight, ShieldCheck, Clock, AlertTriangle, Undo2, GraduationCap, FileSpreadsheet, Link2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAdminMessagesUnread } from '@/hooks/use-admin-messages-unread';
import { cn } from '@/lib/utils';
import { TEACHER_BRANCH_OPTIONS } from '@/lib/teacher-branch-options';
import { UserAvatarBubble } from '@/components/user-avatar';
import { MebbisBulkImportDialog } from './components/MebbisBulkImportDialog';

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
  school_join_stage?: string;
  created_at: string;
  /** API: şifre/Firebase yok — okul ön kaydı */
  is_passwordless_stub?: boolean;
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

const fieldClass =
  'mt-1.5 flex min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 sm:min-h-10 sm:px-3.5 sm:text-sm';

const labelClass = 'text-xs font-medium text-muted-foreground sm:text-sm sm:text-foreground';

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
  const { token, me, refetchMe } = useAuth();
  const [mergeSaving, setMergeSaving] = useState(false);
  const [mergeModalUser, setMergeModalUser] = useState<UserItem | null>(null);
  const [mergeEmail, setMergeEmail] = useState('');
  const [mergeBusy, setMergeBusy] = useState(false);
  const adminMessagesUnread = useAdminMessagesUnread(token, me?.role ?? null);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [mebbisBulkOpen, setMebbisBulkOpen] = useState(false);
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

  const revokeMembership = async (userId: string) => {
    if (!token) return;
    if (!confirm('Bu öğretmenin okul onayını geri almak istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/users/${userId}/teacher-school-membership`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ action: 'revoke' }),
      });
      toast.success('Onay geri alındı');
      refreshAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı');
    }
  };

  const submitMergeRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !mergeModalUser) return;
    const email = mergeEmail.trim().toLowerCase();
    if (!email) {
      toast.error('Web kaydı e-postası gerekli');
      return;
    }
    setMergeBusy(true);
    try {
      await apiFetch('/users/teachers/merge-by-registration', {
        method: 'POST',
        token,
        body: JSON.stringify({
          stub_user_id: mergeModalUser.id,
          registered_email: email,
        }),
      });
      toast.success('Hesaplar birleştirildi');
      setMergeModalUser(null);
      setMergeEmail('');
      refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Birleştirilemedi');
    } finally {
      setMergeBusy(false);
    }
  };

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
    <div className="support-page space-y-2 pb-4 sm:space-y-4 sm:pb-6">
      <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-linear-to-br from-sky-500/12 via-cyan-500/8 to-emerald-500/10 p-2.5 shadow-md ring-1 ring-sky-500/15 dark:border-sky-500/20 dark:from-sky-950/45 dark:via-cyan-950/20 dark:to-emerald-950/30 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-cyan-400/18 blur-3xl dark:bg-cyan-500/10 sm:size-32"
          aria-hidden
        />
        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-sky-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20 dark:ring-white/10 sm:size-10">
              <UsersIcon className="size-[1.05rem] sm:size-[1.2rem]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">Öğretmenler</h1>
              <ToolbarIconHints
                compact
                showOnMobile
                className="text-[11px] sm:text-xs"
                items={[
                  { label: 'Liste', icon: UsersIcon },
                  { label: 'Görünüm', icon: LayoutGrid },
                  ...(me?.role === 'school_admin'
                    ? [
                        { label: 'Üyelik', icon: ShieldCheck },
                        { label: 'Profil', icon: UserCheck },
                      ]
                    : []),
                ]}
                summary={
                  me?.role === 'school_admin'
                    ? 'Üyelik onayı e-posta sonrası. Kişisel bilgiler öğretmen profilindedir.'
                    : 'Okul öğretmen listesi ve yönetimi.'
                }
              />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-stretch justify-end gap-1.5 sm:w-auto sm:items-center sm:gap-2">
            <Link
              href="/duty"
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/25 bg-background/85 px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-sky-500/10 sm:flex-initial sm:px-3 sm:text-sm"
            >
              <ClipboardList className="size-3.5 text-sky-600 sm:size-4" />
              Nöbet
            </Link>
            <Link
              href="/tv"
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/25 bg-background/85 px-2.5 text-xs font-medium transition-colors hover:bg-sky-500/10 sm:flex-initial sm:px-3 sm:text-sm"
            >
              <Tv className="size-3.5 text-muted-foreground sm:size-4" />
              TV
            </Link>
            <div className="flex w-full flex-[1_1_100%] gap-1.5 sm:w-auto sm:flex-initial">
              {me?.role === 'school_admin' && (
                <button
                  type="button"
                  onClick={() => setMebbisBulkOpen(true)}
                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-600/35 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-900 shadow-sm transition-all hover:bg-emerald-500/18 dark:text-emerald-100 sm:flex-initial sm:px-3 sm:text-sm"
                >
                  <FileSpreadsheet className="size-3.5 sm:size-4" aria-hidden />
                  MEBBİS toplu
                </button>
              )}
              <button
                type="button"
                onClick={() => setAddModalOpen(true)}
                disabled={!canAddMore}
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-3 sm:text-sm"
              >
                <UserPlus className="size-3.5 sm:size-4" />
                Öğretmen ekle
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hızlı aksiyon kartları */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-3 lg:grid-cols-4">
        <Link
          href="/tv"
          className="group flex items-center gap-2 rounded-xl border border-border/50 bg-card/95 p-2.5 shadow-sm ring-1 ring-black/5 transition-all hover:border-sky-500/30 hover:shadow-md sm:gap-3 sm:p-3.5 dark:ring-white/5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/12 text-sky-600 ring-1 ring-sky-500/20 sm:size-11 sm:rounded-xl">
            <Megaphone className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground sm:text-sm">Duyuru</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">TV yayını</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600 sm:size-5" />
        </Link>
        <Link
          href="/classes-subjects"
          className="group flex items-center gap-2 rounded-xl border border-border/50 bg-card/95 p-2.5 shadow-sm ring-1 ring-black/5 transition-all hover:border-emerald-500/35 hover:shadow-md sm:gap-3 sm:p-3.5 dark:ring-white/5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300 sm:size-11 sm:rounded-xl">
            <BookOpen className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground sm:text-sm">Sınıf & ders</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">Gruplar</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 sm:size-5" />
        </Link>
        <Link
          href="/school-reviews-report"
          className="group flex items-center gap-2 rounded-xl border border-border/50 bg-card/95 p-2.5 shadow-sm ring-1 ring-black/5 transition-all hover:border-amber-500/35 hover:shadow-md sm:gap-3 sm:p-3.5 dark:ring-white/5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300 sm:size-11 sm:rounded-xl">
            <BarChart3 className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold leading-tight text-foreground sm:text-sm">Okul değerlendirmesi</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">Genel özet</p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600 sm:size-5" />
        </Link>
        <Link
          href="/system-messages"
          className="group relative flex items-center gap-2 rounded-xl border border-border/50 bg-card/95 p-2.5 shadow-sm ring-1 ring-black/5 transition-all hover:border-violet-500/35 hover:shadow-md sm:gap-3 sm:p-3.5 dark:ring-white/5"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:text-violet-300 sm:size-11 sm:rounded-xl">
            <Mail className="size-4 sm:size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground sm:text-sm">Sistem</p>
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              {adminMessagesUnread > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">{adminMessagesUnread} yeni</span>
              ) : (
                'Mesajlar'
              )}
            </p>
          </div>
          {adminMessagesUnread > 0 && (
            <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white sm:right-3 sm:top-3 sm:size-6 sm:text-xs">
              {adminMessagesUnread}
            </span>
          )}
          <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-violet-600 sm:size-5" />
        </Link>
      </div>

      {/* Özet istatistikler */}
      {stats && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-linear-to-r from-sky-500/6 via-background to-violet-500/5 p-2.5 shadow-sm ring-1 ring-sky-500/10 dark:from-sky-950/25 dark:to-violet-950/20 dark:ring-sky-500/15 sm:gap-5 sm:p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] sm:text-sm">
            <UsersIcon className="size-4 shrink-0 text-sky-600 sm:size-5" />
            <span className="text-muted-foreground">Öğretmen</span>
            <span className="font-bold tabular-nums text-foreground">{teacherCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] sm:text-sm">
            <Megaphone className="size-4 shrink-0 text-emerald-600 sm:size-5" />
            <span className="text-muted-foreground">Duyuru</span>
            <span className="font-bold tabular-nums text-foreground">{stats.announcements}</span>
          </div>
          <Link
            href="/duty"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 transition-colors hover:underline dark:text-sky-300 sm:text-sm"
          >
            <ClipboardList className="size-3.5 sm:size-4" />
            Nöbet planı
            <ArrowRight className="size-3 sm:size-4" />
          </Link>
        </div>
      )}

      {!canAddMore && (
        <Alert
          message={`Öğretmen limiti (${teacherLimit}) doldu. Yeni öğretmen eklemek için superadmin ile iletişime geçin.`}
          className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
        />
      )}

      {me?.role === 'school_admin' && me.school?.id && (
        <fieldset className="space-y-2 rounded-lg border border-border/60 bg-card/90 px-3 py-2.5 text-xs sm:text-sm">
          <legend className="px-0.5 font-medium text-foreground">Öğretmen hesabı birleştirme</legend>
          <p className="text-muted-foreground">
            Okul tarafından eklenen (şifresiz) öğretmen ile aynı ad-soyadla web kaydı tek hesapta birleşir; aynı adda birden fazla ön kayıt varsa kayıt engellenir.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4">
            {(
              [
                { value: 'none' as const, label: 'Kapalı', hint: 'Kayıtta birleştirme yok.' },
                { value: 'automatic' as const, label: 'Otomatik', hint: 'Web kaydında ada göre tek hesapta birleşir.' },
                { value: 'manual' as const, label: 'Manuel', hint: 'Kayıtta birleştirme yok; listeden «Web hesabı ile birleştir» kullanın.' },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-0.5 has-[:checked]:border-primary/30 has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="teacher_name_merge_mode"
                  className="mt-1"
                  checked={(me.school?.teacher_name_merge_mode ?? 'none') === opt.value}
                  disabled={mergeSaving}
                  onChange={async () => {
                    if (!token) return;
                    setMergeSaving(true);
                    try {
                      await apiFetch(`/schools/${me.school!.id}`, {
                        method: 'PATCH',
                        token,
                        body: JSON.stringify({ teacher_name_merge_mode: opt.value }),
                      });
                      await refetchMe();
                      toast.success('Ayar kaydedildi');
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Ayar kaydedilemedi');
                    } finally {
                      setMergeSaving(false);
                    }
                  }}
                />
                <span>
                  <span className="font-medium text-foreground">{opt.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Card className="overflow-hidden rounded-xl border border-sky-500/15 bg-card/95 shadow-sm ring-1 ring-sky-500/10 dark:ring-sky-500/15 sm:rounded-2xl">
        <CardHeader className="border-b border-border/50 bg-linear-to-r from-sky-500/8 via-muted/15 to-violet-500/6 px-3 py-3 dark:from-sky-950/30 dark:via-background/50 dark:to-violet-950/20 sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold sm:text-lg">Öğretmen listesi</CardTitle>
              <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-sm">
                <span className="font-semibold text-foreground">{filteredItems.length}</span> gösteriliyor
                <span className="mx-1">·</span>
                <span className="font-semibold text-foreground">{teacherCount}</span> / {teacherLimit}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={loading || !data?.items?.length}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium transition-colors hover:bg-sky-500/8 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-sm"
              >
                <Download className="size-3.5 sm:size-4" />
                CSV
              </button>
              {selectedIds.size > 0 && (
                <a
                  href={`mailto:?bcc=${encodeURIComponent(selectedEmails)}`}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 text-xs font-semibold text-sky-900 transition-colors hover:bg-sky-500/15 dark:text-sky-100 sm:px-3 sm:text-sm"
                >
                  <MailPlus className="size-3.5 sm:size-4" />
                  {selectedIds.size} e-posta
                </a>
              )}
              <div className="relative w-full sm:min-w-[160px] sm:max-w-[260px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:left-3 sm:size-4" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ara…"
                  className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/15 sm:py-2.5 sm:pl-10 sm:pr-3 sm:text-sm"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'branch' | 'name');
                  setPage(1);
                }}
                className="min-h-9 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/15 sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
              >
                <option value="branch">Branş sırası</option>
                <option value="name">Ad sırası</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="min-h-9 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/15 sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
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
                className="min-h-9 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:border-sky-500/40 focus:outline-none focus:ring-2 focus:ring-sky-500/15 sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
              >
                <option value="">Tüm üyelikler</option>
                <option value="pending">Onay bekleyen</option>
                <option value="approved">Doğrulanmış</option>
                <option value="none">Okul yok</option>
              </select>
              <div
                className="flex w-full rounded-lg border border-sky-200/70 bg-sky-500/8 p-0.5 dark:border-sky-800/50 dark:bg-sky-950/30 sm:w-auto"
                role="group"
                aria-label="Görünüm"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-md p-1.5 transition-colors sm:flex-initial sm:p-2',
                    viewMode === 'cards'
                      ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                  )}
                  aria-label="Kart görünümü"
                  title="Kart görünümü"
                >
                  <LayoutGrid className="size-3.5 sm:size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-md p-1.5 transition-colors sm:flex-initial sm:p-2',
                    viewMode === 'table'
                      ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                  )}
                  aria-label="Tablo görünümü"
                  title="Tablo görünümü"
                >
                  <List className="size-3.5 sm:size-4" />
                </button>
              </div>
            </div>
          </div>
          {error && <Alert message={error} className="mt-3 py-2 text-sm" />}
        </CardHeader>
        <CardContent className="bg-linear-to-b from-background/50 to-transparent px-2 pt-4 sm:px-4 sm:pt-6 dark:from-transparent">
          {loading ? (
            <LoadingSpinner label="Öğretmen listesi yükleniyor…" />
          ) : data && data.items.length > 0 ? (
            <>
              {viewMode === 'cards' ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                      onRevoke={revokeMembership}
                      onOpenMerge={
                        me?.role === 'school_admin'
                          ? () => {
                              setMergeModalUser(u);
                              setMergeEmail('');
                            }
                          : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="table-x-scroll rounded-lg border border-slate-200 dark:border-slate-700/60">
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
                              <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-muted-foreground">
                                {u.school_join_stage === 'school_pending'
                                  ? 'Onay kuyruğundan onaylayabilirsiniz.'
                                  : 'E-posta doğrulandıktan sonra onay kuyruğundan onaylayabilirsiniz.'}
                              </p>
                            )}
                            {me?.role === 'school_admin' && u.school_verified && (
                              <button
                                onClick={() => revokeMembership(u.id)}
                                className="mt-1 inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60"
                              >
                                <Undo2 className="size-3" />
                                Onayı geri al
                              </button>
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
                            <div className="flex flex-wrap items-center gap-1">
                              {me?.role === 'school_admin' && u.is_passwordless_stub && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMergeModalUser(u);
                                    setMergeEmail('');
                                  }}
                                  className="inline-flex items-center gap-0.5 rounded-md border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200"
                                  title="Web hesabı ile birleştir"
                                >
                                  <Link2 className="size-3" />
                                  Birleştir
                                </button>
                              )}
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
        onSuccess={() => {
          setAddModalOpen(false);
          refreshAll();
        }}
      />

      <MebbisBulkImportDialog
        open={mebbisBulkOpen}
        onOpenChange={setMebbisBulkOpen}
        token={token}
        onSuccess={refreshAll}
      />

      <Dialog
        open={!!mergeModalUser}
        onOpenChange={(open) => {
          if (!open) {
            setMergeModalUser(null);
            setMergeEmail('');
          }
        }}
      >
        <DialogContent
          title="Web hesabı ile birleştir"
          className="max-w-[min(100%,28rem)]"
          descriptionId="merge-stub-desc"
        >
          {mergeModalUser && (
            <form onSubmit={submitMergeRegistration} className="space-y-3">
              <p id="merge-stub-desc" className="text-sm text-muted-foreground">
                Ön kayıt: <span className="font-medium text-foreground">{mergeModalUser.display_name ?? '—'}</span>. Aynı ad-soyadla web’e kayıtlı öğretmenin e-postasını girin; hesap tek kullanıcıda birleşir.
              </p>
              <div>
                <label htmlFor="merge-reg-email" className={labelClass}>
                  Web kaydı e-postası
                </label>
                <input
                  id="merge-reg-email"
                  type="email"
                  autoComplete="email"
                  value={mergeEmail}
                  onChange={(e) => setMergeEmail(e.target.value)}
                  className={fieldClass}
                  required
                  placeholder="ornek@mail.com"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                  onClick={() => {
                    setMergeModalUser(null);
                    setMergeEmail('');
                  }}
                  disabled={mergeBusy}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={mergeBusy || !token}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {mergeBusy ? 'Birleştiriliyor…' : 'Birleştir'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
  onRevoke,
  onOpenMerge,
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
  onRevoke?: (id: string) => void;
  onOpenMerge?: () => void;
}) {
  const subjectNames = (user.teacher_subject_ids ?? [])
    .map((id) => subjects.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const gradient = PASTEL_GRADIENTS[index % PASTEL_GRADIENTS.length];
  const unverified = teacherNeedsSchoolAttention(user);

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden',
        unverified
          ? 'border-amber-400/80 shadow-md ring-1 ring-amber-400/40 dark:border-amber-500/60 dark:ring-amber-500/30'
          : 'border-slate-200/80 dark:border-slate-700/60',
        selected && 'ring-2 ring-primary/40 border-primary/50',
      )}
    >
      {/* Header gradient band */}
      <div className={cn('h-16 bg-gradient-to-br', unverified ? 'from-amber-200 via-orange-100 to-amber-50 dark:from-amber-900/60 dark:via-orange-900/40 dark:to-amber-950/30' : gradient)} />

      {/* Avatar overlapping header */}
      <div className="relative px-3 -mt-8">
        <div className="flex items-end gap-2.5">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={onToggleSelect}
              className="absolute top-[-1.75rem] right-2.5 rounded border-white/80 shadow-sm"
              aria-label={`${user.display_name ?? user.email} seç`}
            />
          )}
          <div className="rounded-full ring-2 ring-white dark:ring-slate-800 shadow-sm shrink-0">
            <UserAvatarBubble
              avatarKey={user.avatar_key}
              avatarUrl={user.avatar_url}
              displayName={user.display_name || user.email}
              email={user.email}
              size="sm"
              verified={!!user.school_verified}
            />
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <Link href={`/teachers/${user.id}`} className="font-semibold text-foreground truncate block hover:text-primary text-sm leading-tight">
              {user.display_name ?? 'İsim belirtilmemiş'}
            </Link>
            {user.teacher_title && (
              <span className="text-[10px] text-muted-foreground">{user.teacher_title}</span>
            )}
          </div>
        </div>
      </div>

      {/* Info body */}
      <div className="flex-1 px-3 pt-2.5 pb-2 space-y-2">
        {/* Branch & subjects */}
        <div className="flex flex-wrap gap-1">
          {user.teacher_branch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              <GraduationCap className="size-3" />
              {user.teacher_branch}
            </span>
          )}
          {subjectNames && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 truncate max-w-[140px]" title={subjectNames}>
              <BookOpen className="size-3 shrink-0" />
              {subjectNames}
            </span>
          )}
        </div>

        {/* Contact */}
        <div className="space-y-1">
          <a href={`mailto:${user.email}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate hover:text-primary transition-colors">
            <Mail className="size-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{user.email}</span>
          </a>
          {user.teacher_phone && (
            <a href={`tel:${user.teacher_phone}`} className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate hover:text-primary transition-colors">
              <Phone className="size-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{user.teacher_phone}</span>
            </a>
          )}
        </div>

        {/* Membership badge */}
        <div className="pt-0.5">
          <MembershipBadge user={user} />
          {isSchoolAdmin && user.teacher_school_membership === 'pending' && (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              {user.school_join_stage === 'school_pending'
                ? 'Onay kuyruğundan onaylayabilirsiniz.'
                : 'E-posta doğrulandıktan sonra onay kuyruğundan onaylayabilirsiniz.'}
            </p>
          )}
        </div>

        {/* Registration date */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80">
          <Calendar className="size-3 shrink-0" />
          {formatDate(user.created_at)}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30">
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLES[user.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}>
          {STATUS_LABELS[user.status] ?? user.status}
        </span>
        <div className="flex items-center gap-0.5">
          {isSchoolAdmin && user.is_passwordless_stub && onOpenMerge && (
            <button
              type="button"
              onClick={onOpenMerge}
              className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50 hover:text-sky-800 dark:hover:bg-sky-950/50 dark:hover:text-sky-200 transition-colors"
              title="Web hesabı ile birleştir"
            >
              <Link2 className="size-3.5" />
            </button>
          )}
          {isSchoolAdmin && user.school_verified && onRevoke && (
            <button
              type="button"
              onClick={() => onRevoke(user.id)}
              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors"
              title="Onayı geri al"
            >
              <Undo2 className="size-3.5" />
            </button>
          )}
          <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 transition-colors" title="Düzenle">
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

function TeacherBranchDatalist({ id }: { id: string }) {
  return (
    <datalist id={id}>
      {TEACHER_BRANCH_OPTIONS.map((b) => (
        <option key={b} value={b} />
      ))}
    </datalist>
  );
}

function AddTeacherModal({
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
  const [teacherBranch, setTeacherBranch] = useState('');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [teacherTitle, setTeacherTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
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
          teacher_subject_ids: null,
        }),
      });
      toast.success('Öğretmen eklendi');
      setEmail('');
      setDisplayName('');
      setTeacherBranch('');
      setTeacherPhone('');
      setTeacherTitle('');
      setAvatarUrl('');
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
      <DialogContent title="Öğretmen ekle" className="max-w-[min(100%,28rem)] sm:max-w-xl" descriptionId="add-teacher-desc">
        <div className="-mt-0.5 flex items-start gap-3 border-b border-border/60 pb-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500/15 to-sky-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:from-emerald-950/50 dark:to-sky-950/30 dark:text-emerald-300 sm:size-11 sm:rounded-2xl">
            <UserPlus className="size-[1.15rem] sm:size-5" aria-hidden />
          </div>
          <p id="add-teacher-desc" className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-muted-foreground">
            Zorunlu alan e-postadır. Branş ve dersleri öğretmen kendi profilinden tamamlayabilir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-0">
          {error && (
            <div className="mb-4">
              <Alert message={error} />
            </div>
          )}

          <div className="space-y-4 sm:space-y-5">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06] sm:p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
                <Mail className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Hesap
              </p>
              <div className="space-y-3.5">
                <div>
                  <label htmlFor="teacher-email" className={labelClass}>
                    E-posta <span className="text-rose-600 dark:text-rose-400">*</span>
                  </label>
                  <input
                    id="teacher-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ornek@okul.gov.tr"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="teacher-name" className={labelClass}>
                    Görünen ad
                  </label>
                  <input
                    id="teacher-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={255}
                    placeholder="Ad Soyad"
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/10 p-3.5 sm:p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-[11px]">
                <Briefcase className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />
                Okul kaydı <span className="font-normal normal-case text-muted-foreground/80">(isteğe bağlı)</span>
              </p>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-x-4">
                <div className="sm:col-span-2">
                  <label htmlFor="teacher-branch" className={labelClass}>
                    Branş
                  </label>
                  <TeacherBranchDatalist id="teacher-branch-datalist-add" />
                  <input
                    id="teacher-branch"
                    type="text"
                    value={teacherBranch}
                    onChange={(e) => setTeacherBranch(e.target.value)}
                    maxLength={100}
                    placeholder="Örn. Matematik öğretmeni"
                    className={fieldClass}
                    list="teacher-branch-datalist-add"
                  />
                </div>
                <div>
                  <label htmlFor="teacher-title" className={labelClass}>
                    Ünvan
                  </label>
                  <select
                    id="teacher-title"
                    value={teacherTitle}
                    onChange={(e) => setTeacherTitle(e.target.value)}
                    className={cn(fieldClass, 'cursor-pointer')}
                  >
                    {TITLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="teacher-phone" className={labelClass}>
                    Telefon
                  </label>
                  <input
                    id="teacher-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={teacherPhone}
                    onChange={(e) => setTeacherPhone(e.target.value)}
                    maxLength={32}
                    placeholder="05XX XXX XX XX"
                    className={fieldClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="teacher-avatar" className={labelClass}>
                    Profil fotoğrafı URL
                  </label>
                  <input
                    id="teacher-avatar"
                    type="url"
                    inputMode="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    maxLength={512}
                    placeholder="https://…"
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-[1] -mx-4 mt-6 flex flex-col-reverse gap-2 border-t border-border/80 bg-background/95 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 w-full rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/60 sm:min-h-10 sm:w-auto"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 transition-[opacity,transform] hover:bg-emerald-700 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 sm:min-h-10 sm:w-auto dark:shadow-emerald-950/40"
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
  const selectedSubjectNames = (user.teacher_subject_ids ?? [])
    .map((id) => subjects.find((s) => s.id === id)?.name)
    .filter(Boolean);
  const titleLabel = TITLE_OPTIONS.find((o) => o.value === user.teacher_title)?.label;

  if (readOnlyProfile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title="Öğretmen bilgisi" className="max-w-lg">
          <div className="flex flex-col min-h-0 flex-1">
            {/* Profile header with gradient */}
            <div className="relative overflow-hidden rounded-t-lg">
              <div className="h-20 bg-gradient-to-br from-indigo-400 via-violet-400 to-purple-500 dark:from-indigo-600 dark:via-violet-600 dark:to-purple-700" />
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
            </div>

            <div className="relative px-5 -mt-10">
              <div className="flex items-end gap-4">
                <div className="rounded-2xl ring-4 ring-background shadow-lg shrink-0 overflow-hidden">
                  <UserAvatarBubble
                    avatarKey={user.avatar_key}
                    avatarUrl={user.avatar_url}
                    displayName={previewName}
                    email={user.email}
                    size="lg"
                    verified={!!user.school_verified}
                  />
                </div>
                <div className="min-w-0 flex-1 pb-1">
                  <h2 className="text-lg font-bold text-foreground truncate">{previewName}</h2>
                  {user.teacher_branch && (
                    <span className="inline-flex items-center gap-1 mt-0.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                      <GraduationCap className="size-3.5" />
                      {user.teacher_branch}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info rows */}
            <div className="px-5 pt-5 pb-2 space-y-3.5">
              {/* Status + membership */}
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLES[user.status] ?? 'bg-slate-100 text-slate-600')}>
                  {STATUS_LABELS[user.status] ?? user.status}
                </span>
                <MembershipBadge user={user} />
              </div>

              {/* Detail grid */}
              <div className="rounded-xl border border-border/60 bg-muted/20 divide-y divide-border/50">
                <InfoRow icon={<Mail className="size-4" />} label="E-posta">
                  <a href={`mailto:${user.email}`} className="text-sm text-foreground hover:text-primary transition-colors truncate">{user.email}</a>
                </InfoRow>

                {user.teacher_phone && (
                  <InfoRow icon={<Phone className="size-4" />} label="Telefon">
                    <a href={`tel:${user.teacher_phone}`} className="text-sm text-foreground hover:text-primary transition-colors">{user.teacher_phone}</a>
                  </InfoRow>
                )}

                {titleLabel && titleLabel !== 'Seçiniz' && (
                  <InfoRow icon={<Briefcase className="size-4" />} label="Ünvan">
                    <span className="text-sm text-foreground">{titleLabel}</span>
                  </InfoRow>
                )}

                <InfoRow icon={<Calendar className="size-4" />} label="Kayıt tarihi">
                  <span className="text-sm text-foreground">{formatDate(user.created_at)}</span>
                </InfoRow>

                {selectedSubjectNames.length > 0 && (
                  <InfoRow icon={<BookOpen className="size-4" />} label="Dersler">
                    <div className="flex flex-wrap gap-1">
                      {selectedSubjectNames.map((name) => (
                        <span key={name} className="inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                          {name}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                )}
              </div>

              {/* School admin info note */}
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground dark:border-slate-700 dark:bg-slate-800/50">
                Kişisel bilgiler öğretmenin kendi hesabından güncellenir. Okul üyeliğini onay kuyruğundan, hesap durumunu öğretmen listesinden yönetebilirsiniz.
              </p>
            </div>

            <div className="shrink-0 flex justify-end px-5 py-4 border-t border-border bg-muted/20">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Öğretmen düzenle" className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-4 px-6 py-4 border-b border-border bg-muted/30 rounded-t-lg">
            <div className="rounded-xl ring-2 ring-border/40 shadow-sm shrink-0 overflow-hidden">
              <UserAvatarBubble
                avatarKey={user.avatar_key}
                avatarUrl={user.avatar_url}
                displayName={previewName}
                email={user.email}
                size="md"
                verified={!!user.school_verified}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{previewName || '—'}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                <Mail className="size-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <MembershipBadge user={user} />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && <Alert message={error} className="mb-4" />}
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="edit-display-name" className="block text-sm font-medium text-foreground mb-1.5">Görünen ad</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgUser /></span>
                  <input id="edit-display-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={255} placeholder="Ad Soyad" className={inputBase} />
                </div>
              </div>
              <div>
                <label htmlFor="edit-branch" className="block text-sm font-medium text-foreground mb-1.5">Branş</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgBook /></span>
                  <TeacherBranchDatalist id="teacher-branch-datalist-edit" />
                  <input
                    id="edit-branch"
                    type="text"
                    value={teacherBranch}
                    onChange={(e) => setTeacherBranch(e.target.value)}
                    maxLength={100}
                    placeholder="Matematik Öğretmeni vb."
                    className={inputBase}
                    list="teacher-branch-datalist-edit"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="edit-title" className="block text-sm font-medium text-foreground mb-1.5">Ünvan</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"><SvgBriefcase /></span>
                  <select id="edit-title" value={teacherTitle} onChange={(e) => setTeacherTitle(e.target.value)} className={inputBase + ' appearance-none'}>
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
                  <input id="edit-phone" type="tel" value={teacherPhone} onChange={(e) => setTeacherPhone(e.target.value)} maxLength={32} placeholder="05XX XXX XX XX" className={inputBase} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="edit-avatar" className="block text-sm font-medium text-foreground mb-1.5">Fotoğraf URL</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><SvgImage /></span>
                  <input id="edit-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} maxLength={512} placeholder="https://..." className={inputBase} />
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
                      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:text-primary"
                    >
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(s.id)}
                        onChange={(e) => setSubjectIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id))}
                        className="rounded border-input"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/20">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
              İptal
            </button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">
              {submitting ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 text-muted-foreground/70 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}
