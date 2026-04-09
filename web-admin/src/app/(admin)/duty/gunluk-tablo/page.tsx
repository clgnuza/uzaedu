'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Table2,
  ChevronLeft,
  ChevronRight,
  Printer,
  Share2,
  UserX,
  CalendarCheck,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  History,
  Bell,
  MapPin,
  Users,
  User,
  Flag,
  GraduationCap,
} from 'lucide-react';
import { buildColorMap, getTeacherColor } from '@/components/duty/teacher-color';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { getDutyLogActionLabel } from '@/lib/duty-log-labels';
import LessonCoverageDialog from '@/components/duty/LessonCoverageDialog';

type DutySlot = {
  id: string;
  date: string;
  slot_name: string | null;
  area_name: string | null;
  user_id: string;
  lesson_num?: number | null;
  lesson_count?: number;
  reassigned_from_user_id?: string | null;
  user?: { display_name: string | null; email: string; duty_exempt?: boolean };
  absent_marked_at: string | null;
  lesson_cells?: Record<number, { class_section: string; subject: string }>;
  is_mine?: boolean;
};

type DailyResponse = {
  date: string;
  max_lessons?: number;
  duty_education_mode?: 'single' | 'double';
  duty_shift?: 'morning' | 'afternoon' | null;
  slots: DutySlot[];
};

type RecentLog = {
  id: string;
  action: string;
  created_at: string;
  undone_at: string | null;
  duty_slot_id: string | null;
  old_user_id: string | null;
  new_user_id: string | null;
  performedByUser?: { display_name: string | null; email: string };
  oldUser?: { display_name: string | null; email: string } | null;
  newUser?: { display_name: string | null; email: string } | null;
};

type CoverageItem = {
  id: string;
  duty_slot_id: string;
  lesson_num: number;
  covered_by_user_id: string | null;
  covered_by_user?: { id: string; display_name: string | null; email: string } | null;
  duty_slot?: { user_id: string; area_name: string | null; user?: { display_name: string | null; email: string } };
};

const DEFAULT_MAX_LESSONS = 8;
const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'long' })} - ${DAY_NAMES[d.getDay()]} Günü Nöbetçiler`;
}

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function GunlukTabloPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [shift, setShift] = useState<'morning' | 'afternoon'>('morning');
  const [data, setData] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [latestPlanDate, setLatestPlanDate] = useState<string | null>(null);
  const [coverages, setCoverages] = useState<CoverageItem[]>([]);
  const [coverageSlotId, setCoverageSlotId] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [sendingNotify, setSendingNotify] = useState(false);
  const [removingCoverageId, setRemovingCoverageId] = useState<string | null>(null);

  // Aktif plan tarihini çek (Son Plan butonu için). Sayfa açıldığında her zaman bugün gösterilir.
  useEffect(() => {
    if (!token) return;
    apiFetch<{ id: string; period_start: string | null; status: string }[]>('/duty/plans', { token })
      .then((plans) => {
        const published = Array.isArray(plans)
          ? plans.filter((p) => p.status === 'published' && p.period_start)
              .sort((a, b) => (b.period_start! > a.period_start! ? 1 : -1))
          : [];
        if (published[0]?.period_start) {
          setLatestPlanDate(published[0].period_start.slice(0, 10));
        }
      })
      .catch(() => {/* ignore */});
  }, [token]);

  const fetchRecentLogs = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const logs = await apiFetch<RecentLog[]>('/duty/logs?limit=8', { token });
      setRecentLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setRecentLogs([]);
    }
  }, [token, isAdmin]);

  const handleUndo = async (logId: string) => {
    if (!token) return;
    setUndoingId(logId);
    try {
      await apiFetch(`/duty/undo/${logId}`, { token, method: 'POST' });
      toast.success('İşlem geri alındı.');
      await Promise.all([fetchDaily(), fetchRecentLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı.');
    } finally {
      setUndoingId(null);
    }
  };

  const fetchCoverages = useCallback(async (date: string) => {
    if (!token) return;
    try {
      const items = await apiFetch<CoverageItem[]>(`/duty/coverage-by-date?date=${date}`, { token });
      setCoverages(Array.isArray(items) ? items : []);
    } catch {
      setCoverages([]);
    }
  }, [token]);

  const fetchDaily = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ date: selectedDate });
      if (shift) qs.set('shift', shift);
      const [res] = await Promise.all([
        apiFetch<DailyResponse>(`/duty/daily?${qs.toString()}`, { token }),
        fetchCoverages(selectedDate),
        fetchRecentLogs(),
      ]);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate, shift, fetchCoverages, fetchRecentLogs]);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const maxLessons = Math.min(12, Math.max(6, data?.max_lessons ?? DEFAULT_MAX_LESSONS));
  const educationMode = data?.duty_education_mode === 'double' ? 'double' : 'single';

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(toYMD(d));
  };

  const handlePrint = useCallback(() => {
    const existing = document.getElementById('duty-gunluk-print-atpage');
    existing?.remove();
    const style = document.createElement('style');
    style.id = 'duty-gunluk-print-atpage';
    style.textContent = '@media print { @page { size: A4 landscape; margin: 10mm; } }';
    document.head.appendChild(style);
    const cleanup = () => {
      style.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 5000);
  }, []);

  const handleSendNotifications = async () => {
    if (!token || !isAdmin) return;
    setSendingNotify(true);
    try {
      const res = await apiFetch<{ sent: number }>(`/duty/notify-daily?date=${selectedDate}`, { token, method: 'POST' });
      toast.success(`${res.sent ?? 0} öğretmene bildirim gönderildi.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bildirim gönderilemedi.');
    } finally {
      setSendingNotify(false);
    }
  };

  const todayYMD = toYMD(new Date());
  const [markingAbsent, setMarkingAbsent] = useState<string | null>(null);
  const [markAbsentSlot, setMarkAbsentSlot] = useState<DutySlot | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; display_name: string | null; email: string; role?: string }[]>([]);
  const [reassignSlot, setReassignSlot] = useState<DutySlot | null>(null);
  const [reassignUserId, setReassignUserId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const fetchTeachers = useCallback(async () => {
    if (!token) return;
    try {
      const list = await apiFetch<{ id: string; display_name: string | null; email: string }[]>('/duty/teachers', { token });
      setTeachers(Array.isArray(list) ? list : []);
    } catch {
      setTeachers([]);
    }
  }, [token]);

  useEffect(() => {
    if ((markAbsentSlot || reassignSlot) && isAdmin) fetchTeachers();
  }, [markAbsentSlot?.id, reassignSlot?.id, isAdmin, fetchTeachers]);

  const handleMarkAbsentClick = (slot: DutySlot) => setMarkAbsentSlot(slot);
  const handleMarkAbsentConfirm = async (type: 'raporlu' | 'izinli' | 'gelmeyen') => {
    if (!token || !markAbsentSlot) return;
    setMarkingAbsent(markAbsentSlot.id);
    try {
      const res = await apiFetch<{ success: boolean; coverage_lessons?: number[] }>('/duty/mark-absent', {
        token,
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: markAbsentSlot.id, absent_type: type }),
      });
      const labels = { raporlu: 'Raporlu', izinli: 'İzinli', gelmeyen: 'Gelmeyen' };
      const count = res?.coverage_lessons?.length ?? 0;
      toast.success(
        count > 0
          ? `${labels[type]} olarak işaretlendi. ${count} ders boşa çıkacak — Ayarlamaya geçiliyor...`
          : `${labels[type]} olarak işaretlendi.`,
      );
      setMarkAbsentSlot(null);
      fetchDaily();
      setCoverageSlotId(markAbsentSlot.id);
      window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setMarkingAbsent(null);
    }
  };

  const handleRemoveCoverage = async (coverageId: string) => {
    if (!token) return;
    setRemovingCoverageId(coverageId);
    try {
      await apiFetch(`/duty/coverage/${coverageId}`, { token, method: 'DELETE' });
      toast.success('Atama geri alındı.');
      await fetchDaily();
      window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı.');
    } finally {
      setRemovingCoverageId(null);
    }
  };

  const handleReassign = async () => {
    if (!token || !reassignSlot || !reassignUserId) return;
    setReassigning(true);
    try {
      await apiFetch('/duty/reassign', {
        token,
        method: 'POST',
        body: JSON.stringify({ duty_slot_id: reassignSlot.id, new_user_id: reassignUserId }),
      });
      toast.success('Yerine görevlendirme yapıldı.');
      setReassignSlot(null);
      setReassignUserId('');
      fetchDaily();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setReassigning(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!data?.slots?.length) return;
    const d = new Date(selectedDate + 'T12:00:00');
    const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const header = `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'long' })} ${d.getFullYear()} ${dayNames[d.getDay()]} Nöbetçiler:\n`;
    const lines = data.slots.map((s) => {
      const name = s.user?.display_name || s.user?.email || '—';
      const area = s.area_name || '';
      return `• ${name}${area ? ` (${area})` : ''}`;
    });
    const text = header + lines.join('\n');
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const mySlots = data?.slots?.filter((s) => s.is_mine) ?? [];
  const d = new Date(selectedDate + 'T12:00:00');
  const dateLabelShort = d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });

  const teacherColorMap = useMemo(() => {
    const ids = [...new Set((data?.slots ?? []).map((s) => s.user_id))];
    return buildColorMap(ids);
  }, [data?.slots]);

  return (
    <div className="space-y-3 print:space-y-3 sm:space-y-5">
      {/* Öğretmen: modern header + özet */}
      {!isAdmin && (
        <div className="print:hidden space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/duty" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-4" />
              Nöbet
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50/90 to-sky-50/70 px-2 py-1.5 shadow-sm dark:border-violet-800/40 dark:from-violet-950/40 dark:to-slate-900/60 sm:flex-initial sm:justify-start">
                <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0" onClick={() => shiftDay(-1)} aria-label="Önceki gün">
                  <ChevronLeft className="size-4" />
                </Button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-semibold text-foreground focus:outline-none focus:ring-0 sm:w-36 sm:flex-initial"
                />
                <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0" onClick={() => shiftDay(1)} aria-label="Sonraki gün">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              {selectedDate !== todayYMD && (
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayYMD)} className="rounded-xl border-teal-300/60 bg-teal-50/80 text-teal-800 hover:bg-teal-100/80 dark:border-teal-700/50 dark:bg-teal-950/40 dark:text-teal-200">
                  Bugün
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleWhatsAppShare} disabled={!data?.slots?.length} className="rounded-xl border-emerald-200/70 bg-emerald-50/50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-200" title="WhatsApp">
                <Share2 className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-xl border-slate-200/80 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50" title="Yazdır">
                <Printer className="size-4" />
              </Button>
            </div>
          </div>
          {!loading && data?.slots?.length && (
            mySlots.length > 0 ? (
              <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/95 via-teal-50/50 to-cyan-50/40 p-4 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-200/40 dark:border-emerald-800/50 dark:from-emerald-950/50 dark:via-teal-950/30 dark:to-slate-900/40 dark:ring-emerald-800/30">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                    <CalendarCheck className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      {dateLabelShort} — {mySlots.length} nöbetiniz var
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mySlots.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/80 bg-white/90 px-3 py-1.5 text-sm font-medium text-emerald-900 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-100"
                        >
                          <MapPin className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          {s.area_name || s.slot_name || 'Nöbet'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50/90 to-violet-50/40 p-4 dark:border-slate-700 dark:from-slate-900/60 dark:to-violet-950/30">
                <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-300">
                    <Users className="size-4" />
                  </span>
                  <span>{dateLabelShort} — Bu gün nöbetiniz yok. Liste aşağıda.</span>
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* Admin: üst toolbar */}
      {isAdmin && (
        <div className="space-y-2 print:hidden">
          <DutyPageHeader
            icon={Table2}
            title="Günlük nöbet tablosu"
            description="Tarih ve vardiya seçin; yazdırma, WhatsApp ve bildirim."
            color="sky"
            actions={
              <Link
                href="/duty"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:text-sm"
              >
                <ArrowLeft className="size-3.5 sm:size-4" />
                Planlama
              </Link>
            }
          />
          <div className="flex flex-col gap-2 rounded-xl border border-cyan-500/20 bg-linear-to-br from-cyan-500/8 via-background to-background p-2 shadow-sm ring-1 ring-cyan-500/10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 sm:p-2.5">
            <Button variant="outline" size="sm" className="h-8 shrink-0 sm:h-9" onClick={() => shiftDay(-1)} aria-label="Önceki gün">
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 sm:h-9 sm:px-3 sm:text-sm"
            />
            <Button variant="outline" size="sm" className="h-8 shrink-0 sm:h-9" onClick={() => shiftDay(1)} aria-label="Sonraki gün">
              <ChevronRight className="size-4" />
            </Button>
            {selectedDate !== todayYMD && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-primary/40 text-xs text-primary hover:bg-primary/10 sm:h-9 sm:text-sm"
                onClick={() => setSelectedDate(todayYMD)}
              >
                <CalendarCheck className="size-3.5 sm:size-4" />
                Bugün
              </Button>
            )}
            {latestPlanDate && selectedDate !== latestPlanDate && (
              <Button variant="outline" size="sm" className="h-8 border-emerald-500/40 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 sm:h-9 sm:text-sm" onClick={() => setSelectedDate(latestPlanDate)}>
                <CalendarCheck className="size-3.5 sm:size-4" />
                Son plan
              </Button>
            )}
            {educationMode === 'double' && (
              <>
                <Button variant={shift === 'morning' ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:h-9 sm:text-sm" onClick={() => setShift('morning')}>
                  Sabah
                </Button>
                <Button variant={shift === 'afternoon' ? 'default' : 'outline'} size="sm" className="h-8 text-xs sm:h-9 sm:text-sm" onClick={() => setShift('afternoon')}>
                  Öğle
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs sm:h-9 sm:text-sm" onClick={handleWhatsAppShare} disabled={!data?.slots?.length}>
              <Share2 className="size-3.5 sm:size-4" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs sm:h-9 sm:text-sm" onClick={handlePrint}>
              <Printer className="size-3.5 sm:size-4" />
              Yazdır
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-blue-500/40 text-xs text-blue-700 hover:bg-blue-50 dark:text-blue-400 sm:h-9 sm:text-sm"
              onClick={handleSendNotifications}
              disabled={sendingNotify || !data?.slots?.length}
            >
              {sendingNotify ? <RotateCcw className="size-3.5 animate-spin sm:size-4" /> : <Bell className="size-3.5 sm:size-4" />}
              Bildirim
            </Button>
          </div>
        </div>
      )}

      {/* Tablo üstte – hemen gösterilir */}
      {loading ? (
        <div className="flex justify-center py-12 print:hidden">
          <LoadingSpinner />
        </div>
      ) : !data?.slots?.length ? (
        <Card className="print:hidden">
          <EmptyState
            icon={<Table2 className="size-10 text-muted-foreground" />}
            title="Nöbet kaydı yok"
            description="Bu tarihte nöbetçi ataması bulunamadı."
          />
        </Card>
      ) : (
        <Card
          className={cn(
            'duty-gunluk-print-document overflow-hidden print:border print:border-black print:bg-white print:shadow-none',
            isAdmin ? 'rounded-xl' : 'rounded-2xl border border-violet-200/40 bg-gradient-to-b from-white via-violet-50/20 to-sky-50/30 shadow-lg shadow-violet-500/10 ring-1 ring-violet-100/80 dark:border-violet-900/40 dark:from-slate-950 dark:via-violet-950/15 dark:to-slate-900/80 dark:ring-violet-900/30',
          )}
        >
          <CardHeader
            className={cn(
              'pb-2 print:hidden',
              !isAdmin && 'border-b border-violet-200/40 bg-gradient-to-r from-violet-100/60 via-violet-50/40 to-sky-50/50 py-4 dark:border-violet-800/40 dark:from-violet-950/50 dark:via-slate-900/60 dark:to-sky-950/25',
            )}
          >
            <div className={cn('flex items-start gap-3', !isAdmin && 'sm:items-center')}>
              {!isAdmin && (
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/90 text-violet-600 shadow-sm ring-1 ring-violet-200/60 print:hidden dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-700/50">
                  <Table2 className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <CardTitle
                  className={cn(
                    'text-base',
                    !isAdmin && 'text-base font-semibold text-violet-950 dark:text-violet-100',
                  )}
                >
                  {formatDateLabel(selectedDate)}
                  {educationMode === 'double' && (
                    <span className="ml-2 text-sm font-medium text-violet-600/90 dark:text-violet-300/90">
                      ({shift === 'morning' ? 'Sabah' : 'Öğle'} vardiyası)
                    </span>
                  )}
                </CardTitle>
                {isAdmin && (
                  <CardDescription>
                    Nöbetçi | Konum | 1.–N. Ders. Boş = nöbet; dolu = sınıf-ders.
                  </CardDescription>
                )}
                {!isAdmin && (
                  <p className="mt-1 text-xs text-violet-700/80 print:hidden dark:text-violet-300/70">
                    Ders sütunlarını görmek için tabloyu yatay kaydırın.
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className={cn('table-x-scroll', !isAdmin && '-mx-1 px-1 sm:mx-0 sm:px-0')}>
              <table className="w-full border-collapse duty-print-table">
                <thead>
                  <tr className={cn(
                    'border-b',
                    isAdmin ? 'bg-muted/60' : 'border-violet-200/50 bg-gradient-to-r from-slate-100/95 to-violet-100/60 dark:border-violet-800/50 dark:from-slate-800/95 dark:to-violet-950/60',
                  )}>
                    <th className={cn(
                      'border-b border-r px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:px-4 sm:text-sm',
                      !isAdmin && 'sticky left-0 z-20 min-w-[7.5rem] max-w-[38vw] border-violet-200/50 bg-slate-100/98 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.12)] dark:border-violet-800/50 dark:bg-slate-800/98 sm:min-w-[10rem] sm:max-w-none',
                    )}>
                      <span className="inline-flex items-center gap-1.5 text-violet-800 dark:text-violet-200">
                        <User className="size-3.5 shrink-0 opacity-80" />
                        Nöbetçi
                      </span>
                    </th>
                    <th className={cn(
                      'border-b border-r px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:px-4 sm:text-sm',
                      !isAdmin && 'min-w-[5.5rem] border-violet-200/50 bg-slate-100/95 dark:border-violet-800/50 dark:bg-slate-800/95 sm:min-w-[7rem]',
                    )}>
                      <span className="inline-flex items-center gap-1.5 text-violet-800 dark:text-violet-200">
                        <MapPin className="size-3.5 shrink-0 opacity-80" />
                        Konum
                      </span>
                    </th>
                    {Array.from({ length: maxLessons }, (_, i) => (
                      <th
                        key={i}
                        className={cn(
                          'border-b border-r px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide sm:px-2.5 sm:text-xs',
                          !isAdmin && 'min-w-[3rem] border-violet-200/50 bg-violet-50/80 text-violet-900 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-200',
                        )}
                      >
                        <span className="inline-flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1">
                          <GraduationCap className="mx-auto size-3 text-violet-400 opacity-90 sm:mx-0" aria-hidden />
                          <span className="tabular-nums">{i + 1}. Ders</span>
                        </span>
                      </th>
                    ))}
                    {isAdmin && (
                      <th className="border-b px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide print:hidden">
                        İşlem
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.slots.map((slot) => {
                    const tc = getTeacherColor(slot.user_id, teacherColorMap);
                    return (
                    <tr key={slot.id} className={cn(
                      'border-b border-border/25 transition-colors last:border-b-0',
                      isAdmin && 'hover:bg-muted/30',
                      !isAdmin && slot.is_mine && 'bg-gradient-to-r from-emerald-50/95 via-teal-50/35 to-white/80 dark:from-emerald-950/45 dark:via-teal-950/25 dark:to-slate-950/40',
                      !isAdmin && !slot.is_mine && cn(tc.bg, tc.darkBg),
                    )}>
                      <td className={cn(
                        'border-r px-3 py-2.5 text-sm sm:px-4',
                        !isAdmin && 'sticky left-0 z-10 border-violet-200/40 shadow-[4px_0_12px_-4px_rgba(15,23,42,0.1)] dark:border-violet-800/40',
                        !isAdmin && slot.is_mine && 'bg-emerald-50/98 dark:bg-emerald-950/90',
                        !isAdmin && !slot.is_mine && cn(tc.bg, tc.darkBg),
                      )}>
                        <div className={cn('relative flex flex-wrap items-center gap-1.5', !isAdmin && 'pl-0.5')}>
                          {!isAdmin && (
                            <span className={cn('absolute -left-0.5 top-1/2 block h-7 w-1 -translate-y-1/2 rounded-full sm:h-8', slot.is_mine ? 'bg-emerald-500' : tc.dot)} aria-hidden />
                          )}
                          {slot.is_mine && !isAdmin && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-200">
                              Sizin
                            </span>
                          )}
                          <span className={slot.absent_marked_at ? 'line-through text-muted-foreground' : 'font-medium text-foreground'}>
                            {slot.user?.display_name || slot.user?.email || '—'}
                          </span>
                          {slot.user?.duty_exempt && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100/90 px-1.5 py-0.5 text-[10px] font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-200">
                              Muaf
                            </span>
                          )}
                          {slot.reassigned_from_user_id && (
                            <span className="inline-flex rounded-md bg-sky-100/90 px-1.5 py-0.5 text-[10px] text-sky-800 dark:bg-sky-900/45 dark:text-sky-200">
                              Değişti
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-r px-3 py-2.5 text-xs text-muted-foreground sm:text-sm">
                        <div className="flex flex-wrap items-center gap-1">
                          {slot.lesson_num && (
                            <span className="inline-flex items-center rounded-lg bg-indigo-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200">
                              {slot.lesson_num}. ders
                            </span>
                          )}
                          <span className="text-foreground/90">{slot.area_name || (slot.lesson_num ? '' : '—')}</span>
                        </div>
                      </td>
                      {Array.from({ length: maxLessons }, (_, i) => {
                        const lessonNum = i + 1;
                        const cell = slot.lesson_cells?.[lessonNum];
                        const isDutyLesson = slot.lesson_num === lessonNum;
                        const text = cell ? `${cell.class_section} - ${cell.subject}` : '';
                        const cov = slot.absent_marked_at
                          ? coverages.find((c) => c.duty_slot_id === slot.id && c.lesson_num === lessonNum)
                          : null;
                        const assignedName = cov?.covered_by_user ? (cov.covered_by_user.display_name || cov.covered_by_user.email) : null;
                        return (
                          <td
                            key={i}
                            className={cn(
                              'border-r px-1.5 py-1.5 text-center text-[10px] sm:px-2 sm:py-2 sm:text-xs',
                              isDutyLesson && !cell && 'bg-gradient-to-br from-indigo-100/90 to-violet-100/60 font-semibold text-indigo-900 dark:from-indigo-950/50 dark:to-violet-950/40 dark:text-indigo-200',
                              assignedName && 'bg-gradient-to-br from-emerald-50/95 to-teal-50/60 dark:from-emerald-950/35 dark:to-teal-950/25',
                            )}
                            title={assignedName ? `Yerine: ${assignedName}` : isDutyLesson ? 'Bu saatte nöbet görevi' : (text || 'Nöbet')}
                          >
                            {isDutyLesson && !cell ? (
                              <span className="inline-flex items-center justify-center gap-0.5 rounded-md bg-white/80 px-1 py-0.5 text-indigo-800 shadow-sm ring-1 ring-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-700/50">
                                <Flag className="size-3 shrink-0 text-indigo-500" aria-hidden />
                                <span className="hidden sm:inline print:inline">Nöbet</span>
                              </span>
                            ) : assignedName ? (
                              <span className="block">
                                {text && <span className="mb-0.5 block truncate text-[9px] text-muted-foreground sm:text-[10px]">{text}</span>}
                                <span className="flex items-center justify-center gap-0.5">
                                  <span className="font-medium text-emerald-800 dark:text-emerald-200">→ {assignedName}</span>
                                  {isAdmin && cov && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                      onClick={(e) => { e.stopPropagation(); handleRemoveCoverage(cov.id); }}
                                      disabled={removingCoverageId === cov.id}
                                      title="Atamayı geri al"
                                    >
                                      {removingCoverageId === cov.id ? <LoadingSpinner className="size-2.5" /> : <RotateCcw className="size-2.5" />}
                                    </Button>
                                  )}
                                </span>
                              </span>
                            ) : (
                              text || <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                        );
                      })}
                      {isAdmin && (
                        <td className="px-4 py-2.5 print:hidden">
                          {!slot.absent_marked_at ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => handleMarkAbsentClick(slot)}
                              disabled={!!markingAbsent}
                              title="Gelmeyen işaretle"
                            >
                              <UserX className="size-4" />
                            </Button>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {(() => {
                                const slotCovs = coverages.filter((c) => c.duty_slot_id === slot.id);
                                const pending = slotCovs.filter((c) => !c.covered_by_user_id);
                                const covered = slotCovs.filter((c) => c.covered_by_user_id);
                                return (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 flex items-center gap-1"
                                      onClick={() => setCoverageSlotId(slot.id)}
                                      title="Ders bazlı atama"
                                    >
                                      <BookOpen className="size-3" />
                                      Ders Ata
                                    </Button>
                                    {slotCovs.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {pending.length > 0 && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                                            <AlertCircle className="size-2.5" />
                                            {pending.length} bekliyor
                                          </span>
                                        )}
                                        {covered.length > 0 && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                                            <CheckCircle2 className="size-2.5" />
                                            {covered.length} atandı
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <p className="mt-3 px-4 pb-2 text-xs text-muted-foreground print:hidden">
                {maxLessons} ders saati. Boş (—) = nöbet; dolu = ders. Ders programı: Nöbet → Ders Programı Yükle.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Devamsız öğretmen banner'ı – sadece bugünün atamaları için */}
      {isAdmin && data?.slots && selectedDate === todayYMD && (() => {
        const absent = data.slots.filter((s) => s.absent_marked_at);
        if (absent.length === 0) return null;
        const pendingCount = absent.reduce((sum, s) => {
          const covs = coverages.filter((c) => c.duty_slot_id === s.id && !c.covered_by_user_id);
          return sum + covs.length;
        }, 0);
        const allDone = pendingCount === 0;
        return (
          <div
            className={cn(
              'sticky top-0 z-20 rounded-xl border-2 p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 print:hidden',
              allDone
                ? 'border-emerald-500 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-900/40 ring-2 ring-emerald-400/50'
                : 'border-amber-500 bg-amber-100 dark:border-amber-500 dark:bg-amber-900/50 shadow-amber-500/20 ring-2 ring-amber-400/50',
            )}
          >
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex size-14 items-center justify-center rounded-xl shrink-0 shadow-md',
                  allDone ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white',
                )}
              >
                {allDone ? <CheckCircle2 className="size-7" /> : <span className="text-3xl">⚠</span>}
              </div>
              <div>
                <h3 className={cn('font-bold text-lg', allDone ? 'text-emerald-900 dark:text-emerald-100' : 'text-amber-900 dark:text-amber-100')}>
                  {allDone ? 'İşlem tamamlandı' : `${absent.length} devamsız öğretmen · Ayarlama gerekli`}
                </h3>
                <p className={cn('text-sm mt-0.5 font-medium', allDone ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200')}>
                  {allDone ? 'Tüm ders atamaları yapıldı.' : 'Boşa çıkacak dersler için görevlendirme yapın.'}
                </p>
              </div>
            </div>
            {!allDone && (
              <Button
                onClick={() => setCoverageSlotId(absent[0]!.id)}
                size="lg"
                className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg text-base px-6"
              >
                <CalendarCheck className="size-5" />
                Ayarlamaya Git
              </Button>
            )}
          </div>
        );
      })()}

      {/* Son İşlemler mini paneli – sadece admin */}
      {isAdmin && recentLogs.length > 0 && (
        <Card className="rounded-xl border-dashed border-muted-foreground/30 print:hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Son İşlemler</h3>
              <span className="text-xs text-muted-foreground">(son 24 saat içindekiler geri alınabilir)</span>
            </div>
            <div className="space-y-1.5">
              {recentLogs.map((log) => {
                const ageMs = Date.now() - new Date(log.created_at).getTime();
                const canUndo = !log.undone_at && ageMs < 24 * 60 * 60 * 1000 &&
                  ['reassign', 'absent_marked', 'coverage_assigned', 'duty_exempt_set', 'duty_exempt_cleared'].includes(log.action);
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs',
                      log.undone_at ? 'bg-muted/30 opacity-50' : 'bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded font-medium',
                        log.undone_at ? 'bg-muted text-muted-foreground line-through' : 'bg-background',
                      )}>
                        {getDutyLogActionLabel(log.action)}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {log.performedByUser?.display_name || log.performedByUser?.email || ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">
                        {new Date(log.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {canUndo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => handleUndo(log.id)}
                          disabled={undoingId === log.id}
                        >
                          {undoingId === log.id ? <LoadingSpinner className="size-3" /> : (
                            <><RotateCcw className="size-3 mr-1" />Geri Al</>
                          )}
                        </Button>
                      )}
                      {log.undone_at && (
                        <span className="text-muted-foreground italic text-xs">Geri alındı</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog'lar */}
      <Dialog open={!!markAbsentSlot} onOpenChange={(o) => !o && setMarkAbsentSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserX className="size-5" />
              Devamsızlık Tipi
            </DialogTitle>
          </DialogHeader>
          {markAbsentSlot && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{markAbsentSlot.user?.display_name || markAbsentSlot.user?.email}</strong>
                {' '}için devamsızlık tipini seçin:
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => handleMarkAbsentConfirm('raporlu')} disabled={!!markingAbsent}>
                  Raporlu
                </Button>
                <Button variant="outline" onClick={() => handleMarkAbsentConfirm('izinli')} disabled={!!markingAbsent}>
                  İzinli
                </Button>
                <Button variant="outline" onClick={() => handleMarkAbsentConfirm('gelmeyen')} disabled={!!markingAbsent}>
                  Gelmeyen
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMarkAbsentSlot(null)}>
                  İptal
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {coverageSlotId && (
        <LessonCoverageDialog
          dutySlotId={coverageSlotId}
          onClose={() => {
            setCoverageSlotId(null);
            fetchDaily();
            window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
          }}
          onDone={() => {
            setCoverageSlotId(null);
            fetchDaily();
            window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
          }}
        />
      )}

      <Dialog open={!!reassignSlot} onOpenChange={(o) => !o && setReassignSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Yerine Görevlendir</DialogTitle>
          </DialogHeader>
          {reassignSlot && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{reassignSlot.user?.display_name || reassignSlot.user?.email}</strong>
                {' '}yerine görevlendirilecek öğretmeni seçin.
              </p>
              <Select value={reassignUserId} onValueChange={setReassignUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Öğretmen seçin" />
                </SelectTrigger>
                <SelectContent>
                  {teachers
                    .filter((t) => t.id !== reassignSlot.user_id)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.display_name || t.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <DialogFooter>
                <Button variant="outline" onClick={() => setReassignSlot(null)}>
                  İptal
                </Button>
                <Button onClick={handleReassign} disabled={!reassignUserId || reassigning}>
                  {reassigning ? 'Yapılıyor…' : 'Görevlendir'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
