'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { PaletteDragOverlayContent } from '@/components/academic-calendar/academic-calendar-timeline';
import { BELIRLI_PALETTE, OGRETMEN_PALETTE } from '@/config/academic-calendar-palette';
import { toast } from 'sonner';
import { formatAcademicWeekHeading } from '@/lib/academic-week-label';
import {
  AcademicCalendarSettingsView,
  type SettingsAssignment,
  type SettingsOverrides,
  type SettingsSectionTab,
  type SettingsWeek,
} from './academic-calendar-settings-view';

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
  bilsem: 'Bilsem',
};

const DEFAULT_ACADEMIC_YEAR = '2025-2026';

function getDefaultAcademicYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

function getAcademicYears(): string[] {
  const years = new Set<string>();
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = -1; i < 5; i++) {
    const y = startYear + i;
    years.add(`${y}-${y + 1}`);
  }
  years.add(DEFAULT_ACADEMIC_YEAR);
  years.add(getDefaultAcademicYear());
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

function formatDateRangeShort(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return '';
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const fmt = (d: Date) => `${d.getDate()} ${d.toLocaleDateString('tr-TR', { month: 'short' })}`;
  return s.getMonth() === e.getMonth() ? `${s.getDate()}–${fmt(e)}` : `${fmt(s)} – ${fmt(e)}`;
}

function getWeekDisplayLabel(week: SettingsWeek): string {
  const heading = formatAcademicWeekHeading(week);
  const dateStr = formatDateRangeShort(week.dateStart, week.dateEnd);
  return dateStr ? `${heading} · ${dateStr}` : heading;
}

type TeacherOption = { id: string; display_name: string | null; email: string; teacher_branch?: string | null };

async function fetchSchoolTeachers(token: string): Promise<TeacherOption[]> {
  const all: TeacherOption[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await apiFetch<{ items?: TeacherOption[] }>(`/users?role=teacher&limit=100&page=${page}`, { token });
    const items = res?.items ?? [];
    all.push(...items);
    if (items.length < 100) break;
  }
  return all;
}

export type AssignMode = 'teacher' | 'branch' | 'all';
export type AssignFormState = {
  itemId: string;
  itemTitle: string;
  mode: AssignMode;
  userId: string;
  branch: string;
  gorevTipi: 'sorumlu' | 'yardimci';
};

function AkademikTakvimAyarlarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const academicYears = getAcademicYears();
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear);
  const [weeks, setWeeks] = useState<SettingsWeek[]>([]);
  const [overrides, setOverrides] = useState<SettingsOverrides>({
    useTypeTemplate: false,
    hiddenItemIds: [],
    customItems: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customForm, setCustomForm] = useState({
    weekId: '',
    type: 'ogretmen_isleri' as 'belirli_gun_hafta' | 'ogretmen_isleri',
    title: '',
    path: '',
  });
  const [assignments, setAssignments] = useState<SettingsAssignment[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignFormState>({
    itemId: '',
    itemTitle: '',
    mode: 'teacher',
    userId: '',
    branch: '',
    gorevTipi: 'sorumlu',
  });
  const [filterMonth, setFilterMonth] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteTab, setPaletteTab] = useState<'belirli' | 'ogretmen'>('belirli');
  const [activePaletteDrag, setActivePaletteDrag] = useState<{ title: string; variant: 'belirli' | 'ogretmen' } | null>(null);
  const tabFromUrl = searchParams.get('tab');
  const [sectionTab, setSectionTab] = useState<SettingsSectionTab>(
    tabFromUrl === 'gorevlendirme' ? 'gorevlendirme' : tabFromUrl === 'palet' ? 'palet' : 'haftalar',
  );

  const paletteQ = paletteQuery.trim().toLowerCase();
  const belirliPaletteFiltered = paletteQ ? BELIRLI_PALETTE.filter((t) => t.toLowerCase().includes(paletteQ)) : BELIRLI_PALETTE;
  const ogretmenPaletteFiltered = paletteQ
    ? OGRETMEN_PALETTE.filter(({ title }) => title.toLowerCase().includes(paletteQ))
    : OGRETMEN_PALETTE;

  const fetchData = useCallback(async () => {
    if (!token || me?.role !== 'school_admin') return;
    setLoading(true);
    try {
      const ov = await apiFetch<SettingsOverrides>('/academic-calendar/school-overrides', { token });
      const useType = ov?.useTypeTemplate === true;
      const [tpl, asgn] = await Promise.all([
        apiFetch<SettingsWeek[]>(
          `/academic-calendar/template?academic_year=${encodeURIComponent(academicYear)}&use_type_template=${useType}`,
          { token },
        ),
        apiFetch<SettingsAssignment[]>(`/academic-calendar/assignments?academic_year=${encodeURIComponent(academicYear)}`, { token }),
      ]);
      setWeeks(Array.isArray(tpl) ? tpl : []);
      setOverrides({
        useTypeTemplate: ov?.useTypeTemplate === true,
        hiddenItemIds: ov?.hiddenItemIds ?? [],
        customItems: ov?.customItems ?? [],
      });
      setAssignments(Array.isArray(asgn) ? asgn : []);
      try {
        setTeachers(await fetchSchoolTeachers(token));
      } catch {
        setTeachers([]);
      }
    } catch {
      setWeeks([]);
      setOverrides({ useTypeTemplate: false, hiddenItemIds: [], customItems: [] });
      setAssignments([]);
      setTeachers([]);
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

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'gorevlendirme' || t === 'palet' || t === 'haftalar') setSectionTab(t);
  }, [searchParams]);

  const patchOverrides = useCallback(async (next: SettingsOverrides) => {
    if (!token) return;
    await apiFetch('/academic-calendar/school-overrides', {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        useTypeTemplate: next.useTypeTemplate === true,
        hiddenItemIds: next.hiddenItemIds ?? [],
        customItems: next.customItems ?? [],
      }),
    });
  }, [token]);

  const setUseTypeTemplate = async (v: boolean) => {
    if (!token) {
      setOverrides((o) => ({ ...o, useTypeTemplate: v }));
      return;
    }
    setOverrides((prev) => {
      const next = { ...prev, useTypeTemplate: v };
      void (async () => {
        try {
          await patchOverrides(next);
          const tpl = await apiFetch<SettingsWeek[]>(
            `/academic-calendar/template?academic_year=${encodeURIComponent(academicYear)}&use_type_template=${v}`,
            { token },
          );
          setWeeks(Array.isArray(tpl) ? tpl : []);
          toast.success(v ? 'Hazır şablon etkinleştirildi' : 'Hazır şablon kapatıldı');
        } catch (e) {
          setOverrides((o) => ({ ...o, useTypeTemplate: !v }));
          toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
        }
      })();
      return next;
    });
  };

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
      await patchOverrides(overrides);
      toast.success('Ayarlar kaydedildi');
      await fetchData();
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
    const newItem = {
      id: `custom-${Date.now()}`,
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

  const weeksByMonth = weeks.reduce<Map<string, SettingsWeek[]>>((acc, w) => {
    const key =
      w.ay ||
      (w.dateStart ? new Date(w.dateStart + 'T12:00:00').toLocaleDateString('tr-TR', { month: 'long' }).toUpperCase() : 'Diğer');
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

  const filteredMonths = filterMonth ? (sortedMonths.includes(filterMonth) ? [filterMonth] : sortedMonths) : sortedMonths;
  const searchLower = filterSearch.trim().toLowerCase();
  const weekMatchesSearch = (w: SettingsWeek) => {
    if (!searchLower) return true;
    const label = getWeekDisplayLabel(w).toLowerCase();
    if (label.includes(searchLower)) return true;
    for (const i of w.belirliGunHafta) if (i.title.toLowerCase().includes(searchLower)) return true;
    for (const i of w.ogretmenIsleri) if (i.title.toLowerCase().includes(searchLower)) return true;
    return false;
  };
  const filteredWeeksByMonth = new Map<string, SettingsWeek[]>();
  for (const m of filteredMonths) {
    const list = (weeksByMonth.get(m) ?? []).filter(weekMatchesSearch);
    if (list.length > 0) filteredWeeksByMonth.set(m, list);
  }

  const getAssignmentsForItem = (itemId: string) => assignments.filter((a) => a.itemId === itemId);

  const openAssignModal = (itemId: string, itemTitle: string) => {
    setAssignForm({ itemId, itemTitle, mode: 'teacher', userId: '', branch: '', gorevTipi: 'sorumlu' });
    setAssignModalOpen(true);
  };

  const handleAssign = async () => {
    if (!token) return;
    if (assignForm.mode === 'teacher' && !assignForm.userId) {
      toast.error('Öğretmen seçin');
      return;
    }
    if (assignForm.mode === 'branch' && !assignForm.branch.trim()) {
      toast.error('Branş seçin');
      return;
    }
    const body: Record<string, unknown> = {
      item_id: assignForm.itemId,
      gorev_tipi: assignForm.gorevTipi,
    };
    if (assignForm.mode === 'all') body.all_teachers = true;
    else if (assignForm.mode === 'branch') body.teacher_branch = assignForm.branch.trim();
    else body.user_id = assignForm.userId;
    try {
      const res = await apiFetch<{ created: number; updated: number }>('/academic-calendar/assignments', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      });
      const n = (res?.created ?? 0) + (res?.updated ?? 0);
      toast.success(n > 0 ? `${n} görevlendirme kaydedildi.` : 'Görevlendirme güncellendi.');
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
    const d = event.active.data?.current as { type?: string; section?: 'belirli' | 'ogretmen'; title?: string } | undefined;
    if (d?.type === 'palette' && d.title && d.section) setActivePaletteDrag({ title: d.title, variant: d.section });
  };

  const paletteCollisionDetection: CollisionDetection = (args) => {
    const activeData = args.active.data.current as { type?: string; section?: string } | undefined;
    if (activeData?.type === 'palette' && activeData.section) {
      const allowed = args.droppableContainers.filter((c) => {
        const id = String(c.id);
        return id.startsWith('drop__') && id.endsWith(`__${activeData.section}`);
      });
      return pointerWithin({ ...args, droppableContainers: allowed });
    }
    return pointerWithin(args);
  };

  const handleDropFromPalette = (event: DragEndEvent) => {
    const activeData = event.active.data?.current as
      | { type?: string; section?: 'belirli' | 'ogretmen'; title?: string; path?: string }
      | undefined;
    const overId = String(event.over?.id ?? '');
    const title = activeData?.title?.trim();
    if (activeData?.type !== 'palette' || !overId.startsWith('drop__') || !title) return;
    const [, weekId, section] = overId.split('__');
    if (!weekId || !section) return;
    if (activeData.section !== section) {
      toast.error(
        activeData.section === 'belirli'
          ? 'Bu öğe yalnızca «Belirli gün» alanına bırakılabilir.'
          : 'Bu öğe yalnızca «Öğretmen işleri» alanına bırakılabilir.',
      );
      return;
    }
    const path =
      section === 'ogretmen' ? (OGRETMEN_PALETTE.find((p) => p.title === title)?.path ?? '/evrak') : undefined;
    const type = section === 'belirli' ? 'belirli_gun_hafta' : 'ogretmen_isleri';
    const duplicate = (overrides.customItems ?? []).some(
      (c) => c.weekId === weekId && c.type === type && c.title === title,
    );
    if (duplicate) {
      toast.error('Bu öğe bu haftada zaten ekli.');
      return;
    }
    const maxOrder = Math.max(0, ...(overrides.customItems ?? []).filter((c) => c.weekId === weekId).map((c) => c.sortOrder));
    setOverrides((o) => ({
      ...o,
      customItems: [
        ...(o.customItems ?? []),
        {
          id: `custom-${Date.now()}`,
          weekId,
          type,
          title,
          path,
          sortOrder: maxOrder + 1,
        },
      ],
    }));
    toast.success(`"${title}" eklendi. Kaydet butonuna basın.`);
  };

  const stats = useMemo(() => {
    const allItemIds = weeks.flatMap((w) => [...w.belirliGunHafta, ...w.ogretmenIsleri].map((i) => i.id));
    const hiddenSet = new Set(overrides.hiddenItemIds);
    const hidden = allItemIds.filter((id) => hiddenSet.has(id)).length;
    return {
      weeks: weeks.length,
      visible: allItemIds.length - hidden,
      hidden,
      custom: overrides.customItems?.length ?? 0,
      assignments: assignments.length,
    };
  }, [weeks, overrides, assignments]);

  const schoolTypeKey = me?.school?.type ?? '';
  const schoolTypeLabel = schoolTypeKey ? (SCHOOL_TYPE_LABEL[schoolTypeKey] ?? schoolTypeKey) : null;

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={paletteCollisionDetection}
      onDragStart={handlePaletteDragStart}
      onDragCancel={() => setActivePaletteDrag(null)}
      onDragEnd={(e) => {
        handleDropFromPalette(e);
        setActivePaletteDrag(null);
      }}
    >
      <AcademicCalendarSettingsView
        loading={loading}
        saving={saving}
        schoolName={me?.school?.name}
        schoolTypeLabel={schoolTypeLabel}
        academicYear={academicYear}
        academicYears={academicYears}
        onAcademicYearChange={setAcademicYear}
        weeks={weeks}
        overrides={overrides}
        assignments={assignments}
        teachers={teachers}
        belirliPalette={belirliPaletteFiltered}
        ogretmenPalette={ogretmenPaletteFiltered}
        paletteQuery={paletteQuery}
        onPaletteQueryChange={setPaletteQuery}
        paletteTab={paletteTab}
        onPaletteTabChange={setPaletteTab}
        sectionTab={sectionTab}
        onSectionTabChange={setSectionTab}
        filterMonth={filterMonth}
        onFilterMonthChange={setFilterMonth}
        filterSearch={filterSearch}
        onFilterSearchChange={setFilterSearch}
        sortedMonths={sortedMonths}
        weeksByMonth={weeksByMonth}
        filteredMonths={filteredMonths}
        filteredWeeksByMonth={filteredWeeksByMonth}
        getWeekDisplayLabel={getWeekDisplayLabel}
        getWeekLabel={getWeekLabel}
        getAssignmentsForItem={getAssignmentsForItem}
        onSave={handleSave}
        onUseTypeTemplateChange={setUseTypeTemplate}
        onToggleHidden={toggleHidden}
        onRemoveCustom={handleRemoveCustom}
        customModalOpen={customModalOpen}
        onCustomModalOpenChange={setCustomModalOpen}
        customForm={customForm}
        onCustomFormChange={setCustomForm}
        onAddCustom={handleAddCustom}
        assignModalOpen={assignModalOpen}
        onAssignModalOpenChange={setAssignModalOpen}
        assignForm={assignForm}
        onAssignFormChange={setAssignForm}
        onAssign={handleAssign}
        onOpenAssignModal={openAssignModal}
        onRemoveAssignment={handleRemoveAssignment}
        stats={stats}
        paletteDragSection={activePaletteDrag?.variant ?? null}
      />
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        {activePaletteDrag ? (
          <PaletteDragOverlayContent title={activePaletteDrag.title} variant={activePaletteDrag.variant} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export default function AkademikTakvimAyarlarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner label="Yükleniyor…" />
        </div>
      }
    >
      <AkademikTakvimAyarlarPageInner />
    </Suspense>
  );
}
