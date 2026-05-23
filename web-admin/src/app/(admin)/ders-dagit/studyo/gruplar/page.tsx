'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DdPageHeader,
  DD_PAGE,
  DD_CARD_CONTENT,
  DD_CARD_HEADER,
} from '@/components/ders-dagit/dd-ui';
import { GitBranch, Info, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { DdSectionMultiField } from '@/components/ders-dagit/dd-section-picker';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { GroupEntityTable, type GroupRow } from '@/components/ders-dagit/group-entity-table';
import { groupModeLabel } from '@/lib/ders-dagit-labels';
import { schoolTypeLabel } from '@/lib/dersler-studio';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type GroupMode = 'parallel_rooms' | 'subgroups' | 'teacher_multi_class';

type Group = GroupRow;

type CatalogEntry = {
  mode: GroupMode;
  label_tr: string;
  hint_tr?: string;
  recommended?: boolean;
};

type GroupPreset = {
  id: string;
  label: string;
  description: string;
  parallel_mode: GroupMode;
  name_placeholder: string;
  abbr_placeholder: string;
};

type GroupSuggestion = {
  key: string;
  name: string;
  abbreviation: string;
  parallel_mode: GroupMode;
  member_sections: string[];
  source: string;
  reason: string;
  already_exists: boolean;
};

type GroupsRes = {
  groups: Group[];
  catalog: CatalogEntry[];
  school_type: string;
  default_mode: GroupMode;
  presets: GroupPreset[];
  school_hint: string;
};

const SOURCE_LABEL: Record<string, string> = {
  section_tracks: 'Şube adları',
  assignment_joined: 'Atama',
  elective_cluster: 'Seçmeli',
};

export default function GruplarPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [data, setData] = useState<GroupsRes | null>(null);
  const [suggestions, setSuggestions] = useState<GroupSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [selectedSuggest, setSelectedSuggest] = useState<Set<string>>(new Set());
  const [suggestModes, setSuggestModes] = useState<Record<string, GroupMode>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [mode, setMode] = useState<GroupMode>('subgroups');
  const [members, setMembers] = useState<string[]>([]);

  const defaultMode = data?.default_mode ?? 'subgroups';
  const schoolType = data?.school_type ?? 'anadolu_lise';

  const active = useMemo(() => data?.groups.find((g) => g.id === activeId) ?? null, [data, activeId]);

  const catalogOptions = useMemo(
    () =>
      (data?.catalog ?? []).map((c) => ({
        value: c.mode,
        label: c.recommended ? `★ ${c.label_tr}` : c.label_tr,
      })),
    [data?.catalog],
  );

  const selectedModeHint = useMemo(
    () => data?.catalog.find((c) => c.mode === mode)?.hint_tr,
    [data?.catalog, mode],
  );

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const res = await apiFetch<GroupsRes>(`/ders-dagit/studios/${studio.id}/groups`, { token });
    setData(res);
    setActiveId((prev) => (prev && res.groups.some((g) => g.id === prev) ? prev : res.groups[0]?.id ?? null));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (data?.default_mode && !editId && !detailOpen) {
      setMode(data.default_mode);
    }
  }, [data?.default_mode, editId, detailOpen]);

  function loadToForm(g: Group | null) {
    if (!g) {
      setEditId(null);
      setName('');
      setAbbr('');
      setMode(data?.default_mode ?? 'subgroups');
      setMembers([]);
      return;
    }
    setEditId(g.id);
    setName(g.name);
    setAbbr(g.abbreviation);
    setMode((g.parallel_mode as GroupMode) || data?.default_mode || 'subgroups');
    setMembers(g.member_sections ?? []);
    setDetailOpen(true);
  }

  useEffect(() => {
    if (!detailOpen || !activeId) return;
    const g = data?.groups.find((x) => x.id === activeId);
    if (g) loadToForm(g);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync on list refresh
  }, [data, activeId, detailOpen]);

  function selectGroup(id: string) {
    setActiveId(id);
    const g = data?.groups.find((x) => x.id === id);
    if (g) loadToForm(g);
  }

  function applyPreset(p: GroupPreset) {
    setActiveId(null);
    setEditId(null);
    setMode(p.parallel_mode);
    setName('');
    setAbbr('');
    setMembers([]);
    setDetailOpen(true);
    toast.message(p.label, { description: p.description });
  }

  async function fetchSuggestions() {
    if (!token || !studio) return;
    setSuggestBusy(true);
    try {
      const res = await apiFetch<{ suggestions: GroupSuggestion[] }>(
        `/ders-dagit/studios/${studio.id}/groups/suggestions`,
        { token },
      );
      const list = res.suggestions ?? [];
      setSuggestions(list);
      setSuggestModes(Object.fromEntries(list.map((s) => [s.key, s.parallel_mode])));
      setSelectedSuggest(new Set(list.filter((s) => !s.already_exists).map((s) => s.key)));
      setSuggestOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Öneriler alınamadı');
    } finally {
      setSuggestBusy(false);
    }
  }

  async function applySuggestions(applyAll: boolean) {
    if (!token || !studio) return;
    setSuggestBusy(true);
    try {
      const keys = applyAll
        ? suggestions.filter((s) => !s.already_exists).map((s) => s.key)
        : [...selectedSuggest];
      const mode_overrides: Record<string, GroupMode> = {};
      for (const k of keys) {
        if (suggestModes[k]) mode_overrides[k] = suggestModes[k]!;
      }
      const r = await apiFetch<{ created: number; skipped: number }>(
        `/ders-dagit/studios/${studio.id}/groups/apply-suggestions`,
        {
          token,
          method: 'POST',
          body: applyAll ? { apply_all: true, mode_overrides } : { keys, mode_overrides },
        },
      );
      toast.success(`${r.created} grup eklendi`);
      setSuggestOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Uygulanamadı');
    } finally {
      setSuggestBusy(false);
    }
  }

  async function save() {
    if (!token || !studio || !name.trim() || !abbr.trim()) return;
    if (members.length < 2 && (mode === 'subgroups' || mode === 'parallel_rooms')) {
      toast.error('Bu mod için en az iki alt şube seçin');
      return;
    }
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/groups`, {
        token,
        method: 'POST',
        body: {
          id: editId ?? undefined,
          name: name.trim(),
          abbreviation: abbr.trim().slice(0, 8),
          parallel_mode: mode,
          member_sections: members,
        },
      });
      toast.success(editId ? 'Güncellendi' : 'Kaydedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    }
  }

  async function deleteActive() {
    if (!token || !studio || !activeId) return;
    if (!window.confirm('Bu grup silinsin mi?')) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/groups/${activeId}`, { token, method: 'DELETE' });
    toast.success('Silindi');
    setActiveId(null);
    loadToForm(null);
    setDetailOpen(false);
    await load();
  }

  function handleAction(key: EntityActionKey) {
    switch (key) {
      case 'new':
        setActiveId(null);
        loadToForm(null);
        setDetailOpen(true);
        break;
      case 'edit':
        if (active) loadToForm(active);
        break;
      case 'save':
        void save();
        break;
      case 'delete':
        void deleteActive();
        break;
      case 'assign':
        void fetchSuggestions();
        break;
      default:
        break;
    }
  }

  const groupActions = [
    { key: 'new' as const, label: 'Yeni' },
    { key: 'edit' as const, label: 'Güncelle' },
    { key: 'assign' as const, label: 'Verilerden öner', icon: Sparkles },
    { key: 'save' as const, label: 'Kaydet', disabled: !name.trim() || !abbr.trim() },
    { key: 'delete' as const, label: 'Sil', variant: 'outline' as const },
  ];

  const newSuggestions = suggestions.filter((s) => !s.already_exists);

  const emptySuggestHint =
    schoolType === 'mtal'
      ? 'MTAL: şube adlarında 9/A, 11 ELEKTRİK / 11 MAKİNE veya çoklu şubeli meslek atamaları gerekir.'
      : 'Şube adlarında 5A-A / 5A-B veya çoklu şubeli atamalar gerekir.';

  return (
    <div className={DD_PAGE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DdPageHeader
          icon={GitBranch}
          title="Gruplar"
          description="Paralel şube ve alt gruplar — okul türüne göre mod ve öneriler."
        />
        <span
          className="inline-flex items-center rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium"
          aria-label="Okul türü"
        >
          {schoolTypeLabel(schoolType)}
        </span>
      </div>

      {data?.school_hint ? (
        <DdCard variant="sky" className="overflow-hidden">
          <CardContent className={cn(DD_CARD_CONTENT, 'flex gap-2 text-xs')}>
            <Info className="size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-muted-foreground">{data.school_hint}</p>
          </CardContent>
        </DdCard>
      ) : null}

      {(data?.presets?.length ?? 0) > 0 && (
        <DdCard className="overflow-hidden">
          <CardHeader className={DD_CARD_HEADER}>
            <CardTitle className="text-sm">Hızlı şablon</CardTitle>
          </CardHeader>
          <CardContent className={cn(DD_CARD_CONTENT, 'flex flex-wrap gap-2')}>
            {data!.presets.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant="outline"
                className="h-auto flex-col items-start gap-0.5 px-3 py-2 text-left"
                onClick={() => applyPreset(p)}
              >
                <span className="text-xs font-medium">{p.label}</span>
                <span className="text-[10px] font-normal text-muted-foreground">{groupModeLabel(p.parallel_mode)}</span>
              </Button>
            ))}
            {schoolType === 'mtal' ? (
              <Button type="button" size="sm" variant="ghost" className="text-xs" asChild>
                <Link href="/ders-dagit/studyo/kurulum">Kurulum — staj / ikili eğitim</Link>
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="ghost" className="text-xs" asChild>
              <Link href="/ders-dagit/studyo/secmeli">Seçmeli havuzlar</Link>
            </Button>
          </CardContent>
        </DdCard>
      )}

      <DdEntityWorkspace
        title="Tanımlı gruplar"
        toolbar={
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1 text-xs"
            disabled={suggestBusy || !studio}
            onClick={() => void fetchSuggestions()}
          >
            <Sparkles className="size-3.5" aria-hidden />
            {suggestBusy ? '…' : 'Verilerden öner'}
          </Button>
        }
        actions={
          <DdEntityActionBar
            kind="ders"
            selectedLabel={active?.name ?? (name.trim() || null)}
            actions={groupActions}
            onAction={handleAction}
          />
        }
        selectedTitle={active?.name ?? (name.trim() || undefined)}
        list={
          <GroupEntityTable
            groups={data?.groups ?? []}
            activeId={activeId}
            query={query}
            onQueryChange={setQuery}
            onSelect={selectGroup}
          />
        }
        detailOpen={detailOpen}
        detail={
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ad</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="5A bölünmesi" />
            </div>
            <div>
              <Label>Kısaltma (max 8)</Label>
              <Input value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="5a" maxLength={8} />
            </div>
            <DdSelectField
              className="sm:col-span-2"
              label="Mod"
              value={mode}
              onValueChange={(v) => setMode(v as GroupMode)}
              options={catalogOptions}
            />
            {selectedModeHint ? (
              <p className="sm:col-span-2 text-[11px] text-muted-foreground">{selectedModeHint}</p>
            ) : null}
            <DdSectionMultiField
              className="sm:col-span-2"
              label="Alt şubeler (en az 2)"
              value={members}
              onValueChange={setMembers}
              extraSections={members}
            />
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              {groupModeLabel(mode)} — atamalarda &quot;Paralel grup&quot; alanından seçilir. Varsayılan mod:{' '}
              {groupModeLabel(defaultMode)}.
            </p>
          </div>
        }
        footer={`${data?.groups.length ?? 0} grup · çift tık = düzenle`}
      />

      {suggestOpen && (
        <DdCard variant="violet" className="overflow-hidden">
          <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Verilerden önerilen gruplar</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestOpen(false)}>
                  Kapat
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={suggestBusy || !newSuggestions.length}
                  onClick={() => void applySuggestions(true)}
                >
                  Tüm yeni önerileri ekle ({newSuggestions.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={suggestBusy || selectedSuggest.size === 0}
                  onClick={() => void applySuggestions(false)}
                >
                  Seçilenleri ekle ({selectedSuggest.size})
                </Button>
              </div>
            </div>
            {!suggestions.length ? (
              <p className="text-sm text-muted-foreground">{emptySuggestHint}</p>
            ) : (
              <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                {suggestions.map((s) => (
                  <li
                    key={s.key}
                    className={cn('rounded-lg border px-3 py-2', s.already_exists && 'opacity-50')}
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          className="mt-1"
                          disabled={s.already_exists}
                          checked={selectedSuggest.has(s.key)}
                          onChange={(e) => {
                            setSelectedSuggest((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(s.key);
                              else next.delete(s.key);
                              return next;
                            });
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {SOURCE_LABEL[s.source] ?? s.source}
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">{s.member_sections.join(', ')}</span>
                          <br />
                          <span className="text-[10px] text-muted-foreground">{s.reason}</span>
                          {s.already_exists ? (
                            <span className="ml-1 text-[10px] font-medium text-primary">(zaten kayıtlı)</span>
                          ) : null}
                        </span>
                      </label>
                      {!s.already_exists ? (
                        <select
                          className="rounded-md border bg-background px-2 py-1 text-xs"
                          value={suggestModes[s.key] ?? s.parallel_mode}
                          onChange={(e) =>
                            setSuggestModes((prev) => ({
                              ...prev,
                              [s.key]: e.target.value as GroupMode,
                            }))
                          }
                          aria-label={`${s.name} modu`}
                        >
                          {(data?.catalog ?? []).map((c) => (
                            <option key={c.mode} value={c.mode}>
                              {c.label_tr}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </DdCard>
      )}
    </div>
  );
}
