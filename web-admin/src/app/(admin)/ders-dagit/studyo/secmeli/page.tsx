'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
import { downloadTtkbCsv, schoolTypeLabel, type TtkbPreview } from '@/lib/dersler-studio';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSectionField, DdSectionMultiField } from '@/components/ders-dagit/dd-section-picker';
import { DdEntityActionBar, type EntityActionKey } from '@/components/ders-dagit/dd-entity-action-bar';
import { DdEntityWorkspace } from '@/components/ders-dagit/dd-entity-workspace';
import { ElectivePoolTable, type ElectivePoolRow } from '@/components/ders-dagit/elective-pool-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Download, Layers, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Pool = ElectivePoolRow;

type ElectiveSuggestion = {
  key: string;
  name: string;
  base_section: string;
  member_sections: string[];
  subject_names: string[];
  weekly_hours_per_track: number;
  already_exists: boolean;
};

type ElectiveCatalogRow = { id: string; name: string; short_code?: string | null };

type ApplyPreview = {
  pool: { id: string; name: string; group_id: string | null };
  would_create: number;
  would_update: number;
  total: number;
  needs_group: boolean;
  lines: Array<{ subject_name: string; class_section: string; exists: boolean }>;
};

export default function SecmeliPage() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [pools, setPools] = useState<Pool[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [base, setBase] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [subjectNames, setSubjectNames] = useState('');
  const [hrs, setHrs] = useState(2);
  const [aihl, setAihl] = useState<{
    ok: boolean;
    issues: Array<{ subject_name: string; assigned: number; max: number }>;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<ElectiveSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [selectedSuggest, setSelectedSuggest] = useState<Set<string>>(new Set());
  const [applyPreview, setApplyPreview] = useState<ApplyPreview | null>(null);
  const [applyConfirmOpen, setApplyConfirmOpen] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [schoolType, setSchoolType] = useState('anadolu_lise');
  const [ttkbPreview, setTtkbPreview] = useState<TtkbPreview | null>(null);
  const [ttkbBusy, setTtkbBusy] = useState(false);
  const [ttkbReplaceElective, setTtkbReplaceElective] = useState(false);
  const [ttkbCreatePools, setTtkbCreatePools] = useState(true);
  const [electiveCatalog, setElectiveCatalog] = useState<ElectiveCatalogRow[]>([]);

  const active = useMemo(() => pools.find((p) => p.id === activeId) ?? null, [pools, activeId]);

  const loadElectiveCatalog = useCallback(async () => {
    if (!token || !studio) return;
    const rows = await apiFetch<ElectiveCatalogRow[]>(
      `/ders-dagit/studios/${studio.id}/elective-catalog`,
      { token },
    ).catch(() => []);
    setElectiveCatalog(rows);
  }, [token, studio]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [list, norm, sp] = await Promise.all([
      apiFetch<Pool[]>(`/ders-dagit/studios/${studio.id}/elective-pools`, { token }),
      apiFetch<{ ok: boolean; issues: Array<{ subject_name: string; assigned: number; max: number }> }>(
        `/ders-dagit/studios/${studio.id}/aihl-norm`,
        { token },
      ).catch(() => null),
      apiFetch<{ type: string }>(`/ders-dagit/studios/${studio.id}/school-profile`, { token }).catch(() => ({
        type: 'anadolu_lise',
      })),
    ]);
    setPools(list);
    setAihl(norm);
    setSchoolType(sp.type);
    setActiveId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id ?? null));
    await loadElectiveCatalog();
  }, [token, studio, loadElectiveCatalog]);

  useEffect(() => {
    void load();
  }, [load]);

  function loadToForm(p: Pool | null) {
    if (!p) {
      setEditId(null);
      setName('');
      setBase('');
      setMembers([]);
      setSubjectNames('');
      setHrs(2);
      return;
    }
    setEditId(p.id);
    setName(p.name);
    setBase(p.base_section);
    setMembers(p.member_sections ?? []);
    setSubjectNames((p.subject_names ?? []).join(', '));
    setHrs(p.weekly_hours_per_track ?? 2);
    setDetailOpen(true);
  }

  useEffect(() => {
    if (!detailOpen || !activeId) return;
    const p = pools.find((x) => x.id === activeId);
    if (p) loadToForm(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools, activeId, detailOpen]);

  function selectPool(id: string) {
    setActiveId(id);
    const p = pools.find((x) => x.id === id);
    if (p) loadToForm(p);
  }

  async function fetchSuggestions() {
    if (!token || !studio) return;
    setSuggestBusy(true);
    try {
      const res = await apiFetch<{ suggestions: ElectiveSuggestion[] }>(
        `/ders-dagit/studios/${studio.id}/elective-pools/suggestions`,
        { token },
      );
      setSuggestions(res.suggestions ?? []);
      setSelectedSuggest(
        new Set(res.suggestions.filter((s) => !s.already_exists).map((s) => s.key)),
      );
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
      const r = await apiFetch<{ created: number; assignments_created: number }>(
        `/ders-dagit/studios/${studio.id}/elective-pools/apply-suggestions`,
        {
          token,
          method: 'POST',
          body: applyAll
            ? { apply_all: true, sync_groups: true }
            : { keys: [...selectedSuggest], sync_groups: true },
        },
      );
      toast.success(`${r.created} havuz · ${r.assignments_created} atama hazır`);
      setSuggestOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Uygulanamadı');
    } finally {
      setSuggestBusy(false);
    }
  }

  async function save() {
    if (!token || !studio || !base.trim()) return;
    if (members.length < 2) {
      toast.error('En az iki alt şube (kol) gerekli');
      return;
    }
    try {
      await apiFetch(`/ders-dagit/studios/${studio.id}/elective-pools`, {
        token,
        method: 'POST',
        body: {
          id: editId ?? undefined,
          name: name.trim() || `${base.trim()} Seçmeli`,
          base_section: base.trim(),
          member_sections: members,
          subject_names: subjectNames.split(/[,/]/).map((s) => s.trim()).filter(Boolean),
          weekly_hours_per_track: hrs,
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
    if (!window.confirm('Bu seçmeli havuz silinsin mi?')) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/elective-pools/${activeId}`, {
      token,
      method: 'DELETE',
    });
    toast.success('Silindi');
    setActiveId(null);
    loadToForm(null);
    setDetailOpen(false);
    await load();
  }

  async function syncGroup() {
    if (!token || !studio || !activeId) return;
    await apiFetch(`/ders-dagit/studios/${studio.id}/elective-pools/${activeId}/sync-group`, {
      token,
      method: 'POST',
    });
    toast.success('Paralel grup bağlandı');
    await load();
  }

  async function previewApply() {
    if (!token || !studio || !activeId) return;
    setApplyBusy(true);
    try {
      const res = await apiFetch<ApplyPreview>(
        `/ders-dagit/studios/${studio.id}/elective-pools/${activeId}/apply-assignments/preview`,
        { token, method: 'POST' },
      );
      setApplyPreview(res);
      setApplyConfirmOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Önizleme alınamadı');
    } finally {
      setApplyBusy(false);
    }
  }

  async function confirmApply() {
    if (!token || !studio || !activeId) return;
    setApplyBusy(true);
    try {
      const r = await apiFetch<{ assignments_created: number; assignments_updated?: number }>(
        `/ders-dagit/studios/${studio.id}/elective-pools/${activeId}/apply-assignments`,
        { token, method: 'POST' },
      );
      toast.success(
        `+${r.assignments_created} yeni${r.assignments_updated ? `, ${r.assignments_updated} güncellendi` : ''}`,
      );
      setApplyConfirmOpen(false);
      setApplyPreview(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Atama başarısız');
    } finally {
      setApplyBusy(false);
    }
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
        void previewApply();
        break;
      default:
        break;
    }
  }

  const poolActions = [
    { key: 'new' as const, label: 'Yeni havuz' },
    { key: 'edit' as const, label: 'Güncelle' },
    { key: 'assign' as const, label: 'Atamaları üret' },
    { key: 'save' as const, label: 'Kaydet', disabled: !base.trim() || members.length < 2 },
    { key: 'delete' as const, label: 'Sil', variant: 'outline' as const },
  ];

  const newSuggestions = suggestions.filter((s) => !s.already_exists);

  async function previewTtkbElective(download = false, silent = false) {
    if (!token || !studio) return;
    setTtkbBusy(true);
    try {
      const data = await apiFetch<TtkbPreview>(
        `/ders-dagit/studios/${studio.id}/seed/ttkb/elective/preview`,
        { token },
      );
      setTtkbPreview(data);
      if (!data.cell_count) {
        if (!silent) toast.error(data.empty_message ?? 'Liste boş. Kurulumda okul türünü kaydedin.');
        return;
      }
      if (!silent) {
        toast.success(
          `${data.subject_count} seçmeli ders (${schoolTypeLabel(data.school_type)})`,
        );
      }
      if (download) downloadTtkbCsv(data, schoolTypeLabel(data.school_type), 'ttkb-secmeli-listesi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'TTKB listesi alınamadı');
    } finally {
      setTtkbBusy(false);
    }
  }

  async function seedTtkbElective() {
    if (!token || !studio) return;
    setTtkbBusy(true);
    try {
      const r = await apiFetch<{
        created: number;
        updated: number;
        names?: string[];
        pools_created?: number;
        pools_updated?: number;
        pool_names?: string[];
      }>(`/ders-dagit/studios/${studio.id}/seed/ttkb/elective`, {
        token,
        method: 'POST',
        body: { replace_elective: ttkbReplaceElective, create_pools: ttkbCreatePools },
      });
      await load();
      if (!ttkbPreview) await previewTtkbElective(false, true);
      const poolMsg =
        ttkbCreatePools && (r.pools_created || r.pools_updated)
          ? ` · ${(r.pools_created ?? 0) + (r.pools_updated ?? 0)} havuz`
          : '';
      toast.success(
        `${r.names?.length ?? r.created + r.updated} ders${poolMsg}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setTtkbBusy(false);
    }
  }

  function applyTtkbNamesToForm() {
    const fromCatalog = electiveCatalog.map((s) => s.name);
    const rows = ttkbPreview?.cells?.length ? ttkbPreview.cells : ttkbPreview?.sample;
    const fromPreview = rows?.map((c) => c.subject_name.trim()).filter(Boolean) ?? [];
    const names = [...new Set([...fromCatalog, ...fromPreview])];
    if (!names.length) return;
    const existing = subjectNames
      .split(/[,/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [...new Set([...existing, ...names])];
    setSubjectNames(merged.join(', '));
    setDetailOpen(true);
    toast.success(`${names.length} ders adı forma eklendi`);
  }

  return (
    <div className={DD_PAGE}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DdPageHeader
          icon={Layers}
          title="Seçmeli dersler"
          description="Alt şubeler (kollar) ve seçmeli ders adları — atamalardan öneri veya elle havuz."
        />
        <span
          className="inline-flex items-center rounded-full border bg-muted/60 px-2.5 py-0.5 text-xs font-medium"
          aria-label="Okul türü"
        >
          {schoolTypeLabel(schoolType)}
        </span>
      </div>

      <DdCard variant="sky" className="overflow-hidden">
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" aria-hidden />
            TTKB seçmeli ders listesi
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
          <p className="text-xs text-muted-foreground">
            Kurum türüne göre TTKB seçmeli dersler (
            <a
              href="https://ttkb.meb.gov.tr/www/haftalik-ders-cizelgeleri/kategori/7"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline"
            >
              ttkb.meb.gov.tr
            </a>
            ). Lise: yabancı dil ve sanat-spor. Kayıt hem ders listesine hem (işaretliyse) alttaki sınıf
            havuzları tablosuna yazılır — havuz için en az iki kol (şube) gerekir; yoksa 10A-S1 / 10A-S2
            örnek kolları kullanılır.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ttkbBusy}
              onClick={() => void previewTtkbElective(true)}
            >
              <Download className="mr-1 size-3.5" aria-hidden />
              Listeyi indir (CSV)
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={ttkbBusy} onClick={() => void previewTtkbElective(false)}>
              Önizle
            </Button>
            <Button type="button" size="sm" disabled={ttkbBusy || !ttkbPreview} onClick={() => void seedTtkbElective()}>
              Kaydet (liste + havuz)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={ttkbBusy || electiveCatalog.length === 0}
              onClick={async () => {
                if (!token || !studio) return;
                setTtkbBusy(true);
                try {
                  const r = await apiFetch<{ pools_created: number; pools_updated: number; pool_names: string[] }>(
                    `/ders-dagit/studios/${studio.id}/elective-pools/sync-from-catalog`,
                    { token, method: 'POST', body: { replace_pools: ttkbReplaceElective } },
                  );
                  await load();
                  toast.success(
                    `${r.pools_created} yeni, ${r.pools_updated} güncellendi — ${r.pool_names.join(', ')}`,
                  );
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Havuz oluşturulamadı');
                } finally {
                  setTtkbBusy(false);
                }
              }}
            >
              Sadece havuzları oluştur
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!ttkbPreview?.cells?.length && !ttkbPreview?.sample?.length}
              onClick={applyTtkbNamesToForm}
            >
              Adları havuza yaz
            </Button>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ttkbCreatePools}
                onChange={(e) => setTtkbCreatePools(e.target.checked)}
              />
              Sınıf havuzlarını oluştur (9–12 tablo)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ttkbReplaceElective}
                onChange={(e) => setTtkbReplaceElective(e.target.checked)}
              />
              Mevcut kayıtları sil (değiştir)
            </label>
          </div>
          {ttkbPreview && (
            <div className="rounded-lg border bg-muted/30 p-2 text-xs" role="status">
              <p>
                TTKB önizleme: <strong>{ttkbPreview.subject_count}</strong> ders ·{' '}
                <strong>{ttkbPreview.cell_count}</strong> satır
                {ttkbPreview.grades?.length ? ` · sınıflar: ${ttkbPreview.grades.join(', ')}` : ''}
              </p>
              <ul className="mt-2 max-h-24 overflow-y-auto">
                {(ttkbPreview.cells?.length ? ttkbPreview.cells : ttkbPreview.sample ?? [])
                  .slice(0, 12)
                  .map((c, i) => (
                    <li key={i}>
                      {c.grade}. sınıf — {c.subject_name} ({c.weekly_hours} saat)
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
            <p className="font-medium text-foreground">
              Ders listesi (katalog) — {electiveCatalog.length} ders
            </p>
            {electiveCatalog.length === 0 ? (
              <p className="mt-1 text-muted-foreground">
                Henüz kayıt yok. Önizle → &quot;Kaydet (liste + havuz)&quot;.
              </p>
            ) : (
              <ul className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                {electiveCatalog.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md border bg-background px-2 py-0.5 text-[11px]"
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </DdCard>

      {aihl && !aihl.ok && (
        <DdCard className="border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className={cn(DD_CARD_CONTENT, 'flex gap-2 text-sm')}>
            <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="font-medium">AİHL haftalık norm</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {aihl.issues.map((i, idx) => (
                  <li key={idx}>
                    {i.subject_name}: {i.assigned} saat (üst sınır {i.max})
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </DdCard>
      )}

      <DdEntityWorkspace
        title="Seçmeli havuzlar"
        toolbar={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 gap-1 text-xs"
              disabled={suggestBusy}
              onClick={() => void fetchSuggestions()}
            >
              <Sparkles className="size-3.5" aria-hidden />
              Atamalardan öner
            </Button>
            {active && (
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => void syncGroup()}>
                Grup bağla
              </Button>
            )}
          </div>
        }
        actions={
          <DdEntityActionBar
            kind="ders"
            selectedLabel={active?.name ?? (name.trim() || null)}
            actions={poolActions}
            onAction={handleAction}
          />
        }
        selectedTitle={active?.name}
        list={
          <ElectivePoolTable
            pools={pools}
            activeId={activeId}
            query={query}
            onQueryChange={setQuery}
            onSelect={selectPool}
          />
        }
        detailOpen={detailOpen}
        detail={
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Ad</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="10-A Seçmeli" />
            </div>
            <DdSectionField label="Ana şube" value={base} onValueChange={setBase} extraSections={[base, ...members]} />
            <DdSectionMultiField
              className="sm:col-span-2"
              label="Kollar (alt şubeler, min. 2)"
              value={members}
              onValueChange={setMembers}
              extraSections={members}
            />
            <div className="sm:col-span-2">
              <Label>Seçmeli ders adları (virgül)</Label>
              <Input
                value={subjectNames}
                onChange={(e) => setSubjectNames(e.target.value)}
                placeholder="Görsel Sanatlar, Müzik, Beden Eğitimi"
              />
            </div>
            <div>
              <Label>Haftalık saat / kol</Label>
              <Input type="number" min={1} max={6} value={hrs} onChange={(e) => setHrs(Number(e.target.value) || 2)} />
            </div>
            <p className="sm:col-span-2 text-[11px] text-muted-foreground">
              Ders adında &quot;seçmeli&quot; geçen atamalar otomatik önerilir.{' '}
              <Link href="/ders-dagit/studyo/gruplar" className="text-primary underline-offset-2 hover:underline">
                Gruplar
              </Link>{' '}
              ile paralel yerleşim yapılır.
            </p>
          </div>
        }
        footer={`${pools.length} havuz · Atamaları üret = önizle + onay`}
      />

      {suggestOpen && (
        <DdCard variant="lavender" className="overflow-hidden">
          <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Atamalardan önerilen havuzlar</p>
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
                  Tümünü ekle ({newSuggestions.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={suggestBusy || selectedSuggest.size === 0}
                  onClick={() => void applySuggestions(false)}
                >
                  Seçilenleri ekle
                </Button>
              </div>
            </div>
            {!suggestions.length ? (
              <p className="text-sm text-muted-foreground">
                Öneri yok. Dersler/atamalarda adı &quot;seçmeli&quot; içeren kayıt veya 5A-A / 5A-B gibi kollar gerekir.
              </p>
            ) : (
              <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
                {suggestions.map((s) => (
                  <li key={s.key} className={cn('rounded-lg border px-3 py-2', s.already_exists && 'opacity-50')}>
                    <label className="flex cursor-pointer items-start gap-2">
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
                      <span>
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.member_sections.join(', ')}
                        </span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {s.subject_names.join(', ') || 'Seçmeli'}
                        </span>
                        {s.already_exists ? (
                          <span className="ml-1 text-[10px] font-medium text-primary">(kayıtlı)</span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </DdCard>
      )}

      <Dialog open={applyConfirmOpen} onOpenChange={setApplyConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Seçmeli atamaları yaz</DialogTitle>
            <DialogDescription>
              {applyPreview?.pool.name} — {applyPreview?.would_create ?? 0} yeni, {applyPreview?.would_update ?? 0}{' '}
              güncelleme ({applyPreview?.total ?? 0} satır).
            </DialogDescription>
          </DialogHeader>
          {applyPreview?.needs_group && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Paralel grup yok; onayda önce grup oluşturulur.
            </p>
          )}
          <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
            {applyPreview?.lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-2 border-b border-border/40 py-1">
                <span>
                  {l.subject_name} · {l.class_section}
                </span>
                <span className={l.exists ? 'text-muted-foreground' : 'text-primary'}>
                  {l.exists ? 'güncelle' : 'yeni'}
                </span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApplyConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button type="button" disabled={applyBusy} className="gap-1" onClick={() => void confirmApply()}>
              {applyBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Onayla ve aktar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
