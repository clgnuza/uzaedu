'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Building = { id: string; name: string };
type Room = {
  id: string;
  name: string;
  building_id: string | null;
  capacity: number | null;
  allowed_subjects?: string[] | null;
  allowed_class_sections?: string[] | null;
  allowed_teacher_ids?: string[] | null;
};

export default function DersliklerPage() {
  const { token } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bName, setBName] = useState('Ana Bina');
  const [rName, setRName] = useState('');
  const [rCap, setRCap] = useState(30);
  const [rSubjects, setRSubjects] = useState('');
  const [rSections, setRSections] = useState('');
  const [rTeachers, setRTeachers] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [b, r] = await Promise.all([
      apiFetch<Building[]>('/ders-dagit/buildings', { token }),
      apiFetch<Room[]>('/ders-dagit/rooms', { token }),
    ]);
    setBuildings(b);
    setRooms(r);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addBuilding() {
    if (!token || !bName.trim()) return;
    await apiFetch('/ders-dagit/buildings', { token, method: 'POST', body: { name: bName.trim() } });
    toast.success('Bina eklendi');
    await load();
  }

  function roomBody() {
    return {
      name: rName.trim(),
      building_id: buildings[0]?.id ?? null,
      capacity: rCap,
      features: [] as string[],
      allowed_subjects: rSubjects ? rSubjects.split(',').map((s) => s.trim()).filter(Boolean) : null,
      allowed_class_sections: rSections ? rSections.split(',').map((s) => s.trim()).filter(Boolean) : null,
      allowed_teacher_ids: rTeachers ? rTeachers.split(',').map((s) => s.trim()).filter(Boolean) : null,
    };
  }

  function loadRoomToForm(r: Room) {
    setEditId(r.id);
    setRName(r.name);
    setRCap(r.capacity ?? 30);
    setRSubjects(r.allowed_subjects?.join(',') ?? '');
    setRSections(r.allowed_class_sections?.join(',') ?? '');
    setRTeachers(r.allowed_teacher_ids?.join(',') ?? '');
  }

  async function saveRoom() {
    if (!token || !rName.trim()) return;
    await apiFetch('/ders-dagit/rooms', {
      token,
      method: 'POST',
      body: editId ? { id: editId, ...roomBody() } : roomBody(),
    });
    setRName('');
    setEditId(null);
    setRSubjects('');
    setRSections('');
    setRTeachers('');
    toast.success(editId ? 'Güncellendi' : 'Derslik eklendi');
    await load();
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Binalar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="Bina adı" />
            <Button type="button" onClick={() => void addBuilding()}>
              Ekle
            </Button>
          </div>
          <ul className="text-sm">
            {buildings.map((b) => (
              <li key={b.id} className="flex justify-between">
                {b.name}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    await apiFetch(`/ders-dagit/buildings/${b.id}`, { token: token!, method: 'DELETE' });
                    await load();
                  }}
                >
                  Sil
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Derslikler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Ad</Label>
            <Input value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Lab-1" />
          </div>
          <div>
            <Label>Kapasite</Label>
            <Input type="number" value={rCap} onChange={(e) => setRCap(Number(e.target.value))} />
          </div>
          <div>
            <Label className="text-xs">İzinli dersler (virgül)</Label>
            <Input value={rSubjects} onChange={(e) => setRSubjects(e.target.value)} placeholder="Matematik,Fizik" />
          </div>
          <div>
            <Label className="text-xs">İzinli sınıflar</Label>
            <Input value={rSections} onChange={(e) => setRSections(e.target.value)} placeholder="5A,5B" />
          </div>
          <div>
            <Label className="text-xs">İzinli öğretmen id</Label>
            <Input value={rTeachers} onChange={(e) => setRTeachers(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void saveRoom()} disabled={!buildings.length}>
              {editId ? 'Güncelle' : 'Derslik ekle'}
            </Button>
            {editId && (
              <Button type="button" variant="outline" onClick={() => { setEditId(null); setRName(''); }}>
                İptal
              </Button>
            )}
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {rooms.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <button type="button" className="text-left hover:underline" onClick={() => loadRoomToForm(r)}>
                  {r.name}
                  {r.capacity ? ` (${r.capacity})` : ''}
                  {r.allowed_subjects?.length ? ` · ${r.allowed_subjects.join('/')}` : ''}
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    await apiFetch(`/ders-dagit/rooms/${r.id}`, { token: token!, method: 'DELETE' });
                    await load();
                  }}
                >
                  Sil
                </Button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
