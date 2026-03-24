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
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  AcademicCalendarPaletteItem,
  AcademicCalendarDropZone,
} from '@/components/academic-calendar/academic-calendar-timeline';
import { OGRETMEN_PALETTE } from '@/config/academic-calendar-palette';
import { ArrowLeft, Calendar, Eye, Filter, GripVertical, Plus, Trash2, UserPlus } from 'lucide-react';
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
  const academicYear = '2025-2026';

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

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDropFromPalette = (event: DragEndEvent) => {
    const activeData = event.active.data?.current as
      | { type?: string; section?: 'belirli' | 'ogretmen'; title?: string; path?: string }
      | undefined;
    const overId = String(event.over?.id ?? '');
    if (activeData?.type !== 'palette' || !overId.startsWith('drop__') || !activeData.title) return;
    const [, weekId, section] = overId.split('__');
    if (!weekId || !section) return;
    const path = section === 'ogretmen' ? OGRETMEN_PALETTE.find((p) => p.title === activeData.title)?.path ?? '/evrak' : undefined;
    const type = section === 'belirli' ? 'belirli_gun_hafta' : 'ogretmen_isleri';
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

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Akademik Takvim Ayarları</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Görünürlük', icon: Eye },
              { label: 'Özel öğe ekleme', icon: Plus },
              { label: 'Akademik takvim', icon: Calendar },
            ]}
            summary="Okulunuzun akademik takviminde hangi öğelerin görüneceğini yönetin. Gizleyebilir veya özel öğe ekleyebilirsiniz."
          />
        </ToolbarHeading>
        <ToolbarActions>
          <Button variant="outline" size="sm" asChild>
            <Link href="/akademik-takvim">
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Akademik Takvim
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </ToolbarActions>
      </Toolbar>

      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      )}
      {!loading && (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDropFromPalette}>
          <div className="space-y-6">
            {weeks.length > 0 && (
              <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <GripVertical className="size-4 text-muted-foreground" aria-hidden />
                  Öğretmen İşleri — Haftalara sürükleyip bırakın (veya Özel Öğe Ekle)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {OGRETMEN_PALETTE.map(({ title }) => (
                    <AcademicCalendarPaletteItem
                      key={title}
                      id={`palette-ogretmen-${title}`}
                      title={title}
                      variant="ogretmen"
                    />
                  ))}
                </div>
              </div>
            )}

            <Card>
              <CardContent className="pt-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">Standart Öğeler</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-md border border-input bg-muted/30 px-2 py-1">
                      <Filter className="size-4 text-muted-foreground" aria-hidden />
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="h-8 rounded border-0 bg-transparent text-sm focus:ring-0"
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
                      className="h-8 w-48 text-sm"
                    />
                  </div>
                  <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Plus className="mr-2 size-4" />
                        Özel Öğe Ekle
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
              <div className="space-y-8">
                {filteredMonths.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {filterSearch.trim() ? 'Arama kriterlerine uygun hafta bulunamadı.' : 'Henüz hafta yok.'}
                  </p>
                )}
                {filteredMonths.map((monthKey) => {
                  const monthWeeks = filteredWeeksByMonth.get(monthKey) ?? [];
                  return (
                    <div key={monthKey} className="space-y-4">
                      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-4 py-2">
                        <Calendar className="size-5 text-muted-foreground" aria-hidden />
                        <h4 className="text-base font-bold uppercase tracking-wide text-foreground">{monthKey}</h4>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-sm font-medium text-muted-foreground">
                          {monthWeeks.length} hafta
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                        {monthWeeks.map((week) => {
                          const weekCustomBelirli = (overrides.customItems ?? []).filter((c) => c.weekId === week.id && c.type === 'belirli_gun_hafta');
                          const weekCustomOgretmen = (overrides.customItems ?? []).filter((c) => c.weekId === week.id && c.type === 'ogretmen_isleri');
                          return (
                            <Card
                              key={week.id}
                              className={`overflow-hidden shadow-md transition-shadow hover:shadow-lg ${
                                week.isTatil
                                  ? 'border-l-4 border-l-amber-500 bg-amber-50/30 dark:bg-amber-950/20'
                                  : 'border-l-4 border-l-primary bg-card'
                              }`}
                            >
                              <div className="border-b border-border/60 bg-muted/40 px-4 py-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`text-sm font-bold ${week.isTatil ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                                    {getWeekDisplayLabel(week)}
                                  </span>
                                  {week.isTatil && (
                                    <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                                      Tatil
                                    </span>
                                  )}
                                </div>
                              </div>
                              <CardContent className="space-y-3 p-4">
                                {week.belirliGunHafta.length > 0 && (
                                  <div className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                    Belirli Gün ve Haftalar
                                  </div>
                                )}
                        {week.belirliGunHafta.map((item) => {
                          const itemAssignments = getAssignmentsForItem(item.id);
                          const isTemplateItem = !item.id.startsWith('custom-');
                          return (
                            <div key={item.id} className="space-y-1 rounded-md border border-border/80 bg-background/50 p-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-amber-700 dark:text-amber-400">★ {item.title}</span>
                                <label className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{overrides.hiddenItemIds.includes(item.id) ? 'Gizli' : 'Görünür'}</span>
                                  <input type="checkbox" checked={!overrides.hiddenItemIds.includes(item.id)} onChange={() => toggleHidden(item.id)} className="size-4 rounded" aria-label={item.title} />
                                </label>
                              </div>
                              {isTemplateItem && (
                                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                                  {itemAssignments.map((a) => (
                                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
                                      <span>{a.userName} ({a.gorevTipi})</span>
                                      <button type="button" onClick={() => handleRemoveAssignment(a.id)} className="rounded p-0.5 hover:bg-destructive/20" aria-label="Kaldır">
                                        <Trash2 className="size-3" />
                                      </button>
                                    </span>
                                  ))}
                                  <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => openAssignModal(item.id, item.title)}>
                                    <UserPlus className="size-3" />
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
                                  <div className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                                    Öğretmen İşleri
                                  </div>
                                )}
                        {week.ogretmenIsleri.map((item) => (
                          <div key={item.id} className="flex items-center justify-between rounded-md border border-border/80 bg-background/50 px-2 py-1.5">
                            <span className="text-sm text-blue-700 dark:text-blue-400">{item.title}</span>
                            <label className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{overrides.hiddenItemIds.includes(item.id) ? 'Gizli' : 'Görünür'}</span>
                              <input type="checkbox" checked={!overrides.hiddenItemIds.includes(item.id)} onChange={() => toggleHidden(item.id)} className="size-4 rounded" aria-label={item.title} />
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
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-4 font-semibold">Özel Öğeler</h3>
                  <ul className="space-y-2">
                    {overrides.customItems!.map((c) => (
                      <li key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                        <div>
                          <span className="font-medium">{c.title}</span>
                          <span className="ml-2 text-sm text-muted-foreground">({getWeekLabel(c.weekId)}, {c.type === 'belirli_gun_hafta' ? 'Belirli Gün' : 'Öğretmen İşleri'})</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveCustom(c.id)} className="text-destructive" aria-label="Kaldır">
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </DndContext>
      )}
    </div>
  );
}
