'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GitBranch } from 'lucide-react';
import { formatClassSectionsList } from '@/lib/class-section-sort';
import { profileIdForSection } from '@/lib/dd-entity-scope';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { DdCard, CardContent, CardHeader, CardTitle, DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { Scale } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { DdWeekdayPicker } from '@/components/ders-dagit/dd-weekday-picker';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RULE_KIND_UI, ruleLabel } from '@/lib/ders-dagit-labels';

type RuleState = { active: boolean; weight?: number; params?: { days?: number[] } };
type RuleDef = { key: string; label_tr: string; kind: string };
type ClassProfileRules = {
  id: string;
  name: string;
  class_sections: string[];
  rules: Record<string, RuleState> | null;
};
type RulesRes = {
  rules: Record<string, RuleState>;
  catalog: RuleDef[];
  building_travel?: Array<{ from: string; to: string; minutes: number }>;
  class_profiles?: ClassProfileRules[];
};

const STUDIO_SCOPE = '__studio__';

export default function KurallarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const searchParams = useSearchParams();
  const [data, setData] = useState<RulesRes | null>(null);
  const [scope, setScope] = useState(STUDIO_SCOPE);
  const [travelMin, setTravelMin] = useState(5);
  const [peDays, setPeDays] = useState<number[]>([2, 4]);
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string }>>([]);
  const [travelFrom, setTravelFrom] = useState('default');
  const [travelTo, setTravelTo] = useState('default');
  const [travelPairMin, setTravelPairMin] = useState(5);

  const profile = useMemo(
    () => data?.class_profiles?.find((p) => p.id === scope),
    [data, scope],
  );

  const displayRules = useMemo(() => {
    if (!data) return null;
    if (scope === STUDIO_SCOPE) return data.rules;
    return { ...data.rules, ...(profile?.rules ?? {}) };
  }, [data, scope, profile]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [r, b] = await Promise.all([
      apiFetch<RulesRes>(`/ders-dagit/studios/${studio.id}/rules`, { token }),
      apiFetch<Array<{ id: string; name: string }>>('/ders-dagit/buildings', { token }),
    ]);
    setData(r);
    setBuildings(b);
    const merged = scope === STUDIO_SCOPE ? r.rules : { ...r.rules, ...(r.class_profiles?.find((p) => p.id === scope)?.rules ?? {}) };
    const d = merged.meb_pe_music_days?.params?.days;
    if (d?.length) setPeDays([...d].sort((a, b) => a - b));
  }, [token, studio, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const pid = searchParams.get('profile');
    const sec = searchParams.get('section');
    if (pid && data.class_profiles?.some((p) => p.id === pid)) {
      setScope(pid);
      return;
    }
    if (sec) {
      const found = profileIdForSection(data.class_profiles ?? [], sec);
      if (found) setScope(found);
    }
  }, [data, searchParams]);

  const scopeSectionLabel = searchParams.get('section');

  async function patchStudio(rules: RulesRes['rules'], building_travel?: RulesRes['building_travel']) {
    if (!token || !studio || !data) return;
    const body: { rules: typeof rules; building_travel?: typeof building_travel } = { rules };
    if (building_travel !== undefined) body.building_travel = building_travel;
    const res = await apiFetch<RulesRes>(`/ders-dagit/studios/${studio.id}/rules`, { token, method: 'PATCH', body });
    setData(res);
    toast.success('Kaydedildi');
  }

  async function patchProfileRules(profileRules: Record<string, RuleState>) {
    if (!token || !studio || !profile) return;
    const res = await apiFetch<RulesRes>(
      `/ders-dagit/studios/${studio.id}/class-profiles/${profile.id}/rules`,
      { token, method: 'PATCH', body: { rules: profileRules } },
    );
    setData(res);
    toast.success('Profil kuralları kaydedildi');
  }

  async function applyRules(nextDisplay: Record<string, RuleState>) {
    if (!data) return;
    if (scope === STUDIO_SCOPE) {
      await patchStudio(nextDisplay);
      return;
    }
    const overrides: Record<string, RuleState> = { ...(profile?.rules ?? {}) };
    for (const key of Object.keys(nextDisplay)) {
      const studio = data.rules[key];
      const next = nextDisplay[key];
      if (!next) continue;
      const same =
        !!studio?.active === !!next.active &&
        (studio?.weight ?? 5) === (next.weight ?? 5) &&
        JSON.stringify(studio?.params ?? {}) === JSON.stringify(next.params ?? {});
      if (same) delete overrides[key];
      else overrides[key] = next;
    }
    await patchProfileRules(overrides);
  }

  async function toggle(key: string, active: boolean) {
    if (!displayRules) return;
    const rules = { ...displayRules, [key]: { ...displayRules[key], active } };
    await applyRules(rules);
  }

  async function setWeight(key: string, weight: number) {
    if (!displayRules) return;
    const rules = { ...displayRules, [key]: { ...displayRules[key], active: true, weight } };
    await applyRules(rules);
  }

  const scopeOptions = [
    { value: STUDIO_SCOPE, label: 'Tüm okul (varsayılan)' },
    ...(data?.class_profiles ?? []).map((p) => ({
      value: p.id,
      label: `${p.name} (${formatClassSectionsList(p.class_sections ?? []) || 'şube yok'})`,
    })),
  ];

  const byKind = (kind: string) => data?.catalog.filter((c) => c.kind === kind) ?? [];

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={Scale}
        title="Kurallar"
        description="Zorunlu, tercih ve pedagoji kuralları — okul veya sınıf profili kapsamı."
      />
      {(scopeSectionLabel || (scope !== STUDIO_SCOPE && profile)) && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <strong>Bireysel kapsam:</strong>{' '}
          {scopeSectionLabel
            ? `şube ${scopeSectionLabel}`
            : profile
              ? `${profile.name} (${formatClassSectionsList(profile.class_sections ?? [])})`
              : 'sınıf profili'}
          <p className="mt-1 text-xs text-muted-foreground">Buradaki kural değişiklikleri yalnızca bu kapsamdaki şubelere uygulanır.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/ders-dagit/studyo/planlama-iliskileri"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <GitBranch className="h-3.5 w-3.5" />
          Planlama ilişkileri (aSc)
        </Link>
      </div>
      <DdSelectField
        label="Kural kapsamı"
        value={scope}
        onValueChange={setScope}
        options={scopeOptions.length > 1 ? scopeOptions : [{ value: STUDIO_SCOPE, label: 'Tüm okul (varsayılan)' }]}
      />
      {scope !== STUDIO_SCOPE && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Sadece <strong>{profile?.name}</strong> şubeleri için geçerli kural değişiklikleri kaydedilir; diğer şubeler okul
          varsayılanını kullanır.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {(['hard', 'soft', 'pedagogy'] as const).map((kind) => (
          <DdCard key={kind}>
            <CardHeader>
              <CardTitle className="text-base">{RULE_KIND_UI[kind].title}</CardTitle>
              <p className="text-xs text-muted-foreground">{RULE_KIND_UI[kind].hint}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {byKind(kind).map((r) => (
                <div key={r.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={r.key} className="text-xs leading-snug">
                      {ruleLabel(r.key, r.label_tr)}
                    </Label>
                    <Switch
                      id={r.key}
                      checked={displayRules?.[r.key]?.active ?? false}
                      onCheckedChange={(v) => void toggle(r.key, v)}
                    />
                  </div>
                  {kind !== 'hard' && displayRules?.[r.key]?.active && (
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      placeholder="Öncelik puanı"
                      value={displayRules?.[r.key]?.weight ?? 5}
                      onChange={(e) => void setWeight(r.key, Number(e.target.value))}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </DdCard>
        ))}
      </div>
      {scope === STUDIO_SCOPE && (
        <>
          <DdCard>
            <CardHeader>
              <CardTitle className="text-base">Beden ve müzik dersi günleri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <DdWeekdayPicker value={peDays} onChange={setPeDays} minSelected={1} />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!data || peDays.length === 0}
                onClick={() => {
                  if (!displayRules) return;
                  const rules = {
                    ...displayRules,
                    meb_pe_music_days: {
                      ...displayRules.meb_pe_music_days,
                      active: displayRules.meb_pe_music_days?.active ?? true,
                      params: { days: peDays },
                    },
                  };
                  void applyRules(rules);
                }}
              >
                Günleri kaydet
              </Button>
            </CardContent>
          </DdCard>
          <DdCard>
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
                  void patchStudio(data!.rules, next);
                }}
              >
                Varsayılan kaydet
              </Button>
            </CardContent>
          </DdCard>
          <DdCard>
            <CardHeader>
              <CardTitle className="text-base">Bina geçiş matrisi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-2">
              <DdSelectField
                label="Kaynak bina"
                className="min-w-[140px] flex-1 sm:max-w-[200px]"
                value={travelFrom}
                onValueChange={setTravelFrom}
                options={[
                  { value: 'default', label: 'Varsayılan' },
                  ...buildings.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
              <span className="hidden pb-2 text-sm sm:inline">→</span>
              <DdSelectField
                label="Hedef bina"
                className="min-w-[140px] flex-1 sm:max-w-[200px]"
                value={travelTo}
                onValueChange={setTravelTo}
                options={[
                  { value: 'default', label: 'Varsayılan' },
                  ...buildings.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
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
                  void patchStudio(data.rules, rows);
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
          </DdCard>
        </>
      )}
    </div>
  );
}
