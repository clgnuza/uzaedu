'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Send,
  FileDown,
  Check,
  X,
  Share2,
  RotateCcw,
  History,
  Calendar,
  List,
  GripVertical,
  Search,
  ArchiveRestore,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { getDutyLogActionLabel, getDutyLogDetailLine } from '@/lib/duty-log-labels';
import * as XLSX from 'xlsx';

type UserItem = { id: string; display_name: string | null; email: string };
type RecentLog = {
  id: string;
  action: string;
  created_at: string;
  undone_at: string | null;
  duty_slot_id: string | null;
  duty_plan_id?: string | null;
  old_user_id: string | null;
  new_user_id: string | null;
  performedByUser?: { display_name: string | null; email: string };
  oldUser?: { display_name: string | null; email: string } | null;
  newUser?: { display_name: string | null; email: string } | null;
};
type DutySlot = {
  id: string;
  date: string;
  shift?: 'morning' | 'afternoon';
  area_name: string | null;
  slot_start_time: string | null;
  slot_end_time: string | null;
  user_id: string;
  user?: { display_name: string | null; email: string };
};
type DutyPlan = {
  id: string;
  version: string | null;
  status: 'draft' | 'published';
  period_start: string | null;
  period_end: string | null;
  archived_at?: string | null;
  slots?: DutySlot[];
};

const TR_TZ = 'Europe/Istanbul';

/** API tarihi (UTC / ISO) — ofsetsiz tam tarih-saat UTC kabul; gösterim Europe/Istanbul */
function parseServerDateTime(value: string | Date | null | undefined): Date {
  if (value == null) return new Date(NaN);
  if (value instanceof Date) return value;
  let s = String(value).trim();
  if (!s) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T');
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return new Date(`${s}Z`);
  return new Date(s);
}

function formatLogDateTime(value: string | Date): string {
  const d = parseServerDateTime(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    timeZone: TR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('tr-TR');
}

function defaultDateInPlan(periodStart: string | null, periodEnd: string | null): string {
  if (!periodStart || !periodEnd) return '';
  const today = new Date().toISOString().slice(0, 10);
  if (today >= periodStart && today <= periodEnd) return today;
  return periodStart;
}

type DutyAreaItem = { id: string; name: string };

function DutyAreaSelect({
  value,
  onChange,
  areas,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  areas: DutyAreaItem[];
  className?: string;
}) {
  const orphan = value.trim() !== '' && !areas.some((a) => a.name === value);
  return (
    <select
      className={cn(
        'flex w-full rounded-md border border-input bg-background px-3 py-1 text-sm',
        className,
      )}
      value={orphan ? value : value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Seçilmedi —</option>
      {orphan ? <option value={value}>{value} (kayıtlı)</option> : null}
      {areas.map((a) => (
        <option key={a.id} value={a.name}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

/** Aynı nöbet yeri her zaman aynı palet indeksi (liste + takvim) */
const AREA_SLOT_PALETTE = [
  'bg-sky-50/90 border-sky-300/80 dark:bg-sky-950/35 dark:border-sky-800/80',
  'bg-emerald-50/90 border-emerald-300/80 dark:bg-emerald-950/35 dark:border-emerald-800/80',
  'bg-amber-50/90 border-amber-300/80 dark:bg-amber-950/35 dark:border-amber-800/80',
  'bg-violet-50/90 border-violet-300/80 dark:bg-violet-950/35 dark:border-violet-800/80',
  'bg-rose-50/90 border-rose-300/80 dark:bg-rose-950/35 dark:border-rose-800/80',
  'bg-cyan-50/90 border-cyan-300/80 dark:bg-cyan-950/35 dark:border-cyan-800/80',
  'bg-fuchsia-50/90 border-fuchsia-300/80 dark:bg-fuchsia-950/35 dark:border-fuchsia-800/80',
  'bg-lime-50/90 border-lime-300/80 dark:bg-lime-950/35 dark:border-lime-800/80',
  'bg-indigo-50/90 border-indigo-300/80 dark:bg-indigo-950/35 dark:border-indigo-800/80',
  'bg-orange-50/90 border-orange-300/80 dark:bg-orange-950/35 dark:border-orange-800/80',
  'bg-teal-50/90 border-teal-300/80 dark:bg-teal-950/35 dark:border-teal-800/80',
  'bg-pink-50/90 border-pink-300/80 dark:bg-pink-950/35 dark:border-pink-800/80',
];

const AREA_SLOT_NEUTRAL =
  'bg-muted/30 border-dashed border-border/70 dark:bg-muted/20';

function areaKeyFromName(areaName: string | null | undefined): number | null {
  const s = (areaName ?? '').trim();
  if (!s) return null;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % AREA_SLOT_PALETTE.length;
}

function areaSlotBoxClass(areaName: string | null | undefined): string {
  const k = areaKeyFromName(areaName);
  if (k === null) return AREA_SLOT_NEUTRAL;
  return AREA_SLOT_PALETTE[k];
}

export default function DutyPlanDetayPage() {
  const params = useParams();
  const router = useRouter();
  const { token, me } = useAuth();
  const planId = params.id as string;
  const isAdmin = me?.role === 'school_admin';

  const [plan, setPlan] = useState<DutyPlan | null>(null);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
  const [dutyAreas, setDutyAreas] = useState<DutyAreaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<{
    date: string;
    shift: 'morning' | 'afternoon';
    area_name: string;
    slot_start_time: string;
    slot_end_time: string;
    user_id: string;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newSlot, setNewSlot] = useState({
    date: '',
    shift: 'morning' as 'morning' | 'afternoon',
    area_name: '',
    slot_start_time: '',
    slot_end_time: '',
    user_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [unarchiving, setUnarchiving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [dragSlotId, setDragSlotId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [newSlotTeacherQuery, setNewSlotTeacherQuery] = useState('');
  const [newSlotTeacherOpen, setNewSlotTeacherOpen] = useState(false);
  const newSlotTeacherRef = useRef<HTMLDivElement>(null);

  const teachersSorted = useMemo(() => {
    return [...teachers].sort((a, b) => {
      const na = (a.display_name || a.email).toLocaleLowerCase('tr');
      const nb = (b.display_name || b.email).toLocaleLowerCase('tr');
      return na.localeCompare(nb, 'tr');
    });
  }, [teachers]);

  const filteredTeachersForNewSlot = useMemo(() => {
    const q = newSlotTeacherQuery.trim().toLowerCase();
    if (!q) return teachersSorted;
    return teachersSorted.filter(
      (t) =>
        (t.display_name ?? '').toLowerCase().includes(q) ||
        (t.email ?? '').toLowerCase().includes(q),
    );
  }, [teachersSorted, newSlotTeacherQuery]);

  useEffect(() => {
    if (!newSlotTeacherOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = newSlotTeacherRef.current;
      if (el && !el.contains(e.target as Node)) setNewSlotTeacherOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [newSlotTeacherOpen]);

  const fetchPlan = useCallback(async () => {
    if (!token || !planId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await apiFetch<DutyPlan>(`/duty/plans/${planId}`, { token });
      setPlan(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan yüklenemedi.');
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [token, planId]);

  const fetchPlanLogs = useCallback(async () => {
    if (!token || !isAdmin || !planId) return;
    try {
      const logs = await apiFetch<RecentLog[]>(`/duty/plans/${planId}/logs?limit=30`, { token });
      setRecentLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setRecentLogs([]);
    }
  }, [token, isAdmin, planId]);

  const handleUndo = async (logId: string) => {
    if (!token) return;
    setUndoingId(logId);
    try {
      await apiFetch(`/duty/undo/${logId}`, { token, method: 'POST' });
      toast.success('İşlem geri alındı.');
      await Promise.all([fetchPlan(), fetchPlanLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı.');
    } finally {
      setUndoingId(null);
    }
  };

  const fetchTeachers = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const list = await apiFetch<UserItem[]>('/duty/teachers', { token });
      setTeachers(Array.isArray(list) ? list : []);
    } catch {
      setTeachers([]);
    }
  }, [token, isAdmin]);

  const fetchDutyAreas = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const list = await apiFetch<DutyAreaItem[]>('/duty/areas', { token });
      setDutyAreas(Array.isArray(list) ? list : []);
    } catch {
      setDutyAreas([]);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    if (isAdmin) {
      fetchTeachers();
      fetchDutyAreas();
    }
  }, [isAdmin, fetchTeachers, fetchDutyAreas]);

  useEffect(() => {
    if (isAdmin) fetchPlanLogs();
  }, [isAdmin, fetchPlanLogs]);

  const handleStartEdit = (slot: DutySlot) => {
    setEditingId(slot.id);
    setEditRow({
      date: slot.date,
      shift: slot.shift ?? 'morning',
      area_name: slot.area_name ?? '',
      slot_start_time: slot.slot_start_time ?? '',
      slot_end_time: slot.slot_end_time ?? '',
      user_id: slot.user_id,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditRow(null);
  };

  const handleSaveEdit = async () => {
    if (!token || !editingId || !editRow) return;
    setSaving(true);
    try {
      await apiFetch(`/duty/slots/${editingId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          date: editRow.date || undefined,
          shift: editRow.shift,
          area_name: editRow.area_name || null,
          slot_start_time: editRow.slot_start_time || null,
          slot_end_time: editRow.slot_end_time || null,
          user_id: editRow.user_id || undefined,
        }),
      });
      toast.success('Nöbet kaydı güncellendi.');
      handleCancelEdit();
      await Promise.all([fetchPlan(), fetchPlanLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSlot = async () => {
    if (!token || !planId || !newSlot.user_id || !newSlot.date) {
      toast.error('Tarih ve öğretmen zorunludur.');
      return;
    }
    if (plan?.period_start && plan?.period_end && (newSlot.date < plan.period_start || newSlot.date > plan.period_end)) {
      toast.error('Tarih plan dönemi dışında olamaz.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/duty/plans/${planId}/slots`, {
        token,
        method: 'POST',
        body: JSON.stringify({
          date: newSlot.date,
          shift: newSlot.shift,
          user_id: newSlot.user_id,
          area_name: newSlot.area_name || null,
          slot_start_time: newSlot.slot_start_time || null,
          slot_end_time: newSlot.slot_end_time || null,
        }),
      });
      toast.success('Nöbet kaydı eklendi.');
      setAdding(false);
      setNewSlotTeacherQuery('');
      setNewSlotTeacherOpen(false);
      setNewSlot({ date: '', shift: 'morning', area_name: '', slot_start_time: '', slot_end_time: '', user_id: '' });
      await Promise.all([fetchPlan(), fetchPlanLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!token) return;
    if (!confirm('Bu nöbet kaydını silmek istediğinize emin misiniz?')) return;
    setDeletingId(slotId);
    try {
      await apiFetch(`/duty/slots/${slotId}`, { token, method: 'DELETE' });
      toast.success('Nöbet kaydı silindi.');
      await Promise.all([fetchPlan(), fetchPlanLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSwapSlots = async (slotIdA: string, slotIdB: string) => {
    if (!token || slotIdA === slotIdB || swapping) return;
    const slotA = slots.find((s) => s.id === slotIdA);
    const slotB = slots.find((s) => s.id === slotIdB);
    if (!slotA || !slotB) return;
    setSwapping(true);
    setDragSlotId(null);
    try {
      await apiFetch(`/duty/slots/${slotIdA}`, { token, method: 'PATCH', body: JSON.stringify({ user_id: slotB.user_id }) });
      await apiFetch(`/duty/slots/${slotIdB}`, { token, method: 'PATCH', body: JSON.stringify({ user_id: slotA.user_id }) });
      toast.success('Nöbetler takas edildi.');
      await Promise.all([fetchPlan(), fetchPlanLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Takas yapılamadı.');
    } finally {
      setSwapping(false);
    }
  };

  const handlePublish = async () => {
    if (!token || !planId) return;
    setPublishing(true);
    try {
      await apiFetch(`/duty/plans/${planId}/publish`, { token, method: 'POST' });
      toast.success('Plan yayınlandı.');
      await Promise.all([fetchPlan(), fetchPlanLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayınlama başarısız.');
    } finally {
      setPublishing(false);
    }
  };

  const handleSoftDeletePlan = async () => {
    if (!token || !planId) return;
    if (!confirm('Bu planı silmek istediğinize emin misiniz? Plan listeden kaldırılır ancak istatistikler korunur.')) return;
    setDeletingPlan(true);
    try {
      await apiFetch(`/duty/plans/${planId}/soft-delete`, { token, method: 'POST' });
      toast.success('Plan silindi.');
      router.push('/duty/planlar');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Plan silinemedi.');
      setDeletingPlan(false);
    }
  };

  const handleUnarchivePlan = async () => {
    if (!token || !planId) return;
    setUnarchiving(true);
    try {
      await apiFetch(`/duty/plans/${planId}/unarchive`, { token, method: 'POST' });
      toast.success('Plan arşivden çıkarıldı.');
      await fetchPlan();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setUnarchiving(false);
    }
  };

  const handleWhatsAppShare = () => {
    if (!plan || !plan.slots?.length) return;
    const header = `${plan.version || 'Nöbet Planı'} – ${formatDate(plan.period_start)} / ${formatDate(plan.period_end)}\n\n`;
    const lines = plan.slots.map((s) => {
      const name = s.user?.display_name || s.user?.email || '—';
      const shiftLabel = s.shift === 'afternoon' ? 'Öğle' : 'Sabah';
      const area = s.area_name ? ` (${s.area_name})` : '';
      return `${s.date} (${shiftLabel}) – ${name}${area}`;
    });
    const text = header + lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleExport = async () => {
    if (!token || !plan) return;
    setExporting(true);
    try {
      const p = await apiFetch<{ slots: DutySlot[] }>(`/duty/plans/${planId}`, { token });
      const slots = p?.slots ?? [];
      if (slots.length === 0) {
        toast.error('Bu planda nöbet kaydı yok.');
        return;
      }
      const shiftLabel = (s: string | null | undefined) => {
        if (s === 'afternoon') return 'Öğle';
        if (s === 'morning') return 'Sabah';
        return s ?? '';
      };
      const rows: string[][] = [
        ['Tarih', 'Vardiya', 'Öğretmen', 'Alan', 'Giriş Saati', 'Çıkış Saati'],
        ...slots.map((s) => [
          s.date,
          shiftLabel(s.shift),
          s.user?.display_name || s.user?.email || '—',
          s.area_name || '',
          s.slot_start_time || '',
          s.slot_end_time || '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: false });
      ws['!cols'] = [
        { wch: 14 }, { wch: 10 }, { wch: 26 }, { wch: 18 }, { wch: 13 }, { wch: 13 },
      ];
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      const wb = XLSX.utils.book_new();
      const safeVersion = (plan.version ?? 'plan').replace(/[^\w\-]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, safeVersion.slice(0, 31));
      XLSX.writeFile(wb, `nobet-plani-${safeVersion}.xlsx`);
      toast.success('Excel indirildi.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <Link href="/duty/planlar" className="inline-flex items-center justify-center gap-2 h-8 px-3 text-sm rounded-lg font-medium hover:bg-muted hover:text-foreground">
          ← Planlara dön
        </Link>
        <Alert variant="error" message={error ?? 'Plan bulunamadı.'} />
      </div>
    );
  }

  const slots = plan.slots ?? [];
  const isArchived = !!plan.archived_at;
  /** Yayınlı/taslak: okul yöneticisi slot ekler, siler, düzenler */
  const canMutateSlots = isAdmin && !isArchived;
  const canPublishDraft = isAdmin && plan.status === 'draft' && !isArchived;

  // Gün bazlı gruplama – aynı gün aynı arka plan rengi
  const DAY_GROUP_COLORS = [
    'bg-sky-50/80 dark:bg-sky-950/20',
    'bg-emerald-50/80 dark:bg-emerald-950/20',
    'bg-amber-50/80 dark:bg-amber-950/20',
    'bg-violet-50/80 dark:bg-violet-950/20',
    'bg-rose-50/80 dark:bg-rose-950/20',
    'bg-teal-50/80 dark:bg-teal-950/20',
  ];
  const slotsByDate = slots.reduce<Record<string, typeof slots>>((acc, s) => {
    const d = s.date ?? '';
    if (!acc[d]) acc[d] = [];
    acc[d].push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(slotsByDate).sort();
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5];
  const WEEKDAY_LABELS: Record<number, string> = { 1: 'Pazartesi', 2: 'Salı', 3: 'Çarşamba', 4: 'Perşembe', 5: 'Cuma' };
  const datesByWeekday = sortedDates.reduce<Record<number, string[]>>((acc, date) => {
    const day = new Date(date + 'T12:00:00').getDay();
    const wd = day === 0 ? 7 : day;
    if (wd >= 1 && wd <= 5) {
      if (!acc[wd]) acc[wd] = [];
      acc[wd].push(date);
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/duty/planlar" className="inline-flex items-center justify-center gap-2 h-8 px-3 text-sm rounded-lg font-medium hover:bg-muted hover:text-foreground">
            <ArrowLeft className="size-4" />
            Planlar
          </Link>
          <h1 className="text-2xl font-semibold">{plan.version || 'Plan Detayı'}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleWhatsAppShare} disabled={slots.length === 0}>
            <Share2 className="size-4" />
            WhatsApp
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            <FileDown className="size-4" />
            Excel
          </Button>
          {canPublishDraft && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing || slots.length === 0}
            >
              <Send className="size-4" />
              Yayınla
            </Button>
          )}
          {isAdmin && isArchived && (
            <Button size="sm" variant="outline" onClick={handleUnarchivePlan} disabled={unarchiving}>
              {unarchiving ? <LoadingSpinner className="size-4" /> : <ArchiveRestore className="size-4" />}
              Arşivden çıkar
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:text-rose-700"
              onClick={handleSoftDeletePlan}
              disabled={deletingPlan}
              title="Planı sil (istatistikler korunur)"
            >
              {deletingPlan ? <LoadingSpinner className="size-4" /> : <Trash2 className="size-4" />}
              Planı sil
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Dönem: {formatDate(plan.period_start)} – {formatDate(plan.period_end)}</span>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 font-medium',
            plan.status === 'published'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
          )}
        >
          {plan.status === 'published' ? 'Yayınlandı' : 'Taslak'}
        </span>
      </div>

      {isArchived && (
        <Alert
          variant="info"
          message="Bu plan arşivde. Günlük nöbet ve görev ekranlarında kullanılmaz; arşivden çıkararak tekrar etkinleştirebilirsiniz."
        />
      )}
      {canMutateSlots && plan.status === 'published' && (
        <Alert
          variant="info"
          message="Bu plan yayında. Kayıtları ekleyebilir, düzenleyebilir veya silebilirsiniz."
        />
      )}
      {canMutateSlots && (
        <Card className="rounded-lg border-dashed">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-sm font-semibold">Yeni Nöbet Ekle</CardTitle>
            {plan.period_start && plan.period_end && (
              <p className="text-xs text-muted-foreground">
                Tarih {formatDate(plan.period_start)} – {formatDate(plan.period_end)} aralığında olmalıdır.
              </p>
            )}
          </CardHeader>
          <CardContent>
            {adding ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                  <div className="space-y-1.5 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Tarih</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={newSlot.date}
                      min={plan.period_start ?? undefined}
                      max={plan.period_end ?? undefined}
                      onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-4">
                    <Label className="text-xs text-muted-foreground">Vardiya</Label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewSlot((s) => ({ ...s, shift: 'morning' }))}
                        className={cn(
                          'h-9 flex-1 rounded-lg border text-xs font-medium transition-colors',
                          newSlot.shift === 'morning'
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
                        )}
                      >
                        Sabah
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSlot((s) => ({ ...s, shift: 'afternoon' }))}
                        className={cn(
                          'h-9 flex-1 rounded-lg border text-xs font-medium transition-colors',
                          newSlot.shift === 'afternoon'
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
                        )}
                      >
                        Öğle
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 lg:col-span-5">
                    <Label className="text-xs text-muted-foreground">Öğretmen</Label>
                    <div ref={newSlotTeacherRef} className="relative">
                      {newSlot.user_id ? (
                        <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm">
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {teachers.find((t) => t.id === newSlot.user_id)?.display_name ||
                              teachers.find((t) => t.id === newSlot.user_id)?.email ||
                              '—'}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 text-xs"
                            onClick={() => {
                              setNewSlot((s) => ({ ...s, user_id: '' }));
                              setNewSlotTeacherQuery('');
                              setNewSlotTeacherOpen(true);
                            }}
                          >
                            Değiştir
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              className="h-9 pl-9"
                              placeholder="İsim veya e-posta ile ara…"
                              value={newSlotTeacherQuery}
                              onChange={(e) => {
                                setNewSlotTeacherQuery(e.target.value);
                                setNewSlotTeacherOpen(true);
                              }}
                              onFocus={() => setNewSlotTeacherOpen(true)}
                              autoComplete="off"
                            />
                          </div>
                          {newSlotTeacherOpen && (
                            <ul
                              className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-border bg-popover py-1 text-sm shadow-md"
                              role="listbox"
                            >
                              {filteredTeachersForNewSlot.length === 0 ? (
                                <li className="px-3 py-2 text-xs text-muted-foreground">Eşleşen öğretmen yok</li>
                              ) : (
                                filteredTeachersForNewSlot.map((t) => (
                                  <li key={t.id}>
                                    <button
                                      type="button"
                                      className="w-full px-3 py-2 text-left hover:bg-muted"
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => {
                                        setNewSlot((s) => ({ ...s, user_id: t.id }));
                                        setNewSlotTeacherQuery('');
                                        setNewSlotTeacherOpen(false);
                                      }}
                                    >
                                      <span className="font-medium">{t.display_name || t.email}</span>
                                      {t.display_name ? (
                                        <span className="block truncate text-xs text-muted-foreground">{t.email}</span>
                                      ) : null}
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5 lg:col-span-6">
                    <Label className="text-xs text-muted-foreground">Alan (isteğe bağlı)</Label>
                    <DutyAreaSelect
                      value={newSlot.area_name}
                      onChange={(v) => setNewSlot((s) => ({ ...s, area_name: v }))}
                      areas={dutyAreas}
                      className="h-9"
                    />
                    {dutyAreas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        <Link href="/duty/yerler" className="text-primary underline underline-offset-2 hover:no-underline">
                          Nöbet yerleri
                        </Link>{' '}
                        sayfasından tanımlayın.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Giriş saati</Label>
                    <Input
                      className="h-9 tabular-nums"
                      type="text"
                      placeholder="08:00"
                      value={newSlot.slot_start_time}
                      onChange={(e) => setNewSlot((s) => ({ ...s, slot_start_time: e.target.value }))}
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Çıkış saati</Label>
                    <Input
                      className="h-9 tabular-nums"
                      type="text"
                      placeholder="15:30"
                      value={newSlot.slot_end_time}
                      onChange={(e) => setNewSlot((s) => ({ ...s, slot_end_time: e.target.value }))}
                      maxLength={5}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button size="sm" className="h-8" onClick={handleAddSlot} disabled={saving || !newSlot.user_id || !newSlot.date}>
                    {saving ? 'Ekleniyor…' : 'Kaydı ekle'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setAdding(false);
                      setNewSlotTeacherQuery('');
                      setNewSlotTeacherOpen(false);
                    }}
                  >
                    İptal
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  setNewSlotTeacherQuery('');
                  setNewSlotTeacherOpen(false);
                  setNewSlot((s) => ({
                    ...s,
                    date: plan ? defaultDateInPlan(plan.period_start, plan.period_end) : s.date,
                  }));
                  setAdding(true);
                }}
              >
                <Plus className="size-4" />
                Yeni Nöbet Ekle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden rounded-xl">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-1.5 pt-3">
          <div>
            <CardTitle className="text-sm font-semibold">Nöbet Kayıtları</CardTitle>
            {slots.length > 0 && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">Aynı nöbet yeri aynı kutu rengiyle gösterilir.</p>
            )}
          </div>
          {slots.length > 0 && (
            <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                <List className="size-3.5" />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all',
                  viewMode === 'calendar'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                <Calendar className="size-3.5" />
                Takvim
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {slots.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Henüz nöbet kaydı yok.
              {canMutateSlots && ' Yukarıdan ekleyebilirsiniz.'}
            </p>
          ) : viewMode === 'calendar' ? (
            <div className="p-5 space-y-4">
              {canMutateSlots && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                  <p className="text-sm text-muted-foreground">
                    Nöbet kartını başka bir nöbet kartının üzerine <strong className="text-foreground">sürükleyip bırakarak</strong> iki öğretmenin nöbetini takas edebilirsiniz.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 min-[900px]:grid-cols-3 lg:grid-cols-5 gap-4 table-x-scroll">
                {WEEKDAY_ORDER.map((wd) => {
                  const dates = datesByWeekday[wd] ?? [];
                  if (dates.length === 0) return null;
                  const bgColor = DAY_GROUP_COLORS[wd - 1];
                  const label = WEEKDAY_LABELS[wd];
                  return (
                    <div key={wd} className={cn('rounded-xl border border-border overflow-hidden min-w-0 flex flex-col shadow-sm', bgColor)}>
                      <div className="px-4 py-3 border-b border-border bg-muted/60 dark:bg-muted/50 text-sm font-semibold uppercase tracking-wide shrink-0">
                        {label}
                      </div>
                      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                        {dates.map((date) => {
                          const daySlots = slotsByDate[date] ?? [];
                          return (
                            <div key={date} className="rounded-xl border border-border bg-background/90 dark:bg-background/95 overflow-hidden shadow-sm">
                              <div className="px-3 py-2 border-b border-border/60 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                {formatDate(date)}
                              </div>
                              <div className="space-y-2 p-2 min-h-[44px]">
                                {daySlots.map((slot) => (
                                  <div
                                    key={slot.id}
                                    {...(canMutateSlots ? {
                                      draggable: true,
                                      onDragStart: () => setDragSlotId(slot.id),
                                      onDragEnd: () => setDragSlotId(null),
                                      onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-primary', 'ring-offset-2'); },
                                      onDragLeave: (e: React.DragEvent) => { e.currentTarget.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'); },
                                      onDrop: (e: React.DragEvent) => {
                                        e.preventDefault();
                                        e.currentTarget.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                                        if (dragSlotId && dragSlotId !== slot.id) handleSwapSlots(dragSlotId, slot.id);
                                      },
                                    } : {})}
                                    className={cn(
                                      'flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-xs transition-shadow',
                                      areaSlotBoxClass(slot.area_name),
                                      canMutateSlots && 'cursor-grab active:cursor-grabbing hover:shadow-sm',
                                      canMutateSlots && dragSlotId === slot.id && 'opacity-60',
                                    )}
                                  >
                                    <div className="flex min-w-0 items-center gap-2">
                                      {canMutateSlots && <GripVertical className="size-4 shrink-0 text-muted-foreground" />}
                                      <span
                                        className={cn(
                                          'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                                          slot.shift === 'afternoon'
                                            ? 'bg-orange-100/90 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                                            : 'bg-sky-100/90 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
                                        )}
                                      >
                                        {slot.shift === 'afternoon' ? 'Öğle' : 'Sabah'}
                                      </span>
                                      <span className="ml-auto shrink-0 tabular-nums text-[10px] text-muted-foreground">
                                        {(slot.slot_start_time || '—') + ' – ' + (slot.slot_end_time || '—')}
                                      </span>
                                    </div>
                                    <p className="min-w-0 wrap-break-word text-sm font-medium leading-snug text-foreground">
                                      {slot.user?.display_name || slot.user?.email || '—'}
                                    </p>
                                    {slot.area_name ? (
                                      <span className="inline-flex w-fit max-w-full rounded-md border border-foreground/15 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-foreground/90 dark:bg-background/30">
                                        {slot.area_name}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] leading-tight text-muted-foreground">Alan yok</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-2 sm:p-3">
              {sortedDates.map((date, dateIdx) => {
                const daySlots = slotsByDate[date] ?? [];
                const groupBg = DAY_GROUP_COLORS[dateIdx % DAY_GROUP_COLORS.length];
                return (
                  <div
                    key={date}
                    className={cn('overflow-hidden rounded-lg border border-border shadow-sm', groupBg)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border/60 bg-muted/40 px-2.5 py-1.5">
                      <span className="text-sm font-medium text-foreground">{formatDate(date)}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{daySlots.length} kayıt</span>
                    </div>
                    <ul className="space-y-1.5 p-1">
                      {daySlots.map((slot) => (
                        <li key={slot.id} className="list-none">
                          <div
                            className={cn(
                              'rounded-md border',
                              areaSlotBoxClass(slot.area_name),
                              editingId === slot.id && editRow ? 'p-2' : 'px-2 py-1.5 sm:px-2.5 sm:py-2',
                            )}
                          >
                          {editingId === slot.id && editRow ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                                <div className="space-y-1.5 min-w-0">
                                  <Label className="text-xs text-muted-foreground">Tarih</Label>
                                  <Input
                                    type="date"
                                    value={editRow.date}
                                    onChange={(e) => setEditRow((r) => (r ? { ...r, date: e.target.value } : r))}
                                    className="h-10 min-h-[44px] w-full max-w-full text-sm sm:h-9 sm:min-h-0"
                                  />
                                </div>
                                <div className="space-y-1.5 min-w-0">
                                  <Label className="text-xs text-muted-foreground">Vardiya</Label>
                                  <select
                                    className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm sm:h-9 sm:min-h-0"
                                    value={editRow.shift}
                                    onChange={(e) =>
                                      setEditRow((r) => (r ? { ...r, shift: e.target.value as 'morning' | 'afternoon' } : r))
                                    }
                                  >
                                    <option value="morning">Sabah</option>
                                    <option value="afternoon">Öğle</option>
                                  </select>
                                </div>
                                <div className="space-y-1.5 min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                                  <Label className="text-xs text-muted-foreground">Öğretmen</Label>
                                  <select
                                    className="flex h-10 min-h-[44px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm sm:h-9 sm:min-h-0"
                                    value={editRow.user_id}
                                    onChange={(e) => setEditRow((r) => (r ? { ...r, user_id: e.target.value } : r))}
                                  >
                                    {teachers.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.display_name || t.email}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1.5 min-w-0">
                                  <Label className="text-xs text-muted-foreground">Alan</Label>
                                  <DutyAreaSelect
                                    value={editRow.area_name}
                                    onChange={(v) => setEditRow((r) => (r ? { ...r, area_name: v } : r))}
                                    areas={dutyAreas}
                                    className="h-10 min-h-[44px] w-full sm:h-9 sm:min-h-0"
                                  />
                                  {dutyAreas.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                      <Link href="/duty/yerler" className="text-primary underline underline-offset-2 hover:no-underline">
                                        Nöbet yerleri
                                      </Link>
                                    </p>
                                  ) : null}
                                </div>
                                <div className="space-y-1.5 min-w-0">
                                  <Label className="text-xs text-muted-foreground">Giriş</Label>
                                  <Input
                                    value={editRow.slot_start_time}
                                    onChange={(e) => setEditRow((r) => (r ? { ...r, slot_start_time: e.target.value } : r))}
                                    className="h-10 min-h-[44px] w-full text-sm tabular-nums sm:h-9 sm:min-h-0"
                                    maxLength={5}
                                    placeholder="08:00"
                                  />
                                </div>
                                <div className="space-y-1.5 min-w-0">
                                  <Label className="text-xs text-muted-foreground">Çıkış</Label>
                                  <Input
                                    value={editRow.slot_end_time}
                                    onChange={(e) => setEditRow((r) => (r ? { ...r, slot_end_time: e.target.value } : r))}
                                    className="h-10 min-h-[44px] w-full text-sm tabular-nums sm:h-9 sm:min-h-0"
                                    maxLength={5}
                                    placeholder="15:30"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" className="min-h-[44px] min-w-[44px] sm:min-h-9" onClick={handleSaveEdit} disabled={saving}>
                                  <Check className="size-4" />
                                  Kaydet
                                </Button>
                                <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-9" onClick={handleCancelEdit}>
                                  <X className="size-4" />
                                  İptal
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-0">
                                <span
                                  className={cn(
                                    'inline-flex w-fit shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-semibold',
                                    slot.shift === 'afternoon'
                                      ? 'bg-orange-100/90 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                                      : 'bg-sky-100/90 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
                                  )}
                                >
                                  {slot.shift === 'afternoon' ? 'Öğle' : 'Sabah'}
                                </span>
                                <p className="min-w-0 flex-[1_1_12rem] wrap-break-word text-sm font-medium leading-tight text-foreground">
                                  {slot.user?.display_name || slot.user?.email || '—'}
                                </p>
                                {slot.area_name ? (
                                  <span className="inline-flex max-w-full shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-foreground/10 dark:ring-foreground/20">
                                    {slot.area_name}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Alan yok</span>
                                )}
                                <span className="shrink-0 tabular-nums text-xs leading-tight text-muted-foreground">
                                  {(slot.slot_start_time || '—') + ' – ' + (slot.slot_end_time || '—')}
                                </span>
                              </div>
                              {canMutateSlots && (
                                <div className="flex shrink-0 gap-1 self-end sm:self-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 px-2 text-xs"
                                    onClick={() => handleStartEdit(slot)}
                                    disabled={!!editingId && editingId !== slot.id}
                                  >
                                    <Pencil className="size-3.5" />
                                    Düzenle
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 px-2 text-xs text-rose-600 hover:text-rose-700"
                                    onClick={() => handleDeleteSlot(slot.id)}
                                    disabled={!!deletingId || (!!editingId && editingId !== slot.id)}
                                  >
                                    <Trash2 className="size-3.5" />
                                    Sil
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && recentLogs.length > 0 && (
        <Card className="rounded-xl border-dashed border-muted-foreground/30">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Son İşlemler</h3>
              <span className="text-xs text-muted-foreground">(son 24 saat içindekiler geri alınabilir)</span>
            </div>
            <div className="space-y-1.5">
              {recentLogs.map((log) => {
                const detailLine = getDutyLogDetailLine(log);
                const ageMs = Date.now() - parseServerDateTime(log.created_at).getTime();
                const canUndo = !log.undone_at && ageMs < 24 * 60 * 60 * 1000 &&
                  ['reassign', 'absent_marked', 'coverage_assigned', 'duty_exempt_set', 'duty_exempt_cleared'].includes(log.action);
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs',
                      log.undone_at ? 'bg-muted/30 opacity-50' : 'bg-muted/60',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cn('rounded px-1.5 py-0.5 font-medium', log.undone_at ? 'bg-muted text-muted-foreground line-through' : 'bg-background')}>
                          {getDutyLogActionLabel(log.action)}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {log.performedByUser?.display_name || log.performedByUser?.email || ''}
                        </span>
                      </div>
                      {detailLine && (
                        <span className="truncate pl-0 text-[11px] text-muted-foreground">{detailLine}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">
                        {formatLogDateTime(log.created_at)}
                      </span>
                      {canUndo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                          onClick={() => handleUndo(log.id)}
                          disabled={undoingId === log.id}
                        >
                          {undoingId === log.id ? <LoadingSpinner className="size-3" /> : (
                            <><RotateCcw className="mr-1 size-3" />Geri Al</>
                          )}
                        </Button>
                      )}
                      {log.undone_at && (
                        <span className="text-xs italic text-muted-foreground">Geri alındı</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
