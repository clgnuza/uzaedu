'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentUrlInput } from '@/components/document-url-input';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, FileText, Download } from 'lucide-react';
import { filterBilsemCatalogSubjects } from '@/lib/bilsem-catalog-subjects';

const FORMATS = [
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF' },
] as const;

/** API camelCase (fileUrl) veya snake_case; boş string ile ?? zincirinde kaybolmasın */
function pickTemplateFileUrl(row: Record<string, unknown>): string {
  for (const k of ['file_url', 'fileUrl'] as const) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

type DocumentTemplate = {
  id: string;
  type: string;
  sub_type: string | null;
  school_type: string | null;
  grade: number | null;
  section: string | null;
  subject_code: string | null;
  subject_label: string | null;
  curriculum_model: string | null;
  academic_year: string | null;
  version: string;
  file_url: string;
  file_format: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

type ListResponse = {
  total: number;
  page: number;
  limit: number;
  items: DocumentTemplate[];
};

type FormState = {
  type: string;
  sub_type: string;
  school_type: string;
  grade: string;
  section: string;
  subject_code: string;
  subject_label: string;
  academic_year: string;
  version: string;
  file_url: string;
  file_url_local: string;
  file_format: string;
  is_active: boolean;
  requires_merge: boolean;
  form_schema: string;
  sort_order: string;
};

type CatalogOptions = {
  evrak_types: { value: string; label: string }[];
  school_types: { value: string; label: string }[];
  sections: { value: string; label: string }[];
  sub_types: { value: string; label: string }[];
};

export type SablonlarTabProps = {
  fixedCurriculumModel?: 'bilsem';
  excludeCurriculumModel?: string;
};

const EMPTY_FORM: FormState = {
  type: '',
  sub_type: '',
  school_type: '',
  grade: '',
  section: '',
  subject_code: '',
  subject_label: '',
  academic_year: '',
  version: '1',
  file_url: '',
  file_url_local: '',
  file_format: 'docx',
  is_active: true,
  requires_merge: false,
  form_schema: '',
  sort_order: '',
};

export function SablonlarTab({ fixedCurriculumModel, excludeCurriculumModel }: SablonlarTabProps = {}) {
  const router = useRouter();
  const { token, me, loading: authLoading } = useAuth();
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filters, setFilters] = useState({
    type: '',
    grade: '',
    section: '',
    subject_code: '',
    active_only: true,
  });
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<CatalogOptions | null>(null);
  const [subjects, setSubjects] = useState<{ code: string; label: string }[]>([]);

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));

  const fetchList = useCallback(async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.section) params.set('section', filters.section);
      if (filters.subject_code) params.set('subject_code', filters.subject_code);
      if (fixedCurriculumModel) params.set('curriculum_model', fixedCurriculumModel);
      else if (excludeCurriculumModel) params.set('exclude_curriculum_model', excludeCurriculumModel);
      params.set('active_only', String(filters.active_only));
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await apiFetch<ListResponse>(`/document-templates?${params}`, { token });
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, canManage, filters, page, fixedCurriculumModel, excludeCurriculumModel]);

  const fetchCatalog = useCallback(
    async (evrakType?: string) => {
      if (!token || !canManage) return;
      try {
        const opts = await apiFetch<{
          evrak_types: { value: string; label: string }[];
          school_types: { value: string; label: string }[];
          sections: { value: string; label: string }[];
          sub_types: { value: string; label: string }[];
        }>(`/document-templates/options${evrakType ? `?type=${encodeURIComponent(evrakType)}` : ''}`, {
          token,
        });
        setCatalog((c) => ({
          evrak_types: opts.evrak_types ?? c?.evrak_types ?? [],
          school_types: opts.school_types ?? c?.school_types ?? [],
          sections: opts.sections ?? c?.sections ?? [],
          sub_types: opts.sub_types ?? [],
        }));
      } catch {
        setCatalog(null);
      }
    },
    [token, canManage]
  );

  const fetchSubjects = useCallback(
    async (grade?: number, section?: string) => {
      if (!token || !canManage) return;
      try {
        const params = new URLSearchParams();
        if (fixedCurriculumModel === 'bilsem') {
          params.set('curriculum_model', 'bilsem');
          if (section) params.set('section', section);
          const res = await apiFetch<{
            items: Array<{ code: string; label: string; ana_grup?: string | null }>;
          }>(`/document-templates/subjects?${params}`, { token });
          setSubjects(filterBilsemCatalogSubjects(res.items ?? []));
          return;
        }
        if (grade) params.set('grade', String(grade));
        if (section) params.set('section', section);
        const res = await apiFetch<{ items: { code: string; label: string }[] }>(
          `/document-templates/subjects?${params}`,
          { token }
        );
        setSubjects(res.items ?? []);
      } catch {
        setSubjects([]);
      }
    },
    [token, canManage, fixedCurriculumModel]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!canManage) {
      router.replace('/403');
      return;
    }
    fetchList();
    fetchCatalog(form.type || undefined);
  }, [authLoading, canManage, router, fetchList, fetchCatalog, form.type]);

  useEffect(() => {
    if (fixedCurriculumModel === 'bilsem') {
      fetchSubjects(undefined, form.section || undefined);
      return;
    }
    const g = form.grade ? parseInt(form.grade, 10) : undefined;
    if (g && g >= 1 && g <= 12) {
      fetchSubjects(g, form.section || undefined);
    } else {
      setSubjects([]);
    }
  }, [form.grade, form.section, fetchSubjects, fixedCurriculumModel]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = async (t: DocumentTemplate) => {
    if (!token) return;
    try {
      const full = await apiFetch<DocumentTemplate>(`/document-templates/${t.id}`, { token });
      const tt = full as Record<string, unknown>;
      setForm({
        type: (tt.type as string) ?? '',
        sub_type: (tt.sub_type ?? tt.subType) as string ?? '',
        school_type: (tt.school_type ?? tt.schoolType) as string ?? '',
        grade: tt.grade != null ? String(tt.grade) : '',
        section: (tt.section as string) ?? '',
        subject_code: (tt.subject_code ?? tt.subjectCode) as string ?? '',
        subject_label: (tt.subject_label ?? tt.subjectLabel) as string ?? '',
        academic_year: (tt.academic_year ?? tt.academicYear) as string ?? '',
        version: (tt.version as string) ?? '',
        file_url: pickTemplateFileUrl(tt),
        file_url_local: (() => {
          const loc = tt.file_url_local ?? tt.fileUrlLocal;
          return typeof loc === 'string' ? loc : '';
        })(),
        file_format: (tt.file_format ?? tt.fileFormat) as string ?? 'docx',
        is_active: (tt.is_active ?? tt.isActive) as boolean ?? true,
        requires_merge: (tt.requires_merge ?? tt.requiresMerge) as boolean ?? false,
        form_schema: Array.isArray(tt.form_schema ?? tt.formSchema)
          ? JSON.stringify((tt.form_schema ?? tt.formSchema) as unknown[], null, 2)
          : '',
        sort_order: tt.sort_order != null || tt.sortOrder != null ? String(tt.sort_order ?? tt.sortOrder) : '',
      });
      setEditing(full);
      setShowForm(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Şablon detayı alınamadı');
    }
  };

  const handleSave = async () => {
    if (!token) return;
    const editingRow = editing as Record<string, unknown> | null;
    const fileUrlResolved =
      form.file_url.trim() ||
      (editingRow ? pickTemplateFileUrl(editingRow) : '');
    const fileUrlLocalResolved =
      form.file_url_local.trim() ||
      (() => {
        const loc = editingRow?.file_url_local ?? editingRow?.fileUrlLocal;
        return typeof loc === 'string' ? loc.trim() : '';
      })();
    if (!fileUrlResolved && !fileUrlLocalResolved) {
      toast.error('Dosya URL veya R2 key girin veya yükleyin.');
      return;
    }
    if (!form.version.trim()) {
      toast.error('Sürüm girin.');
      return;
    }
    setSaving(true);
    try {
      let parsedFormSchema: Array<{ key: string; label: string; type: string; required?: boolean }> | undefined;
      if (form.form_schema.trim()) {
        try {
          const parsed = JSON.parse(form.form_schema);
          if (!Array.isArray(parsed)) parsedFormSchema = undefined;
          else {
            const valid = parsed.every(
              (item: unknown) =>
                item && typeof item === 'object' && 'key' in item && 'label' in item && 'type' in item
            );
            if (!valid || parsed.length === 0) {
              toast.error('Form şeması geçersiz. Her öğe {key, label, type} içermeli. Örnek: [{"key":"sinif","label":"Sınıf","type":"text","required":true}]');
              setSaving(false);
              return;
            }
            parsedFormSchema = parsed as Array<{ key: string; label: string; type: string; required?: boolean }>;
          }
        } catch {
          parsedFormSchema = undefined;
        }
      }
      const body = {
        type: form.type,
        sub_type: form.sub_type.trim() || undefined,
        school_type: form.school_type.trim() || undefined,
        grade: form.grade ? parseInt(form.grade, 10) : undefined,
        section: form.section.trim() || undefined,
        subject_code: form.subject_code.trim() || undefined,
        subject_label: form.subject_label.trim() || undefined,
        academic_year: form.academic_year.trim() || undefined,
        version: form.version.trim(),
        ...(fileUrlResolved || !editing ? { file_url: fileUrlResolved || fileUrlLocalResolved } : {}),
        ...(fileUrlLocalResolved ? { file_url_local: fileUrlLocalResolved } : {}),
        file_format: form.file_format,
        is_active: form.is_active,
        requires_merge: form.requires_merge,
        form_schema: parsedFormSchema,
        sort_order: form.sort_order ? parseInt(form.sort_order, 10) : undefined,
        ...(fixedCurriculumModel ? { curriculum_model: fixedCurriculumModel } : {}),
      };
      if (editing) {
        await apiFetch(`/document-templates/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Şablon güncellendi');
      } else {
        await apiFetch('/document-templates', {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Şablon eklendi');
      }
      setShowForm(false);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Bu şablonu silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/document-templates/${id}`, { method: 'DELETE', token });
      toast.success('Şablon silindi');
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
  };

  const handleDownload = async (id: string) => {
    if (!token) return;
    try {
      const res = await apiFetch<{ download_url: string; filename: string }>(
        `/document-templates/${id}/download`,
        { token },
      );
      window.open(res.download_url, '_blank');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }
  if (!canManage) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {fixedCurriculumModel === 'bilsem' ? 'Bilsem Word şablonları' : 'Evrak Şablonları'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {fixedCurriculumModel === 'bilsem'
              ? 'curriculum_model = bilsem ile okul yöneticisinin yüklediği Bilsem yıllık plan Word şablonları.'
              : 'Yıllık plan, günlük plan, zümre vb. evrak şablonlarını yönetin.'}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" />
          Yeni Şablon
        </button>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tüm türler</option>
            {catalog?.evrak_types?.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={filters.grade}
            onChange={(e) => setFilters((f) => ({ ...f, grade: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tüm sınıflar</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
              <option key={g} value={g}>
                {g}. Sınıf
              </option>
            ))}
          </select>
          <select
            value={filters.section}
            onChange={(e) => setFilters((f) => ({ ...f, section: e.target.value }))}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tüm bölümler</option>
            {catalog?.sections?.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.active_only}
              onChange={(e) => setFilters((f) => ({ ...f, active_only: e.target.checked }))}
              className="rounded border-input"
            />
            Sadece aktifler
          </label>
        </CardContent>
      </Card>

      {/* Form modal */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{editing ? 'Şablon Düzenle' : 'Yeni Şablon'}</CardTitle>
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
                <label className="mb-1 block text-sm font-medium">Evrak Türü</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Evrak türü seçin</option>
                  {catalog?.evrak_types?.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sürüm</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="1 veya 2024-1"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Sınıf (1-12)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  placeholder="Boş = tüm"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bölüm</label>
                <select
                  value={form.section}
                  onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {catalog?.sections?.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Okul Türü (zümre)</label>
                <select
                  value={form.school_type}
                  onChange={(e) => setForm((f) => ({ ...f, school_type: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {catalog?.school_types?.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Alt Tür</label>
                {catalog?.sub_types?.length ? (
                  <select
                    value={form.sub_type}
                    onChange={(e) => setForm((f) => ({ ...f, sub_type: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {catalog.sub_types.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.sub_type}
                    onChange={(e) => setForm((f) => ({ ...f, sub_type: e.target.value }))}
                    placeholder="İsteğe bağlı"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Ders</label>
              {subjects.length > 0 ? (
                <select
                  value={
                    form.subject_code
                      ? subjects.find((s) => s.code === form.subject_code)
                        ? form.subject_code
                        : ''
                      : ''
                  }
                  onChange={(e) => {
                    const sel = subjects.find((s) => s.code === e.target.value);
                    setForm((f) => ({
                      ...f,
                      subject_code: sel?.code ?? '',
                      subject_label: sel?.label ?? '',
                    }));
                  }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— Seçin</option>
                  {subjects.map((s, i) => (
                    <option key={`${s.code}-${i}`} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    value={form.subject_code}
                    onChange={(e) => setForm((f) => ({ ...f, subject_code: e.target.value }))}
                    placeholder="Ders kodu (sınıf/bölüm seçin)"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={form.subject_label}
                    onChange={(e) => setForm((f) => ({ ...f, subject_label: e.target.value }))}
                    placeholder="Ders etiketi"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              )}
              {subjects.length === 0 &&
                (fixedCurriculumModel === 'bilsem' || form.grade || form.section) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {fixedCurriculumModel === 'bilsem'
                    ? 'Bilsem ders kataloğu boş; önce Bilsem Ayarlar’dan Ek-1 derslerini yükleyin veya elle girin.'
                    : 'Bu sınıf/bölüm için katalogda ders yok; elle girebilirsiniz.'}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Öğretim Yılı</label>
              <input
                type="text"
                value={form.academic_year}
                onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                placeholder="2024-2025"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Dosya (R2 key veya URL) *</label>
              <DocumentUrlInput
                id="doc-file"
                value={form.file_url}
                onChange={(v) => setForm((f) => ({ ...f, file_url: v }))}
                token={token}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Yükle ile R2&apos;ye yükleyin veya tam URL yapıştırın.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Yerel Fallback (opsiyonel)</label>
              <input
                type="text"
                value={form.file_url_local}
                onChange={(e) => setForm((f) => ({ ...f, file_url_local: e.target.value }))}
                placeholder="local:ornek-yillik-plan-cografya.xlsx"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                R2 başarısız olursa kullanılır; backend/templates/ altındaki dosya adı (local: ile başlar).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Dosya Formatı</label>
                <select
                  value={form.file_format}
                  onChange={(e) => setForm((f) => ({ ...f, file_format: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Sıra</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  placeholder="Küçük = üstte"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
              Aktif
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.requires_merge}
                onChange={(e) => setForm((f) => ({ ...f, requires_merge: e.target.checked }))}
                className="rounded border-input"
              />
              Form + Merge (evrak üret)
            </label>
            {form.requires_merge && (
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-medium">Form Şeması (JSON)</label>
                <textarea
                  value={form.form_schema}
                  onChange={(e) => setForm((f) => ({ ...f, form_schema: e.target.value }))}
                  rows={6}
                  placeholder='[{"key":"sinif","label":"Sınıf","type":"text","required":true},...]'
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm"
                />
              </div>
            )}
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

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5" />
            Şablonlar ({data?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner className="size-8" />
            </div>
          ) : !data?.items?.length ? (
            <EmptyState
              icon={<FileText className="size-10 text-muted-foreground" />}
              title="Henüz şablon yok"
              description="Yeni şablon ekleyerek başlayın. Öğretmenler evrak türü, sınıf ve ders seçerek şablonu indirebilir."
            />
          ) : (
            <div className="table-x-scroll rounded-lg border border-border">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Tür</th>
                    <th>Sınıf</th>
                    <th>Ders</th>
                    <th>Sürüm</th>
                    <th>Format</th>
                    <th>Durum</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2">
                        {catalog?.evrak_types?.find((x) => x.value === t.type)?.label ?? t.type}
                      </td>
                      <td className="px-3 py-2">{t.grade ? `${t.grade}. Sınıf` : '—'}</td>
                      <td className="px-3 py-2">
                        {String((t as Record<string, unknown>).subject_label ?? (t as Record<string, unknown>).subjectLabel ?? (t as Record<string, unknown>).subject_code ?? (t as Record<string, unknown>).subjectCode ?? '—')}
                      </td>
                      <td className="px-3 py-2">{t.version}</td>
                      <td className="px-3 py-2">
                        {String((t as Record<string, unknown>).file_format ?? (t as Record<string, unknown>).fileFormat ?? '—')}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            ((t as Record<string, unknown>).is_active ?? (t as Record<string, unknown>).isActive)
                              ? 'rounded bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'rounded bg-muted px-2 py-0.5 text-muted-foreground'
                          }
                        >
                          {((t as Record<string, unknown>).is_active ?? (t as Record<string, unknown>).isActive) ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDownload(t.id)}
                            title="İndir"
                            className="rounded p-1.5 hover:bg-muted"
                          >
                            <Download className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void openEdit(t)}
                            title="Düzenle"
                            className="rounded p-1.5 hover:bg-muted"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id)}
                            title="Sil"
                            className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
