'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type RuleDef = { key: string; label_tr: string; kind: string };
type RulesRes = {
  rules: Record<string, { active: boolean; weight?: number; params?: { days?: number[] } }>;
  catalog: RuleDef[];
  building_travel?: Array<{ from: string; to: string; minutes: number }>;
};

export default function KurallarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<RulesRes | null>(null);
  const [travelMin, setTravelMin] = useState(5);
  const [peDays, setPeDays] = useState('2,4');
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([]);
  const [travelFrom, setTravelFrom] = useState('default');
  const [travelTo, setTravelTo] = useState('default');
  const [travelPairMin, setTravelPairMin] = useState(5);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [r, b] = await Promise.all([
      apiFetch<RulesRes>(`/ders-dagit/studios/${studio.id}/rules`, { token }),
      apiFetch<Array<{ id: string; name: string }>>('/ders-dagit/buildings', { token }),
    ]);
    setData(r);
    setBuildings(b);
    const d = r.rules.meb_pe_music_days?.params?.days;
    if (d?.length) setPeDays(d.join(','));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(rules: RulesRes['rules'], building_travel?: RulesRes['building_travel']) {
    if (!token || !studio || !data) return;
    const body: { rules: typeof rules; building_travel?: typeof building_travel } = { rules };
    if (building_travel !== undefined) body.building_travel = building_travel;
    await apiFetch(`/ders-dagit/studios/${studio.id}/rules`, { token, method: 'PATCH', body });
    setData({ ...data, rules, building_travel: building_travel ?? data.building_travel });
    toast.success('Kaydedildi');
  }

  async function toggle(key: string, active: boolean) {
    if (!data) return;
    const rules = { ...data.rules, [key]: { ...data.rules[key], active } };
    await patch(rules);
  }

  async function setWeight(key: string, weight: number) {
    if (!data) return;
    const rules = { ...data.rules, [key]: { ...data.rules[key], active: true, weight } };
    await patch(rules);
  }

  const byKind = (kind: string) => data?.catalog.filter((c) => c.kind === kind) ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {(['hard', 'soft', 'pedagogy'] as const).map((kind) => (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-base capitalize">{kind === 'hard' ? 'Sert' : kind === 'soft' ? 'Yumuşak' : 'MEB'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {byKind(kind).map((r) => (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={r.key} className="text-xs leading-snug">
                      {r.label_tr}
                    </Label>
                    <Switch
                      id={r.key}
                      checked={data?.rules[r.key]?.active ?? false}
                      onCheckedChange={(v) => void toggle(r.key, v)}
                    />
                  </div>
                  {kind !== 'hard' && data?.rules[r.key]?.active && (
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      placeholder="Ağırlık"
                      value={data?.rules[r.key]?.weight ?? 5}
                      onChange={(e) => void setWeight(r.key, Number(e.target.value))}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">MEB beden/müzik günleri</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <Input
            className="w-40 font-mono text-xs"
            value={peDays}
            onChange={(e) => setPeDays(e.target.value)}
            placeholder="2,4 (Sal,Per)"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!data}
            onClick={() => {
              if (!data) return;
              const days = peDays
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => n >= 1 && n <= 7);
              const rules = {
                ...data.rules,
                meb_pe_music_days: {
                  ...data.rules.meb_pe_music_days,
                  active: data.rules.meb_pe_music_days?.active ?? true,
                  params: { days: days.length ? days : [2, 4] },
                },
              };
              void patch(rules);
            }}
          >
            Günleri kaydet
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bina geçiş süresi (dakika)</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input type="number" className="w-24" value={travelMin} onChange={(e) => setTravelMin(Number(e.target.value))} />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              const rows = data?.building_travel ?? [];
              const next = rows.filter((x) => !(x.from === 'default' && x.to === 'default'));
              next.push({ from: 'default', to: 'default', minutes: travelMin });
              void patch(data!.rules, next);
            }}
          >
            Varsayılan kaydet
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bina geçiş matrisi</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-2">
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={travelFrom}
            onChange={(e) => setTravelFrom(e.target.value)}
          >
            <option value="default">Varsayılan</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="text-sm">→</span>
          <select
            className="h-9 rounded-md border px-2 text-sm"
            value={travelTo}
            onChange={(e) => setTravelTo(e.target.value)}
          >
            <option value="default">Varsayılan</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <Input type="number" className="w-20" value={travelPairMin} onChange={(e) => setTravelPairMin(Number(e.target.value))} />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (!data) return;
              const rows = [...(data.building_travel ?? [])];
              const i = rows.findIndex((x) => x.from === travelFrom && x.to === travelTo);
              const row = { from: travelFrom, to: travelTo, minutes: travelPairMin };
              if (i >= 0) rows[i] = row;
              else rows.push(row);
              void patch(data.rules, rows);
            }}
          >
            Ekle / güncelle
          </Button>
        </CardContent>
        {data?.building_travel && data.building_travel.length > 0 && (
          <ul className="px-6 pb-4 text-xs text-muted-foreground">
            {data.building_travel.map((t, i) => (
              <li key={i}>
                {t.from} → {t.to}: {t.minutes} dk
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
