'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  AcademicCalendarPaletteItem,
  AcademicCalendarDropZone,
  PaletteDragOverlayContent,
} from '@/components/academic-calendar/academic-calendar-timeline';
import { BELIRLI_PALETTE, OGRETMEN_PALETTE } from '@/config/academic-calendar-palette';
import { cn } from '@/lib/utils';
import { ArrowLeft, Calendar, CalendarDays, Eye, Filter, GripVertical, LayoutGrid, Plus, Trash2, UserPlus } from 'lucide-react';

const SCHOOL_TYPE_LABEL: Record<string, string> = {
  anaokul: 'Anaokul',
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
  meslek_lisesi: 'Meslek lisesi',
  imam_hatip_ortaokul: 'İmam Hatip ortaokul',
  imam_hatip_lise: 'İmam Hatip lise',
  ozel_egitim: 'Özel eğitim',
  halk_egitim: 'Halk eğitim',
  bilsem: 'BİLSEM',
};
import { toast } from 'sonner';

/** Tarih aralığını kısa formatta göster (örn: "8–12 Eyl") */
function formatDateRangeShort(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '';
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'short' })}`;
  return s.getMonth() === e.getMonth() ? `${s.getDate()}–${fmt(e)}` : `${fmt(s)} – ${fmt(e)}`;
}

/** Hafta etiketi: başlık varsa onu kullan, yoksa tarih aralığı + hafta no */
function getWeekDisplayLabel(week: WeekWithItems): string {
  const label = week.title?.trim();
  if (label) return label;
  const dateStr = formatDateRangeShort(week.dateStart, week.dateEnd);
  if (dateStr) return `${dateStr} (${week.weekNumber ?? week.weekOrder ?? '?'}. Hafta)`;
  return `${week.weekNumber ?? week.weekOrder ?? '?'}. Hafta`;
}

type WeekWithItems = {
  id: string;
  weekNumber: number;
  weekOrder?: number;
  ay?: string;
  title: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  isTatil?: boolean;
  belirliGunHafta: { id: string; title: string }[];
  ogretmenIsleri: { id: string; title: string }[];
};

type Overrides = {
  hiddenItemIds: string[];
  customItems: { id: string; weekId: string; type: string; title: string; path?: string; sortOrder: number }[];
};

type Assignment = {
  id: string;
  itemId: string;
  itemTitle: string;
  weekId: string;
  userId: string;
  userName: string;
  gorevTipi: string;
};

type TeacherOption = { id: string; display_name: string | null; email: string };

export default function AkademikTakvimAyarlarPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [weeks, setWeeks] = useState<WeekWithItems[]>([]);
  const [overrides, setOverrides] = useState<Overrides>({ hiddenItemIds: [], customItems: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ weekId: '', type: 'ogretmen_isleri' as 'belirli_gun_hafta' | 'ogretmen_isleri', title: '', path: '' });
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ itemId: '', itemTitle: '', userId: '', gorevTipi: 'sorumlu' as 'sorumlu' | 'yardimci' });
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [activePaletteDrag, setActivePaletteDrag] = useState<{ title: string; variant: 'belirli' | 'ogretmen' } | null>(null);
  /** Mobil / dar ekran: palet vs hafta listesi */
  const [sectionTab, setSectionTab] = useState<'palet' | 'haftalar'>('haftalar');
  const academicYear = '2025-2026';

  const paletteQ = paletteQuery.trim().toLowerCase();
  const belirliPaletteFiltered = paletteQ
    ? BELIRLI_PALETTE.filter((t) => t.toLowerCase().includes(paletteQ))
    : BELIRLI_PALETTE;
  const ogretmenPaletteFiltered = paletteQ
    ? OGRETMEN_PALETTE.filter(({ title }) => title.toLowerCase().includes(paletteQ))
    : OGRETMEN_PALETTE;

  const fetchData = useCallback(async () => {
    if (!token || me?.role !== 'school_admin') return;
    setLoading(true);
    try {
      const [tpl, ov, asgn, usr] = await Promise.all([
        apiFetch<WeekWithItems[]>(`/academic-calendar/template?academic_year=${encodeURIComponent(academicYear)}`, { token }),
        apiFetch<Overrides>('/academic-calendar/school-overrides', { token }),
        apiFetch<Assignment[]>(`/academic-calendar/assignments?academic_year=${encodeURIComponent(academicYear)}`, { token }),
        apiFetch<{ items?: TeacherOption[] }>('/users?role=teacher&limit=100', { token }).then((r) => r?.items ?? []),
      ]);
      setWeeks(Array.isArray(tpl) ? tpl : []);
      setOverrides(ov ?? { hiddenItemIds: [], customItems: [] });
      setAssignments(Array.isArray(asgn) ? asgn : []);
      setTeachers(Array.isArray(usr) ? usr : []);
    } catch {
      setWeeks([]);
      setOverrides({ hiddenItemIds: [], customItems: [] });
      setAssignments([]);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, [token, me?.role]);

  useEffect(() => {
    if (me && me.role !== 'school_admin') {
      router.replace('/403');
      return;
    }
  }, [me, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleHidden = (id: string) => {
    const next = overrides.hiddenItemIds.includes(id)
      ? overrides.hiddenItemIds.filter((x) => x !== id)
      : [...overrides.hiddenItemIds, id];
    setOverrides((o) => ({ ...o, hiddenItemIds: next }));
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch('/academic-calendar/school-overrides', {
        method: 'PATCH',
        token,
        body: JSON.stringify(overrides),
      });
      toast.success('Ayarlar kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustom = () => {
    if (!customForm.title.trim() || !customForm.weekId) {
      toast.error('Hafta ve başlık zorunludur');
      return;
    }
    const id = `custom-${Date.now()}`;
    const newItem = {
      id,
      weekId: customForm.weekId,
      type: customForm.type,
      title: customForm.title.trim(),
      path: customForm.path.trim() || undefined,
      sortOrder: 0,
    };
    setOverrides((o) => ({ ...o, customItems: [...(o.customItems ?? []), newItem] }));
    setCustomForm({ weekId: '', type: 'ogretmen_isleri', title: '', path: '' });
    setCustomModalOpen(false);
    toast.success('Özel öğe eklendi');
  };

  const handleRemoveCustom = (id: string) => {
    setOverrides((o) => ({ ...o, customItems: (o.customItems ?? []).filter((c) => c.id !== id) }));
  };

  const getWeekLabel = (weekId: string) => {
    const w = weeks.find((x) => x.id === weekId);
    return w ? getWeekDisplayLabel(w) : weekId.slice(0, 8);
  };

  /** Ay bazlı gruplama (EYLÜL, EKİM, ...) */
  const weeksByMonth = weeks.reduce<Map<string, WeekWithItems[]>>((acc, w) => {
    const key = w.ay || (w.dateStart ? new Date(w.dateStart + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'long' }).toUpperCase() : 'Diğer');
    const list = acc.get(key) ?? [];
    list.push(w);
    acc.set(key, list);
    return acc;
  }, new Map());
  const monthOrder = ['EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN'];
  const sortedMonths = Array.from(weeksByMonth.keys()).sort((a, b) => {
    const ia = monthOrder.indexOf(a);
    const ib = monthOrder.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return String(a).localeCompare(String(b));
  });

  /** Ay + metin süzmesi sonucu gösterilecek aylar ve haftalar */
  const filteredMonths = filterMonth ? (sortedMonths.includes(filterMonth) ? [filterMonth] : sortedMonths) : sortedMonths;
  const searchLower = filterSearch.trim().toLowerCase();
  const weekMatchesSearch = (w: WeekWithItems) => {
    if (!searchLower) return true;
    const label = getWeekDisplayLabel(w).toLowerCase();
    if (label.includes(searchLower)) return true;
    for (const i of w.belirliGunHafta) if (i.title.toLowerCase().includes(searchLower)) return true;
    for (const i of w.ogretmenIsleri) if (i.title.toLowerCase().includes(searchLower)) return true;
    return false;
  };
  const filteredWeeksByMonth = new Map<string, WeekWithItems[]>();
  for (const m of filteredMonths) {
    const list = (weeksByMonth.get(m) ?? []).filter(weekMatchesSearch);
    if (list.length > 0) filteredWeeksByMonth.set(m, list);
  }

  const getAssignmentsForItem = (itemId: string) => assignments.filter((a) => a.itemId === itemId);

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
      await apiFetch('/academic-calendar/assignments', {
        method: 'POST',
        token,
        body: JSON.stringify({
          item_id: assignForm.itemId,
          user_id: assignForm.userId,
          gorev_tipi: assignForm.gorevTipi,
        }),
      });
      toast.success('Görevlendirme yapıldı. Öğretmene bildirim gönderildi.');
      setAssignModalOpen(false);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Görevlendirilemedi');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/academic-calendar/assignments/${assignmentId}`, { method: 'DELETE', token });
      toast.success('Görevlendirme kaldırıldı');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaldırılamadı');
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handlePaletteDragStart = (event: DragStartEvent) => {
    const d = event.active.data?.current as
      | { type?: string; section?: 'belirli' | 'ogretmen'; title?: string }
      | undefined;
    if (d?.type === 'palette' && d.title && d.section) setActivePaletteDrag({ title: d.title, variant: d.section });
  };

  const handleDropFromPalette = (event: DragEndEvent) => {
    const activeData = event.active.data?.current as
      | { type?: string; section?: 'belirli' | 'ogretmen'; title?: string; path?: string }
      | undefined;
    const overId = String(event.over?.id ?? '');
    if (activeData?.type !== 'palette' || !overId.startsWith('drop__') || !activeData.title) return;
    const [, weekId, section] = overId.split('__');
    if (!weekId || !section) return;
    const path =
      section === 'ogretmen'
        ? OGRETMEN_PALETTE.find((p) => p.title === activeData.title)?.path ?? '/evrak'
        : undefined;
    const type = section === 'belirli' ? 'belirli_gun_hafta' : 'ogretmen_isleri';
    const duplicate = (overrides.customItems ?? []).some(
      (c) => c.weekId === weekId && c.type === type && c.title === activeData.title,
    );
    if (duplicate) {
      toast.error('Bu öğe bu haftada zaten ekli.');
      return;
    }
    const maxOrder = Math.max(0, ...(overrides.customItems ?? []).filter((c) => c.weekId === weekId).map((c) => c.sortOrder));
    const newItem = {
      id: `custom-${Date.now()}`,
      weekId,
      type,
      title: activeData.title,
      path,
      sortOrder: maxOrder + 1,
    };
    setOverrides((o) => ({ ...o, customItems: [...(o.customItems ?? []), newItem] }));
    toast.success(`"${activeData.title}" eklendi. Kaydet butonuna basın.`);
  };

  const schoolTypeKey = me?.school?.type ?? '';
  const schoolTypeLabel = schoolTypeKey ? SCHOOL_TYPE_LABEL[schoolTypeKey] ?? schoolTypeKey : null;

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  const toolbarSummary =
    schoolTypeLabel
      ? `Kurum türü (${schoolTypeLabel}) şablonu yüklendi. Öğeleri gizleyin, listeden özel öğe ekleyin veya paletten sürükleyip bırakın. Kaydet ile kaydedilir.`
      : 'Okulunuzun akademik takviminde hangi öğelerin görüneceğini yönetin. Gizleyebilir veya özel öğe ekleyebilirsiniz.';

  return (
    <div className="space-y-4 pb-6 sm:space-y-6 sm:pb-8">
      <Toolbar className="max-sm:border-0 max-sm:pb-2 sm:pb-5">
        <div className="min-w-0 flex-1">
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base sm:text-xl lg:text-2xl">Akademik takvim ayarları</ToolbarPageTitle>
          <p className="text-xs leading-snug text-muted-foreground sm:hidden">
            {toolbarSummary.length > 130 ? `${toolbarSummary.slice(0, 128)}…` : toolbarSummary}
          </p>
          <ToolbarIconHints
            showOnMobile
            compact
            items={[
              { label: 'Görünürlük', icon: Eye },
              { label: 'Özel öğe', icon: Plus },
              { label: 'Takvim', icon: Calendar },
            ]}
            summary={toolbarSummary}
          />
        </ToolbarHeading>
        </div>
        <ToolbarActions>
          <Button variant="outline" size="sm" asChild className="max-sm:min-h-11">
            <Link href="/akademik-takvim">
              <ArrowLeft className="mr-2 size-4 shrink-0" aria-hidden />
              <span className="max-sm:truncate">Takvime dön</span>
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={saving} className="max-sm:min-h-11 sm:min-w-22">
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </ToolbarActions>
      </Toolbar>

      {weeks.length > 0 && (
        <div
          role="tablist"
          aria-label="Bölüm seçin"
          className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'palet'}
            onClick={() => setSectionTab('palet')}
            className={cn(
              'flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all sm:min-h-0 sm:px-4',
              sectionTab === 'palet'
                ? 'bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-400/35'
                : 'bg-amber-500/14 text-amber-950 dark:bg-amber-500/18 dark:text-amber-50',
            )}
          >
            <LayoutGrid className="size-4 shrink-0 opacity-95" aria-hidden />
            Paletten sürükle
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sectionTab === 'haftalar'}
            onClick={() => setSectionTab('haftalar')}
            className={cn(
              'flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all sm:min-h-0 sm:px-4',
              sectionTab === 'haftalar'
                ? 'bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-violet-500/25 ring-2 ring-violet-400/35'
                : 'bg-violet-500/14 text-violet-950 dark:bg-violet-500/18 dark:text-violet-50',
            )}
          >
            <CalendarDays className="size-4 shrink-0 opacity-95" aria-hidden />
            Haftalar & öğeler
          </button>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}
      {!loading && (
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={handlePaletteDragStart}
          onDragCancel={() => setActivePaletteDrag(null)}
          onDragEnd={(e) => {
            handleDropFromPalette(e);
            setActivePaletteDrag(null);
          }}
        >
          <div className="space-y-4 sm:space-y-6">
            {weeks.length > 0 && (
              <div
                className={cn(
                  'sticky top-(--header-height) z-20 my-1 max-h-[min(36vh,260px)] overflow-y-auto overscroll-contain rounded-xl border border-dashed border-amber-500/45 bg-background/95 p-2 shadow-md backdrop-blur-sm supports-backdrop-filter:bg-background/90 dark:border-amber-500/30 sm:my-2 sm:max-h-[min(44vh,340px)] sm:border-primary/40 sm:p-3 sm:dark:border-primary/35',
                  sectionTab !== 'palet' && 'hidden sm:block',
                )}
              >
              <div className="space-y-3 rounded-xl border border-dashed border-amber-400/25 bg-linear-to-br from-amber-500/8 via-primary/5 to-sky-500/8 p-2.5 sm:space-y-4 sm:border-primary/20 sm:p-4">
                {schoolTypeLabel && (
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    <span className="font-medium text-foreground">Şablon:</span> {schoolTypeLabel}
                    {me?.school?.name ? ` · ${me.school.name}` : ''}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                    <span className="font-medium text-foreground">Sürükle-bırak:</span> ~8 px sürükleyin; hafta kartındaki{' '}
                    <span className="text-amber-700 dark:text-amber-400">turuncu</span> veya{' '}
                    <span className="text-sky-700 dark:text-sky-400">mavi</span> alana bırakın.
                  </p>
                  <Input
                    placeholder="Paletten ara…"
                    value={paletteQuery}
                    onChange={(e) => setPaletteQuery(e.target.value)}
                    className="h-9 w-full text-sm sm:max-w-xs"
                    aria-label="Paletten ara"
                  />
                </div>
                <div>
                  <h3 className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground sm:mb-2 sm:gap-2 sm:text-sm">
                    <GripVertical className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400 sm:size-4" aria-hidden />
                    <span className="text-amber-800 dark:text-amber-200">Belirli gün / hafta</span>
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground sm:text-xs">{belirliPaletteFiltered.length} öğe</span>
                  </h3>
                  <details open className="text-muted-foreground">
                    <summary className="cursor-pointer text-[11px] font-medium sm:text-xs">Liste (aç / kapa)</summary>
                    <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-amber-200/60 bg-background/70 p-2 dark:border-amber-900/40 sm:max-h-32 sm:gap-2">
                      {belirliPaletteFiltered.length === 0 ? (
                        <span className="w-full py-4 text-center text-xs text-muted-foreground">Arama sonucu yok.</span>
                      ) : (
                        belirliPaletteFiltered.map((title) => (
                          <AcademicCalendarPaletteItem
                            key={title}
                            id={`palette-belirli-${title}`}
                            title={title}
                            variant="belirli"
                          />
                        ))
                      )}
                    </div>
                  </details>
                </div>
                <div>
                  <h3 className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground sm:mb-2 sm:gap-2 sm:text-sm">
                    <GripVertical className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400 sm:size-4" aria-hidden />
                    <span className="text-sky-800 dark:text-sky-200">Öğretmen işleri</span>
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground sm:text-xs">{ogretmenPaletteFiltered.length} öğe</span>
                  </h3>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-sky-200/60 bg-background/70 p-2 dark:border-sky-900/40 sm:max-h-36 sm:gap-2">
                    {ogretmenPaletteFiltered.length === 0 ? (
                      <span className="w-full py-4 text-center text-xs text-muted-foreground">Arama sonucu yok.</span>
                    ) : (
                      ogretmenPaletteFiltered.map(({ title }) => (
                        <AcademicCalendarPaletteItem
                          key={title}
                          id={`palette-ogretmen-${title}`}
                          title={title}
                          variant="ogretmen"
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}

            <Card
              className={cn(
                'overflow-hidden border-border/80 shadow-sm',
                weeks.length > 0 && sectionTab !== 'haftalar' && 'hidden sm:block',
              )}
            >
              <CardContent className="p-4 pt-5 sm:p-6 sm:pt-6">
                <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <h3 className="text-sm font-bold text-foreground sm:text-base">Haftalık öğeler</h3>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-violet-200/70 bg-violet-500/8 px-2.5 py-1 dark:border-violet-500/25 sm:w-auto sm:min-w-0">
                      <Filter className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent text-sm focus:ring-0"
                        aria-label="Ay filtresi"
                      >
                        <option value="">Tüm aylar</option>
                        {sortedMonths.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <Input
                      placeholder="Hafta veya öğe ara…"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="h-10 w-full text-sm sm:h-8 sm:w-48"
                    />
                  </div>
                  <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full min-h-10 shrink-0 sm:w-auto">
                        <Plus className="mr-2 size-4 shrink-0" />
                        Özel öğe ekle
                      </Button>
                    </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Özel Öğe Ekle</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label htmlFor="week">Hafta *</Label>
                        <select
                          id="week"
                          value={customForm.weekId}
                          onChange={(e) => setCustomForm((f) => ({ ...f, weekId: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="">— Hafta seçin —</option>
                          {sortedMonths.map((monthKey) => {
                            const monthWeeks = weeksByMonth.get(monthKey) ?? [];
                            return (
                              <optgroup key={monthKey} label={monthKey}>
                                {monthWeeks.map((w) => (
                                  <option key={w.id} value={w.id}>
                                    {getWeekDisplayLabel(w)}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })}
                        </select>
                      </div>
                      <div>
                        <Label>Tür</Label>
                        <div className="flex gap-4 pt-2">
                          <label className="flex items-center gap-2">
                            <input type="radio" checked={customForm.type === 'belirli_gun_hafta'} onChange={() => setCustomForm((f) => ({ ...f, type: 'belirli_gun_hafta' }))} />
                            Belirli Gün ve Haftalar
                          </label>
                          <label className="flex items-center gap-2">
                            <input type="radio" checked={customForm.type === 'ogretmen_isleri'} onChange={() => setCustomForm((f) => ({ ...f, type: 'ogretmen_isleri' }))} />
                            Öğretmen İşleri
                          </label>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="title">Başlık *</Label>
                        <Input
                          id="title"
                          value={customForm.title}
                          onChange={(e) => setCustomForm((f) => ({ ...f, title: e.target.value }))}
                          placeholder="Örn: Okulumuza Özel Etkinlik"
                        />
                      </div>
                      {customForm.type === 'ogretmen_isleri' && (
                        <div>
                          <Label htmlFor="path">Yol</Label>
                          <Input
                            id="path"
                            value={customForm.path}
                            onChange={(e) => setCustomForm((f) => ({ ...f, path: e.target.value }))}
                            placeholder="/evrak"
                          />
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCustomModalOpen(false)}>
                        İptal
                      </Button>
                      <Button onClick={handleAddCustom}>Ekle</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                    <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Öğretmen Görevlendir</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">{assignForm.itemTitle}</p>
                        <div className="grid gap-4 py-4">
                          <div>
                            <Label htmlFor="teacher">Öğretmen *</Label>
                            <select
                              id="teacher"
                              value={assignForm.userId}
                              onChange={(e) => setAssignForm((f) => ({ ...f, userId: e.target.value }))}
                              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                            >
                              <option value="">— Seçin —</option>
                              {teachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.display_name || t.email}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label>Görev tipi</Label>
                            <div className="flex gap-4 pt-2">
                              <label className="flex items-center gap-2">
                                <input type="radio" checked={assignForm.gorevTipi === 'sorumlu'} onChange={() => setAssignForm((f) => ({ ...f, gorevTipi: 'sorumlu' }))} />
                                Sorumlu
                              </label>
                              <label className="flex items-center gap-2">
                                <input type="radio" checked={assignForm.gorevTipi === 'yardimci'} onChange={() => setAssignForm((f) => ({ ...f, gorevTipi: 'yardimci' }))} />
                                Yardımcı
                              </label>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setAssignModalOpen(false)}>
                            İptal
                          </Button>
                          <Button onClick={handleAssign}>Görevlendir</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
              </div>
              <div className="space-y-6 sm:space-y-8">
                {filteredMonths.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {filterSearch.trim() ? 'Arama kriterlerine uygun hafta bulunamadı.' : 'Henüz hafta yok.'}
                  </p>
                )}
                {filteredMonths.map((monthKey) => {
                  const monthWeeks = filteredWeeksByMonth.get(monthKey) ?? [];
                  return (
                    <div key={monthKey} className="space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-2 rounded-xl bg-linear-to-r from-violet-500/15 via-indigo-500/10 to-fuchsia-500/10 px-3 py-2 ring-1 ring-violet-200/50 dark:from-violet-500/20 dark:via-indigo-500/15 dark:ring-violet-500/20 sm:px-4 sm:py-2.5">
                        <Calendar className="size-4 shrink-0 text-violet-600 dark:text-violet-400 sm:size-5" aria-hidden />
                        <h4 className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-violet-950 dark:text-violet-100 sm:text-base">
                          {monthKey}
                        </h4>
                        <span className="ml-auto shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold text-violet-800 shadow-sm dark:bg-violet-950/60 dark:text-violet-200 sm:text-sm">
                          {monthWeeks.length} hafta
                        </span>
                      </div>
                      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
                        {monthWeeks.map((week) => {
                          const weekCustomBelirli = (overrides.customItems ?? []).filter((c) => c.weekId === week.id && c.type === 'belirli_gun_hafta');
                          const weekCustomOgretmen = (overrides.customItems ?? []).filter((c) => c.weekId === week.id && c.type === 'ogretmen_isleri');
                          return (
                            <Card
                              key={week.id}
                              className={cn(
                                'overflow-hidden shadow-sm transition-shadow hover:shadow-md sm:shadow-md sm:hover:shadow-lg',
                                week.isTatil
                                  ? 'border-l-[3px] border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/25'
                                  : 'border-l-[3px] border-l-violet-500 bg-card dark:border-l-violet-400',
                              )}
                            >
                              <div className="border-b border-border/60 bg-muted/35 px-3 py-2.5 sm:px-4 sm:py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <span
                                    className={cn(
                                      'text-xs font-bold leading-snug sm:text-sm',
                                      week.isTatil ? 'text-amber-800 dark:text-amber-300' : 'text-foreground',
                                    )}
                                  >
                                    {getWeekDisplayLabel(week)}
                                  </span>
                                  {week.isTatil && (
                                    <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100 sm:text-xs">
                                      Tatil
                                    </span>
                                  )}
                                </div>
                              </div>
                              <CardContent className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">
                                {week.belirliGunHafta.length > 0 && (
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 sm:text-xs">
                                    Belirli gün / hafta
                                  </div>
                                )}
                        {week.belirliGunHafta.map((item) => {
                          const itemAssignments = getAssignmentsForItem(item.id);
                          const isTemplateItem = !item.id.startsWith('custom-');
                          return (
                            <div key={item.id} className="space-y-1.5 rounded-lg border border-amber-200/50 bg-amber-500/5 p-2 dark:border-amber-900/35 sm:p-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 text-xs leading-snug text-amber-900 dark:text-amber-200 sm:text-sm">
                                  ★ {item.title}
                                </span>
                                <label className="flex shrink-0 items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground sm:text-xs">
                                    {overrides.hiddenItemIds.includes(item.id) ? 'Gizli' : 'Açık'}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={!overrides.hiddenItemIds.includes(item.id)}
                                    onChange={() => toggleHidden(item.id)}
                                    className="size-4.5 rounded border-amber-300 sm:size-4"
                                    aria-label={item.title}
                                  />
                                </label>
                              </div>
                              {isTemplateItem && (
                                <div className="flex flex-wrap items-center gap-1.5 border-t border-amber-200/40 pt-2 dark:border-amber-900/30 sm:gap-2">
                                  {itemAssignments.map((a) => (
                                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
                                      <span>{a.userName} ({a.gorevTipi})</span>
                                      <button type="button" onClick={() => handleRemoveAssignment(a.id)} className="rounded p-0.5 hover:bg-destructive/20" aria-label="Kaldır">
                                        <Trash2 className="size-3" />
                                      </button>
                                    </span>
                                  ))}
                                  <Button variant="outline" size="sm" className="h-8 gap-1 text-xs sm:h-7" onClick={() => openAssignModal(item.id, item.title)}>
                                    <UserPlus className="size-3.5 shrink-0 sm:size-3" />
                                    Görevlendir
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <AcademicCalendarDropZone weekId={week.id} section="belirli" isEmpty={weekCustomBelirli.length === 0}>
                          {weekCustomBelirli.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {weekCustomBelirli.map((c) => (
                                <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                  ★ {c.title}
                                  <button type="button" onClick={() => handleRemoveCustom(c.id)} className="rounded p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800" aria-label="Kaldır">
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </AcademicCalendarDropZone>
                                {week.ogretmenIsleri.length > 0 && (
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-400 sm:text-xs">
                                    Öğretmen işleri
                                  </div>
                                )}
                        {week.ogretmenIsleri.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2 rounded-lg border border-sky-200/55 bg-sky-500/5 px-2 py-2 dark:border-sky-900/35 sm:px-2.5 sm:py-1.5"
                          >
                            <span className="min-w-0 text-xs leading-snug text-sky-900 dark:text-sky-200 sm:text-sm">{item.title}</span>
                            <label className="flex shrink-0 items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground sm:text-xs">
                                {overrides.hiddenItemIds.includes(item.id) ? 'Gizli' : 'Açık'}
                              </span>
                              <input
                                type="checkbox"
                                checked={!overrides.hiddenItemIds.includes(item.id)}
                                onChange={() => toggleHidden(item.id)}
                                className="size-4.5 rounded border-sky-300 sm:size-4"
                                aria-label={item.title}
                              />
                            </label>
                          </div>
                        ))}
                        <AcademicCalendarDropZone weekId={week.id} section="ogretmen" isEmpty={weekCustomOgretmen.length === 0}>
                          {weekCustomOgretmen.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {weekCustomOgretmen.map((c) => (
                                <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
                                  {c.title}
                                  <button type="button" onClick={() => handleRemoveCustom(c.id)} className="rounded p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800" aria-label="Kaldır">
                                    <Trash2 className="size-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </AcademicCalendarDropZone>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

            {(overrides.customItems?.length ?? 0) > 0 && (
              <Card
                className={cn(
                  'overflow-hidden border-teal-200/60 shadow-sm dark:border-teal-900/30',
                  weeks.length > 0 && sectionTab !== 'haftalar' && 'hidden sm:block',
                )}
              >
                <CardContent className="p-4 pt-5 sm:p-6 sm:pt-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-teal-900 dark:text-teal-100 sm:mb-4 sm:text-base">
                    <span className="rounded-lg bg-teal-500/15 px-2 py-0.5 text-xs font-bold text-teal-800 dark:bg-teal-500/25 dark:text-teal-200">
                      {overrides.customItems!.length}
                    </span>
                    Özel öğeler
                  </h3>
                  <ul className="space-y-2">
                    {overrides.customItems!.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start justify-between gap-2 rounded-xl border border-teal-200/50 bg-teal-500/5 p-3 dark:border-teal-900/35"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-foreground">{c.title}</span>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {getWeekLabel(c.weekId)} · {c.type === 'belirli_gun_hafta' ? 'Belirli gün' : 'Öğretmen işleri'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCustom(c.id)}
                          className="size-10 shrink-0 text-destructive sm:size-9"
                          aria-label="Kaldır"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
            {activePaletteDrag ? (
              <PaletteDragOverlayContent title={activePaletteDrag.title} variant={activePaletteDrag.variant} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
