'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterBilsemCatalogSubjects } from '@/lib/bilsem-catalog-subjects';

type SubjectItem = {
  id: string;
  code: string;
  label: string;
  grade_min?: number | null;
  grade_max?: number | null;
  gradeMin?: number | null;
  gradeMax?: number | null;
  section_filter?: string | null;
  sectionFilter?: string | null;
  ana_grup?: string | null;
  anaGrup?: string | null;
  sort_order?: number;
  sortOrder?: number;
  is_active?: boolean;
  isActive?: boolean;
};

const BILSEM_ANA_GRUPLAR = [
  { value: 'GENEL_YETENEK', label: 'Genel Yetenek' },
  { value: 'RESIM', label: 'Resim' },
  { value: 'MUZIK', label: 'Müzik' },
  { value: 'DIGERLERI', label: 'Diğerleri' },
] as const;

function pick<T extends SubjectItem>(i: T) {
  return {
    id: i.id,
    code: i.code,
    label: i.label,
    gradeMin: i.grade_min ?? i.gradeMin,
    gradeMax: i.grade_max ?? i.gradeMax,
    sectionFilter: i.section_filter ?? i.sectionFilter,
    anaGrup: i.ana_grup ?? i.anaGrup ?? null,
    sortOrder: i.sort_order ?? i.sortOrder ?? 0,
    isActive: i.is_active ?? i.isActive ?? true,
  };
}

/** MEB haftalık ders saati varsayılanları (ttkb.meb.gov.tr). API boş dönerse kullanılır. */
const DERS_SAATI_DEFAULTS: Record<string, Record<number, number>> = {
  turkce: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 6, 6: 6, 7: 6, 8: 6 },
  turk_dili_edebiyati: { 9: 5, 10: 5, 11: 5, 12: 5 },
  matematik: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5, 9: 6, 10: 6, 11: 6, 12: 6 },
  hayat_bilgisi: { 1: 4, 2: 4, 3: 4 },
  fen_bilimleri: { 4: 3, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4 },
  sosyal_bilgiler: { 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
  ingilizce: { 2: 2, 3: 2, 4: 2, 5: 4, 6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4 },
  din_kulturu: { 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 1, 10: 1, 11: 1, 12: 1 },
  muzik: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2 },
  gorsel_sanatlar: { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2 },
  beden_egitimi_oyun: { 1: 2, 2: 2, 3: 2, 4: 2 },
  beden_egitimi: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2 },
  cografya: { 9: 2, 10: 2, 11: 2, 12: 2 },
  tarih: { 9: 2, 10: 2, 11: 2, 12: 2 },
  fizik: { 9: 2, 10: 2, 11: 2, 12: 2 },
  kimya: { 9: 2, 10: 2, 11: 2, 12: 2 },
  biyoloji: { 9: 2, 10: 2, 11: 2, 12: 2 },
  felsefe: { 9: 2, 10: 2, 11: 2, 12: 2 },
  tc_inkilap: { 8: 2 },
  bil_tek_yazilim: { 5: 2, 6: 2, 7: 2, 8: 2 },
  bilgisayar_bilimi: { 9: 2, 10: 2, 11: 2, 12: 2 },
};

type DersSaatiConfig = Record<string, Record<string | number, number>>;

/** Ders kodu -> ders_saati config key. turkce_maarif -> turkce, 9-cografya -> cografya */
function normalizeDersSaatiKey(code: string): string {
  const base = (code ?? '').toLowerCase().trim().replace(/_maarif(_[a-z]+)?$/, '').replace(/_maarif$/, '');
  const m = base.match(/^\d+-(.+)$/);
  return m ? m[1] : base;
}

const SECTIONS = [
  { value: '', label: '— Tümü —' },
  { value: 'ders', label: 'Ders' },
  { value: 'secmeli', label: 'Seçmeli' },
  { value: 'iho', label: 'İHO (İmam Hatip Ortaokulu)' },
  { value: 'ihl', label: 'İHL (İmam Hatip Lisesi)' },
  { value: 'meslek', label: 'Meslek' },
  { value: 'mesem', label: 'Mesem' },
  { value: 'gsl', label: 'GSL (Güzel Sanatlar Lisesi)' },
  { value: 'spor_l', label: 'Spor L.' },
];

export function AyarlarTab({ variant }: { variant?: 'default' | 'bilsem' } = {}) {
  const router = useRouter();
  const { token, me, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubjectItem | null>(null);
  const [form, setForm] = useState({
    code: '',
    label: '',
    grade_min: '',
    grade_max: '',
    section_filter: '',
    ana_grup: '',
    sort_order: '',
    is_active: true,
    ders_saati: {} as Record<number, number>,
  });
  const [saving, setSaving] = useState(false);
  const [dersSaatiConfig, setDersSaatiConfig] = useState<DersSaatiConfig | null>(null);

  const isSuperadmin = me?.role === 'superadmin';

  const fetchList = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (variant === 'bilsem') params.set('curriculum_model', 'bilsem');
      const res = await apiFetch<{ items: SubjectItem[] }>(
        `/document-templates/config/subjects?${params}`,
        { token }
      );
      const raw = res?.items ?? [];
      setItems(variant === 'bilsem' ? filterBilsemCatalogSubjects(raw) : raw);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, isSuperadmin, variant]);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperadmin) {
      router.replace('/403');
      return;
    }
    fetchList();
  }, [authLoading, isSuperadmin, router, fetchList]);

  const fetchDersSaatiConfig = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    try {
      const data = await apiFetch<DersSaatiConfig>('/app-config/ders-saati', { token });
      setDersSaatiConfig(data);
    } catch {
      setDersSaatiConfig({});
    }
  }, [token, isSuperadmin]);

  useEffect(() => {
    if (authLoading || !isSuperadmin) return;
    fetchDersSaatiConfig();
  }, [authLoading, isSuperadmin, fetchDersSaatiConfig]);

  const getDersSaatiForSubject = (subjectCode: string): Record<number, number> => {
    const key = normalizeDersSaatiKey(subjectCode);
    const saved = dersSaatiConfig?.[key];
    const defs = DERS_SAATI_DEFAULTS[key];
    const out: Record<number, number> = {};
    for (let g = 1; g <= 12; g++) {
      const v = saved?.[g] ?? saved?.[String(g)];
      if (typeof v === 'number' && v >= 0 && v <= 10) out[g] = v;
      else if (defs?.[g] != null) out[g] = defs[g];
      else out[g] = 0;
    }
    return out;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: '',
      label: '',
      grade_min: '',
      grade_max: '',
      section_filter: '',
      ana_grup: '',
      sort_order: '',
      is_active: true,
      ders_saati: {},
    });
    setShowForm(true);
  };

  const openEdit = (item: SubjectItem) => {
    const p = pick(item);
    setEditing(item);
    setForm({
      code: p.code,
      label: p.label,
      grade_min: p.gradeMin != null ? String(p.gradeMin) : '',
      grade_max: p.gradeMax != null ? String(p.gradeMax) : '',
      section_filter: p.sectionFilter ?? '',
      ana_grup: p.anaGrup ?? '',
      sort_order: p.sortOrder != null ? String(p.sortOrder) : '',
      is_active: p.isActive,
      ders_saati: getDersSaatiForSubject(p.code),
    });
    setShowForm(true);
  };

  const setFormDersSaati = (grade: number, value: number) => {
    const clamped = Math.min(10, Math.max(0, value));
    setForm((f) => ({
      ...f,
      ders_saati: { ...f.ders_saati, [grade]: clamped },
    }));
  };

  const getFormDersSaati = (grade: number): number => {
    const v = form.ders_saati?.[grade];
    if (typeof v === 'number' && v >= 0 && v <= 10) return v;
    const key = normalizeDersSaatiKey(form.code);
    return DERS_SAATI_DEFAULTS[key]?.[grade] ?? 0;
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.code.trim()) {
      toast.error('Ders kodu girin.');
      return;
    }
    if (!form.label.trim()) {
      toast.error('Ders adı girin.');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        label: form.label.trim(),
        grade_min: form.grade_min ? parseInt(form.grade_min, 10) : null,
        grade_max: form.grade_max ? parseInt(form.grade_max, 10) : null,
        section_filter: form.section_filter?.trim() || null,
        sort_order: form.sort_order ? parseInt(form.sort_order, 10) : 0,
        is_active: form.is_active,
      };
      if (variant === 'bilsem') body.ana_grup = form.ana_grup?.trim() || null;
      if (!editing) body.code = form.code.trim();
      if (editing) {
        await apiFetch(`/document-templates/config/subjects/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/document-templates/config/subjects', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        });
      }
      const dersSaatiKey = normalizeDersSaatiKey(form.code.trim());
      const merged: Record<string, Record<number, number>> = {};
      for (const [k, grades] of Object.entries(dersSaatiConfig ?? {})) {
        if (k === dersSaatiKey) continue;
        merged[k] = {};
        for (const [g, s] of Object.entries(grades)) {
          const gn = parseInt(String(g), 10);
          if (Number.isFinite(gn) && gn >= 1 && gn <= 12 && typeof s === 'number' && s >= 0 && s <= 10) {
            merged[k][gn] = Math.round(s);
          }
        }
        if (Object.keys(merged[k]).length === 0) delete merged[k];
      }
      merged[dersSaatiKey] = {};
      for (let g = 1; g <= 12; g++) {
        const v = form.ders_saati?.[g] ?? getFormDersSaati(g);
        if (v > 0) merged[dersSaatiKey][g] = v;
      }
      if (Object.keys(merged[dersSaatiKey]).length > 0) {
        await apiFetch('/app-config/ders-saati', { method: 'PATCH', token, body: JSON.stringify(merged) });
        fetchDersSaatiConfig();
      }
      toast.success(editing ? 'Ders güncellendi' : 'Ders eklendi');
      setShowForm(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Bu dersi silmek (devre dışı bırakmak) istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/document-templates/config/subjects/${id}`, { method: 'DELETE', token });
      toast.success('Ders silindi');
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }
  if (!isSuperadmin) return null;

  return (
    <div className="space-y-6">
      {variant === 'bilsem' && (
        <Card className="border-violet-200/60 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-950/25">
          <CardContent className="py-4 text-sm text-muted-foreground">
            <strong className="text-foreground">BİLSEM:</strong> Kılavuza göre yetenek alanları <strong className="text-foreground">Genel Yetenek</strong>, <strong className="text-foreground">Resim</strong>, <strong className="text-foreground">Müzik</strong>, <strong className="text-foreground">Diğerleri</strong>. Yıllık plan içeriklerinde sınıf yerine ana grup (yetenek alanı) ve alt grup (Uyum, Destek-1/2, BYF-1/2, ÖYG-1…7, Proje) kullanılır. Ders eklerken yetenek alanı atayın.
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {variant === 'bilsem' ? 'BİLSEM — Ders ayarları' : 'Ders Ayarları'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {variant === 'bilsem'
              ? 'Yıllık plan ve evrak üretimi bu alan/ders listesini kullanır; düzey sütunları örgün okul sınıfı (1–12) ile ilgilidir.'
              : 'Yıllık Plan İçerikleri, Kazanım Setleri ve Evrak üretimi bu ders listesini kullanır.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-5" />
          Ders Ekle
        </button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-5" />
            Ders Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner className="size-8" />
            </div>
          ) : !items.length ? (
            <EmptyState
              icon={<Settings className="size-10 text-muted-foreground" />}
              title="Henüz ders yok"
              description="Ders ekle/düzenle ile Yıllık Plan İçerikleri ve Evrak filtrelerinde kullanılacak ders listesini oluşturun."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Kod</th>
                    <th>Ders Adı</th>
                    {variant === 'bilsem' && <th>Yetenek Alanı</th>}
                    <th>{variant === 'bilsem' ? 'Örgün düzey (min)' : 'Sınıf (min)'}</th>
                    <th>{variant === 'bilsem' ? 'Örgün düzey (max)' : 'Sınıf (max)'}</th>
                    <th>Bölüm</th>
                    <th>Sıra</th>
                    <th>Durum</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const p = pick(item);
                    const anaGrupLabel = variant === 'bilsem' && p.anaGrup
                      ? BILSEM_ANA_GRUPLAR.find((g) => g.value === p.anaGrup)?.label ?? p.anaGrup
                      : null;
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                        <td className="px-3 py-2">{p.label}</td>
                        {variant === 'bilsem' && <td className="px-3 py-2">{anaGrupLabel ?? '—'}</td>}
                        <td className="px-3 py-2">{p.gradeMin ?? '—'}</td>
                        <td className="px-3 py-2">{p.gradeMax ?? '—'}</td>
                        <td className="px-3 py-2">{p.sectionFilter ?? '—'}</td>
                        <td className="px-3 py-2">{p.sortOrder}</td>
                        <td className="px-3 py-2">
                          {p.isActive ? (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Aktif
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                              Pasif
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              title="Düzenle"
                              className="rounded p-1.5 hover:bg-muted"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              title="Sil"
                              className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </button>
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
      </Card>

      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing ? 'Ders Düzenle' : 'Yeni Ders Ekle'}</CardTitle>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              İptal
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Ders Kodu *</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="9-cografya"
                  maxLength={64}
                  readOnly={!!editing}
                  disabled={!!editing}
                />
                {editing && (
                  <p className="mt-1 text-xs text-muted-foreground">Ders kodu güncellemede değiştirilemez.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ders Adı *</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Coğrafya"
                  maxLength={256}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {variant === 'bilsem' ? 'Örgün düzey min (1–12)' : 'Sınıf Min (1–12)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={form.grade_min}
                  onChange={(e) => setForm((f) => ({ ...f, grade_min: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Boş = tümü"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  {variant === 'bilsem' ? 'Örgün düzey max (1–12)' : 'Sınıf Max (1–12)'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={form.grade_max}
                  onChange={(e) => setForm((f) => ({ ...f, grade_max: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Boş = tümü"
                />
              </div>
              {variant === 'bilsem' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Yetenek Alanı (Ana Grup)</label>
                  <select
                    value={form.ana_grup}
                    onChange={(e) => setForm((f) => ({ ...f, ana_grup: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Seçin (BİLSEM için)</option>
                    {BILSEM_ANA_GRUPLAR.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Bölüm Filtresi</label>
                <select
                  value={form.section_filter}
                  onChange={(e) => setForm((f) => ({ ...f, section_filter: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {SECTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sıra</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-input"
              />
              Aktif (listede görünsün)
            </label>

            <div className="rounded-lg border border-border p-4">
              <p className="mb-2 text-sm font-medium text-foreground">
                {variant === 'bilsem'
                  ? 'Haftalık ders saatleri (örgün 1–12. sınıf bazlı)'
                  : 'Haftalık ders saatleri (sınıf bazlı)'}
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {variant === 'bilsem'
                  ? 'BİLSEM program uygulama tablosundaki alanlar için örgün sınıf düzeyine göre planlanır. MEB varsayılanları otomatik doldurulur.'
                  : 'Yıllık plan ve GPT taslak üretiminde kullanılır. MEB varsayılanları otomatik doldurulur; gerektiğinde düzenleyin.'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => {
                  const key = normalizeDersSaatiKey(form.code);
                  const hasDefault = DERS_SAATI_DEFAULTS[key]?.[g] != null;
                  return (
                    <div key={g} className="flex items-center gap-1">
                      <label className="text-xs text-muted-foreground">{g}.</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        className={cn(
                          'w-12 rounded border border-input bg-background px-1 py-1 text-center text-xs',
                          !hasDefault && 'bg-muted/50 text-muted-foreground',
                        )}
                        value={getFormDersSaati(g) || ''}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setFormDersSaati(g, Number.isFinite(v) ? v : 0);
                        }}
                        placeholder={hasDefault ? undefined : '–'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? '…' : editing ? 'Güncelle' : 'Kaydet'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                İptal
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
