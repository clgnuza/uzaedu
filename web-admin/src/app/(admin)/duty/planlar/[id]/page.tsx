'use client';

import { useState, useEffect, useCallback } from 'react';
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
import * as XLSX from 'xlsx';

type UserItem = { id: string; display_name: string | null; email: string };
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
  slots?: DutySlot[];
};

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('tr-TR');
}

export default function DutyPlanDetayPage() {
  const params = useParams();
  const router = useRouter();
  const { token, me } = useAuth();
  const planId = params.id as string;
  const isAdmin = me?.role === 'school_admin';

  const [plan, setPlan] = useState<DutyPlan | null>(null);
  const [teachers, setTeachers] = useState<UserItem[]>([]);
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
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [dragSlotId, setDragSlotId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);

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
      await Promise.all([fetchPlan(), fetchRecentLogs()]);
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

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  useEffect(() => {
    if (isAdmin) fetchTeachers();
  }, [isAdmin, fetchTeachers]);

  useEffect(() => {
    if (isAdmin) fetchRecentLogs();
  }, [isAdmin, fetchRecentLogs]);

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
      fetchPlan();
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
      setNewSlot({ date: '', shift: 'morning', area_name: '', slot_start_time: '', slot_end_time: '', user_id: '' });
      fetchPlan();
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
      fetchPlan();
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
      fetchPlan();
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
      fetchPlan();
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
  const canEdit = isAdmin && plan.status === 'draft';

  // Gün bazlı gruplama – aynı gün aynı arka plan rengi
  const DAY_GROUP_COLORS = [
    'bg-sky-50/80 dark:bg-sky-950/20',
    'bg-emerald-50/80 dark:bg-emerald-950/20',
    'bg-amber-50/80 dark:bg-amber-950/20',
    'bg-violet-50/80 dark:bg-violet-950/20',
    'bg-rose-50/80 dark:bg-rose-950/20',
    'bg-teal-50/80 dark:bg-teal-950/20',
  ];
  // Öğretmen (nöbet) satırları – her kart farklı renkte (sırayla)
  const SLOT_ROW_COLORS = [
    'bg-white dark:bg-slate-900 border-sky-200 dark:border-sky-800',
    'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700',
    'bg-blue-50/90 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    'bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    'bg-violet-50/90 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800',
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
          {canEdit && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing || slots.length === 0}
            >
              <Send className="size-4" />
              Yayınla
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

      {canEdit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Yeni Nöbet Ekle</CardTitle>
          </CardHeader>
          <CardContent>
            {adding ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                <div className="space-y-1">
                  <Label>Tarih</Label>
                  <Input
                    type="date"
                    value={newSlot.date}
                    onChange={(e) => setNewSlot((s) => ({ ...s, date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Vardiya</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={newSlot.shift}
                    onChange={(e) => setNewSlot((s) => ({ ...s, shift: e.target.value as 'morning' | 'afternoon' }))}
                  >
                    <option value="morning">Sabah</option>
                    <option value="afternoon">Öğle</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Öğretmen</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={newSlot.user_id}
                    onChange={(e) => setNewSlot((s) => ({ ...s, user_id: e.target.value }))}
                  >
                    <option value="">Seçin</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name || t.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Alan</Label>
                  <Input
                    placeholder="Koridor, Bahçe..."
                    value={newSlot.area_name}
                    onChange={(e) => setNewSlot((s) => ({ ...s, area_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Giriş</Label>
                  <Input
                    type="text"
                    placeholder="08:00"
                    value={newSlot.slot_start_time}
                    onChange={(e) => setNewSlot((s) => ({ ...s, slot_start_time: e.target.value }))}
                    maxLength={5}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Çıkış</Label>
                  <Input
                    type="text"
                    placeholder="15:30"
                    value={newSlot.slot_end_time}
                    onChange={(e) => setNewSlot((s) => ({ ...s, slot_end_time: e.target.value }))}
                    maxLength={5}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddSlot} disabled={saving || !newSlot.user_id || !newSlot.date}>
                    {saving ? 'Ekleniyor…' : 'Ekle'}
                  </Button>
                  <Button variant="ghost" onClick={() => setAdding(false)}>İptal</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <Plus className="size-4" />
                Yeni Nöbet Ekle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Son İşlemler paneli */}
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
                      <span className={cn('px-1.5 py-0.5 rounded font-medium', log.undone_at ? 'bg-muted text-muted-foreground line-through' : 'bg-background')}>
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

      <Card className="overflow-hidden rounded-xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Nöbet Kayıtları</CardTitle>
          {slots.length > 0 && (
            <div className="flex rounded-xl border border-border bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  viewMode === 'list'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                <List className="size-4" />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  viewMode === 'calendar'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                <Calendar className="size-4" />
                Takvim (sürükle-bırak)
              </button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {slots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Henüz nöbet kaydı yok.
              {canEdit && ' Yukarıdan ekleyebilirsiniz.'}
            </p>
          ) : viewMode === 'calendar' ? (
            <div className="p-5 space-y-4">
              {canEdit && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
                  <p className="text-sm text-muted-foreground">
                    Nöbet kartını başka bir nöbet kartının üzerine <strong className="text-foreground">sürükleyip bırakarak</strong> iki öğretmenin nöbetini takas edebilirsiniz.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 min-[900px]:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
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
                              <div className="p-2 space-y-2 min-h-[44px]">
                                {daySlots.map((slot, slotIdx) => (
                                  <div
                                    key={slot.id}
                                    {...(canEdit ? {
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
                                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all',
                                      SLOT_ROW_COLORS[slotIdx % SLOT_ROW_COLORS.length],
                                      canEdit && 'cursor-grab active:cursor-grabbing hover:shadow-md',
                                      canEdit && dragSlotId === slot.id && 'opacity-50 scale-[0.98]',
                                    )}
                                  >
                                    {canEdit && <GripVertical className="size-4 text-muted-foreground shrink-0" />}
                                    <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold', slot.shift === 'afternoon' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300')}>
                                      {slot.shift === 'afternoon' ? 'Öğle' : 'Sabah'}
                                    </span>
                                    <span className="truncate font-medium min-w-0">{slot.user?.display_name || slot.user?.email || '—'}</span>
                                    {slot.area_name && <span className="text-[10px] text-muted-foreground truncate shrink-0 max-w-[70px]">{slot.area_name}</span>}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide">Tarih</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide">Vardiya</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide">Öğretmen</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide">Alan</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide">Giriş</th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide">Çıkış</th>
                    {canEdit && <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wide">İşlem</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.flatMap((date, dateIdx) => {
                    const daySlots = slotsByDate[date];
                    const rowBg = DAY_GROUP_COLORS[dateIdx % DAY_GROUP_COLORS.length];
                    return daySlots.map((slot, idx) => (
                    <tr
                      key={slot.id}
                      className={cn(
                        'border-t border-border/60 hover:bg-muted/50 transition-colors',
                        rowBg,
                        idx === 0 && 'border-t-2 border-t-border',
                      )}
                    >
                      {editingId === slot.id && editRow ? (
                        <>
                          <td className="px-4 py-2.5">
                            <Input
                              type="date"
                              value={editRow.date}
                              onChange={(e) => setEditRow((r) => (r ? { ...r, date: e.target.value } : r))}
                              className="h-8 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              className="flex h-8 w-28 rounded-md border border-input bg-transparent px-2 text-sm"
                              value={editRow.shift}
                              onChange={(e) => setEditRow((r) => (r ? { ...r, shift: e.target.value as 'morning' | 'afternoon' } : r))}
                            >
                              <option value="morning">Sabah</option>
                              <option value="afternoon">Öğle</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              className="flex h-8 w-full max-w-[180px] rounded-md border border-input bg-transparent px-2 text-sm"
                              value={editRow.user_id}
                              onChange={(e) => setEditRow((r) => (r ? { ...r, user_id: e.target.value } : r))}
                            >
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.display_name || t.email}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={editRow.area_name}
                              onChange={(e) => setEditRow((r) => (r ? { ...r, area_name: e.target.value } : r))}
                              className="h-8 text-sm max-w-[120px]"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={editRow.slot_start_time}
                              onChange={(e) => setEditRow((r) => (r ? { ...r, slot_start_time: e.target.value } : r))}
                              className="h-8 w-20 text-sm"
                              maxLength={5}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              value={editRow.slot_end_time}
                              onChange={(e) => setEditRow((r) => (r ? { ...r, slot_end_time: e.target.value } : r))}
                              className="h-8 w-20 text-sm"
                              maxLength={5}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                              <Check className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                              <X className="size-4" />
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5">
                            {idx === 0 ? (
                              <span className="font-semibold text-foreground">{formatDate(slot.date)}</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', slot.shift === 'afternoon' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300')}>
                              {slot.shift === 'afternoon' ? 'Öğle' : 'Sabah'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-medium">
                            {slot.user?.display_name || slot.user?.email || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{slot.area_name || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{slot.slot_start_time || '—'}</td>
                          <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{slot.slot_end_time || '—'}</td>
                          {canEdit && (
                            <td className="px-4 py-2.5 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleStartEdit(slot)}
                                disabled={!!editingId}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-rose-600 hover:text-rose-700"
                                onClick={() => handleDeleteSlot(slot.id)}
                                disabled={!!deletingId}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
