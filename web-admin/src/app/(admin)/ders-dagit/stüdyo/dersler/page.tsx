'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Subject = {
  id: string;
  name: string;
  short_code: string | null;
  class_hours: Record<string, number>;
};

export default function DerslerPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [rows, setRows] = useState<Subject[]>([]);
  const [name, setName] = useState('');
  const [section, setSection] = useState('5A');
  const [hours, setHours] = useState(4);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setRows(await apiFetch<Subject[]>(`/ders-dagit/studios/${studio.id}/subjects`, { token }));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add() {
    if (!token || !studio || !name.trim()) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/subjects`, {
      token,
      method: 'POST',
      body: { name: name.trim(), class_hours: { [section]: hours } },
    });
    setName('');
    toast.success('Ders eklendi');
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ders kataloğu (Faz 5)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label>Ders adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Matematik" />
          </div>
          <div>
            <Label>Şube</Label>
            <Input value={section} onChange={(e) => setSection(e.target.value)} />
          </div>
          <div>
            <Label>Saat/hafta</Label>
            <Input type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={() => void add()}>
              Ekle
            </Button>
          </div>
        </CardContent>
      </Card>
      <ul className="space-y-2 text-sm">
        {rows.map((s) => (
          <li key={s.id} className="flex justify-between rounded-lg border px-3 py-2">
            <span>
              <strong>{s.name}</strong>{' '}
              <span className="text-muted-foreground">
                {Object.entries(s.class_hours ?? {})
                  .map(([k, v]) => `${k}:${v}`)
                  .join(', ') || '—'}
              </span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                if (!token || !studio) return;
                await apiFetch(`/ders-dagit/studios/${studio.id}/subjects/${s.id}`, { token, method: 'DELETE' });
                await load();
              }}
            >
              Sil
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
