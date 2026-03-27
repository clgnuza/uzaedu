'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  RefreshCw,
  Plus,
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  MapPin,
  User,
  CalendarDays,
  MessageSquare,
  BookOpen,
  ChevronRight,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type DutySlot = {
  id: string;
  date: string;
  area_name: string | null;
  user_id?: string;
  user?: { display_name: string | null; email: string };
};

type CoverageInfo = {
  id: string;
  lesson_num: number;
  class_section?: string;
  subject?: string;
  covered_by_user_id?: string | null;
  covered_by_user?: { display_name: string | null; email: string } | null;
};

type SwapRequest = {
  id: string;
  duty_slot_id: string;
  request_type?: 'swap' | 'day_change' | 'coverage_swap';
  teacher2_status?: 'pending' | 'approved' | 'rejected' | null;
  coverage_id?: string | null;
  coverage?: CoverageInfo | null;
  status: 'pending' | 'approved' | 'rejected' | 'reverted';
  admin_note: string | null;
  created_at: string;
  requested_by_user_id: string;
  proposed_user_id?: string | null;
  requestedByUser?: { display_name: string | null; email: string };
  proposedUser?: { display_name: string | null; email: string } | null;
  duty_slot?: DutySlot;
};

type UserItem = { id: string; display_name: string | null; email: string; role?: string; area_name?: string | null };

type MyCoverage = {
  id: string;
  lesson_num: number;
  duty_slot_id: string;
  duty_slot?: {
    date: string;
    area_name: string | null;
    user?: { display_name: string | null; email: string };
  };
};

function personName(u?: { display_name: string | null; email: string } | null) {
  if (!u) return '—';
  return u.display_name || u.email || '—';
}

function formatDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatDateTime(s: string) {
  return new Date(s).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_CONFIG_SWAP = {
  pending: {
    icon: Clock,
    label: 'Beklemede',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    border: 'border-l-amber-400',
  },
  approved: {
    icon: CheckCircle2,
    label: 'Onaylandı',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    border: 'border-l-emerald-400',
  },
  rejected: {
    icon: XCircle,
    label: 'Reddedildi',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    border: 'border-l-rose-400',
  },
  reverted: {
    icon: Undo2,
    label: 'Geri alındı',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
    border: 'border-l-slate-400',
  },
} as const;

const TEACHER2_CONFIG = {
  pending: { label: 'Öğrtmn. onayı bekleniyor', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200' },
  approved: { label: 'Öğrtmn. onayladı', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200' },
  rejected: { label: 'Öğrtmn. reddetti', className: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200' },
};

// Adım göstergesi: swap / coverage_swap için 2 adım
function StepIndicator({ request }: { request: SwapRequest }) {
  if (request.request_type === 'day_change') {
    return (
      <div className="flex items-center gap-1.5 text-xs mt-2">
        <span className={cn(
          'px-2 py-0.5 rounded-full font-medium',
          request.status === 'pending'
            ? 'bg-amber-100 text-amber-700'
            : request.status === 'approved'
              ? 'bg-emerald-100 text-emerald-700'
              : request.status === 'reverted'
                ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                : 'bg-rose-100 text-rose-700',
        )}>
          Admin Onayı
        </span>
        <span className={cn(
          'px-2 py-0.5 rounded-full font-medium',
          request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : request.status === 'reverted' ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' : 'bg-muted text-muted-foreground',
        )}>
          {request.status === 'approved' ? 'Tamamlandı' : request.status === 'reverted' ? 'Geri alındı' : request.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
        </span>
      </div>
    );
  }

  const t2 = request.teacher2_status;
  const adminStep = request.status;

  return (
    <div className="flex items-center gap-1 text-xs mt-2">
      <span className={cn(
        'px-2 py-0.5 rounded-full font-medium',
        t2 === 'approved'
          ? 'bg-emerald-100 text-emerald-700'
          : t2 === 'rejected'
            ? 'bg-rose-100 text-rose-700'
            : 'bg-amber-100 text-amber-700',
      )}>
        {t2 === 'approved' ? '✓ Öğrtmn. Onayı' : t2 === 'rejected' ? '✗ Öğrtmn. Reddi' : '⏳ Öğrtmn. Onayı'}
      </span>
      <ChevronRight className="size-3 text-muted-foreground" />
      <span className={cn(
        'px-2 py-0.5 rounded-full font-medium',
        adminStep === 'approved'
          ? 'bg-emerald-100 text-emerald-700'
          : adminStep === 'reverted'
            ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
            : adminStep === 'rejected'
              ? 'bg-rose-100 text-rose-700'
              : 'bg-muted text-muted-foreground',
      )}>
        {adminStep === 'approved' ? '✓ Admin Onayı' : adminStep === 'reverted' ? '↩ Geri alındı' : adminStep === 'rejected' ? '✗ Admin Reddi' : 'Admin Onayı'}
      </span>
    </div>
  );
}

export default function TakasPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const isTeacher = me?.role === 'teacher';
  const [swapEnabled, setSwapEnabled] = useState<boolean | null>(isAdmin ? true : null);

  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Swap talebi oluşturma
  const [createOpen, setCreateOpen] = useState(false);
  const [mySlots, setMySlots] = useState<DutySlot[]>([]);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  // Seçili slot ile aynı gün nöbetçi olan öğretmenler (swap için)
  const [sameDayTeachers, setSameDayTeachers] = useState<UserItem[]>([]);
  const [sameDayLoadingSlotId, setSameDayLoadingSlotId] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [creating, setCreating] = useState(false);

  // Gün değişimi talebi
  const [dayChangeOpen, setDayChangeOpen] = useState(false);
  const [dayChangeSlotId, setDayChangeSlotId] = useState('');
  const [dayChangeCreating, setDayChangeCreating] = useState(false);

  // Ders görevi değişimi talebi
  const [coverageSwapOpen, setCoverageSwapOpen] = useState(false);
  const [myCoverages, setMyCoverages] = useState<MyCoverage[]>([]);
  const [selectedCoverageId, setSelectedCoverageId] = useState('');
  const [selectedCoverageTeacherId, setSelectedCoverageTeacherId] = useState('');
  const [coverageSwapCreating, setCoverageSwapCreating] = useState(false);

  // Admin onay/red
  const [respondOpen, setRespondOpen] = useState<SwapRequest | null>(null);
  const [respondStatus, setRespondStatus] = useState<'approved' | 'rejected'>('approved');
  const [respondNote, setRespondNote] = useState('');
  const [respondOverrideUser, setRespondOverrideUser] = useState('');
  const [responding, setResponding] = useState(false);

  // Öğretmen B yanıt
  const [teacher2Responding, setTeacher2Responding] = useState<string | null>(null);

  // Talep iptal (öğretmen: kendi talebi, admin: herhangi bekleyen)
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiFetch<SwapRequest[]>('/duty/swap-requests', { token });
      setRequests(Array.isArray(list) ? list : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    if (!token || isAdmin) return;
    apiFetch<{ swap_enabled: boolean }>('/duty/teacher-features', { token })
      .then((d) => setSwapEnabled(d?.swap_enabled ?? true))
      .catch(() => setSwapEnabled(true));
  }, [token, isAdmin]);

  const fetchTeacherData = useCallback(async () => {
    if (!token || !isTeacher) return;
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    // 6 ay ileri (nöbet takası + gün değişimi için yeterli aralık)
    const endDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    const to = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    try {
      const [slots, teachersList, coverages] = await Promise.all([
        apiFetch<DutySlot[]>(`/duty/daily-range?from=${from}&to=${to}`, { token }),
        apiFetch<UserItem[]>('/duty/teachers', { token }),
        apiFetch<MyCoverage[]>(`/duty/coverage-by-date?from=${from}&to=${to}`, { token }),
      ]);
      setMySlots(Array.isArray(slots) ? slots : []);
      setTeachers(Array.isArray(teachersList) ? teachersList : []);
      setMyCoverages(
        (Array.isArray(coverages) ? coverages : []).filter(
          (c: MyCoverage & { covered_by_user_id?: string }) => c.covered_by_user_id === me?.id
        )
      );
    } catch {
      setMySlots([]);
      setTeachers([]);
      setMyCoverages([]);
    }
  }, [token, isTeacher, me?.id]);

  useEffect(() => {
    if (createOpen || dayChangeOpen || coverageSwapOpen) fetchTeacherData();
  }, [createOpen, dayChangeOpen, coverageSwapOpen, fetchTeacherData]);

  useEffect(() => {
    if (isAdmin && (respondOpen?.request_type === 'day_change' || respondOpen?.request_type === 'coverage_swap')) {
      apiFetch<UserItem[]>('/duty/teachers', { token: token! }).then((t) => {
        if (Array.isArray(t)) setTeachers(t);
      }).catch(() => {});
    }
  }, [respondOpen, isAdmin, token]);

  // Seçili slot'un tarihindeki nöbetçileri yükle (swap için – aynı gün, farklı yer de dahil)
  useEffect(() => {
    if (!selectedSlotId || !token) {
      setSameDayTeachers([]);
      return;
    }
    const slot = mySlots.find((s) => s.id === selectedSlotId);
    if (!slot) return;
    setSameDayLoadingSlotId(selectedSlotId);
    setSameDayTeachers([]);
    setSelectedUserId('');
    // /duty/partners endpoint tüm rollerde aynı gün nöbetçi olanları (farklı yerler dahil) döner
    apiFetch<{ user_id: string; display_name: string | null; email: string; area_name: string | null }[]>(
      `/duty/partners?date=${slot.date}`,
      { token }
    ).then((res) => {
      const list = Array.isArray(res) ? res : [];
      setSameDayTeachers(
        list.map((p) => ({
          id: p.user_id,
          display_name: p.display_name,
          email: p.email,
          area_name: p.area_name,
        }))
      );
    }).catch(() => {
      setSameDayTeachers([]);
    }).finally(() => {
      setSameDayLoadingSlotId(null);
    });
  }, [selectedSlotId, mySlots, token]);

  const handleCreate = async () => {
    if (!selectedSlotId || !selectedUserId || !token) return;
    setCreating(true);
    try {
      await apiFetch('/duty/swap-requests', {
        token,
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: selectedSlotId, proposed_user_id: selectedUserId, request_type: 'swap' }),
      });
      toast.success('Devir talebi gönderildi. Karşı öğretmene bildirim gönderildi.');
      setCreateOpen(false);
      setSelectedSlotId('');
      setSelectedUserId('');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Talep gönderilemedi.');
    } finally {
      setCreating(false);
    }
  };

  const handleDayChangeCreate = async () => {
    if (!dayChangeSlotId || !token) return;
    setDayChangeCreating(true);
    try {
      await apiFetch('/duty/swap-requests', {
        token,
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: dayChangeSlotId, request_type: 'day_change' }),
      });
      toast.success('Gün değişim talebi gönderildi. Admin tarafından atama yapılacak.');
      setDayChangeOpen(false);
      setDayChangeSlotId('');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Talep gönderilemedi.');
    } finally {
      setDayChangeCreating(false);
    }
  };

  const handleCoverageSwapCreate = async () => {
    if (!selectedCoverageId || !selectedCoverageTeacherId || !token) return;
    const cov = myCoverages.find((c) => c.id === selectedCoverageId);
    if (!cov) return;
    setCoverageSwapCreating(true);
    try {
      await apiFetch('/duty/swap-requests', {
        token,
        method: 'POST',
        body: JSON.stringify({
          duty_slot_id: cov.duty_slot_id,
          request_type: 'coverage_swap',
          coverage_id: selectedCoverageId,
          proposed_user_id: selectedCoverageTeacherId,
        }),
      });
      toast.success('Ders görevi değişim talebi gönderildi. Karşı öğretmene bildirim gönderildi.');
      setCoverageSwapOpen(false);
      setSelectedCoverageId('');
      setSelectedCoverageTeacherId('');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Talep gönderilemedi.');
    } finally {
      setCoverageSwapCreating(false);
    }
  };

  const handleTeacher2Respond = async (reqId: string, action: 'approved' | 'rejected') => {
    if (!token) return;
    setTeacher2Responding(reqId + action);
    try {
      await apiFetch(`/duty/swap-requests/${reqId}/teacher-respond`, {
        token,
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      toast.success(action === 'approved' ? 'Talebi kabul ettiniz. Admin onayı bekleniyor.' : 'Talep reddedildi.');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı.');
    } finally {
      setTeacher2Responding(null);
    }
  };

  const handleRespond = async () => {
    if (!respondOpen || !token) return;
    setResponding(true);
    try {
      await apiFetch(`/duty/swap-requests/${respondOpen.id}/respond`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          status: respondStatus,
          admin_note: respondNote || undefined,
          proposed_user_id: respondOverrideUser || undefined,
        }),
      });
      toast.success(respondStatus === 'approved' ? 'Talep onaylandı.' : 'Talep reddedildi.');
      setRespondOpen(null);
      setRespondNote('');
      setRespondOverrideUser('');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı.');
    } finally {
      setResponding(false);
    }
  };

  const handleCancel = async (reqId: string) => {
    if (!token) return;
    setCancelingId(reqId);
    try {
      await apiFetch(`/duty/swap-requests/${reqId}`, { token, method: 'DELETE' });
      toast.success('Talep iptal edildi.');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'İptal edilemedi.');
    } finally {
      setCancelingId(null);
    }
  };

  const handleRevert = async (reqId: string) => {
    if (!token) return;
    if (!window.confirm('Onaylanan talebi geri almak istiyor musunuz? Nöbet veya ders görevi önceki öğretmene döner.')) return;
    setRevertingId(reqId);
    try {
      await apiFetch(`/duty/swap-requests/${reqId}/revert`, { token, method: 'POST' });
      toast.success('Talep geri alındı.');
      fetchRequests();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı.');
    } finally {
      setRevertingId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;
  const revertedCount = requests.filter((r) => r.status === 'reverted').length;

  type RequestTypeKey = 'swap' | 'day_change' | 'coverage_swap';

  const REQUEST_TYPE_LABELS: Record<RequestTypeKey, { label: string; className: string }> = {
    swap: { label: 'Nöbet Takası', className: 'bg-sky-200/90 text-sky-900 dark:bg-sky-800/60 dark:text-sky-100' },
    day_change: { label: 'Gün Değişimi', className: 'bg-violet-200/90 text-violet-900 dark:bg-violet-800/60 dark:text-violet-100' },
    coverage_swap: { label: 'Ders Görevi Değişimi', className: 'bg-amber-200/90 text-amber-950 dark:bg-amber-800/60 dark:text-amber-100' },
  };

  /** Talep kartları ve oluştur butonları — tipe göre pastel tema */
  const TYPE_UI: Record<
    RequestTypeKey,
    {
      createBtn: string;
      section: string;
      sectionTitle: string;
      cardTint: string;
    }
  > = {
    swap: {
      createBtn:
        'border-2 border-sky-400/70 bg-gradient-to-br from-sky-100 to-sky-50 text-sky-950 shadow-sm hover:from-sky-200 hover:to-sky-100 dark:border-sky-600 dark:from-sky-950/60 dark:to-sky-900/40 dark:text-sky-50 dark:hover:from-sky-900 dark:hover:to-sky-950',
      section:
        'rounded-2xl border-2 border-sky-300/70 bg-gradient-to-br from-sky-50/90 via-white to-sky-100/30 p-4 shadow-sm dark:border-sky-700/50 dark:from-sky-950/40 dark:via-slate-950/50 dark:to-sky-950/20',
      sectionTitle: 'text-sky-900 dark:text-sky-100',
      cardTint: 'bg-sky-50/60 dark:bg-sky-950/25',
    },
    day_change: {
      createBtn:
        'border-2 border-violet-400/70 bg-gradient-to-br from-violet-100 to-violet-50 text-violet-950 shadow-sm hover:from-violet-200 hover:to-violet-100 dark:border-violet-600 dark:from-violet-950/60 dark:to-violet-900/40 dark:text-violet-50 dark:hover:from-violet-900 dark:hover:to-violet-950',
      section:
        'rounded-2xl border-2 border-violet-300/70 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/30 p-4 shadow-sm dark:border-violet-700/50 dark:from-violet-950/40 dark:via-slate-950/50 dark:to-fuchsia-950/15',
      sectionTitle: 'text-violet-900 dark:text-violet-100',
      cardTint: 'bg-violet-50/60 dark:bg-violet-950/25',
    },
    coverage_swap: {
      createBtn:
        'border-2 border-amber-400/70 bg-gradient-to-br from-amber-100 to-amber-50 text-amber-950 shadow-sm hover:from-amber-200 hover:to-amber-100 dark:border-amber-600 dark:from-amber-950/60 dark:to-amber-900/40 dark:text-amber-50 dark:hover:from-amber-900 dark:hover:to-amber-950',
      section:
        'rounded-2xl border-2 border-amber-300/70 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/30 p-4 shadow-sm dark:border-amber-700/50 dark:from-amber-950/40 dark:via-slate-950/50 dark:to-orange-950/15',
      sectionTitle: 'text-amber-950 dark:text-amber-100',
      cardTint: 'bg-amber-50/60 dark:bg-amber-950/25',
    },
  };

  const requestsByType = useMemo(() => {
    const swap: SwapRequest[] = [];
    const day_change: SwapRequest[] = [];
    const coverage_swap: SwapRequest[] = [];
    for (const r of requests) {
      const t = (r.request_type ?? 'swap') as RequestTypeKey;
      if (t === 'day_change') day_change.push(r);
      else if (t === 'coverage_swap') coverage_swap.push(r);
      else swap.push(r);
    }
    return { swap, day_change, coverage_swap };
  }, [requests]);

  const TYPE_ORDER: { key: RequestTypeKey; title: string; Icon: typeof ArrowLeftRight }[] = [
    { key: 'swap', title: 'Nöbet Takası', Icon: ArrowLeftRight },
    { key: 'day_change', title: 'Gün Değişimi', Icon: CalendarDays },
    { key: 'coverage_swap', title: 'Ders Görevi Değişimi', Icon: BookOpen },
  ];

  if (isTeacher && swapEnabled === false) {
    return (
      <div className="space-y-5">
        <Card className="rounded-xl border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <ArrowLeftRight className="size-6 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-100">Görev Devri kapalı</h3>
                <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/90">
                  Okul yöneticiniz Görev Devri özelliğini devre dışı bırakmış. Nöbet takası, gün değişimi ve ders görevi değişimi talebi oluşturamazsınız. Açılmasını istiyorsanız okul yöneticinizle iletişime geçin.
                </p>
                <Link href="/duty">
                  <Button variant="outline" size="sm" className="mt-4 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200">
                    Nöbet sayfasına dön
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DutyPageHeader
        icon={ArrowLeftRight}
        title="Görev Devri ve Değişim Talepleri"
        description={
          isAdmin
            ? 'Bekleyen talepleri onaylayın veya reddedin. Talep tiplerine göre uygun öğretmeni atayabilirsiniz.'
            : 'Nöbet takası, gün değişimi veya ders görevi değişimi talebinde bulunun.'
        }
        color="blue"
        badge={
          pendingCount > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {pendingCount} bekliyor
            </span>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchRequests} disabled={loading}>
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
              Yenile
            </Button>
            {isTeacher && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:rounded-2xl sm:border sm:border-border/60 sm:bg-muted/30 sm:p-1.5">
                <span className="hidden text-[11px] font-medium text-muted-foreground sm:mr-1 sm:inline">Yeni talep</span>
                <Button size="sm" className={cn('gap-1.5', TYPE_UI.swap.createBtn)} onClick={() => setCreateOpen(true)}>
                  <Plus className="size-4 shrink-0" />
                  Nöbet Takası
                </Button>
                <Button size="sm" className={cn('gap-1.5', TYPE_UI.day_change.createBtn)} onClick={() => setDayChangeOpen(true)}>
                  <CalendarDays className="size-4 shrink-0" />
                  Gün Değişimi
                </Button>
                <Button size="sm" className={cn('gap-1.5', TYPE_UI.coverage_swap.createBtn)} onClick={() => setCoverageSwapOpen(true)}>
                  <BookOpen className="size-4 shrink-0" />
                  Ders Görevi
                </Button>
              </div>
            )}
          </div>
        }
      />

      {/* Özet sayaçlar */}
      {requests.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Bekleyen', value: pendingCount, color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/20', Icon: Clock },
            { label: 'Onaylanan', value: approvedCount, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/20', Icon: CheckCircle2 },
            { label: 'Reddedilen', value: rejectedCount, color: 'text-rose-700', bg: 'bg-rose-50 dark:bg-rose-950/20', Icon: XCircle },
            { label: 'Geri alınan', value: revertedCount, color: 'text-slate-700', bg: 'bg-slate-50 dark:bg-slate-950/30', Icon: Undo2 },
          ].map((s) => (
            <div key={s.label} className={cn('rounded-xl p-3 border border-border/50 flex items-center gap-3', s.bg)}>
              <s.Icon className={cn('size-5 shrink-0', s.color)} />
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        </div>
      ) : !requests.length ? (
        <EmptyState
          icon={<ArrowLeftRight className="size-12 text-muted-foreground/50" />}
          title="Talep yok"
          description={isAdmin ? 'Henüz talep bulunmuyor.' : 'Nöbet takası veya değişim talebi oluşturabilirsiniz.'}
        />
      ) : (
        <div className="space-y-8">
          {TYPE_ORDER.map(({ key, title, Icon: SectionIcon }) => {
            const list = requestsByType[key];
            if (!list.length) return null;
            const ui = TYPE_UI[key];
            return (
              <div key={key} className="space-y-3">
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-2.5 rounded-xl border px-3 py-2.5 sm:px-4',
                    ui.section,
                  )}
                >
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/90 shadow-sm ring-1 ring-black/5 dark:bg-slate-900/90 dark:ring-white/10',
                      ui.sectionTitle,
                    )}
                  >
                    <SectionIcon className="size-4" aria-hidden />
                  </div>
                  <span className={cn('text-sm font-semibold sm:text-base', ui.sectionTitle)}>
                    {title}{' '}
                    <span className="font-normal text-muted-foreground">({list.length})</span>
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((req) => {
            const cfg = STATUS_CONFIG_SWAP[req.status as keyof typeof STATUS_CONFIG_SWAP] ?? STATUS_CONFIG_SWAP.pending;
            const Icon = cfg.icon;
            const typeLabel = REQUEST_TYPE_LABELS[(req.request_type ?? 'swap') as RequestTypeKey];
            const isTeacher2 = isTeacher && req.proposed_user_id === me?.id && req.teacher2_status === 'pending' && req.status === 'pending';

            return (
              <div
                key={req.id}
                className={cn(
                  'rounded-xl border border-l-4 bg-card shadow-sm hover:shadow-md transition-shadow',
                  cfg.border,
                  ui.cardTint,
                )}
              >
                <div className="p-4 pb-3">
                  {/* Durum ve tarih */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.badge)}>
                      <Icon className="size-3" />
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(req.created_at)}</span>
                  </div>

                  {/* Talep tipi */}
                  {typeLabel && (
                    <div className="mb-2">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', typeLabel.className)}>
                        {req.request_type === 'coverage_swap' && <BookOpen className="size-3" />}
                        {req.request_type === 'day_change' && <CalendarDays className="size-3" />}
                        {req.request_type === 'swap' && <ArrowLeftRight className="size-3" />}
                        {typeLabel.label}
                      </span>
                    </div>
                  )}

                  {/* Nöbet bilgisi */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <CalendarDays className="size-3.5 shrink-0" />
                    <span className="font-medium text-foreground">
                      {req.duty_slot?.date ? formatDate(req.duty_slot.date) : '—'}
                    </span>
                    {req.duty_slot?.area_name && (
                      <>
                        <span className="text-border">·</span>
                        <MapPin className="size-3.5 shrink-0" />
                        <span>{req.duty_slot.area_name}</span>
                      </>
                    )}
                  </div>

                  {/* Coverage bilgisi */}
                  {req.request_type === 'coverage_swap' && req.coverage && (
                    <div className="flex items-center gap-1.5 text-xs mb-2 bg-orange-50 dark:bg-orange-950/20 rounded-md px-2 py-1.5">
                      <BookOpen className="size-3.5 text-orange-500 shrink-0" />
                      <span className="font-medium">{req.coverage.lesson_num}. ders</span>
                      {req.coverage.class_section && (
                        <span className="text-muted-foreground">– {req.coverage.class_section}{req.coverage.subject ? `-${req.coverage.subject}` : ''}</span>
                      )}
                    </div>
                  )}

                  {/* Transfer akışı */}
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Talep özeti</p>
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {req.requestedByUser?.display_name || req.requestedByUser?.email || '—'}
                        </span>
                      </div>
                      <ArrowLeftRight className="size-4 text-primary shrink-0" />
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className="text-sm font-medium truncate text-right">
                          {req.request_type === 'day_change' && req.status === 'pending'
                            ? <span className="text-muted-foreground italic text-xs">Admin atayacak</span>
                            : (req.proposedUser?.display_name || req.proposedUser?.email || '—')
                        }
                        </span>
                        <User className="size-3.5 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  </div>

                  {(req.status === 'approved' || req.status === 'reverted') && (
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2.5 mb-2 space-y-1.5',
                        req.status === 'approved'
                          ? 'border-emerald-200/90 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-900/40',
                      )}
                    >
                      <p
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide',
                          req.status === 'approved'
                            ? 'text-emerald-800 dark:text-emerald-300'
                            : 'text-slate-700 dark:text-slate-300',
                        )}
                      >
                        {req.status === 'approved' ? 'Onay sonrası güncel kayıt' : 'Güncel kayıt (geri alındı)'}
                      </p>
                      {req.request_type === 'coverage_swap' ? (
                        <>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                            <span className="text-muted-foreground shrink-0">Ders görevini yürüten:</span>
                            <span className="font-semibold text-foreground">
                              {personName(req.coverage?.covered_by_user ?? req.proposedUser)}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            Talep: {personName(req.requestedByUser)} → onaylanan: {personName(req.proposedUser)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                            <span className="text-muted-foreground shrink-0">Nöbet görevlisi (kayıtta):</span>
                            <span className="font-semibold text-foreground">{personName(req.duty_slot?.user)}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            Devreden: {personName(req.requestedByUser)}
                            <span className="text-border mx-1">·</span>
                            Taleple onaylanan: {personName(req.proposedUser)}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 2-adım onay göstergesi */}
                  {req.request_type !== 'day_change' && (
                    <StepIndicator request={req} />
                  )}

                  {/* Admin notu */}
                  {req.admin_note && (
                    <div className="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground italic">
                      <MessageSquare className="size-3.5 shrink-0 mt-0.5" />
                      <span>"{req.admin_note}"</span>
                    </div>
                  )}
                </div>

                {/* Öğretmen B yanıt butonları */}
                {isTeacher2 && (
                  <div className="px-4 pb-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Bu talep size yönlendirildi. Kabul veya reddedin:</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        disabled={teacher2Responding === req.id + 'approved'}
                        onClick={() => handleTeacher2Respond(req.id, 'approved')}
                      >
                        {teacher2Responding === req.id + 'approved' ? <LoadingSpinner className="size-3.5" /> : <Check className="size-3.5" />}
                        Kabul Et
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 border-rose-300 text-rose-700 hover:bg-rose-50 text-xs dark:border-rose-700 dark:text-rose-300"
                        disabled={teacher2Responding === req.id + 'rejected'}
                        onClick={() => handleTeacher2Respond(req.id, 'rejected')}
                      >
                        {teacher2Responding === req.id + 'rejected' ? <LoadingSpinner className="size-3.5" /> : <X className="size-3.5" />}
                        Reddet
                      </Button>
                    </div>
                  </div>
                )}

                {/* Talep iptal – talep sahibi (öğretmen) veya admin, bekleyen talepler için */}
                {!isTeacher2 && req.status === 'pending' && (req.requested_by_user_id === me?.id || isAdmin) && (
                  <div className="px-4 pb-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      disabled={!!cancelingId}
                      onClick={() => handleCancel(req.id)}
                    >
                      {cancelingId === req.id ? <LoadingSpinner className="size-3.5" /> : <Trash2 className="size-3.5" />}
                      Talep İptal
                    </Button>
                  </div>
                )}

                {/* Admin onay butonları */}
                {isAdmin && req.status === 'pending' && (
                  <div className="flex gap-2 px-4 pb-4">
                    <Button
                      size="sm"
                      className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      onClick={() => { setRespondOpen(req); setRespondStatus('approved'); setRespondNote(''); setRespondOverrideUser(''); }}
                    >
                      <Check className="size-3.5" />
                      Onayla
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-8 border-rose-300 text-rose-700 hover:bg-rose-50 text-xs dark:border-rose-700 dark:text-rose-300"
                      onClick={() => { setRespondOpen(req); setRespondStatus('rejected'); setRespondNote(''); setRespondOverrideUser(''); }}
                    >
                      <X className="size-3.5" />
                      Reddet
                    </Button>
                  </div>
                )}

                {isAdmin && req.status === 'approved' && (
                  <div className="px-4 pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs border-slate-300"
                      disabled={revertingId === req.id}
                      onClick={() => handleRevert(req.id)}
                    >
                      {revertingId === req.id ? <LoadingSpinner className="size-3.5" /> : <Undo2 className="size-3.5" />}
                      Onayı geri al
                    </Button>
                  </div>
                )}
              </div>
            );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nöbet takası modal – teacher */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="size-5" />
              Nöbet Takası Talebi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
              <strong>Ne yapıyorsunuz?</strong> Nöbetinizi aynı gün nöbetçi başka bir öğretmene devretmek istiyorsunuz.
              Seçtiğiniz öğretmene bildirim gider; kabul ederse okul yöneticisi son onayı verir.
            </p>
            <div>
              <Label>Devredeceğiniz nöbetiniz</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">Size atanan nöbeti seçin (tarih ve alan)</p>
              <Select value={selectedSlotId} onValueChange={setSelectedSlotId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nöbet seçin — örn: 2 Şub Pzt, Bahçe" />
                </SelectTrigger>
                <SelectContent>
                  {mySlots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {formatDate(s.date)} — {s.area_name ?? 'Alan yok'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedSlotId && (
              <div>
                <Label>Devredeceğiniz öğretmen</Label>
                <p className="text-xs text-muted-foreground mt-0.5 mb-1">Aynı gün nöbetçi — seçtiğiniz kişiye bildirim gidecek</p>
                {sameDayLoadingSlotId === selectedSlotId ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <LoadingSpinner className="size-4" /> O gün nöbetçiler yükleniyor…
                  </div>
                ) : sameDayTeachers.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                    Bu gün başka nöbetçi bulunamadı. Takas için aynı gün nöbetçi olan bir öğretmen gereklidir.
                  </p>
                ) : (
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aynı gün nöbetçi öğretmen seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {sameDayTeachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.display_name || t.email}
                          {t.area_name ? ` — ${t.area_name} nöbetçi` : ' — nöbetçi'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
            <Button onClick={handleCreate} disabled={!selectedSlotId || !selectedUserId || creating || sameDayTeachers.length === 0}>
              {creating ? <LoadingSpinner className="size-4" /> : 'Gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gün değişimi modal – teacher */}
      <Dialog open={dayChangeOpen} onOpenChange={setDayChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-5 text-purple-500" />
              Gün Değişimi Talebi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground rounded-md bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 px-3 py-2">
              <strong>Ne yapıyorsunuz?</strong> Nöbet gününüzü değiştirmek istiyorsunuz. Takas yapacak öğretmeni siz seçmezsiniz;
              okul yöneticisi uygun bir öğretmenle değişim yapar.
            </p>
            <div>
              <Label>Değiştirilecek nöbet günü</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1">Hangi nöbetinizin başka bir güne alınmasını istiyorsunuz? (Bu ay ve sonraki 5 ay)</p>
              {mySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 rounded-lg border border-dashed border-muted-foreground/30">
                  Bu dönemde size atanmış nöbet bulunamadı. Nöbet planı yayınlandıktan sonra tekrar deneyin.
                </p>
              ) : (
                <Select value={dayChangeSlotId} onValueChange={setDayChangeSlotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nöbet seçin — tarih ve alan" />
                  </SelectTrigger>
                  <SelectContent>
                    {mySlots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatDate(s.date)} — {s.area_name ?? 'Alan yok'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDayChangeOpen(false)}>İptal</Button>
            <Button onClick={handleDayChangeCreate} disabled={!dayChangeSlotId || dayChangeCreating || mySlots.length === 0}>
              {dayChangeCreating ? <LoadingSpinner className="size-4" /> : 'Talep Gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ders görevi değişimi modal – teacher */}
      <Dialog open={coverageSwapOpen} onOpenChange={setCoverageSwapOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="size-5 text-orange-500" />
              Ders Görevi Değişim Talebi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 px-3 py-2">
              <strong>Ne yapıyorsunuz?</strong> Size atanan ders görevini (yerine girdiğiniz ders) başka bir öğretmene devretmek istiyorsunuz.
              Seçtiğiniz öğretmene bildirim gider; kabul ederse okul yöneticisi onaylar.
            </p>
            {myCoverages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed border-muted-foreground/30">
                Bu dönemde size atanmış ders görevi yok. Ders görevi, nöbet gününde gelmeyen öğretmenin yerine girmeniz gereken atamadır.
                Plan yayınlandıktan ve görevlendirme yapıldıktan sonra burada görünür.
              </p>
            ) : (
              <>
                <div>
                  <Label>Devredeceğiniz ders görevi</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">Size atanmış ders (hangi ders, hangi tarih). Bu ay ve sonraki 5 ay.</p>
                  <Select value={selectedCoverageId} onValueChange={(v) => { setSelectedCoverageId(v); setSelectedCoverageTeacherId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ders görevi seçin — X. ders, tarih" />
                    </SelectTrigger>
                    <SelectContent>
                      {myCoverages.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.lesson_num}. ders — {c.duty_slot?.date ? formatDate(c.duty_slot.date) : '—'}
                          {c.duty_slot?.user ? ` (${c.duty_slot.user.display_name || c.duty_slot.user.email} yerine)` : ''}
                          {c.duty_slot?.area_name ? ` · ${c.duty_slot.area_name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Görevi devredeceğiniz öğretmen</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">Seçtiğiniz öğretmene bildirim gidecek</p>
                  <Select value={selectedCoverageTeacherId} onValueChange={setSelectedCoverageTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Öğretmen seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.filter((t) => t.id !== me?.id).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.display_name || t.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoverageSwapOpen(false)}>İptal</Button>
            <Button
              onClick={handleCoverageSwapCreate}
              disabled={!selectedCoverageId || !selectedCoverageTeacherId || coverageSwapCreating || myCoverages.length === 0}
            >
              {coverageSwapCreating ? <LoadingSpinner className="size-4" /> : 'Talep Gönder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin onay/red modal */}
      <Dialog open={!!respondOpen} onOpenChange={(o) => { if (!o) { setRespondOpen(null); setRespondOverrideUser(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {respondStatus === 'approved' ? 'Talebi Onayla' : 'Talebi Reddet'}
            </DialogTitle>
          </DialogHeader>
          {respondOpen && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                <p><span className="text-muted-foreground">Talep tipi:</span> {REQUEST_TYPE_LABELS[(respondOpen.request_type ?? 'swap') as RequestTypeKey]?.label}</p>
                <p>
                  <span className="text-muted-foreground">Talep eden:</span>{' '}
                  {respondOpen.requestedByUser?.display_name || respondOpen.requestedByUser?.email}
                  {' '}→{' '}
                  {respondOpen.proposedUser?.display_name || respondOpen.proposedUser?.email || 'Atanmamış'}
                </p>
                <p><span className="text-muted-foreground">Nöbet:</span> {respondOpen.duty_slot?.date ? formatDate(respondOpen.duty_slot.date) : '—'}</p>
                {respondOpen.coverage && (
                  <p><span className="text-muted-foreground">Ders:</span> {respondOpen.coverage.lesson_num}. ders {respondOpen.coverage.class_section ?? ''}</p>
                )}
                {respondOpen.teacher2_status && (
                  <p>
                    <span className="text-muted-foreground">Öğretmen onayı:</span>{' '}
                    <span className={cn(
                      'font-medium',
                      respondOpen.teacher2_status === 'approved' ? 'text-emerald-600' :
                        respondOpen.teacher2_status === 'rejected' ? 'text-rose-600' : 'text-amber-600',
                    )}>
                      {TEACHER2_CONFIG[respondOpen.teacher2_status]?.label ?? respondOpen.teacher2_status}
                    </span>
                  </p>
                )}
              </div>

              {/* Gün değişimi veya coverage_swap için admin öğretmen atayabilir */}
              {respondStatus === 'approved' && (respondOpen.request_type === 'day_change' || (respondOpen.request_type === 'coverage_swap' && !respondOpen.proposed_user_id)) && (
                <div>
                  <Label>Görevlendirilecek öğretmen {respondOpen.request_type === 'day_change' ? '(zorunlu)' : ''}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-1">
                    {respondOpen.request_type === 'day_change'
                      ? 'Talep edilen nöbeti hangi öğretmene atayacaksınız?'
                      : 'Ders görevini hangi öğretmene vereceksiniz?'}
                  </p>
                  <Select value={respondOverrideUser} onValueChange={setRespondOverrideUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Öğretmen seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.filter((t) => t.id !== respondOpen.requested_by_user_id).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.display_name || t.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Not (opsiyonel)</Label>
                <textarea
                  value={respondNote}
                  onChange={(e) => setRespondNote(e.target.value)}
                  placeholder="Talep sahibine gösterilecek not..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRespondOpen(null); setRespondOverrideUser(''); }}>
              İptal
            </Button>
            <Button
              variant={respondStatus === 'rejected' ? 'destructive' : 'default'}
              onClick={handleRespond}
              disabled={
                responding ||
                (respondStatus === 'approved' && respondOpen?.request_type === 'day_change' && !respondOverrideUser)
              }
            >
              {responding ? <LoadingSpinner className="size-4" /> : respondStatus === 'approved' ? 'Onayla' : 'Reddet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
