'use client';

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
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

  const handlePrint = () => {
    window.print();
  };

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

  return (
    <div className="space-y-6">
      {/* Öğretmen: modern header + özet */}
      {!isAdmin && (
        <div className="print:hidden space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Link href="/duty" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-4" />
              Nöbet
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card/80 px-3 py-2 shadow-sm">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => shiftDay(-1)} aria-label="Önceki gün">
                  <ChevronLeft className="size-4" />
                </Button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-36 border-0 bg-transparent text-sm font-medium focus:outline-none focus:ring-0"
                />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => shiftDay(1)} aria-label="Sonraki gün">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              {selectedDate !== todayYMD && (
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayYMD)} className="text-primary border-primary/40">
                  Bugün
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleWhatsAppShare} disabled={!data?.slots?.length}>
                <Share2 className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="size-4" />
              </Button>
            </div>
          </div>
          {!loading && data?.slots?.length && (
            mySlots.length > 0 ? (
              <div className="rounded-xl border-2 border-emerald-400/60 bg-emerald-50/80 dark:bg-emerald-950/30 dark:border-emerald-500/50 p-4 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                    <CalendarCheck className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      {dateLabelShort} — {mySlots.length} nöbetiniz var
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {mySlots.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-emerald-950/50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-200 border border-emerald-200/80"
                        >
                          <MapPin className="size-3.5 shrink-0" />
                          {s.area_name || s.slot_name || 'Nöbet'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Users className="size-4" />
                  {dateLabelShort} — Bu gün nöbetiniz yok. Nöbetçi listesi aşağıda.
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* Admin: üst toolbar */}
      {isAdmin && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Link href="/duty" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="size-4" />
              Planlama
            </Link>
            <h1 className="text-xl font-semibold text-foreground">Günlük Nöbet Tablosu</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftDay(-1)} aria-label="Önceki gün">
              <ChevronLeft className="size-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button variant="outline" size="sm" onClick={() => shiftDay(1)} aria-label="Sonraki gün">
              <ChevronRight className="size-4" />
            </Button>
            {selectedDate !== todayYMD && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(todayYMD)} className="border-primary/40 text-primary hover:bg-primary/10">
                <CalendarCheck className="size-4" />
                Bugün
              </Button>
            )}
            {latestPlanDate && selectedDate !== latestPlanDate && (
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(latestPlanDate)} className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400">
                <CalendarCheck className="size-4" />
                Son Plan
              </Button>
            )}
            {educationMode === 'double' && (
              <>
                <Button variant={shift === 'morning' ? 'default' : 'outline'} size="sm" onClick={() => setShift('morning')}>Sabah</Button>
                <Button variant={shift === 'afternoon' ? 'default' : 'outline'} size="sm" onClick={() => setShift('afternoon')}>Öğle</Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleWhatsAppShare} disabled={!data?.slots?.length}>
              <Share2 className="size-4" />
              WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="size-4" />
              Yazdır
            </Button>
            <Button variant="outline" size="sm" onClick={handleSendNotifications} disabled={sendingNotify || !data?.slots?.length} className="border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-400">
              {sendingNotify ? <RotateCcw className="size-4 animate-spin" /> : <Bell className="size-4" />}
              Bildirim
            </Button>
          </div>
        </div>
      )}

      {/* Tablo üstte – hemen gösterilir */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : !data?.slots?.length ? (
        <Card>
          <EmptyState
            icon={<Table2 className="size-10 text-muted-foreground" />}
            title="Nöbet kaydı yok"
            description="Bu tarihte nöbetçi ataması bulunamadı."
          />
        </Card>
      ) : (
        <Card className={cn(
          'overflow-hidden',
          isAdmin ? 'rounded-xl' : 'rounded-xl border-border/80 shadow-md',
        )}>
          <CardHeader className={cn('pb-2', !isAdmin && 'py-4')}>
            <CardTitle className={cn(
              'text-base',
              !isAdmin && 'text-sm font-medium text-muted-foreground',
            )}>
              {formatDateLabel(selectedDate)}
              {educationMode === 'double' && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({shift === 'morning' ? 'Sabah' : 'Öğle'} vardiyası)</span>
              )}
            </CardTitle>
            {isAdmin && (
              <CardDescription>
                Nöbetçi | Konum | 1.–N. Ders. Boş = nöbet; dolu = sınıf-ders.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse duty-print-table">
                <thead>
                  <tr className="border-b bg-muted/60">
                    <th className="border-b border-r px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                      Nöbetçi
                    </th>
                    <th className="border-b border-r px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide">
                      Konum
                    </th>
                    {Array.from({ length: maxLessons }, (_, i) => (
                      <th
                        key={i}
                        className="border-b border-r px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide"
                      >
                        {i + 1}. Ders
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
                  {data.slots.map((slot) => (
                    <tr key={slot.id} className={cn(
                      'border-b last:border-b-0 hover:bg-muted/30 transition-colors',
                      slot.is_mine && !isAdmin && 'bg-emerald-50/60 dark:bg-emerald-950/20 border-l-4 border-l-emerald-500',
                    )}>
                      <td className="border-r px-4 py-2.5 text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {slot.is_mine && !isAdmin && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              Sizin
                            </span>
                          )}
                          <span className={slot.absent_marked_at ? 'line-through text-muted-foreground' : ''}>
                            {slot.user?.display_name || slot.user?.email || '—'}
                          </span>
                          {slot.user?.duty_exempt && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                              ✓ Muaf
                            </span>
                          )}
                          {slot.reassigned_from_user_id && (
                            <span className="inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Değiştirildi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-r px-4 py-2.5 text-sm text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-1">
                          {slot.lesson_num && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                              {slot.lesson_num}. ders nöbeti
                            </span>
                          )}
                          <span>{slot.area_name || (slot.lesson_num ? '' : '—')}</span>
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
                              'border-r px-2 py-1.5 text-center text-xs',
                              isDutyLesson && !cell && 'bg-indigo-50 dark:bg-indigo-950/30 font-semibold text-indigo-700 dark:text-indigo-300',
                              assignedName && 'bg-emerald-50/70 dark:bg-emerald-950/20',
                            )}
                            title={assignedName ? `Yerine: ${assignedName}` : isDutyLesson ? 'Bu saatte nöbet görevi' : (text || 'Nöbet')}
                          >
                            {isDutyLesson && !cell ? (
                              '⚑ Nöbet'
                            ) : assignedName ? (
                              <span className="block">
                                {text && <span className="block text-[10px] text-muted-foreground truncate">{text}</span>}
                                <span className="flex items-center justify-center gap-0.5">
                                  <span className="font-medium text-emerald-700 dark:text-emerald-300">→ {assignedName}</span>
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
                              text || '—'
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
                  ))}
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
          <>
          <div
            className={cn(
              'sticky top-0 z-40 rounded-xl border-2 p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 print:hidden',
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
      <Card className="rounded-xl print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftDay(-1)} aria-label="Önceki gün">
            <ChevronLeft className="size-4" />
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button variant="outline" size="sm" onClick={() => shiftDay(1)} aria-label="Sonraki gün">
            <ChevronRight className="size-4" />
          </Button>
          {selectedDate !== todayYMD && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(todayYMD)}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <CalendarCheck className="size-4" />
              Bugün
            </Button>
          )}
          {latestPlanDate && selectedDate !== latestPlanDate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(latestPlanDate)}
              className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400"
            >
              <CalendarCheck className="size-4" />
              Son Plan
            </Button>
          )}
        </div>
        {educationMode === 'double' && (
          <div className="flex items-center gap-2">
            <Button
              variant={shift === 'morning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShift('morning')}
            >
              Sabah
            </Button>
            <Button
              variant={shift === 'afternoon' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShift('afternoon')}
            >
              Öğle
            </Button>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={handleWhatsAppShare} disabled={!data?.slots?.length}>
          <Share2 className="size-4" />
          WhatsApp&apos;ta Paylaş
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="size-4" />
          Yazdır
        </Button>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendNotifications}
            disabled={sendingNotify || !data?.slots?.length}
            className="border-blue-500/40 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20"
          >
            {sendingNotify ? <RotateCcw className="size-4 animate-spin" /> : <Bell className="size-4" />}
            Bildirimleri Gönder
          </Button>
        )}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-xl border-emerald-600/30 bg-emerald-50/50 dark:bg-emerald-950/20 print:border print:bg-white print:dark:bg-white">
        <CardContent className="p-4">
          <h2 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 print:text-black">
            {formatDateLabel(selectedDate)}
            {educationMode === 'double' && (
              <span className="ml-2 text-sm font-medium text-emerald-700/80 dark:text-emerald-200/80 print:text-black">
                ({shift === 'morning' ? 'Sabah' : 'Öğle'} vardiyası)
              </span>
            )}
          </h2>
        </CardContent>
      </Card>

          </>
        );
      })()}

      {/* Son İşlemler mini paneli – sadece admin */}
      {isAdmin && recentLogs.length > 0 && (
        <Card className="rounded-xl border-dashed border-muted-foreground/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Son İşlemler</h3>
              <span className="text-xs text-muted-foreground">(son 24 saat içindekiler geri alınabilir)</span>
            </div>
            <div className="space-y-1.5">
              {recentLogs.map((log) => {
                const ACTION_LABELS: Record<string, string> = {
                  reassign: 'Yerine görevlendirme',
                  absent_marked: 'Gelmeyen işaretlendi',
                  coverage_assigned: 'Ders ataması',
                  duty_exempt_set: 'Muafiyet eklendi',
                  duty_exempt_cleared: 'Muafiyet kaldırıldı',
                  publish: 'Plan yayınlandı',
                };
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
                        {ACTION_LABELS[log.action] ?? log.action}
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
