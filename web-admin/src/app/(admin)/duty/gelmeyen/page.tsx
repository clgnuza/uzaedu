'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2, UserMinus, FileDown, Copy, Download, Plus, RefreshCw, FileText, AlertTriangle, CalendarOff, ClipboardX, User2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { DutyPageHeader } from '@/components/duty/duty-page-header';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

type UserItem = { id: string; display_name: string | null; email: string };

type ClassScheduleDate = {
  date: string;
  day_of_week: number;
  lessons: { lesson_num: number; class_section: string; subject: string }[];
};
type ClassSchedule = {
  absence_id: string;
  teacher_name: string | null;
  date_from: string;
  date_to: string;
  dates: ClassScheduleDate[];
};

type DutyAbsence = {
  id: string;
  user_id: string;
  date_from: string;
  date_to: string;
  absence_type: 'raporlu' | 'izinli' | 'gelmeyen';
  note: string | null;
  user?: { display_name: string | null; email: string };
};

type AbsentSlotItem = {
  id: string;
  date: string;
  absent_type: 'raporlu' | 'izinli' | 'gelmeyen';
  user_id: string;
  user: { display_name: string | null; email: string } | null;
};

const ABSENCE_LABELS: Record<string, string> = {
  raporlu: 'Raporlu',
  izinli: 'İzinli',
  gelmeyen: 'Gelmeyen',
};

export default function DutyGelmeyenPage() {
  const { token, me } = useAuth();
  const isAdmin = me?.role === 'school_admin';
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [absences, setAbsences] = useState<DutyAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [ekDersMonth, setEkDersMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [ekDersData, setEkDersData] = useState<{ user_id: string; date: string; absent_type: string }[] | null>(null);
  const [expandedAbsenceId, setExpandedAbsenceId] = useState<string | null>(null);
  const [classSchedules, setClassSchedules] = useState<Record<string, ClassSchedule>>({});
  const [scheduleLoading, setScheduleLoading] = useState<string | null>(null);
  const [absentSlots, setAbsentSlots] = useState<AbsentSlotItem[]>([]);
  const [absentSlotsLoading, setAbsentSlotsLoading] = useState(false);
  const [clearingSlotId, setClearingSlotId] = useState<string | null>(null);

  const fetchClassSchedule = async (absenceId: string) => {
    if (classSchedules[absenceId]) {
      setExpandedAbsenceId(expandedAbsenceId === absenceId ? null : absenceId);
      return;
    }
    if (!token) return;
    setScheduleLoading(absenceId);
    try {
      const data = await apiFetch<ClassSchedule>(`/duty/absences/${absenceId}/class-schedule`, { token });
      setClassSchedules((prev) => ({ ...prev, [absenceId]: data }));
      setExpandedAbsenceId(absenceId);
    } catch {
      toast.error('Ders programı alınamadı.');
    } finally {
      setScheduleLoading(null);
    }
  };

  const [form, setForm] = useState({
    user_id: '',
    date_from: '',
    date_to: '',
    absence_type: 'raporlu' as 'raporlu' | 'izinli' | 'gelmeyen',
    note: '',
  });

  const fetchTeachers = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const list = await apiFetch<UserItem[]>('/duty/teachers', { token });
      setTeachers(Array.isArray(list) ? list : []);
    } catch {
      setTeachers([]);
    }
  }, [token, isAdmin]);

  const fetchAbsences = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const now = new Date();
      const from = `${now.getFullYear() - 2}-01-01`;
      const to = `${now.getFullYear()}-12-31`;
      const list = await apiFetch<DutyAbsence[]>(`/duty/absences?from=${from}&to=${to}`, { token });
      setAbsences(Array.isArray(list) ? list : []);
    } catch {
      setAbsences([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  const fetchAbsentSlots = useCallback(async () => {
    if (!token || !isAdmin) return;
    setAbsentSlotsLoading(true);
    try {
      const now = new Date();
      const from = `${now.getFullYear() - 2}-01-01`;
      const to = `${now.getFullYear()}-12-31`;
      const list = await apiFetch<AbsentSlotItem[]>(`/duty/absent-slots?from=${from}&to=${to}`, { token });
      setAbsentSlots(Array.isArray(list) ? list : []);
    } catch {
      setAbsentSlots([]);
    } finally {
      setAbsentSlotsLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchTeachers();
      fetchAbsences();
      fetchAbsentSlots();
    }
  }, [isAdmin, fetchTeachers, fetchAbsences, fetchAbsentSlots]);

  const toYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const setDateShortcut = (type: 'bugun' | 'hafta' | 'ay') => {
    const now = new Date();
    let from: string;
    let to: string;
    if (type === 'bugun') {
      from = to = toYMD(now);
    } else if (type === 'hafta') {
      const day = now.getDay();
      const mondayOffset = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      from = toYMD(monday);
      to = toYMD(friday);
    } else {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    setForm((f) => ({ ...f, date_from: from, date_to: to }));
  };

  const handleAdd = async (keepSettings = false) => {
    const dateTo = form.date_to.trim() || form.date_from;
    if (!token || !form.user_id || !form.date_from) {
      toast.error('Öğretmen ve başlangıç tarihi zorunludur.');
      return;
    }
    if (form.date_from > dateTo) {
      toast.error('Bitiş tarihi başlangıçtan önce olamaz.');
      return;
    }
    setAdding(true);
    try {
      await apiFetch('/duty/absences', {
        token,
        method: 'POST',
        body: JSON.stringify({
          user_id: form.user_id,
          date_from: form.date_from,
          date_to: dateTo,
          absence_type: form.absence_type,
          note: form.note.trim() || undefined,
        }),
      });
      toast.success('Devamsızlık kaydı eklendi. İlgili nöbet slotları otomatik işaretlendi.');
      if (keepSettings) {
        setForm((f) => ({ ...f, date_from: '', date_to: '' }));
      } else {
        setForm({ user_id: '', date_from: '', date_to: '', absence_type: 'raporlu', note: '' });
      }
      fetchAbsences();
      fetchAbsentSlots();
      window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi.');
    } finally {
      setAdding(false);
    }
  };

  const fetchEkDersAbsences = useCallback(async () => {
    if (!token || !isAdmin) return;
    const [y, m] = ekDersMonth.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    try {
      const res = await apiFetch<{ items: { user_id: string; date: string; absent_type: string }[] }>(
        `/duty/absences-for-ek-ders?from=${from}&to=${to}`,
        { token },
      );
      setEkDersData(res?.items ?? []);
    } catch {
      setEkDersData([]);
    }
  }, [token, isAdmin, ekDersMonth]);

  useEffect(() => {
    if (isAdmin && ekDersMonth) fetchEkDersAbsences();
  }, [isAdmin, ekDersMonth, fetchEkDersAbsences]);

  const handleEkDersExcelExport = () => {
    if (!ekDersData || ekDersData.length === 0) return;
    const teacherCounts = new Map<string, number>();
    for (const item of ekDersData) {
      teacherCounts.set(item.user_id, (teacherCounts.get(item.user_id) ?? 0) + 1);
    }
    const summaryRows = Array.from(teacherCounts.entries()).map(([uid, cnt]) => {
      const t = teachers.find((x) => x.id === uid);
      return [t?.display_name || t?.email || uid, cnt];
    });
    const detailRows = ekDersData.map((item) => {
      const t = teachers.find((x) => x.id === item.user_id);
      return [t?.display_name || t?.email || item.user_id, item.date, ABSENCE_LABELS[item.absent_type] || item.absent_type];
    });
    const ws1 = XLSX.utils.aoa_to_sheet([['Öğretmen', 'Devamsızlık Sayısı'], ...summaryRows.map((r) => [r[0], r[1]])]);
    const ws2 = XLSX.utils.aoa_to_sheet([['Öğretmen', 'Tarih', 'Tip'], ...detailRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Özet');
    XLSX.utils.book_append_sheet(wb, ws2, 'Detay');
    XLSX.writeFile(wb, `nobet-devamsizlik-${ekDersMonth}.xlsx`);
    toast.success('Excel indirildi.');
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    if (!confirm('Bu devamsızlık kaydını silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/duty/absences/${id}`, { token, method: 'DELETE' });
      toast.success('Kayıt silindi.');
      fetchAbsences();
      fetchAbsentSlots();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    }
  };

  const handleClearSlot = async (slotId: string) => {
    if (!token) return;
    if (!confirm('Bu devamsızlık işaretini kaldırmak istediğinize emin misiniz? Ders atamaları da silinecektir.')) return;
    setClearingSlotId(slotId);
    try {
      await apiFetch(`/duty/slots/${slotId}/clear-absent`, { token, method: 'POST' });
      toast.success('Devamsızlık işareti kaldırıldı.');
      fetchAbsentSlots();
      window.dispatchEvent(new CustomEvent('duty-pending-coverage-update'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaldırılamadı.');
    } finally {
      setClearingSlotId(null);
    }
  };

  if (!isAdmin) {
    return <Alert variant="error" message="Bu sayfaya erişim yetkiniz yok." />;
  }

  const ABSENCE_CONFIG = {
    raporlu: {
      icon: FileText,
      label: 'Raporlu',
      badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      border: 'border-l-amber-400',
      iconColor: 'text-amber-500',
    },
    izinli: {
      icon: CalendarOff,
      label: 'İzinli',
      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      border: 'border-l-blue-400',
      iconColor: 'text-blue-500',
    },
    gelmeyen: {
      icon: AlertTriangle,
      label: 'Gelmeyen',
      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      border: 'border-l-rose-400',
      iconColor: 'text-rose-500',
    },
  } as const;

  const absenceTypeBadge = (type: string) => {
    const cfg = ABSENCE_CONFIG[type as keyof typeof ABSENCE_CONFIG];
    return cfg?.badge ?? 'bg-muted text-muted-foreground';
  };

  const raporluCount = absences.filter((a) => a.absence_type === 'raporlu').length;
  const izinliCount = absences.filter((a) => a.absence_type === 'izinli').length;
  const gelmeyenCount = absences.filter((a) => a.absence_type === 'gelmeyen').length;

  return (
    <div className="space-y-5">
      <DutyPageHeader
        icon={UserMinus}
        title="Devamsızlık"
        description="Raporlu, izinli veya gelmeyen öğretmenleri ekleyin. Otomatik planlama bu öğretmenleri hariç tutar."
        color="rose"
        badge={
          absences.length > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
              {absences.length} kayıt
            </span>
          ) : undefined
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchAbsences(); fetchAbsentSlots(); }}
            disabled={loading || absentSlotsLoading}
          >
            <RefreshCw className={cn('size-4', (loading || absentSlotsLoading) && 'animate-spin')} />
            Yenile
          </Button>
        }
      />

      {/* Özet sayaçlar */}
      {absences.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Raporlu', value: raporluCount, color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/20', Icon: FileText },
            { label: 'İzinli', value: izinliCount, color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-950/20', Icon: CalendarOff },
            { label: 'Gelmeyen', value: gelmeyenCount, color: 'text-rose-700', bg: 'bg-rose-50 dark:bg-rose-950/20', Icon: ClipboardX },
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

      {/* Yeni devamsızlık formu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            Yeni Devamsızlık Ekle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-xs text-muted-foreground">Öğretmen</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                value={form.user_id}
                onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
              >
                <option value="">Seçin…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name || t.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Başlangıç</Label>
              <Input type="date" value={form.date_from} onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bitiş (boşsa tek gün)</Label>
              <Input type="date" value={form.date_to} onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Devamsızlık Tipi</Label>
              <select
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                value={form.absence_type}
                onChange={(e) => setForm((f) => ({ ...f, absence_type: e.target.value as 'raporlu' | 'izinli' | 'gelmeyen' }))}
              >
                <option value="raporlu">Raporlu</option>
                <option value="izinli">İzinli</option>
                <option value="gelmeyen">Gelmeyen</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Kısa yol butonları */}
            <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
              {[{ label: 'Bugün', type: 'bugun' as const }, { label: 'Bu hafta', type: 'hafta' as const }, { label: 'Bu ay', type: 'ay' as const }].map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => setDateShortcut(s.type)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <Input
              placeholder="Not (opsiyonel)…"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="h-9 flex-1 min-w-[160px]"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => handleAdd(false)} disabled={adding || !form.user_id || !form.date_from} size="sm">
              {adding ? <LoadingSpinner className="size-4" /> : <Plus className="size-4" />}
              {adding ? 'Ekleniyor…' : 'Ekle'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAdd(true)}
              disabled={adding || !form.user_id || !form.date_from}
            >
              <Copy className="size-4" />
              Aynı ayarlarla tekrar ekle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Günlük tablodan işaretlenenler */}
      {absentSlots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardX className="size-4" />
              Günlük Tablodan İşaretlenenler
              <span className="text-xs font-normal text-muted-foreground">
                ({absentSlots.length} kayıt · Günlük listede &quot;Gelmeyen işaretle&quot; ile eklenen)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {absentSlots.map((slot) => (
                <div
                  key={slot.id}
                  className={cn(
                    'flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5',
                    ABSENCE_CONFIG[slot.absent_type]?.border ?? 'border-l-rose-400',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{slot.user?.display_name || slot.user?.email || slot.user_id}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(slot.date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      <span className={cn('font-medium', ABSENCE_CONFIG[slot.absent_type]?.iconColor)}>{ABSENCE_LABELS[slot.absent_type] ?? slot.absent_type}</span>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                    onClick={() => handleClearSlot(slot.id)}
                    disabled={clearingSlotId === slot.id}
                  >
                    {clearingSlotId === slot.id ? <LoadingSpinner className="size-4" /> : <Trash2 className="size-4" />}
                    Kaldır
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kayıtlı devamsızlıklar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Kayıtlı Devamsızlıklar</h3>
          {absences.length > 0 && (
            <span className="text-xs text-muted-foreground">{absences.length} kayıt</span>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : absences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-dashed border-border/60 bg-muted/20 gap-3">
            <UserMinus className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Henüz devamsızlık kaydı yok.</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {absences.map((a) => {
              const cfg = ABSENCE_CONFIG[a.absence_type as keyof typeof ABSENCE_CONFIG] ?? ABSENCE_CONFIG.gelmeyen;
              const Icon = cfg.icon;
              const isSingleDay = a.date_from === a.date_to;
              return (
                <div
                  key={a.id}
                  className={cn(
                    'relative rounded-xl border border-l-4 bg-card hover:shadow-sm transition-shadow',
                    cfg.border,
                  )}
                >
                  <div className="p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold', cfg.badge)}>
                        <Icon className="size-3" />
                        {cfg.label}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mt-0.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                        onClick={() => handleDelete(a.id)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <User2 className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-semibold truncate">{a.user?.display_name || a.user?.email || '—'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isSingleDay
                        ? new Date(a.date_from + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                        : `${new Date(a.date_from + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${new Date(a.date_to + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      }
                    </p>
                    {a.note && (
                      <p className="mt-1.5 text-xs text-muted-foreground italic truncate">"{a.note}"</p>
                    )}
                  </div>
                  {/* Boşa Çıkacak Dersler paneli */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3.5 py-2 border-t text-xs text-muted-foreground hover:bg-muted/30 transition-colors rounded-b-xl"
                    onClick={() => {
                      if (expandedAbsenceId === a.id) {
                        setExpandedAbsenceId(null);
                      } else {
                        fetchClassSchedule(a.id);
                      }
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <BookOpen className="size-3 text-amber-500" />
                      <span className="text-amber-700 dark:text-amber-300 font-medium">Boşa Çıkacak Dersler</span>
                    </span>
                    {scheduleLoading === a.id ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : expandedAbsenceId === a.id ? (
                      <ChevronUp className="size-3" />
                    ) : (
                      <ChevronDown className="size-3" />
                    )}
                  </button>
                  {expandedAbsenceId === a.id && classSchedules[a.id] && (() => {
                    const schedule = classSchedules[a.id];
                    const totalLessons = schedule.dates.reduce((sum, d) => sum + d.lessons.length, 0);
                    return (
                      <div className="px-3.5 pb-3 pt-2 border-t bg-amber-50/50 dark:bg-amber-950/10 rounded-b-xl">
                        {schedule.dates.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">Bu tarihler için ders programı yüklü değil.</p>
                        ) : (
                          <>
                            {totalLessons > 0 && (
                              <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-800 dark:text-amber-200">
                                <AlertTriangle className="size-3 shrink-0" />
                                {totalLessons} ders saati boşa çıkacak — nöbetçilere görevlendirme yapılmalı
                              </div>
                            )}
                            <div className="space-y-2">
                              {schedule.dates.map((d) => (
                                <div key={d.date}>
                                  <p className="text-xs font-medium text-foreground mb-1">
                                    {new Date(d.date + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'short' })}
                                  </p>
                                  {d.lessons.length === 0 ? (
                                    <p className="text-xs text-muted-foreground ml-2">— Bu gün dersi yok</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1 ml-2">
                                      {d.lessons.map((l) => (
                                        <span key={l.lesson_num} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-semibold">
                                          {l.lesson_num}. ders · {l.class_section} · {l.subject}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ek ders puantaj */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="size-4" />
            Ek Ders Puantajı – Nöbet Devamsızlık
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Günlük tabloda işaretlenen nöbet devamsızlıkları. Ek ders hesaplamasında kullanılmak üzere ay seçin.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={ekDersMonth}
              onChange={(e) => setEkDersMonth(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            />
            {ekDersData && ekDersData.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleEkDersExcelExport}>
                <Download className="size-4" />
                Excel İndir
              </Button>
            )}
          </div>
          {ekDersData && ekDersData.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Öğretmen başına devamsızlık</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {(() => {
                    const counts = new Map<string, number>();
                    for (const item of ekDersData) counts.set(item.user_id, (counts.get(item.user_id) ?? 0) + 1);
                    return Array.from(counts.entries()).map(([uid, n]) => {
                      const t = teachers.find((x) => x.id === uid);
                      return (
                        <span key={uid} className="text-muted-foreground">
                          {t?.display_name || t?.email || uid}:{' '}
                          <strong className="text-foreground">{n}</strong>
                        </span>
                      );
                    });
                  })()}
                </div>
              </div>
              <div className="table-x-scroll rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Öğretmen</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tarih</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ekDersData.map((item, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {teachers.find((t) => t.id === item.user_id)?.display_name ||
                            teachers.find((t) => t.id === item.user_id)?.email ||
                            item.user_id}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.date}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', absenceTypeBadge(item.absent_type))}>
                            {ABSENCE_LABELS[item.absent_type] || item.absent_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">{ekDersData.length} devamsızlık kaydı</p>
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bu ay için işaretlenmiş nöbet devamsızlığı yok.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
