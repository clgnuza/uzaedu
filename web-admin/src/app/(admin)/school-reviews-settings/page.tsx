'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type SchoolReviewCriteria = {
  id: string;
  slug: string;
  label: string;
  hint: string | null;
  sort_order: number;
  min_score: number;
  max_score: number;
  is_active: boolean;
};

type SchoolReviewsConfig = {
  enabled: boolean;
  rating_min: number;
  rating_max: number;
  moderation_mode: 'auto' | 'moderation';
  allow_questions: boolean;
  questions_require_moderation: boolean;
};

function canAccessSchoolReviewsSettings(role: string | undefined): boolean {
  return role === 'superadmin' || role === 'moderator';
}

export default function SchoolReviewsSettingsPage() {
  const router = useRouter();
  const { token, me, loading: authLoading } = useAuth();
  const isSuperadmin = me?.role === 'superadmin';
  const [config, setConfig] = useState<SchoolReviewsConfig | null>(null);
  const [criteria, setCriteria] = useState<SchoolReviewCriteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<SchoolReviewsConfig>>({});
  const [criteriaForm, setCriteriaForm] = useState<Partial<SchoolReviewCriteria> & { slug?: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    if (authLoading || !canAccessSchoolReviewsSettings(me?.role)) return;
    setLoading(true);
    try {
      const [configData, criteriaData] = await Promise.all([
        apiFetch<SchoolReviewsConfig>('/app-config/school-reviews', { token: token ?? undefined }),
        apiFetch<SchoolReviewCriteria[]>('/school-reviews/criteria/admin', { token: token ?? undefined }),
      ]);
      setConfig(configData);
      setCriteria(criteriaData);
      setForm({
        enabled: configData.enabled,
        rating_min: configData.rating_min,
        rating_max: configData.rating_max,
        moderation_mode: configData.moderation_mode,
        allow_questions: configData.allow_questions,
        questions_require_moderation: configData.questions_require_moderation,
      });
      setLoadError(false);
    } catch {
      setConfig(null);
      setCriteria([]);
      setLoadError(true);
      toast.error('Ayarlar yüklenemedi veya yetkiniz yok.');
    } finally {
      setLoading(false);
    }
  }, [authLoading, me?.role, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccessSchoolReviewsSettings(me?.role)) {
      router.replace('/403');
      return;
    }
    fetchConfig();
  }, [authLoading, me?.role, router, fetchConfig]);

  const handleSave = async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    const min = form.rating_min ?? config?.rating_min ?? 1;
    const max = form.rating_max ?? config?.rating_max ?? 10;
    if (min > max) {
      toast.error('Minimum puan, maksimum puandan büyük olamaz.');
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<SchoolReviewsConfig> = {
        rating_min: form.rating_min,
        rating_max: form.rating_max,
        moderation_mode: form.moderation_mode,
        allow_questions: form.allow_questions,
        questions_require_moderation: form.questions_require_moderation,
      };
      if (isSuperadmin) payload.enabled = form.enabled;
      await apiFetch('/app-config/school-reviews', {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
      toast.success('Okul değerlendirme ayarları kaydedildi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const sortedCriteria = useMemo(
    () =>
      [...criteria].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.label.localeCompare(b.label, 'tr');
      }),
    [criteria],
  );

  const moveCriterion = async (index: number, dir: -1 | 1) => {
    if (!token) return;
    const j = index + dir;
    if (j < 0 || j >= sortedCriteria.length) return;
    const arr = [...sortedCriteria];
    const [item] = arr.splice(index, 1);
    arr.splice(j, 0, item);
    try {
      await Promise.all(
        arr.map((c, i) =>
          apiFetch(`/school-reviews/criteria/${c.id}`, {
            method: 'PATCH',
            token,
            body: JSON.stringify({ sort_order: i }),
          }),
        ),
      );
      toast.success('Sıra güncellendi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıra değişmedi');
    }
  };

  const toggleCriterionActive = async (c: SchoolReviewCriteria) => {
    if (!token) return;
    try {
      await apiFetch(`/school-reviews/criteria/${c.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      toast.success(c.is_active ? 'Kriter pasif; öğretmen formunda görünmez.' : 'Kriter tekrar aktif.');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleNormalizeCriteriaScores = async () => {
    if (!token || !canAccessSchoolReviewsSettings(me?.role)) return;
    if (!confirm('Tüm kriterlerde min=1, max=10 olarak güncellenecek (başlık/slug silinmez). Devam?')) return;
    try {
      await apiFetch('/school-reviews/criteria/normalize-score-range', { method: 'POST', token });
      toast.success('Kriter puan aralıkları 1–10 yapıldı');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const handleReseedDefaultCriteria = async () => {
    if (!token || !isSuperadmin) return;
    if (
      !confirm(
        'Mevcut tüm kriter satırları silinir ve 8 yeni varsayılan kriter (1–10) yüklenir. Eski değerlendirmelerdeki kriter puanları (slug) artık eşleşmeyebilir. Devam edilsin mi?'
      )
    )
      return;
    try {
      await apiFetch('/school-reviews/criteria/reseed-defaults', { method: 'POST', token });
      toast.success('Varsayılan kriterler yüklendi');
      fetchConfig();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }
  if (me?.role && !canAccessSchoolReviewsSettings(me.role)) return null;
  if (loadError && !config) {
    return (
      <div className="space-y-4">
        <Alert variant="error" message="Ayarlar yüklenemedi. Oturum ve yetkilerinizi kontrol edin." />
        <button
          type="button"
          onClick={() => fetchConfig()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Yeniden dene
        </button>
      </div>
    );
  }
  if (loading || !config) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-foreground">Okul Değerlendirme Ayarları</h1>
          <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
            Puanlama 1–10
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Modül anahtarı, moderasyon, soru-cevap ve değerlendirme kriterleri (süper yönetici: varsayılan kriterleri yeniden yükleme).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modül Durumu</CardTitle>
          <p className="text-sm text-muted-foreground">
            Modül kapalıyken öğretmenler okul listesine erişemez ve değerlendirme yapamaz.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            className={`flex items-center gap-3 ${isSuperadmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
          >
            <input
              type="checkbox"
              disabled={!isSuperadmin}
              checked={form.enabled ?? config.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              className="size-4 rounded border-border disabled:cursor-not-allowed"
            />
            <span className="text-sm font-medium">Modülü aç</span>
          </label>
          {!isSuperadmin && (
            <p className="text-xs text-muted-foreground">
              Modülü açıp kapatma yalnızca süper yönetici tarafından yapılabilir.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Değerlendirme (Puan) Ayarları</CardTitle>
          <p className="text-sm text-muted-foreground">
            Genel tek puan modunda aralık 1–10 olmalıdır (kriter varken her kritere ayrı 1–10).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Minimum puan</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.rating_min ?? config.rating_min}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating_min: parseInt(e.target.value, 10) || 1 }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Maksimum puan</label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.rating_max ?? config.rating_max}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating_max: parseInt(e.target.value, 10) || 10 }))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Moderasyon modu</label>
            <select
              value={form.moderation_mode ?? config.moderation_mode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  moderation_mode: e.target.value as 'auto' | 'moderation',
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="auto">
                Otomatik yayın – Değerlendirmeler anında yayınlanır
              </option>
              <option value="moderation">
                Moderasyon – Değerlendirmeler onay sonrası yayınlanır
              </option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soru / Cevap Ayarları</CardTitle>
          <p className="text-sm text-muted-foreground">
            Öğretmenler okullar hakkında soru sorabilir; diğer öğretmenler cevap verebilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.allow_questions ?? config.allow_questions}
              onChange={(e) => setForm((f) => ({ ...f, allow_questions: e.target.checked }))}
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Soru özelliğini aç</span>
          </label>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.questions_require_moderation ?? config.questions_require_moderation}
              onChange={(e) =>
                setForm((f) => ({ ...f, questions_require_moderation: e.target.checked }))
              }
              className="size-4 rounded border-border"
            />
            <span className="text-sm font-medium">Sorular moderasyondan geçsin</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Değerlendirme Kriterleri</CardTitle>
              <p className="text-sm text-muted-foreground">
                Varsayılan kriterler 1–10 puan ölçeğindedir. Kriter yoksa tek genel puan (yukarıdaki aralık) kullanılır.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleNormalizeCriteriaScores}
                className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
              >
                Tüm kriterleri 1–10 yap
              </button>
              {isSuperadmin && (
                <button
                  type="button"
                  onClick={handleReseedDefaultCriteria}
                  className="rounded-md border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
                >
                  Varsayılan kriterleri yeniden yükle
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {criteriaForm ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Slug (sadece yeni kritere)</label>
                <input
                  type="text"
                  value={criteriaForm.slug ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="sosyo_ekonomik"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  readOnly={!!criteriaForm.id}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Başlık</label>
                <input
                  type="text"
                  value={criteriaForm.label ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Lokasyonun Sosyo-Ekonomik Durumu"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">İpucu (opsiyonel)</label>
                <input
                  type="text"
                  value={criteriaForm.hint ?? ''}
                  onChange={(e) => setCriteriaForm((f) => ({ ...f, hint: e.target.value || undefined }))}
                  placeholder="1 = en pahalı"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Sıra (0 = ilk)</label>
                  <input
                    type="number"
                    min={0}
                    value={criteriaForm.sort_order ?? 0}
                    onChange={(e) =>
                      setCriteriaForm((f) => ({
                        ...f,
                        sort_order: Math.max(0, parseInt(e.target.value, 10) || 0),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex cursor-pointer items-end gap-2 pb-2">
                  <input
                    type="checkbox"
                    checked={criteriaForm.is_active !== false}
                    onChange={(e) => setCriteriaForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="size-4 rounded border-border"
                  />
                  <span className="text-sm font-medium">Aktif (formda göster)</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Min puan</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={criteriaForm.min_score ?? 1}
                    onChange={(e) =>
                      setCriteriaForm((f) => ({
                        ...f,
                        min_score: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Max puan</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={criteriaForm.max_score ?? 10}
                    onChange={(e) =>
                      setCriteriaForm((f) => ({
                        ...f,
                        max_score: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 10)),
                      }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    try {
                      if (criteriaForm.id) {
                        await apiFetch(`/school-reviews/criteria/${criteriaForm.id}`, {
                          method: 'PATCH',
                          token,
                          body: JSON.stringify({
                            label: criteriaForm.label,
                            hint: criteriaForm.hint || null,
                            sort_order: criteriaForm.sort_order ?? 0,
                            min_score: criteriaForm.min_score ?? 1,
                            max_score: criteriaForm.max_score ?? 10,
                            is_active: criteriaForm.is_active !== false,
                          }),
                        });
                        toast.success('Kriter güncellendi');
                      } else if (criteriaForm.slug && criteriaForm.label) {
                        await apiFetch('/school-reviews/criteria', {
                          method: 'POST',
                          token,
                          body: JSON.stringify({
                            slug: criteriaForm.slug.trim().toLowerCase().replace(/\s+/g, '_'),
                            label: criteriaForm.label.trim(),
                            hint: criteriaForm.hint?.trim() || null,
                            sort_order:
                              criteriaForm.sort_order ??
                              (criteria.length ? Math.max(...criteria.map((x) => x.sort_order)) + 1 : 0),
                            min_score: criteriaForm.min_score ?? 1,
                            max_score: criteriaForm.max_score ?? 10,
                            is_active: criteriaForm.is_active !== false,
                          }),
                        });
                        toast.success('Kriter eklendi');
                      }
                      setCriteriaForm(null);
                      fetchConfig();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Hata');
                    }
                  }}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setCriteriaForm(null)}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
                >
                  İptal
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setCriteriaForm({
                  slug: '',
                  label: '',
                  hint: null,
                  min_score: 1,
                  max_score: 10,
                  is_active: true,
                  sort_order: criteria.length ? Math.max(...criteria.map((x) => x.sort_order)) + 1 : 0,
                })
              }
              className="flex items-center gap-2 rounded-md border border-dashed border-primary/50 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              <Plus className="size-4" />
              Yeni kriter ekle
            </button>
          )}
          <ul className="divide-y divide-border">
            {sortedCriteria.map((c, index) => (
              <li
                key={c.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 sm:flex-nowrap',
                  !c.is_active && 'opacity-65',
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveCriterion(index, -1)}
                      disabled={index === 0}
                      className="rounded p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Yukarı taşı"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCriterion(index, 1)}
                      disabled={index === sortedCriteria.length - 1}
                      className="rounded p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Aşağı taşı"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                  </div>
                  <div className="min-w-0">
                    <span className="font-medium">{c.label}</span>
                    {c.hint && <span className="ml-2 text-sm text-muted-foreground">({c.hint})</span>}
                    <span className="ml-2 text-xs text-muted-foreground">#{c.slug}</span>
                    <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                      {c.min_score}–{c.max_score}
                    </span>
                    {!c.is_active && (
                      <span className="ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-900 dark:text-amber-100">
                        Pasif
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={c.is_active}
                      onChange={() => toggleCriterionActive(c)}
                      className="size-3.5 rounded border-border"
                    />
                    Aktif
                  </label>
                  <button
                    type="button"
                    onClick={() => setCriteriaForm({ ...c })}
                    className="rounded p-1.5 hover:bg-muted"
                    aria-label="Düzenle"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!token || !confirm('Bu kriteri silmek istediğinize emin misiniz?')) return;
                      try {
                        await apiFetch(`/school-reviews/criteria/${c.id}`, { method: 'DELETE', token });
                        toast.success('Kriter silindi');
                        fetchConfig();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Silinemedi');
                      }
                    }}
                    className="rounded p-1.5 text-destructive hover:bg-destructive/10"
                    aria-label="Sil"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {criteria.length === 0 && !criteriaForm && (
            <p className="text-sm text-muted-foreground">Henüz kriter yok. Eklediğinizde öğretmenler her kritere ayrı puan verir.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      <Alert variant="info">
        <p className="font-medium">Önerilen ayarlar</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
          <li>6–10 kriter: formu uzatmadan yeterli ayrıntı.</li>
          <li>Tüm kriterlerde min–max’ı aynı tutun (örn. 1–10).</li>
          <li>Geçici kapatma için silmek yerine &quot;Pasif&quot; kullanın (slug/puan geçmişi korunur).</li>
          <li>Moderasyonu önce test ortamında deneyin; canlıda &quot;Otomatik yayın&quot; risklidir.</li>
          <li>&quot;Varsayılan kriterleri yeniden yükle&quot; mevcut satırları siler; yalnızca sıfırdan kurulumda kullanın.</li>
        </ul>
      </Alert>

      <Alert
        variant="info"
        message="Okul yöneticisi yalnızca kendi okulunun raporunu görür. Modül anahtarı (aç/kapa) yalnızca süper yönetici içindir; moderatör diğer ayarları güncelleyebilir."
      />
    </div>
  );
}
