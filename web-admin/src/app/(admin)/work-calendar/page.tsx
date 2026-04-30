'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, createFetchTimeoutSignal, isAbortError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, CalendarClock, Sparkles } from 'lucide-react';

const MEB_YEARS = ['2024-2025', '2025-2026'];

type WorkCalendarItem = {
  id: string;
  academic_year: string;
  week_order: number;
  week_start: string;
  week_end: string;
  ay: string;
  hafta_label: string | null;
  is_tatil: boolean;
  tatil_label: string | null;
  sinav_etiketleri?: string | null;
  sort_order: number | null;
};

function getAcademicYears(): string[] {
  const years: string[] = [];
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = -1; i < 5; i++) {
    const y = startYear + i;
    years.push(`${y}-${y + 1}`);
  }
  return years.sort((a, b) => b.localeCompare(a));
}

const AYLAR = [
  'EYLÜL', 'EKİM', 'KASIM', 'ARALIK', 'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
];

const DEFAULT_YEAR_STORAGE_KEY = 'ogretmenpro_work_calendar_default_year';

function getInitialAcademicYear(): string {
  if (typeof window === 'undefined') return '2025-2026';
  try {
    const saved = localStorage.getItem(DEFAULT_YEAR_STORAGE_KEY);
    const years = getAcademicYears();
    if (saved && years.includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return getAcademicYears()[0] ?? '2025-2026';
}

export default function WorkCalendarPage() {
  const embedded = false;
  const router = useRouter();
  const { token, me, loading: authLoading } = useAuth();
  const [items, setItems] = useState<WorkCalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [academicYear, setAcademicYear] = useState(() => getInitialAcademicYear());
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WorkCalendarItem | null>(null);
  const [form, setForm] = useState({
    academic_year: '',
    week_order: '',
    week_start: '',
    week_end: '',
    ay: 'EYLÜL',
    hafta_label: '',
    is_tatil: false,
    tatil_label: '',
    sinav_etiketleri: '',
    sort_order: '',
  });
  const [saving, setSaving] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [gptGenerating, setGptGenerating] = useState(false);
  const [gptDraft, setGptDraft] = useState<WorkCalendarItem[] | null>(null);

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));

  const fetchList = useCallback(async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const params = academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : '';
      const res = await apiFetch<{ items: WorkCalendarItem[] }>(`/work-calendar${params}`, { token });
      setItems(res.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, canManage, academicYear]);

  useEffect(() => {
    if (authLoading) return;
    if (!canManage) {
      router.replace('/403');
      return;
    }
    fetchList();
  }, [authLoading, canManage, router, fetchList]);

  const openCreate = () => {
    setEditing(null);
    setGptDraft(null);
    setForm({
      academic_year: academicYear || getAcademicYears()[0] || '',
      week_order: '',
      week_start: '',
      week_end: '',
      ay: 'EYLÜL',
      hafta_label: '',
      is_tatil: false,
      tatil_label: '',
      sinav_etiketleri: '',
      sort_order: '',
    });
    setShowForm(true);
  };

  const openEdit = (item: WorkCalendarItem) => {
    const i = item as Record<string, unknown>;
    setEditing(item);
    setGptDraft(null);
    setForm({
      academic_year: (i.academic_year ?? i.academicYear) as string,
      week_order: String(i.week_order ?? i.weekOrder ?? ''),
      week_start: (i.week_start ?? i.weekStart) as string,
      week_end: (i.week_end ?? i.weekEnd) as string,
      ay: (i.ay as string) ?? 'EYLÜL',
      hafta_label: (i.hafta_label ?? i.haftaLabel) as string ?? '',
      is_tatil: (i.is_tatil ?? i.isTatil) as boolean ?? false,
      tatil_label: (i.tatil_label ?? i.tatilLabel) as string ?? '',
      sinav_etiketleri: (i.sinav_etiketleri ?? i.sinavEtiketleri) as string ?? '',
      sort_order: i.sort_order != null || i.sortOrder != null ? String(i.sort_order ?? i.sortOrder) : '',
    });
    setShowForm(true);
  };

  const canGpt = academicYear && academicYear.length >= 9;
  const handleGptGenerate = async () => {
    if (!token || !canGpt) return;
    setGptGenerating(true);
    setGptDraft(null);
    try {
      const res = await apiFetch<{ items: WorkCalendarItem[] }>('/work-calendar/generate-draft', {
        method: 'POST',
        token,
        body: JSON.stringify({ academic_year: academicYear }),
        signal: createFetchTimeoutSignal(480_000),
      });
      setGptDraft(res.items ?? []);
      toast.success(`${res.items?.length ?? 0} haftalık taslak oluşturuldu. Kaydedebilirsiniz.`);
    } catch (e) {
      if (isAbortError(e)) {
        toast.error('Taslak oluşturma zaman aşımı (8 dk). Tekrar deneyin.');
      } else {
        toast.error(e instanceof Error ? e.message : 'GPT taslağı oluşturulamadı.');
      }
    } finally {
      setGptGenerating(false);
    }
  };

  const canBulkDelete = academicYear && items.length > 0;
  const handleBulkDelete = async () => {
    if (!token || !canBulkDelete) return;
    if (!confirm(`Bu öğretim yılı (${academicYear}) için tüm takvim (${items.length} hafta) silinecek. Devam edilsin mi?`)) return;
    try {
      const res = await apiFetch<{ deleted: number }>('/work-calendar/bulk-delete', {
        method: 'POST',
        token,
        body: JSON.stringify({ academic_year: academicYear }),
      });
      toast.success(`${res.deleted ?? 0} kayıt silindi.`);
      setGptDraft(null);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Toplu silme başarısız.');
    }
  };

  const handleSyncFromMeb = async () => {
    if (!token || !academicYear) return;
    if (items.length > 0 && !confirm(`Bu yıl için mevcut takvim silinip MEB takvimi (seminer dahil) ile değiştirilecek. Devam?`)) return;
    setSaving(true);
    try {
      const res = await apiFetch<{ created: number; message?: string }>('/work-calendar/sync-from-meb', {
        method: 'POST',
        token,
        body: JSON.stringify({ academic_year: academicYear }),
      });
      toast.success(res.message ?? `${res.created} hafta güncellendi`);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedAcademicCalendar = async () => {
    if (!token || !academicYear) return;
    if (!confirm(`Bu yıl için akademik takvim şablonu (Belirli Günler + Öğretmen İşleri, seminer dahil) güncellenecek. Eksik öğeler eklenecek, mevcut içerik ve görevlendirmeler korunacak. Devam?`)) return;
    setSeedLoading(true);
    try {
      const res = await apiFetch<{ seeded: number }>('/seed/academic-calendar', {
        method: 'POST',
        token,
        body: JSON.stringify({ academic_year: academicYear }),
      });
      toast.success(`${res.seeded ?? 0} akademik takvim öğesi oluşturuldu.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Şablon doldurulamadı (yerel ortam gerekebilir).');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!token || !gptDraft?.length) return;
    if (items.length > 0 && !confirm('Bu yıl için mevcut takvim silinip taslak ile değiştirilecek. Devam edilsin mi?')) return;
    setSaving(true);
    try {
      await apiFetch('/work-calendar/save-draft', {
        method: 'POST',
        token,
        body: JSON.stringify({
          academic_year: academicYear,
          items: gptDraft.map((i) => ({
            week_order: i.week_order,
            week_start: i.week_start,
            week_end: i.week_end,
            ay: i.ay,
            hafta_label: i.hafta_label,
            is_tatil: i.is_tatil,
            tatil_label: i.tatil_label,
            sinav_etiketleri: (i as Record<string, unknown>).sinav_etiketleri ?? (i as Record<string, unknown>).sinavEtiketleri ?? null,
          })),
        }),
      });
      toast.success(`${gptDraft.length} hafta kaydedildi.`);
      setGptDraft(null);
      fetchList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    if (!form.academic_year.trim()) {
      toast.error('Öğretim yılı girin.');
      return;
    }
    if (!form.week_order.trim() || !form.week_start || !form.week_end) {
      toast.error('Hafta sırası, başlangıç ve bitiş tarihi zorunludur.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        academic_year: form.academic_year.trim(),
        week_order: parseInt(form.week_order, 10),
        week_start: form.week_start,
        week_end: form.week_end,
        ay: form.ay,
        hafta_label: form.hafta_label.trim() || undefined,
        is_tatil: form.is_tatil,
        tatil_label: form.tatil_label.trim() || undefined,
        sinav_etiketleri: form.sinav_etiketleri.trim() || undefined,
        sort_order: form.sort_order ? parseInt(form.sort_order, 10) : undefined,
      };
      if (editing) {
        await apiFetch(`/work-calendar/${editing.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success('Kayıt güncellendi');
      } else {
        await apiFetch('/work-calendar', { method: 'POST', token, body: JSON.stringify(body) });
        toast.success('Kayıt eklendi');
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
    if (!token || !confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/work-calendar/${id}`, { method: 'DELETE', token });
      toast.success('Kayıt silindi');
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
  if (!canManage) return null;

  const academicYears = getAcademicYears();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {embedded ? (
            <h2 className="text-lg font-semibold text-foreground">Bilsem — MEB çalışma takvimi (referans)</h2>
          ) : (
            <h1 className="text-2xl font-semibold text-foreground">Çalışma Takvimi</h1>
          )}
          <p className="text-sm text-muted-foreground">
            {embedded
              ? 'Ulusal hafta çerçevesi; yıllık plan içerikleri ve evrak birleştirme bu takvime göre çalışır.'
              : 'Öğretim yılına göre hafta bazlı takvim. Yıllık plan merge için kullanılır.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="work-cal-year" className="text-sm font-medium text-muted-foreground">Öğretim Yılı</label>
            <select
              id="work-cal-year"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium"
            >
              {academicYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.setItem(DEFAULT_YEAR_STORAGE_KEY, academicYear);
                  toast.success(`${academicYear} varsayılan öğretim yılı olarak kaydedildi.`);
                } catch {
                  toast.error('Kaydedilemedi.');
                }
              }}
              className="text-xs text-muted-foreground hover:text-primary hover:underline"
              title="Sonraki ziyaretlerde bu yıl otomatik seçilsin"
            >
              Varsayılan yap
            </button>
          </div>
          <div className="h-6 w-px bg-border" aria-hidden />
          <div className="flex flex-wrap gap-2">
          {canGpt && MEB_YEARS.includes(academicYear) && (
            <>
              <button
                type="button"
                onClick={handleSyncFromMeb}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <CalendarClock className="size-5" />
                {saving ? 'Güncelleniyor…' : 'MEB ile Güncelle (Seminer Dahil)'}
              </button>
              <button
                type="button"
                onClick={handleSeedAcademicCalendar}
                disabled={seedLoading || saving}
                className="inline-flex items-center gap-2 rounded-lg border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                {seedLoading ? 'Dolduruluyor…' : 'Akademik Takvimi Doldur'}
              </button>
            </>
          )}
          {canGpt && (
            <button
              type="button"
              onClick={handleGptGenerate}
              disabled={gptGenerating}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            >
              <Sparkles className="size-5" />
              {gptGenerating ? 'Oluşturuluyor…' : MEB_YEARS.includes(academicYear) ? 'Taslak Önizle' : 'GPT ile Taslak Oluştur'}
            </button>
          )}
          {canBulkDelete && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-2 rounded-lg border border-destructive/60 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20"
            >
              <Trash2 className="size-5" />
              Tüm Takvimi Sil ({items.length})
            </button>
          )}
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-5" />
            Yeni Hafta Ekle
          </button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-5" />
            Haftalar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner className="size-8" />
            </div>
          ) : gptDraft ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  GPT taslağı — {gptDraft.length} hafta. Kaydedip uygulayabilir veya iptal edebilirsiniz.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? '…' : 'Kaydet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGptDraft(null)}
                    className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
                  >
                    İptal
                  </button>
                </div>
              </div>
              <div className="table-x-scroll max-h-[400px] overflow-y-auto rounded-lg border border-border">
                <table className="evrak-admin-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Hafta</th>
                      <th>Başlangıç</th>
                      <th>Bitiş</th>
                      <th>Ay</th>
                      <th>Etiket</th>
                      <th>Tatil</th>
                      <th>Sınav</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gptDraft.map((i, idx) => (
                      <tr key={idx}>
                        <td>{i.week_order}</td>
                        <td>{i.week_start}</td>
                        <td>{i.week_end}</td>
                        <td>{i.ay}</td>
                        <td className="max-w-[160px] truncate">{i.hafta_label || '—'}</td>
                        <td>{i.is_tatil ? (i.tatil_label || 'Tatil') : '—'}</td>
                        <td className="max-w-[140px] truncate text-muted-foreground">
                          {(() => {
                            const v =
                              (i as Record<string, unknown>).sinav_etiketleri ??
                              (i as Record<string, unknown>).sinavEtiketleri;
                            return typeof v === 'string' && v.trim() ? v : '—';
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !items.length ? (
            <EmptyState
              icon={<CalendarClock className="size-10 text-muted-foreground" />}
              title="Henüz kayıt yok"
              description="Öğretim yılına göre hafta takvimi ekleyin. Yıllık plan üretiminde hafta tarihleri buradan alınır."
            />
          ) : (
            <div className="table-x-scroll rounded-lg border border-border">
              <table className="evrak-admin-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Yıl</th>
                    <th>Hafta</th>
                    <th>Başlangıç</th>
                    <th>Bitiş</th>
                    <th>Ay</th>
                    <th>Etiket</th>
                    <th>Tatil</th>
                    <th>Sınav</th>
                    <th className="text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const i = item as Record<string, unknown>;
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{(i.academic_year ?? i.academicYear) as string}</td>
                        <td className="px-3 py-2">{String(i.week_order ?? i.weekOrder ?? '')}</td>
                        <td className="px-3 py-2">{(i.week_start ?? i.weekStart) as string}</td>
                        <td className="px-3 py-2">{(i.week_end ?? i.weekEnd) as string}</td>
                        <td className="px-3 py-2">{i.ay as string}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate">
                          {(i.hafta_label ?? i.haftaLabel) as string || '—'}
                        </td>
                        <td className="px-3 py-2">
                          {(i.is_tatil ?? i.isTatil) ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              {(i.tatil_label ?? i.tatilLabel) as string || 'Tatil'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[140px] truncate text-muted-foreground">
                          {(i.sinav_etiketleri ?? i.sinavEtiketleri) as string || '—'}
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
            <CardTitle>{editing ? 'Hafta Düzenle' : 'Yeni Hafta Ekle'}</CardTitle>
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
                <label className="mb-1 block text-sm font-medium">Öğretim Yılı *</label>
                <select
                  value={form.academic_year}
                  onChange={(e) => setForm((f) => ({ ...f, academic_year: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seçin</option>
                  {academicYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Hafta Sırası (1-36) *</label>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={form.week_order}
                  onChange={(e) => setForm((f) => ({ ...f, week_order: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Başlangıç Tarihi *</label>
                <input
                  type="date"
                  value={form.week_start}
                  onChange={(e) => setForm((f) => ({ ...f, week_start: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bitiş Tarihi *</label>
                <input
                  type="date"
                  value={form.week_end}
                  onChange={(e) => setForm((f) => ({ ...f, week_end: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ay</label>
                <select
                  value={form.ay}
                  onChange={(e) => setForm((f) => ({ ...f, ay: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  {AYLAR.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Hafta Etiketi</label>
                <input
                  type="text"
                  value={form.hafta_label}
                  onChange={(e) => setForm((f) => ({ ...f, hafta_label: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="1. Hafta: 8-12 Eylül"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_tatil}
                onChange={(e) => setForm((f) => ({ ...f, is_tatil: e.target.checked }))}
                className="rounded border-input"
              />
              Tatil haftası
            </label>
            {form.is_tatil && (
              <div>
                <label className="mb-1 block text-sm font-medium">Tatil Etiketi</label>
                <input
                  type="text"
                  value={form.tatil_label}
                  onChange={(e) => setForm((f) => ({ ...f, tatil_label: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="1. DÖNEM ARA TATİLİ: 10-14 Kasım"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Sınav Tarihleri (isteğe bağlı)</label>
              <input
                type="text"
                value={form.sinav_etiketleri}
                onChange={(e) => setForm((f) => ({ ...f, sinav_etiketleri: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                placeholder="Örn: 1. Dönem 1. Sınav: 15 Kasım"
              />
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
