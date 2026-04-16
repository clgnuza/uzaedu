'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle, ToolbarActions } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  BilsemPaletteItem,
  BilsemWeekCardEdit,
  type BilsemItem,
  type BilsemWeek,
} from '@/components/bilsem/bilsem-calendar-edit';
import { BILSEM_PALETTE } from '@/config/bilsem-palette';
import { ArrowLeft, Building2, Calendar, Database, GripVertical, Layers, Plus } from 'lucide-react';
import { toast } from 'sonner';

const ITEM_TYPES = ['belirli_gun_hafta', 'dep', 'tanilama', 'diger'] as const;

function getAcademicYears(): string[] {
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let i = -1; i < 5; i++) {
    years.push(`${startYear + i}-${startYear + i + 1}`);
  }
  return years.sort((a, b) => b.localeCompare(a));
}

export default function BilsemSablonTakvimPage(props?: { embedded?: boolean }) {
  const embedded = props?.embedded === true;
  const router = useRouter();
  const { token, me, loading: authLoading } = useAuth();
  const [weeks, setWeeks] = useState<BilsemWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    weekId: '',
    item_type: 'belirli_gun_hafta' as (typeof ITEM_TYPES)[number],
    title: '',
    path: '',
    sort_order: 0,
  });
  const [editForm, setEditForm] = useState<{
    id: string;
    weekId: string;
    item_type: (typeof ITEM_TYPES)[number];
    title: string;
    path: string;
    sort_order: number;
  } | null>(null);
  const [academicYear, setAcademicYear] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 8 ? `${now.getFullYear()}-${now.getFullYear() + 1}` : `${now.getFullYear() - 1}-${now.getFullYear()}`;
  });
  const [seedLoading, setSeedLoading] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const fetchData = useCallback(async () => {
    if (!token || me?.role !== 'superadmin') return;
    setLoading(true);
    try {
      const data = await apiFetch<BilsemWeek[]>(`/bilsem/calendar/template?academic_year=${encodeURIComponent(academicYear)}`, { token });
      setWeeks(Array.isArray(data) ? data : []);
    } catch {
      setWeeks([]);
    } finally {
      setLoading(false);
    }
  }, [token, me?.role, academicYear]);

  const handleSeed = useCallback(async () => {
    if (!token) return;
    setSeedLoading(true);
    try {
      const res = await apiFetch<{ seeded: number }>('/bilsem/calendar/seed', {
        method: 'POST',
        token,
        body: JSON.stringify({ academic_year: academicYear }),
      });
      toast.success(`${res.seeded ?? 0} Bilsem öğesi eklendi.`);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Doldurulamadı');
    } finally {
      setSeedLoading(false);
    }
  }, [token, academicYear, fetchData]);

  useEffect(() => {
    if (authLoading) return;
    if (me && me.role !== 'superadmin') {
      router.replace('/403');
    }
  }, [authLoading, me, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const autoSeedAttempted = useRef(false);
  useEffect(() => {
    if (!loading && weeks.length === 0 && token && me?.role === 'superadmin' && !autoSeedAttempted.current && !seedLoading) {
      autoSeedAttempted.current = true;
      handleSeed();
    }
  }, [loading, weeks.length, token, me?.role, seedLoading]);

  const handleAdd = async () => {
    if (!token || !addForm.weekId || !addForm.title.trim()) {
      toast.error('Hafta seçin ve başlık girin');
      return;
    }
    try {
      await apiFetch('/bilsem/calendar/items', {
        method: 'POST',
        token,
        body: JSON.stringify({
          week_id: addForm.weekId,
          item_type: addForm.item_type,
          title: addForm.title.trim(),
          path: addForm.path.trim() || undefined,
          sort_order: addForm.sort_order,
        }),
      });
      toast.success('Öğe eklendi');
      setAddModalOpen(false);
      setAddForm({ weekId: '', item_type: 'belirli_gun_hafta', title: '', path: '', sort_order: 0 });
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    }
  };

  const openEdit = (item: BilsemItem, weekId: string) => {
    setEditForm({
      id: item.id,
      weekId,
      item_type: item.itemType as (typeof ITEM_TYPES)[number],
      title: item.title,
      path: item.path ?? '',
      sort_order: item.sortOrder,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!token || !editForm) return;
    try {
      await apiFetch(`/bilsem/calendar/items/${editForm.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          week_id: editForm.weekId,
          item_type: editForm.item_type,
          title: editForm.title.trim(),
          path: editForm.path.trim() || null,
          sort_order: editForm.sort_order,
        }),
      });
      toast.success('Öğe güncellendi');
      setEditModalOpen(false);
      setEditForm(null);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Bu öğeyi kaldırmak istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/bilsem/calendar/items/${id}`, { method: 'DELETE', token });
      toast.success('Öğe kaldırıldı');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaldırılamadı');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeData = event.active.data?.current as
      | { type?: string; itemType?: string; title?: string; itemId?: string; weekId?: string }
      | undefined;
    const overId = String(event.over?.id ?? '');

    if (activeData?.type === 'palette' && overId.startsWith('bilsem-drop__')) {
      const weekId = overId.replace('bilsem-drop__', '');
      if (!weekId || !activeData.title || !activeData.itemType) return;
      try {
        await apiFetch('/bilsem/calendar/items', {
          method: 'POST',
          token: token!,
          body: JSON.stringify({
            week_id: weekId,
            item_type: activeData.itemType,
            title: activeData.title,
          }),
        });
        toast.success(`"${activeData.title}" eklendi`);
        fetchData();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Eklenemedi');
      }
      return;
    }

    if (activeData?.type === 'item' && activeData?.itemId && event.over) {
      const overId = String(event.over.id);
      if (overId.startsWith('bilsem-drop__') || overId.startsWith('bilsem-palette-')) return;
      if (activeData.itemId === overId) return;
      const week = weeks.find((w) => w.items.some((i) => i.id === activeData.itemId));
      if (!week) return;
      const items = [...week.items];
      const oldIndex = items.findIndex((i) => i.id === activeData.itemId);
      const newIndex = items.findIndex((i) => i.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      const ids = reordered.map((i) => i.id);
      try {
        await apiFetch('/bilsem/calendar/items/reorder', {
          method: 'PATCH',
          token: token!,
          body: JSON.stringify({ item_ids: ids }),
        });
        setWeeks((prev) =>
          prev.map((w) =>
            w.id === week.id ? { ...w, items: reordered } : w
          )
        );
      } catch {
        toast.error('Sıra güncellenemedi');
      }
    }
  };

  return (
    <div className="space-y-8">
      <Toolbar>
        <ToolbarHeading>
          {!embedded && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bilsem/takvim">
                <ArrowLeft className="mr-2 size-4" aria-hidden />
                Takvime Dön
              </Link>
            </Button>
          )}
          <ToolbarPageTitle>{embedded ? 'Bilsem İş Planı' : 'Bilsem Takvim Şablonu'}</ToolbarPageTitle>
          {embedded ? (
            <ToolbarIconHints
              compact
              items={[
                { label: 'Ülke şablonu', icon: Calendar },
                { label: 'Haftalık satırlar', icon: Layers },
                { label: 'Okul hizalama', icon: Building2 },
                { label: 'Sürükle-bırak', icon: GripVertical },
              ]}
              summary="Ülke şablonu: haftalık iş planı satırları ve etkinlikler. Okul Bilsem takvimleri bununla hizalanır."
            />
          ) : (
            <ToolbarIconHints
              items={[
                { label: 'Haftalık şablon', icon: Calendar },
                { label: 'Paletten sürükle', icon: GripVertical },
                { label: 'Öğe ekle', icon: Plus },
                { label: 'Şablon doldur', icon: Database },
              ]}
              summary="Hafta bazlı Bilsem çalışma takvimi şablonunu yönetin. Paletten sürükleyip bırakın veya Öğe Ekle ile ekleyin."
            />
          )}
        </ToolbarHeading>
        <ToolbarActions>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
              aria-label="Öğretim yılı"
            >
              {getAcademicYears().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seedLoading}>
              <Database className="mr-2 size-4" aria-hidden />
              {seedLoading ? 'Dolduruluyor…' : '2025-2026 Şablonu Doldur'}
            </Button>
            <Button onClick={() => setAddModalOpen(true)} disabled={weeks.length === 0}>
              <Plus className="mr-2 size-4" aria-hidden />
              Öğe Ekle
            </Button>
          </div>
        </ToolbarActions>
      </Toolbar>

      {loading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      {!loading && weeks.length === 0 && (
        <EmptyState
          icon={<Calendar className="size-10 text-muted-foreground" />}
          title="Henüz hafta yok"
          description="Çalışma takvimi oluşturulmamış. Önce çalışma takviminde haftaları tanımlayın."
          action={
            <Link href="/bilsem-sablon?tab=calisma-takvimi">
              <Button variant="outline">Çalışma Takvimi</Button>
            </Link>
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
            <div className="flex flex-wrap gap-2">
              {BILSEM_PALETTE.map((p) => (
                <BilsemPaletteItem
                  key={`${p.type}-${p.title}`}
                  id={`bilsem-palette-${p.type}-${p.title}`}
                  type={p.type}
                  title={p.title}
                />
              ))}
            </div>
          </div>

          <h2 className="text-lg font-semibold">Haftalık iş planı</h2>
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
            {weeks.map((week, idx) => (
              <BilsemWeekCardEdit
                key={week.id}
                week={week}
                showConnector={idx < weeks.length - 1}
                onDeleteItem={handleDelete}
                onEditItem={openEdit}
              />
            ))}
          </DndContext>
        </div>
      )}

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Öğe Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-week">Hafta *</Label>
              <select
                id="add-week"
                value={addForm.weekId}
                onChange={(e) => setAddForm((f) => ({ ...f, weekId: e.target.value }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seçin</option>
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.title ?? `${w.weekNumber}. Hafta`} {w.dateStart && `(${new Date(w.dateStart).toLocaleDateString('tr-TR')})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-type">Tür *</Label>
              <select
                id="add-type"
                value={addForm.item_type}
                onChange={(e) => setAddForm((f) => ({ ...f, item_type: e.target.value as (typeof ITEM_TYPES)[number] }))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="belirli_gun_hafta">Belirli Gün</option>
                <option value="dep">DEP</option>
                <option value="tanilama">Tanılama</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-title">Başlık *</Label>
              <Input
                id="add-title"
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Örn: Tanılama süreci"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-path">Yol (isteğe bağlı)</Label>
              <Input
                id="add-path"
                value={addForm.path}
                onChange={(e) => setAddForm((f) => ({ ...f, path: e.target.value }))}
                placeholder="/evrak"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>İptal</Button>
            <Button onClick={handleAdd}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={(open) => !open && setEditForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Öğe Düzenle</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-week">Hafta *</Label>
                <select
                  id="edit-week"
                  value={editForm.weekId}
                  onChange={(e) => setEditForm((f) => f && { ...f, weekId: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.title ?? `${w.weekNumber}. Hafta`} {w.dateStart && `(${new Date(w.dateStart).toLocaleDateString('tr-TR')})`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-type">Tür *</Label>
                <select
                  id="edit-type"
                  value={editForm.item_type}
                  onChange={(e) => setEditForm((f) => f && { ...f, item_type: e.target.value as (typeof ITEM_TYPES)[number] })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="belirli_gun_hafta">Belirli Gün</option>
                  <option value="dep">DEP</option>
                  <option value="tanilama">Tanılama</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-title">Başlık *</Label>
                <Input
                  id="edit-title"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => f && { ...f, title: e.target.value })}
                  placeholder="Örn: Tanılama süreci"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-path">Yol (isteğe bağlı)</Label>
                <Input
                  id="edit-path"
                  value={editForm.path}
                  onChange={(e) => setEditForm((f) => f && { ...f, path: e.target.value })}
                  placeholder="/evrak"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>İptal</Button>
            <Button onClick={handleEdit}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
