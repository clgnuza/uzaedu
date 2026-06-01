'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DdAccentButton,
  DdPageHeader,
  DD_PAGE,
} from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Merge, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Building = { id: string; name: string; sort_order?: number };
type Room = { id: string; building_id: string | null };

function normName(name: string) {
  return name.trim().toLocaleLowerCase('tr');
}

export default function BinalarPage() {
  const { token } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeKeepId, setMergeKeepId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        apiFetch<Building[]>('/ders-dagit/buildings', { token }),
        apiFetch<Room[]>('/ders-dagit/rooms', { token }),
      ]);
      setBuildings(b);
      setRooms(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const roomCountByBuilding = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rooms) {
      if (!r.building_id) continue;
      m.set(r.building_id, (m.get(r.building_id) ?? 0) + 1);
    }
    return m;
  }, [rooms]);

  const duplicateNameKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of buildings) {
      const k = normName(b.name);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [buildings]);

  const selectedList = useMemo(() => buildings.filter((b) => selected.has(b.id)), [buildings, selected]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addBuilding() {
    if (!token || !newName.trim()) return;
    const k = normName(newName);
    if (buildings.some((b) => normName(b.name) === k)) {
      toast.error('Aynı isimde bina zaten var');
      return;
    }
    setBusy(true);
    try {
      await apiFetch<Building>('/ders-dagit/buildings', {
        token,
        method: 'POST',
        body: { name: newName.trim() },
      });
      setNewName('');
      toast.success('Bina eklendi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(b: Building) {
    setEditId(b.id);
    setEditName(b.name);
  }

  async function saveEdit() {
    if (!token || !editId || !editName.trim()) return;
    const k = normName(editName);
    if (buildings.some((b) => b.id !== editId && normName(b.name) === k)) {
      toast.error('Bu isim başka bir binada kullanılıyor');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/ders-dagit/buildings', {
        token,
        method: 'POST',
        body: { id: editId, name: editName.trim() },
      });
      setEditId(null);
      toast.success('Kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBuilding(id: string, name: string) {
    if (!token) return;
    const n = roomCountByBuilding.get(id) ?? 0;
    const msg =
      n > 0
        ? `“${name}” silinsin mi? ${n} dersliğin binası boşalır (derslikler silinmez).`
        : `“${name}” silinsin mi?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/buildings/${id}`, { token, method: 'DELETE' });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Bina silindi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setBusy(false);
    }
  }

  async function mergeSelected() {
    if (!token || selectedList.length < 2) {
      toast.message('Birleştirmek için en az 2 bina seçin');
      return;
    }
    const keepId = mergeKeepId || selectedList[0]!.id;
    const mergeIds = selectedList.map((b) => b.id).filter((id) => id !== keepId);
    if (!mergeIds.length) {
      toast.message('Kalacak bina dışında en az bir kayıt seçin');
      return;
    }
    const keeper = buildings.find((b) => b.id === keepId);
    if (
      !window.confirm(
        `${mergeIds.length + 1} bina tek kayıtta birleştirilecek. Kalacak: “${keeper?.name ?? '?'}”. Devam?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ merged: number; rooms_moved: number }>('/ders-dagit/buildings/merge', {
        token,
        method: 'POST',
        body: { keep_id: keepId, merge_ids: [...mergeIds, keepId] },
      });
      setSelected(new Set());
      setMergeKeepId('');
      toast.success(`${res.merged} bina birleştirildi · ${res.rooms_moved} derslik taşındı`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Birleştirilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={Building2}
        title="Binalar"
        description="Kampüs binaları okul genelindedir. Yinelenen kayıtları birleştirebilirsiniz."
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/ders-dagit/studyo/derslikler">← Derslikler</Link>
        </Button>
      </div>

      <DdCard variant="teal">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Yeni bina</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-xs">Bina adı</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Örn. Ana Bina, Spor Salonu Blok"
              onKeyDown={(e) => e.key === 'Enter' && void addBuilding()}
            />
          </div>
          <DdAccentButton type="button" disabled={busy || !newName.trim()} onClick={() => void addBuilding()}>
            Ekle
          </DdAccentButton>
        </CardContent>
      </DdCard>

      {selectedList.length >= 2 ? (
        <DdCard variant="violet" className="border-violet-300/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Merge className="size-4" aria-hidden />
              Seçili binaları birleştir ({selectedList.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Derslikler kalacak binaya taşınır; diğer bina kayıtları silinir.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Kalacak bina</Label>
              <select
                className="h-9 w-full max-w-md rounded-md border bg-background px-2 text-sm"
                value={mergeKeepId || selectedList[0]?.id || ''}
                onChange={(e) => setMergeKeepId(e.target.value)}
              >
                {selectedList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({roomCountByBuilding.get(b.id) ?? 0} derslik)
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" size="sm" disabled={busy} onClick={() => void mergeSelected()}>
              Birleştir
            </Button>
          </CardContent>
        </DdCard>
      ) : null}

      <DdCard variant="sky">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Kayıtlı binalar ({buildings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !buildings.length ? (
            <p className="text-sm text-muted-foreground">Henüz bina yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 px-2 py-2" />
                    <th className="px-2 py-2">Ad</th>
                    <th className="px-2 py-2 text-right">Derslik</th>
                    <th className="px-2 py-2 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b) => {
                    const dup = duplicateNameKeys.has(normName(b.name));
                    const editing = editId === b.id;
                    return (
                      <tr
                        key={b.id}
                        className={cn('border-t', dup && 'bg-amber-50/80 dark:bg-amber-950/20')}
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-border"
                            checked={selected.has(b.id)}
                            onChange={() => toggleSelect(b.id)}
                            aria-label={`${b.name} seç`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          {editing ? (
                            <Input
                              className="h-8 max-w-xs text-sm"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void saveEdit();
                                if (e.key === 'Escape') setEditId(null);
                              }}
                            />
                          ) : (
                            <span className="font-medium">
                              {b.name}
                              {dup ? (
                                <span className="ml-2 text-[10px] font-normal text-amber-700 dark:text-amber-300">
                                  (yinelenen ad)
                                </span>
                              ) : null}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {roomCountByBuilding.get(b.id) ?? 0}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            {editing ? (
                              <>
                                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void saveEdit()}>
                                  Kaydet
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>
                                  İptal
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  title="Adı düzenle"
                                  onClick={() => startEdit(b)}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  title="Sil"
                                  disabled={busy}
                                  onClick={() => void deleteBuilding(b.id, b.name)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </DdCard>
    </div>
  );
}
