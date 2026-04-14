'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Building2, DoorOpen, Plus, Trash2, Users, Settings2, Edit2, LayoutGrid, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Building = { id: string; name: string; sortOrder: number };
type Room = {
  id: string;
  buildingId: string;
  name: string;
  capacity: number;
  seatLayout: string;
  sortOrder: number;
  buildingName?: string;
};

/* ─── Grup tipi ─── */
type LayoutGroup = { id: string; rowType: 'pair' | 'single'; rowCount: number };

function parseLayoutGroups(seatLayout: string): LayoutGroup[] {
  if (seatLayout.startsWith('[')) {
    try {
      const raw = JSON.parse(seatLayout) as Array<{ rowType: string; rowCount: number }>;
      return raw.map((g, i) => ({
        id: `g${i}`,
        rowType: g.rowType === 'single' ? 'single' : 'pair',
        rowCount: g.rowCount,
      }));
    } catch { /* fallthrough */ }
  }
  // Eski format: 'pair' | 'single' | 'rows_NxM'
  if (seatLayout.startsWith('rows_')) {
    const m = seatLayout.match(/rows_(\d+)x(\d+)/);
    if (m) return [{ id: 'g0', rowType: 'pair', rowCount: parseInt(m[1]) }];
  }
  return [{ id: 'g0', rowType: seatLayout === 'single' ? 'single' : 'pair', rowCount: 5 }];
}

function groupCapacity(g: LayoutGroup) {
  return g.rowType === 'pair' ? g.rowCount * 2 : g.rowCount;
}

/* ─── Sınıf Düzeni Modal ─── */
function ClassLayoutModal({
  room,
  schoolQ,
  token,
  onClose,
  onSaved,
}: {
  room: Room;
  schoolQ: string;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [groups, setGroups] = useState<LayoutGroup[]>(() => parseLayoutGroups(room.seatLayout));
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addGroup = () => {
    setGroups((g) => [...g, { id: `g${Date.now()}`, rowType: 'pair', rowCount: 5 }]);
  };

  const removeGroup = (id: string) => setGroups((g) => g.filter((x) => x.id !== id));

  const totalCapacity = groups.reduce((s, g) => s + groupCapacity(g), 0);

  /* Seat number offset per group */
  const groupOffsets: number[] = [];
  let offset = 1;
  for (const g of groups) {
    groupOffsets.push(offset);
    offset += groupCapacity(g);
  }

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/butterfly-exam/rooms/${room.id}${schoolQ}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ layoutGroups: groups.map(({ rowType, rowCount }) => ({ rowType, rowCount })) }),
      });
      toast.success('Düzen kaydedildi');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-[90vh] max-h-[680px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-zinc-800">
          <div>
            <p className="font-semibold">Sınıf Düzeni Yönetimi</p>
            <p className="text-xs text-muted-foreground">
              {room.buildingName ? `${room.buildingName} · ` : ''}{room.name} · {totalCapacity} öğrenci · {totalCapacity} kapasite
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Grup Ayarları */}
          <div className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Grup Ayarları
              <button type="button" onClick={addGroup}
                className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700">
                <Plus className="size-3" /> Ekle
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
              {groups.map((g, i) => (
                <div key={g.id}
                  className={cn(
                    'cursor-pointer rounded-xl border p-3 transition',
                    activeGroup === g.id
                      ? 'border-indigo-400/60 bg-indigo-50/80 dark:border-indigo-600/40 dark:bg-indigo-950/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-800/40'
                  )}
                  onClick={() => setActiveGroup(g.id === activeGroup ? null : g.id)}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">Grup {i + 1}</p>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }}
                      className="rounded p-0.5 text-rose-500 hover:bg-rose-50">
                      <X className="size-3" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] text-muted-foreground">Sıra Tipi</label>
                    <select
                      className="h-7 w-full rounded-lg border border-input bg-white/85 px-2 text-xs dark:bg-zinc-900"
                      value={g.rowType}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, rowType: e.target.value as 'pair' | 'single' } : x))}>
                      <option value="pair">İkili Sıra</option>
                      <option value="single">Tekli Sıra</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] text-muted-foreground">Adet</label>
                        <Input type="number" min={1} max={30} value={g.rowCount}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setGroups((gs) => gs.map((x) => x.id === g.id ? { ...x, rowCount: Math.max(1, parseInt(e.target.value) || 1) } : x))}
                          className="mt-0.5 h-7 text-xs" />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">Kapasite</p>
                        <p className="mt-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">{groupCapacity(g)} kişi</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 px-4 py-2 text-xs text-muted-foreground dark:border-zinc-800">
              {groups.length} grup • {totalCapacity} kapasite
            </div>
          </div>

          {/* Right: Visual Preview */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Smartboard header */}
            <div className="flex items-center gap-2 bg-emerald-500 px-4 py-2 text-white">
              <LayoutGrid className="size-4" />
              <span className="text-sm font-semibold">
                AKILLI TAHTA — {room.buildingName ? `${room.buildingName} · ` : ''}{room.name}
              </span>
            </div>

            {/* Seat canvas */}
            <div className="flex flex-1 gap-2 overflow-auto p-4">
              {groups.map((g, gi) => {
                const startNo = groupOffsets[gi];
                const isPair = g.rowType === 'pair';
                return (
                  <div key={g.id}
                    className={cn(
                      'flex shrink-0 flex-col rounded-xl border-2 transition',
                      activeGroup === g.id
                        ? 'border-blue-400 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30'
                        : 'border-slate-200 bg-slate-50/60 dark:border-zinc-700 dark:bg-zinc-800/30'
                    )}
                    onClick={() => setActiveGroup(g.id === activeGroup ? null : g.id)}>
                    {/* Group label */}
                    <div className={cn(
                      'rounded-t-[10px] px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide',
                      activeGroup === g.id ? 'bg-blue-400 text-white' : 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                    )}>
                      GRUP {gi + 1}
                    </div>

                    {/* Seats */}
                    <div className="p-2 space-y-1">
                      {Array.from({ length: g.rowCount }, (_, rowIdx) => {
                        const rowStart = startNo + rowIdx * (isPair ? 2 : 1);
                        return (
                          <div key={rowIdx} className="flex items-center gap-1">
                            <span className="w-4 text-[9px] text-muted-foreground tabular-nums text-right">{rowIdx + 1}</span>
                            {isPair ? (
                              <>
                                <SeatBox no={rowStart} active={activeGroup === g.id} />
                                <SeatBox no={rowStart + 1} active={activeGroup === g.id} />
                              </>
                            ) : (
                              <SeatBox no={rowStart} active={activeGroup === g.id} wide />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {groups.length === 0 && (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Sol panelden grup ekleyin
                </div>
              )}
            </div>

            {/* MASA label at bottom left */}
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2 dark:border-zinc-800">
              <div className="flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                MASA
              </div>
              <p className="text-xs text-muted-foreground">Toplam {totalCapacity} koltuk</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-zinc-800">
          <Button variant="outline" size="sm" onClick={onClose}>İptal</Button>
          <Button size="sm" disabled={saving} onClick={() => void save()} className="gap-1.5">
            {saving ? <LoadingSpinner /> : null}
            Kaydet
          </Button>
        </div>
      </div>
    </div>
  );
}

function SeatBox({ no, active, wide }: { no: number; active: boolean; wide?: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums',
      wide ? 'h-7 w-12' : 'h-7 w-7',
      active
        ? 'border-blue-400 bg-blue-500 text-white'
        : 'border-slate-300 bg-white text-slate-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200'
    )}>
      {no}
    </div>
  );
}
type ClassRow = { id: string; name: string; grade: number | null; section: string | null; studentCount: number };

const TABS = [
  { id: 'buildings', label: 'Binalar', icon: Building2 },
  { id: 'rooms', label: 'Salon Atamaları', icon: DoorOpen },
  { id: 'classes', label: 'Sınıf Atamaları', icon: Users },
  { id: 'strategy', label: 'Yerleştirme Ayarları', icon: Settings2 },
] as const;
type TabId = typeof TABS[number]['id'];

export default function KelebekYerlesimPage() {
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';

  const [tab, setTab] = useState<TabId>('buildings');
  const [loading, setLoading] = useState(true);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);

  // Building form
  const [bName, setBName] = useState('');
  const [editBuilding, setEditBuilding] = useState<Building | null>(null);
  const [editBName, setEditBName] = useState('');

  // Room form
  const [rForm, setRForm] = useState({ buildingId: '', name: '', capacity: '30', seat_layout: 'pair' as 'pair' | 'single', floor: '' });

  // Class-building assignments (local state, stored in classBuilding map)
  const [classBuilding, setClassBuilding] = useState<Record<string, string>>({});

  // Strategy
  const [strategy, setStrategy] = useState<'inter_building' | 'intra_building'>('inter_building');
  const [specialRulesEnabled, setSpecialRulesEnabled] = useState(false);

  // Layout modal
  const [layoutRoom, setLayoutRoom] = useState<Room | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [b, r, c] = await Promise.all([
        apiFetch<Building[]>(`/butterfly-exam/buildings${schoolQ}`, { token }),
        apiFetch<Room[]>(`/butterfly-exam/rooms${schoolQ}`, { token }),
        apiFetch<ClassRow[]>(`/butterfly-exam/classes${schoolQ}`, { token }),
      ]);
      setBuildings(b);
      setRooms(r);
      setClasses(c);
      if (b.length && !rForm.buildingId) {
        setRForm((f) => ({ ...f, buildingId: b[0].id }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  const addBuilding = async () => {
    if (!token || !bName.trim()) return;
    try {
      await apiFetch(`/butterfly-exam/buildings${schoolQ}`, {
        method: 'POST', token, body: JSON.stringify({ name: bName.trim() }),
      });
      setBName('');
      toast.success('Bina eklendi');
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Kaydedilemedi'); }
  };

  const saveEditBuilding = async () => {
    if (!token || !editBuilding || !editBName.trim()) return;
    try {
      await apiFetch(`/butterfly-exam/buildings/${editBuilding.id}${schoolQ}`, {
        method: 'PATCH', token, body: JSON.stringify({ name: editBName.trim() }),
      });
      toast.success('Güncellendi');
      setEditBuilding(null);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Güncellenemedi'); }
  };

  const delBuilding = async (id: string) => {
    if (!token || !confirm('Binayı ve salonları silmek istiyor musunuz?')) return;
    try {
      await apiFetch(`/butterfly-exam/buildings/${id}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Silindi');
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  const addRoom = async () => {
    if (!token || !rForm.buildingId || !rForm.name.trim()) return;
    const cap = parseInt(rForm.capacity, 10);
    if (!Number.isFinite(cap) || cap < 1) { toast.error('Geçerli kapasite girin'); return; }
    try {
      await apiFetch(`/butterfly-exam/rooms${schoolQ}`, {
        method: 'POST', token,
        body: JSON.stringify({
          building_id: rForm.buildingId,
          name: rForm.name.trim(),
          capacity: cap,
          seat_layout: rForm.seat_layout,
        }),
      });
      setRForm((f) => ({ ...f, name: '', capacity: '30', floor: '' }));
      toast.success('Salon eklendi');
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Kaydedilemedi'); }
  };

  const delRoom = async (id: string) => {
    if (!token || !confirm('Salonu silmek istiyor musunuz?')) return;
    try {
      await apiFetch(`/butterfly-exam/rooms/${id}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Silindi');
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  if (me?.role === 'teacher') {
    return (
      <div className="rounded-xl border border-rose-300/50 bg-rose-500/5 p-6 text-center text-sm text-muted-foreground">
        Salon ve bina tanımları yalnızca okul yöneticisi tarafından yapılır.
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Binalar', value: buildings.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
          { label: 'Sınıf Atamaları', value: `${Object.keys(classBuilding).length}/${classes.length}`, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Salon Atamaları', value: rooms.length, icon: DoorOpen, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/40' },
          { label: 'Yerleştirme Ayarları', value: strategy === 'inter_building' ? 'Binalar Arası' : 'Bina İçi', icon: Settings2, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
        ].map((stat) => {
          const Icon = stat.icon;
          const tabId = ['buildings', 'classes', 'rooms', 'strategy'][['Binalar', 'Sınıf Atamaları', 'Salon Atamaları', 'Yerleştirme Ayarları'].indexOf(stat.label)] as TabId;
          return (
            <button key={stat.label} type="button"
              onClick={() => setTab(tabId)}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-left transition hover:shadow-sm',
                tab === tabId
                  ? 'border-indigo-300/60 bg-indigo-50 dark:border-indigo-800/50 dark:bg-indigo-950/30'
                  : 'border-white/60 bg-white/80 dark:border-zinc-800/40 dark:bg-zinc-900/50'
              )}>
              <div className={cn('rounded-lg p-2', stat.bg)}>
                <Icon className={cn('size-4', stat.color)} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className="text-sm font-semibold">{stat.value}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab: Binalar */}
      {tab === 'buildings' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex items-center gap-2 rounded-xl border border-sky-300/40 bg-sky-500/5 px-4 py-3">
              <Building2 className="size-5 text-sky-600 shrink-0" />
              <Input
                placeholder="Bina adı (örn. Ana Bina, Ek Bina)"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addBuilding()}
                className="flex-1 bg-white/80 dark:bg-zinc-950/50"
              />
              <Button type="button" onClick={() => void addBuilding()} disabled={!bName.trim()} className="shrink-0 gap-1">
                <Plus className="size-4" /> Bina Ekle
              </Button>
            </div>
          )}

          {buildings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-muted-foreground dark:border-slate-700">
              Henüz bina yok. Tek binası olan okullar için bina eklemenize gerek yoktur.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {buildings.map((b) => {
                const bRooms = rooms.filter((r) => r.buildingId === b.id);
                const bClasses = classes.filter((c) => classBuilding[c.id] === b.id);
                return (
                  <div key={b.id} className="rounded-xl border border-white/60 bg-white/80 p-4 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-950/40">
                          <Building2 className="size-5 text-blue-600" />
                        </div>
                        {editBuilding?.id === b.id ? (
                          <div className="flex gap-1">
                            <Input value={editBName} onChange={(e) => setEditBName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && void saveEditBuilding()}
                              className="h-7 text-sm w-32" autoFocus />
                            <Button size="sm" className="h-7 text-xs px-2" onClick={() => void saveEditBuilding()}>Kaydet</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-1" onClick={() => setEditBuilding(null)}>İptal</Button>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold">{b.name}</p>
                            <p className="text-xs text-muted-foreground">{bRooms.length} salon · {bClasses.length} sınıf atanmış</p>
                          </div>
                        )}
                      </div>
                      {isAdmin && editBuilding?.id !== b.id && (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => { setEditBuilding(b); setEditBName(b.name); }}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700">
                            <Edit2 className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => void delBuilding(b.id)}
                            className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Salon Atamaları */}
      {tab === 'rooms' && (
        <div className="space-y-4">
          {/* Info */}
          {classes.length > 0 && (
            <div className="rounded-xl border border-blue-200/60 bg-blue-50/80 px-4 py-3 text-xs text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300">
              {classes.length} sınıf otomatik sınav salonu olarak ayarlanmıştır. "Salon Ekle" ile ders sınıflarından bağımsız alanlar ekleyebilirsiniz.
            </div>
          )}

          {isAdmin && (
            <div className="rounded-xl border border-violet-300/40 bg-violet-500/5 p-4">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <DoorOpen className="size-4 text-violet-600" /> Yeni Salon Ekle
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <select
                  className={cn('h-9 rounded-lg border border-input bg-white/85 px-3 text-sm dark:bg-zinc-950/55', !buildings.length && 'opacity-60')}
                  value={rForm.buildingId}
                  onChange={(e) => setRForm((f) => ({ ...f, buildingId: e.target.value }))}
                  disabled={!buildings.length}
                >
                  {!buildings.length && <option value="">Önce bina ekleyin</option>}
                  {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <Input placeholder="Salon Adı" value={rForm.name}
                  onChange={(e) => setRForm((f) => ({ ...f, name: e.target.value }))}
                  className="bg-white/80 dark:bg-zinc-950/50 text-sm" />
                <Input type="number" min={1} placeholder="Kapasite" value={rForm.capacity}
                  onChange={(e) => setRForm((f) => ({ ...f, capacity: e.target.value }))}
                  className="bg-white/80 dark:bg-zinc-950/50 text-sm" />
                <select
                  className="h-9 rounded-lg border border-input bg-white/85 px-3 text-sm dark:bg-zinc-950/55"
                  value={rForm.seat_layout}
                  onChange={(e) => setRForm((f) => ({ ...f, seat_layout: e.target.value as 'pair' | 'single' }))}>
                  <option value="pair">İkili Sıra</option>
                  <option value="single">Tekli Sıra</option>
                </select>
              </div>
              <Button type="button" onClick={() => void addRoom()} disabled={!buildings.length} className="mt-2 gap-1 text-sm">
                <Plus className="size-4" /> Salon Kaydet
              </Button>
            </div>
          )}

          {rooms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-muted-foreground dark:border-slate-700">
              Henüz salon yok.
            </div>
          ) : (
            <div className="space-y-2">
              {buildings.map((b) => {
                const bRooms = rooms.filter((r) => r.buildingId === b.id);
                if (!bRooms.length) return null;
                return (
                  <div key={b.id}>
                    <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{b.name}</p>
                    <div className="space-y-1.5">
                      {bRooms.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2.5 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/55">
                          <div className="flex items-center gap-2.5">
                            <div className="rounded-md bg-violet-100 p-1.5 dark:bg-violet-950/40">
                              <DoorOpen className="size-3.5 text-violet-600" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{r.name}</p>
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                                  {r.capacity} kişi
                                </span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                  {r.seatLayout === 'single' ? 'Tekli' : 'İkili'} sıra
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button type="button"
                              onClick={() => setLayoutRoom({ ...r, buildingName: buildings.find((b) => b.id === r.buildingId)?.name })}
                              className="flex items-center gap-1 rounded-lg border border-indigo-300/60 bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700/40 dark:bg-indigo-950/30 dark:text-indigo-300">
                              <LayoutGrid className="size-3" /> Düzen
                            </button>
                            {isAdmin && (
                              <button type="button" onClick={() => void delRoom(r.id)}
                                className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30">
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {/* Rooms not assigned to any building */}
              {rooms.filter((r) => !buildings.find((b) => b.id === r.buildingId)).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2.5 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/55">
                  <div>
                    <p className="text-sm font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.buildingName} · {r.capacity} kişi</p>
                  </div>
                  {isAdmin && (
                    <button type="button" onClick={() => void delRoom(r.id)} className="rounded p-1 text-rose-500">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Sınıf Atamaları */}
      {tab === 'classes' && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Her sınıfı bir binaya atayın. Atanmayan sınıflar &quot;tüm binalar&quot; ile çalışır.
          </p>
          {buildings.length === 0 ? (
            <div className="rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
              Önce &quot;Binalar&quot; sekmesinden bina ekleyin.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/60 bg-white/80 dark:border-zinc-800/40 dark:bg-zinc-900/60">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground dark:bg-zinc-800/80">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Sınıf Adı</th>
                    <th className="px-4 py-2.5 text-left">Seviye</th>
                    <th className="px-4 py-2.5 text-left">Öğrenci Sayısı</th>
                    <th className="px-4 py-2.5 text-left">Atanmış Bina</th>
                    {isAdmin && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.grade ?? '-'}</td>
                      <td className="px-4 py-2.5 tabular-nums">{c.studentCount}</td>
                      <td className="px-4 py-2.5">
                        {classBuilding[c.id] ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            {buildings.find((b) => b.id === classBuilding[c.id])?.name ?? 'Bina'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Tüm Binalar</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5">
                          <select
                            className="h-7 rounded-md border border-input bg-white/85 px-2 text-xs dark:bg-zinc-950/55"
                            value={classBuilding[c.id] ?? ''}
                            onChange={(e) => setClassBuilding((m) => ({ ...m, [c.id]: e.target.value }))}>
                            <option value="">Tüm Binalar</option>
                            {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sınıf Düzeni Modal */}
      {layoutRoom && token && (
        <ClassLayoutModal
          room={layoutRoom}
          schoolQ={schoolQ}
          token={token}
          onClose={() => setLayoutRoom(null)}
          onSaved={() => void load()}
        />
      )}

      {/* Tab: Yerleştirme Ayarları */}
      {tab === 'strategy' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Strategy */}
          <div className="rounded-xl border border-white/60 bg-white/80 p-4 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
            <div className="mb-3 flex items-center gap-2">
              <Settings2 className="size-4 text-indigo-600" />
              <p className="font-semibold text-sm">Yerleştirme Stratejisi</p>
            </div>
            <div className="space-y-2">
              <label className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                strategy === 'intra_building' ? 'border-indigo-400/60 bg-indigo-50/80 dark:bg-indigo-950/30' : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40'
              )}>
                <input type="radio" className="mt-0.5" checked={strategy === 'intra_building'} onChange={() => setStrategy('intra_building')} />
                <div>
                  <p className="text-sm font-medium">Bina İçi Yerleştirme</p>
                  <p className="text-xs text-muted-foreground">Her bina kendi öğrencilerini kendi salonlarında sınava alır.</p>
                </div>
              </label>
              <label className={cn(
                'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                strategy === 'inter_building' ? 'border-indigo-400/60 bg-indigo-50/80 dark:bg-indigo-950/30' : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800/40'
              )}>
                <input type="radio" className="mt-0.5" checked={strategy === 'inter_building'} onChange={() => setStrategy('inter_building')} />
                <div>
                  <p className="text-sm font-medium">Binalar Arası Yerleştirme</p>
                  <p className="text-xs text-muted-foreground">Tüm binalar birlikte kullanılır, öğrenciler farklı binalara yerleştirilir.</p>
                </div>
              </label>
            </div>
            <div className="mt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
                  specialRulesEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-600'
                )} onClick={() => setSpecialRulesEnabled((v) => !v)}>
                  <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform m-0.5', specialRulesEnabled ? 'translate-x-4' : 'translate-x-0')} />
                </div>
                <div>
                  <p className="text-sm font-medium">Özel Kuralları Uygula</p>
                  <p className="text-xs text-muted-foreground">Tanımladığınız sınıflara özel kurallara göre, diğer sınıflar yukarıdaki stratejiye göre yerleştirilir.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Special Rules panel */}
          <div className="rounded-xl border border-amber-300/40 bg-amber-50/50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-sm">Özel Kurallar Yönetimi</p>
              {specialRulesEnabled && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                  Aktif
                </span>
              )}
            </div>
            {!specialRulesEnabled ? (
              <p className="text-xs text-muted-foreground">
                &quot;Özel Kuralları Uygula&quot; seçeneğini aktif ederek sınıf bazlı bina atamaları yapabilirsiniz.
              </p>
            ) : (
              <div className="space-y-2">
                {classes.filter((c) => classBuilding[c.id]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sınıf Atamaları sekmesinden sınıflar için özel bina ataması yapın.
                  </p>
                ) : (
                  classes.filter((c) => classBuilding[c.id]).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-white/80 px-3 py-2 dark:border-amber-900/30 dark:bg-zinc-800/40">
                      <p className="text-sm font-medium">{c.name}</p>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {buildings.find((b) => b.id === classBuilding[c.id])?.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
