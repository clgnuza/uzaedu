'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Scale } from 'lucide-react';
import { profileIdForSection } from '@/lib/dd-entity-scope';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { DdPageHeader, DD_PAGE } from '@/components/ders-dagit/dd-ui';
import { RulesStudioPanel, type RuleState, type RulesRes } from '@/components/ders-dagit/RulesStudioPanel';
import { toast } from 'sonner';

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
    const fallbackDays = r.rules.meb_pe_music_days?.params?.days;
    if (fallbackDays?.length) setPeDays([...fallbackDays].sort((a, b) => a - b));
    const defaultTravel =
      (r.building_travel ?? []).find((x) => x.from === 'default' && x.to === 'default')?.minutes ?? 5;
    setTravelMin(defaultTravel);
    setTravelPairMin(defaultTravel);
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const merged =
      scope === STUDIO_SCOPE
        ? data.rules
        : { ...data.rules, ...(data.class_profiles?.find((p) => p.id === scope)?.rules ?? {}) };
    const d = merged.meb_pe_music_days?.params?.days;
    if (d?.length) setPeDays([...d].sort((a, b) => a - b));
  }, [data, scope]);

  useEffect(() => {
    if (!data) return;
    const row = (data.building_travel ?? []).find((x) => x.from === travelFrom && x.to === travelTo);
    if (row?.minutes != null) {
      setTravelPairMin(row.minutes);
      return;
    }
    const fallback =
      (data.building_travel ?? []).find((x) => x.from === 'default' && x.to === 'default')?.minutes ?? travelMin;
    setTravelPairMin(fallback);
  }, [data, travelFrom, travelTo, travelMin]);

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
      const studioRule = data.rules[key];
      const next = nextDisplay[key];
      if (!next) continue;
      const same =
        !!studioRule?.active === !!next.active &&
        (studioRule?.weight ?? 5) === (next.weight ?? 5) &&
        JSON.stringify(studioRule?.params ?? {}) === JSON.stringify(next.params ?? {});
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
      label: `${p.name} (${(p.class_sections ?? []).join(', ') || 'şube yok'})`,
    })),
  ];

  return (
    <div className={DD_PAGE}>
      <DdPageHeader
        icon={Scale}
        title="Kurallar"
        description="Zorunlu, tercih ve pedagoji — her satırın yanındaki (i) ile açıklama."
      />
      {data && (
        <RulesStudioPanel
          scope={scope}
          studioScope={STUDIO_SCOPE}
          scopeOptions={scopeOptions.length > 1 ? scopeOptions : [{ value: STUDIO_SCOPE, label: 'Tüm okul (varsayılan)' }]}
          onScopeChange={setScope}
          profile={profile}
          scopeSectionLabel={searchParams.get('section')}
          catalog={data.catalog}
          displayRules={displayRules}
          onToggle={(k, v) => void toggle(k, v)}
          onWeight={(k, w) => void setWeight(k, w)}
          peDays={peDays}
          onPeDaysChange={setPeDays}
          onSavePeDays={() => {
            if (!displayRules) return;
            void applyRules({
              ...displayRules,
              meb_pe_music_days: {
                ...displayRules.meb_pe_music_days,
                active: displayRules.meb_pe_music_days?.active ?? true,
                params: { days: peDays },
              },
            });
          }}
          peSaveDisabled={!data || peDays.length === 0}
          travelMin={travelMin}
          onTravelMinChange={setTravelMin}
          onSaveTravelDefault={() => {
            const rows = data?.building_travel ?? [];
            const next = rows.filter((x) => !(x.from === 'default' && x.to === 'default'));
            next.push({ from: 'default', to: 'default', minutes: travelMin });
            void patchStudio(data!.rules, next);
          }}
          buildings={buildings}
          travelFrom={travelFrom}
          travelTo={travelTo}
          travelPairMin={travelPairMin}
          onTravelFrom={setTravelFrom}
          onTravelTo={setTravelTo}
          onTravelPairMin={setTravelPairMin}
          onSaveTravelPair={() => {
            if (!data) return;
            const rows = [...(data.building_travel ?? [])];
            const i = rows.findIndex((x) => x.from === travelFrom && x.to === travelTo);
            const row = { from: travelFrom, to: travelTo, minutes: travelPairMin };
            if (i >= 0) rows[i] = row;
            else rows.push(row);
            void patchStudio(data.rules, rows);
          }}
          buildingTravel={data.building_travel}
        />
      )}
    </div>
  );
}
