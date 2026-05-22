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

type GroupMode = 'parallel_rooms' | 'subgroups' | 'teacher_multi_class';

type Group = {
  id: string;
  name: string;
  abbreviation: string;
  parallel_mode: string | null;
  member_sections: string[];
};

type GroupsRes = {
  groups: Group[];
  catalog: Array<{ mode: GroupMode; label_tr: string; horarium_ref: string }>;
};

export default function GruplarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<GroupsRes | null>(null);
  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [mode, setMode] = useState<GroupMode>('parallel_rooms');
  const [members, setMembers] = useState('5A-A, 5A-B');

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setData(await apiFetch<GroupsRes>(`/ders-dagit/studios/${studio.id}/groups`, { token }));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token || !studio || !name.trim() || !abbr.trim()) return;
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/groups`, {
        token,
        method: 'POST',
        body: {
          name: name.trim(),
          abbreviation: abbr.trim().slice(0, 8),
          parallel_mode: mode,
          member_sections: members.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
        },
      });
      setName('');
      setAbbr('');
      toast.success('Grup kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  }

  const modeLabel = (m: string | null) =>
    data?.catalog.find((c) => c.mode === m)?.label_tr ?? m ?? '—';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Horarium Gruplar:{' '}
        <a href="https://horarium.ai/tr/help#divisions" className="underline" target="_blank" rel="noreferrer">
          yardım
        </a>
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni grup</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Ad</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="5A bölünmesi" />
          </div>
          <div>
            <Label>Kısaltma</Label>
            <Input value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="5a" maxLength={8} />
          </div>
          <div className="sm:col-span-2">
            <Label>Mod</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as GroupMode)}
            >
              {(data?.catalog ?? []).map((c) => (
                <option key={c.mode} value={c.mode}>
                  {c.label_tr}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label>Alt şubeler (virgülle)</Label>
            <Input value={members} onChange={(e) => setMembers(e.target.value)} placeholder="5A-A, 5A-B" />
          </div>
          <Button type="button" onClick={() => void save()}>
            Kaydet
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gruplar ({data?.groups.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {(data?.groups ?? []).map((g) => (
              <li key={g.id} className="flex justify-between rounded-lg border px-3 py-2">
                <span>
                  <strong>{g.name}</strong> ({g.abbreviation}) — {modeLabel(g.parallel_mode)}
                  <br />
                  <span className="text-xs text-muted-foreground">{g.member_sections?.join(', ') || '—'}</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={async () => {
                    if (!token || !studio) return;
                    await apiFetch(`/ders-dagit/studios/${studio.id}/groups/${g.id}`, {
                      token,
                      method: 'DELETE',
                    });
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
