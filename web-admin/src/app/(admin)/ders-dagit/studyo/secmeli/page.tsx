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

type Pool = {
  id: string;
  name: string;
  base_section: string;
  member_sections: string[];
  subject_names: string[];
  group_id: string | null;
  weekly_hours_per_track: number;
};

export default function SecmeliPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [pools, setPools] = useState<Pool[]>([]);
  const [name, setName] = useState('');
  const [base, setBase] = useState('5A');
  const [members, setMembers] = useState('5A-A, 5A-B, 5A-C');
  const [subjects, setSubjects] = useState('Seçmeli 1, Seçmeli 2');
  const [hrs, setHrs] = useState(2);
  const [aihl, setAihl] = useState<{ ok: boolean; issues: Array<{ subject_name: string; assigned: number; max: number }> } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [list, norm] = await Promise.all([
      apiFetch<Pool[]>(`/ders-dagit/studios/${studio.id}/elective-pools`, { token }),
      apiFetch<{ ok: boolean; issues: Array<{ subject_name: string; assigned: number; max: number }> }>(
        `/ders-dagit/studios/${studio.id}/aihl-norm`,
        { token },
      ).catch(() => null),
    ]);
    setPools(list);
    setAihl(norm);
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token || !studio) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/elective-pools`, {
      token,
      method: 'POST',
      body: {
        name: name.trim() || `${base} Seçmeli`,
        base_section: base.trim(),
        member_sections: members.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
        subject_names: subjects.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
        weekly_hours_per_track: hrs,
      },
    });
    toast.success('Havuz kaydedildi');
    await load();
  }

  return (
    <div className="space-y-4">
      {aihl && !aihl.ok && (
        <Card className="border-amber-300">
          <CardHeader>
            <CardTitle className="text-base">AİHL norm uyarısı</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="space-y-1 text-xs">
              {aihl.issues.map((i, idx) => (
                <li key={idx}>
                  {i.subject_name}: {i.assigned} saat (max {i.max})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seçmeli havuz (Faz 37)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Ad</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="5A Seçmeli" />
          </div>
          <div>
            <Label>Ana şube</Label>
            <Input value={base} onChange={(e) => setBase(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Alt şubeler</Label>
            <Input value={members} onChange={(e) => setMembers(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Ders adları (virgül)</Label>
            <Input value={subjects} onChange={(e) => setSubjects(e.target.value)} />
          </div>
          <div>
            <Label>Saat / kol</Label>
            <Input type="number" min={1} max={6} value={hrs} onChange={(e) => setHrs(Number(e.target.value))} />
          </div>
          <Button type="button" onClick={() => void save()}>
            Kaydet
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Havuzlar ({pools.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {pools.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span>
                  <strong>{p.name}</strong> · {p.base_section}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {p.member_sections.join(', ')} · {p.subject_names.join(', ') || 'Seçmeli'}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (!token || !studio) return;
                      await apiFetch(`/ders-dagit/studios/${studio.id}/elective-pools/${p.id}/sync-group`, {
                        token,
                        method: 'POST',
                      });
                      toast.success('Alt grup oluşturuldu');
                      await load();
                    }}
                  >
                    Grup
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={async () => {
                      if (!token || !studio) return;
                      const r = await apiFetch<{ assignments_created: number }>(
                        `/ders-dagit/studios/${studio.id}/elective-pools/${p.id}/apply-assignments`,
                        { token, method: 'POST' },
                      );
                      toast.success(`${r.assignments_created} atama`);
                      await load();
                    }}
                  >
                    Atama
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      if (!token || !studio) return;
                      await apiFetch(`/ders-dagit/studios/${studio.id}/elective-pools/${p.id}`, {
                        token,
                        method: 'DELETE',
                      });
                      await load();
                    }}
                  >
                    Sil
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
