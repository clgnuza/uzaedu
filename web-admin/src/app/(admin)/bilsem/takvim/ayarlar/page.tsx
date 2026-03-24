'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Calendar,
  UserPlus,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Layers,
  Search,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type BilsemItem = {
  id: string;
  title: string;
  itemType: string;
  assignedUsers?: { userId: string; displayName: string | null; gorevTipi: string }[];
};

type BilsemWeek = {
  id: string;
  academicYear: string;
  weekNumber: number;
  title: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  sortOrder: number;
  items: BilsemItem[];
};

type Assignment = {
  id: string;
  itemId: string;
  itemTitle: string;
  weekId: string;
  userId: string;
  displayName: string | null;
  gorevTipi: string;
};

type TeacherOption = { id: string; display_name: string | null };

type SchoolOverrides = {
  hiddenItemIds: string[];
  customItems: { id: string; weekId: string; type: string; title: string; path?: string; sortOrder: number }[];
};

const ITEM_TYPE_LABELS: Record<string, string> = {
  belirli_gun_hafta: 'Belirli Gün',
  dep: 'DEP',
  tanilama: 'Tanılama',
  diger: 'Diğer',
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  belirli_gun_hafta: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  dep: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  tanilama: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
  diger: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function getAcademicYears(): string[] {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let i = -1; i < 5; i++) {
    years.push(`${startYear + i}-${startYear + i + 1}`);
  }
  return years.sort((a, b) => b.localeCompare(a));
}

function formatWeekDate(start: string | null, end: string | null): string {
  if (!start || !end) return '';
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  return `${fmt(s)} – ${fmt(e)}`;
}

function getMonthFromDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('tr-TR', { month: 'long' });
}

export default function BilsemTakvimAyarlarPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [weeks, setWeeks] = useState<BilsemWeek[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [overrides, setOverrides] = useState<SchoolOverrides>({ hiddenItemIds: [], customItems: [] });
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [addCustomOpen, setAddCustomOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ itemId: '', itemTitle: '', userId: '', gorevTipi: 'sorumlu' as 'sorumlu' | 'yardimci' });
  const [customForm, setCustomForm] = useState({ weekId: '', title: '', type: 'belirli_gun_hafta' as string });
  const [academicYear, setAcademicYear] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 8 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [mobileMenuOpen]);

  const fetchData = useCallback(async () => {
    if (!token || me?.role !== 'school_admin') return;
    setLoading(true);
    setFetchError(null);
    try {
      const [cal, asgn, usr, ov] = await Promise.all([
        apiFetch<BilsemWeek[]>(`/bilsem/calendar/template?academic_year=${encodeURIComponent(academicYear)}`, { token }),
        apiFetch<Assignment[]>(`/bilsem/calendar/assignments?academic_year=${encodeURIComponent(academicYear)}`, { token }),
        apiFetch<TeacherOption[]>('/bilsem/teachers', { token }),
        apiFetch<SchoolOverrides>('/bilsem/calendar/school-overrides', { token }),
      ]);
      setWeeks(Array.isArray(cal) ? cal : []);
      setAssignments(Array.isArray(asgn) ? asgn : []);
      setTeachers(Array.isArray(usr) ? usr : []);
      setOverrides(ov && typeof ov === 'object' ? { hiddenItemIds: ov.hiddenItemIds ?? [], customItems: ov.customItems ?? [] } : { hiddenItemIds: [], customItems: [] });
      const calWeeks = cal ?? [];
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const toExpand = new Set<string>();
      const currentWeek = calWeeks.find((w) => {
        if (!w.dateStart || !w.dateEnd) return false;
        const start = new Date(w.dateStart + 'T12:00:00');
        const end = new Date(w.dateEnd + 'T23:59:59');
        return today >= start && today <= end;
      });
      if (currentWeek) toExpand.add(currentWeek.id);
      calWeeks.slice(0, 2).forEach((w) => toExpand.add(w.id));
      setExpandedWeeks(toExpand);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : 'Veriler yüklenemedi');
      setWeeks([]);
      setAssignments([]);
      setTeachers([]);
      setOverrides({ hiddenItemIds: [], customItems: [] });
    } finally {
      setLoading(false);
    }
  }, [token, me?.role, academicYear]);

  useEffect(() => {
    if (me && me.role !== 'school_admin') {
      router.replace('/403');
      return;
    }
  }, [me, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const months = useMemo(() => {
    const set = new Set<string>();
    weeks.forEach((w) => {
      const m = getMonthFromDate(w.dateStart);
      if (m) set.add(m);
    });
    return Array.from(set).sort((a, b) => {
      const order = ['Eylül', 'Ekim', 'Kasım', 'Aralık', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [weeks]);

  const filteredWeeks = useMemo(() => {
    return weeks.filter((week) => {
      const monthMatch = !filterMonth || getMonthFromDate(week.dateStart) === filterMonth;
      const searchLower = searchQuery.trim().toLowerCase();
      const searchMatch =
        !searchLower ||
        week.items.some((i) => i.title.toLowerCase().includes(searchLower)) ||
        (week.title ?? '').toLowerCase().includes(searchLower);
      return monthMatch && searchMatch;
    });
  }, [weeks, filterMonth, searchQuery]);

  const toggleWeek = (weekId: string) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const expandAll = () => setExpandedWeeks(new Set(weeks.map((w) => w.id)));
  const collapseAll = () => setExpandedWeeks(new Set());

  const getAssignmentsForItem = (itemId: string) => assignments.filter((a) => a.itemId === itemId);
  const isHidden = (itemId: string) => overrides.hiddenItemIds.includes(itemId);

  const openAssignModal = (itemId: string, itemTitle: string) => {
    setAssignForm({ itemId, itemTitle, userId: '', gorevTipi: 'sorumlu' });
    setAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!token || !assignForm.userId) {
      toast.error('Öğretmen seçin');
      return;
    }
    try {
      await apiFetch('/bilsem/calendar/assignments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          bilsem_calendar_item_id: assignForm.itemId,
          user_id: assignForm.userId,
          gorev_tipi: assignForm.gorevTipi,
        }),
      });
      toast.success('Öğretmen atandı. Bildirim gönderildi.');
      setAssignModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Atama yapılamadı');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/bilsem/calendar/assignments/${assignmentId}`, { method: 'DELETE', token });
      toast.success('Atama kaldırıldı');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaldırılamadı');
    }
  };

  const toggleItemVisibility = async (itemId: string) => {
    if (!token) return;
    const next = isHidden(itemId)
      ? overrides.hiddenItemIds.filter((id) => id !== itemId)
      : [...overrides.hiddenItemIds, itemId];
    setOverrides((o) => ({ ...o, hiddenItemIds: next }));
    try {
      await apiFetch('/bilsem/calendar/school-overrides', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ hiddenItemIds: next, customItems: overrides.customItems ?? [] }),
      });
      toast.success(isHidden(itemId) ? 'Etkinlik gösterildi' : 'Etkinlik gizlendi');
    } catch (e) {
      setOverrides((o) => ({ ...o, hiddenItemIds: overrides.hiddenItemIds }));
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleUseFullTemplate = async () => {
    if (!token) return;
    setOverrides((o) => ({ ...o, hiddenItemIds: [] }));
    try {
      await apiFetch('/bilsem/calendar/school-overrides', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ hiddenItemIds: [], customItems: overrides.customItems ?? [] }),
      });
      toast.success('Tüm şablon etkinlikleri gösterildi');
    } catch (e) {
      setOverrides((o) => ({ ...o, hiddenItemIds: overrides.hiddenItemIds }));
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleAddCustomItem = async () => {
    if (!token || !customForm.weekId.trim() || !customForm.title.trim()) {
      toast.error('Hafta ve başlık girin');
      return;
    }
    const newItem = {
      id: crypto.randomUUID(),
      weekId: customForm.weekId,
      type: customForm.type,
      title: customForm.title.trim(),
      sortOrder: 0,
    };
    const next = [...(overrides.customItems ?? []), newItem];
    setOverrides((o) => ({ ...o, customItems: next }));
    setAddCustomOpen(false);
    setCustomForm({ weekId: '', title: '', type: 'belirli_gun_hafta' });
    try {
      await apiFetch('/bilsem/calendar/school-overrides', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ hiddenItemIds: overrides.hiddenItemIds ?? [], customItems: next }),
      });
      toast.success('Özel etkinlik eklendi');
    } catch (e) {
      setOverrides((o) => ({ ...o, customItems: overrides.customItems ?? [] }));
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    }
  };

  const handleRemoveCustomItem = async (customId: string) => {
    if (!token) return;
    const next = (overrides.customItems ?? []).filter((c) => c.id !== customId);
    setOverrides((o) => ({ ...o, customItems: next }));
    try {
      await apiFetch('/bilsem/calendar/school-overrides', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ hiddenItemIds: overrides.hiddenItemIds ?? [], customItems: next }),
      });
      toast.success('Özel etkinlik kaldırıldı');
    } catch (e) {
      setOverrides((o) => ({ ...o, customItems: overrides.customItems ?? [] }));
      toast.error(e instanceof Error ? e.message : 'Kaldırılamadı');
    }
  };

  const customItemIds = new Set((overrides.customItems ?? []).map((c) => c.id));
  const canAssign = (item: BilsemItem) => !customItemIds.has(item.id);
  const totalItems = weeks.reduce((s, w) => s + w.items.length, 0);
  const hiddenCount = overrides.hiddenItemIds.length;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-muted/30 p-4">
        <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>
            Ayarlar
            {me?.school?.name && (
              <span className="ml-2 text-base font-normal text-muted-foreground">— {me.school.name}</span>
            )}
          </ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Göster / gizle', icon: Eye },
              { label: 'Özel etkinlik', icon: Plus },
              { label: 'Sorumlu öğretmen', icon: UserPlus },
              { label: 'BİLSEM takvimi', icon: Calendar },
            ]}
            summary="Etkinlikleri göster/gizle, özel etkinlik ekleyin. Her etkinliğe sorumlu veya yardımcı öğretmen atayabilirsiniz."
          />
        </ToolbarHeading>
        <ToolbarActions>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="ay-select" className="sr-only">Öğretim yılı</Label>
            <select
              id="ay-select"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm transition-colors hover:border-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Öğretim yılı seçin"
            >
              {getAcademicYears().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="hidden sm:flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUseFullTemplate}
                title="Gizlenen tüm etkinlikleri göster"
              >
                <RotateCcw className="mr-2 size-4" />
                Şablonu Kullan
                {hiddenCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium">
                    {hiddenCount}
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setAddCustomOpen(true); setMobileMenuOpen(false); }}>
                <Plus className="mr-2 size-4" />
                Ekle
              </Button>
            </div>
            <div className="sm:hidden relative" ref={mobileMenuRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-expanded={mobileMenuOpen}
                aria-haspopup="true"
              >
                <MoreVertical className="size-4" />
              </Button>
              {mobileMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg border bg-background p-2 shadow-lg">
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => { handleUseFullTemplate(); setMobileMenuOpen(false); }}>
                    <RotateCcw className="mr-2 size-4" /> Şablonu Kullan
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start" onClick={() => { setAddCustomOpen(true); setMobileMenuOpen(false); }}>
                    <Plus className="mr-2 size-4" /> Ekle
                  </Button>
                </div>
              )}
            </div>
          </div>
        </ToolbarActions>
      </Toolbar>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {fetchError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col gap-2 pt-6">
            <span className="text-destructive">{fetchError}</span>
            <Button variant="outline" size="sm" onClick={() => fetchData()} className="w-fit">Yeniden Dene</Button>
          </CardContent>
        </Card>
      )}
      {!loading && !fetchError && weeks.length === 0 && (
        <Card soft className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Calendar className="mb-4 size-14 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">BİLSEM şablonu henüz oluşturulmamış</p>
            <p className="mt-1 text-sm text-muted-foreground">Superadmin tarafından şablon doldurulduktan sonra burada görünecektir.</p>
          </CardContent>
        </Card>
      )}
      {!loading && !fetchError && weeks.length > 0 && (
        <div className="space-y-6">
          <Card soft>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4">
              <div className="flex items-center gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Layers className="size-5 text-primary" />
                  Şablon etkinlikleri
                </h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm text-muted-foreground">
                  {totalItems} etkinlik · {weeks.length} hafta
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll}>Tümünü Aç</Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>Tümünü Kapat</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Etkinlik veya hafta ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm w-full sm:w-40"
                >
                  <option value="">Tüm aylar</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-muted-foreground">
                Superadmin tarafından tanımlanan şablon. Gizlediğiniz etkinlikler okul takviminde görünmez.
              </p>
              <div className="space-y-2">
                {filteredWeeks.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    Arama veya filtreye uygun hafta bulunamadı.
                  </p>
                ) : (
                  filteredWeeks.map((week) => {
                    const isExpanded = expandedWeeks.has(week.id);
                    const weekLabel = week.title ?? `${week.weekNumber}. Hafta`;
                    const dateRange = formatWeekDate(week.dateStart, week.dateEnd);
                    const isEmpty = week.items.length === 0;
                    return (
                      <div
                        key={week.id}
                        className={cn(
                          'rounded-xl border transition-colors',
                          isEmpty ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20' : 'border-border bg-card',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleWeek(week.id)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-xl"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{weekLabel}</span>
                            {dateRange && (
                              <span className="ml-2 text-sm text-muted-foreground">{dateRange}</span>
                            )}
                          </div>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {week.items.length} etkinlik
                          </span>
                          {isEmpty && (
                            <span className="flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              <Sparkles className="size-3" />
                              Boş
                            </span>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="border-t px-4 py-3">
                            {isEmpty ? (
                              <p className="text-sm text-muted-foreground italic">Bu haftada etkinlik yok</p>
                            ) : (
                              <ul className="space-y-2">
                                {week.items.map((item) => {
                                  const hidden = isHidden(item.id);
                                  const itemAssignments = getAssignmentsForItem(item.id);
                                  const assignable = canAssign(item);
                                  return (
                                    <li
                                      key={item.id}
                                      className={cn(
                                        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border px-4 py-3 transition-all',
                                        hidden ? 'bg-muted/40 opacity-70 border-dashed' : 'bg-card border-border hover:border-primary/20 hover:shadow-sm',
                                      )}
                                    >
                                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => toggleItemVisibility(item.id)}
                                          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                                          title={hidden ? 'Göster' : 'Gizle'}
                                        >
                                          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                          <span className="text-xs">{hidden ? 'Göster' : 'Gizle'}</span>
                                        </Button>
                                        <span
                                          className={cn(
                                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                                            ITEM_TYPE_COLORS[item.itemType] ?? 'bg-zinc-100 text-zinc-700',
                                          )}
                                        >
                                          {ITEM_TYPE_LABELS[item.itemType] ?? item.itemType}
                                        </span>
                                        <span className="truncate">{item.title}</span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        {itemAssignments.map((a) => (
                                          <span
                                            key={a.id}
                                            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-medium"
                                          >
                                            <span className="text-foreground">{a.displayName ?? '—'}</span>
                                            <span className="text-xs text-muted-foreground">({a.gorevTipi === 'sorumlu' ? 'Sorumlu' : 'Yardımcı'})</span>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveAssignment(a.id)}
                                              className="ml-0.5 rounded-full p-1 text-destructive hover:bg-destructive/10 transition-colors"
                                              title="Atamayı kaldır"
                                            >
                                              <Trash2 className="size-3.5" />
                                            </button>
                                          </span>
                                        ))}
                                        {!hidden && assignable && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openAssignModal(item.id, item.title)}
                                            className="gap-2 shrink-0"
                                          >
                                            <UserPlus className="size-4" />
                                            Öğretmen ata
                                          </Button>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {(overrides.customItems?.length ?? 0) > 0 && (
            <Card soft>
              <CardHeader>
                <h2 className="text-lg font-semibold">Özel etkinlikler</h2>
                <p className="text-sm text-muted-foreground">Okulunuza özel eklediğiniz etkinlikler</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {overrides.customItems.map((c) => {
                    const week = weeks.find((w) => w.id === c.weekId);
                    return (
                      <li
                        key={c.id}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border bg-muted/20 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                              ITEM_TYPE_COLORS[c.type] ?? 'bg-zinc-100 text-zinc-700',
                            )}
                          >
                            {ITEM_TYPE_LABELS[c.type] ?? c.type}
                          </span>
                          <span>{c.title}</span>
                          {week && (
                            <span className="text-xs text-muted-foreground">
                              ({week.title ?? `${week.weekNumber}. Hafta`})
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCustomItem(c.id)}
                          className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 w-fit"
                        >
                          <Trash2 className="size-4" />
                          Sil
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Etkinliğe öğretmen ata</DialogTitle>
          </DialogHeader>
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-medium">{assignForm.itemTitle}</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="assign-teacher">Öğretmen seçin</Label>
              <select
                id="assign-teacher"
                value={assignForm.userId}
                onChange={(e) => setAssignForm((f) => ({ ...f, userId: e.target.value }))}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm transition-colors focus:ring-2 focus:ring-ring"
              >
                <option value="">Öğretmen seçin...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.display_name ?? '—'}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-type">Rol</Label>
              <select
                id="assign-type"
                value={assignForm.gorevTipi}
                onChange={(e) => setAssignForm((f) => ({ ...f, gorevTipi: e.target.value as 'sorumlu' | 'yardimci' }))}
                className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm transition-colors focus:ring-2 focus:ring-ring"
              >
                <option value="sorumlu">Sorumlu öğretmen — Etkinlikten sorumlu</option>
                <option value="yardimci">Yardımcı öğretmen — Etkinlikte destek verir</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAssignModalOpen(false)}>İptal</Button>
            <Button onClick={handleAssign}>Ata</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addCustomOpen} onOpenChange={setAddCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Özel Etkinlik Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-week">Hafta</Label>
              <select
                id="custom-week"
                value={customForm.weekId}
                onChange={(e) => setCustomForm((f) => ({ ...f, weekId: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seçin</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title ?? `${w.weekNumber}. Hafta`} {w.dateStart && `(${formatWeekDate(w.dateStart, w.dateEnd ?? w.dateStart)})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-type">Etkinlik tipi</Label>
              <select
                id="custom-type"
                value={customForm.type}
                onChange={(e) => setCustomForm((f) => ({ ...f, type: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="belirli_gun_hafta">Belirli Gün</option>
                <option value="dep">DEP</option>
                <option value="tanilama">Tanılama</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-title">Başlık</Label>
              <Input
                id="custom-title"
                value={customForm.title}
                onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Etkinlik adı"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustomOpen(false)}>İptal</Button>
            <Button onClick={handleAddCustomItem}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
