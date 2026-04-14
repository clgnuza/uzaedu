'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DndContext,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  AcademicCalendarPaletteItem,
  AcademicCalendarWeekCardEdit,
  type WeekWithItems,
} from '@/components/academic-calendar/academic-calendar-timeline';
import { BELIRLI_PALETTE, OGRETMEN_PALETTE } from '@/config/academic-calendar-palette';
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ORDER } from '@/lib/school-labels';
import { Calendar, Plus, ArrowLeft, GripVertical, Flag } from 'lucide-react';
import { toast } from 'sonner';

const TEMPLATE_SCHOOL_OPTIONS: { value: string; label: string }[] = [
  { value: 'ilkokul', label: `${SCHOOL_TYPE_LABELS.ilkokul} (varsayılan)` },
  { value: '__global__', label: 'Ortak (tüm kurumlar)' },
  ...SCHOOL_TYPE_ORDER.filter((k) => k !== 'ilkokul').map((k) => ({
    value: k,
    label: SCHOOL_TYPE_LABELS[k] ?? k,
  })),
];

export default function AkademikTakvimSablonuPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [templateSchoolType, setTemplateSchoolType] = useState('ilkokul');
  const [weeks, setWeeks] = useState<WeekWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [addForm, setAddForm] = useState<{ weekId: string; type: 'belirli_gun_hafta' | 'ogretmen_isleri'; title: string; path: string }>({ weekId: '', type: 'ogretmen_isleri', title: '', path: '' });
  const academicYear = '2025-2026';
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const st = `school_type=${encodeURIComponent(templateSchoolType)}`;
      const data = await apiFetch<WeekWithItems[]>(
        `/academic-calendar/template?academic_year=${encodeURIComponent(academicYear)}&${st}`,
        { token },
      );
      const raw = Array.isArray(data) ? data : [];
      const normalized: WeekWithItems[] = raw.map((w) => ({
        ...w,
        belirliGunHafta: Array.isArray(w.belirliGunHafta) ? w.belirliGunHafta : (w as unknown as { belirli_gun_hafta?: WeekWithItems['belirliGunHafta'] }).belirli_gun_hafta ?? [],
        ogretmenIsleri: Array.isArray(w.ogretmenIsleri) ? w.ogretmenIsleri : (w as unknown as { ogretmen_isleri?: WeekWithItems['ogretmenIsleri'] }).ogretmen_isleri ?? [],
      }));
      setWeeks(normalized);
    } catch {
      setWeeks([]);
    } finally {
      setLoading(false);
    }
  }, [token, templateSchoolType]);

  useEffect(() => {
    if (me && me.role !== 'superadmin') {
      router.replace('/403');
      return;
    }
  }, [me, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSeedCalendar = async () => {
    if (!token) return;
    setSeedLoading(true);
    try {
      const res = await apiFetch<{ seeded: number }>('/seed/academic-calendar', {
        method: 'POST',
        token,
        body: JSON.stringify({ academic_year: academicYear }),
      });
      toast.success(`${res.seeded ?? 0} akademik takvim öğesi oluşturuldu veya güncellendi.`);
      await fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Doldurulamadı');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!token || !addForm.weekId || !addForm.title.trim()) {
      toast.error('Hafta seçin ve başlık girin');
      return;
    }
    try {
      await apiFetch('/academic-calendar/items', {
        method: 'POST',
        token,
        body: JSON.stringify({
          week_id: addForm.weekId,
          item_type: addForm.type,
          title: addForm.title.trim(),
          path: addForm.path.trim() || null,
          school_types: templateSchoolType === '__global__' ? null : [templateSchoolType],
        }),
      });
      toast.success('Öğe eklendi');
      setAddModalOpen(false);
      setAddForm({ weekId: '', type: 'ogretmen_isleri', title: '', path: '' });
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!token || !confirm('Bu öğeyi kaldırmak istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/academic-calendar/items/${id}`, { method: 'DELETE', token });
      toast.success('Öğe kaldırıldı');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaldırılamadı');
    }
  };

  const handleUnifiedDragEnd = async (event: DragEndEvent) => {
    const activeData = event.active.data?.current as
      | { type?: string; weekId?: string; section?: 'belirli' | 'ogretmen'; title?: string; path?: string }
      | undefined;
    const overId = String(event.over?.id ?? '');

    if (activeData?.type === 'palette' && overId.startsWith('drop__')) {
      const [, weekId, section] = overId.split('__');
      if (!weekId || !section || !activeData.title) return;
      try {
        const path =
          section === 'ogretmen'
            ? OGRETMEN_PALETTE.find((p) => p.title === activeData.title)?.path ?? '/evrak'
            : null;
        await apiFetch('/academic-calendar/items', {
          method: 'POST',
          token: token!,
          body: JSON.stringify({
            week_id: weekId,
            item_type: section === 'belirli' ? 'belirli_gun_hafta' : 'ogretmen_isleri',
            title: activeData.title,
            path,
            school_types: templateSchoolType === '__global__' ? null : [templateSchoolType],
          }),
        });
        toast.success(`"${activeData.title}" eklendi`);
        fetchData();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Eklenemedi');
      }
      return;
    }

    if (activeData?.weekId && activeData?.section) {
      await handleDragEnd(event, activeData.section, activeData.weekId);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, section: 'belirli' | 'ogretmen', weekId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const week = weeks.find((w) => w.id === weekId);
    if (!week) return;
    const items = section === 'belirli' ? [...week.belirliGunHafta] : [...week.ogretmenIsleri];
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(items, oldIndex, newIndex);
    const ids = reordered.map((i) => i.id);
    try {
      await apiFetch('/academic-calendar/items/reorder', {
        method: 'PATCH',
        token: token!,
        body: JSON.stringify({ item_ids: ids }),
      });
      setWeeks((prev) =>
        prev.map((w) =>
          w.id === weekId
            ? section === 'belirli'
              ? { ...w, belirliGunHafta: reordered }
              : { ...w, ogretmenIsleri: reordered }
            : w
        )
      );
    } catch {
      toast.error('Sıra güncellenemedi');
    }
  };

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Akademik Takvim Şablonu</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Haftalık şablon', icon: Calendar },
              { label: 'Sürükle-bırak sıra', icon: GripVertical },
              { label: 'Belirli Gün / öğretmen işleri', icon: Flag },
              { label: 'Yeni öğe', icon: Plus },
            ]}
            summary="Hafta bazlı akademik takvim şablonunu yönetin. Her haftaya Belirli Gün ve Haftalar ile Öğretmen İşleri ekleyebilir, sürükle-bırak ile sıralayabilirsiniz."
          />
        </ToolbarHeading>
        <ToolbarActions>
          <div className="flex items-center gap-2">
            <Label htmlFor="tpl-school" className="sr-only">
              Kurum türü şablonu
            </Label>
            <select
              id="tpl-school"
              value={templateSchoolType}
              onChange={(e) => setTemplateSchoolType(e.target.value)}
              className="h-9 max-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
            >
              {TEMPLATE_SCHOOL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedCalendar}
            disabled={seedLoading}
          >
            {seedLoading ? 'Dolduruluyor…' : 'Akademik Takvimi Doldur'}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/akademik-takvim">
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Takvime Dön
            </Link>
          </Button>
          <Button onClick={() => setAddModalOpen(true)} disabled={weeks.length === 0}>
            <Plus className="mr-2 size-4" aria-hidden />
            Öğe Ekle
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Öğe Ekle</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="week">Hafta *</Label>
              <select
                id="week"
                value={addForm.weekId}
                onChange={(e) => setAddForm((f) => ({ ...f, weekId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">— Seçin —</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.weekNumber}. Hafta {w.title ? `— ${w.title}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tür *</Label>
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={addForm.type === 'belirli_gun_hafta'} onChange={() => setAddForm((f) => ({ ...f, type: 'belirli_gun_hafta' }))} />
                  Belirli Gün ve Haftalar (turuncu)
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={addForm.type === 'ogretmen_isleri'} onChange={() => setAddForm((f) => ({ ...f, type: 'ogretmen_isleri' }))} />
                  Öğretmen İşleri (mavi)
                </label>
              </div>
            </div>
            <div>
              <Label htmlFor="title">Başlık *</Label>
              <Input
                id="title"
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Örn: Cumhuriyet Bayramı"
              />
            </div>
            {addForm.type === 'ogretmen_isleri' && (
              <div>
                <Label htmlFor="path">Yol (isteğe bağlı)</Label>
                <Input
                  id="path"
                  value={addForm.path}
                  onChange={(e) => setAddForm((f) => ({ ...f, path: e.target.value }))}
                  placeholder="/evrak"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleAddItem}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {!loading && weeks.length === 0 && (
        <EmptyState
          icon={<Calendar className="size-10 text-muted-foreground" />}
          title="Henüz hafta yok"
          description="Çalışma takvimi veya akademik takvim içeriği oluşturulmamış. Önce 'Akademik Takvimi Doldur' ile haftaları ve öğeleri yükleyin."
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSeedCalendar} disabled={seedLoading}>
                {seedLoading ? 'Dolduruluyor…' : 'Akademik Takvimi Doldur'}
              </Button>
              <Link href="/document-templates?tab=calisma-takvimi">
                <Button variant="outline">Çalışma Takvimi</Button>
              </Link>
              <Link href="/akademik-takvim">
                <Button variant="outline">Takvime Git</Button>
              </Link>
            </div>
          }
        />
      )}
      {!loading && weeks.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <GripVertical className="size-4 text-muted-foreground" aria-hidden />
              İş Listesi — Aşağıdaki haftalara sürükleyip bırakın
            </h3>
            <div className="space-y-3">
              <div>
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">Öğretmen İşleri — Haftalara sürükleyin</div>
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
              <details className="text-muted-foreground">
                <summary className="cursor-pointer text-xs font-medium">Belirli Gün ve Haftalar (isteğe bağlı)</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {BELIRLI_PALETTE.slice(0, 12).map((title) => (
                    <AcademicCalendarPaletteItem
                      key={title}
                      id={`palette-belirli-${title}`}
                      title={title}
                      variant="belirli"
                    />
                  ))}
                  {BELIRLI_PALETTE.length > 12 && (
                    <span className="px-2 py-1 text-xs">+{BELIRLI_PALETTE.length - 12} (Öğe Ekle ile)</span>
                  )}
                </div>
              </details>
            </div>
          </div>

          <h2 className="text-lg font-semibold">Haftalık Şablon</h2>
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleUnifiedDragEnd}>
            {weeks.map((week, idx) => (
              <AcademicCalendarWeekCardEdit
                key={week.id}
                week={week}
                showConnector={idx < weeks.length - 1}
                onDeleteItem={handleDeleteItem}
              />
            ))}
          </DndContext>
        </div>
      )}
    </div>
  );
}
